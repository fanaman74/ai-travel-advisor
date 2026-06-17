import { Job } from 'bullmq'
import { getRedis } from '@/lib/redis'
import { query } from '@/lib/db'
import { toGeohash } from '@/lib/geo'
import {
  runGoogleMapsScraper,
  runGoogleMapsReviewsScraper,
  runTripAdvisorScraper,
  runEventbriteScraper,
} from '@/lib/apify'
import { mergePlaces } from './merge-places'
import { enrichInBatches } from './enrich-places'
import type { ScrapeLocationJobData } from '@/types'

const DEDUP_TTL = 86_400       // 24 hours in seconds
const JOB_STATUS_TTL = 7_200   // 2 hours

async function setProgress(redis: ReturnType<typeof getRedis>, jobId: string, pct: number) {
  await redis.setex(`job:${jobId}:status`, JOB_STATUS_TTL, pct.toString())
}

export async function processScrapeLocation(job: Job<ScrapeLocationJobData>) {
  const { jobId, lat, lng, radius } = job.data
  const redis = getRedis()
  const geohash = toGeohash(lat, lng)
  const lockKey = `scrape:lock:${geohash}`

  // Mark job as started in DB
  await query(
    `UPDATE scrape_jobs SET status = 'running', started_at = now() WHERE id = $1`,
    [jobId]
  )
  await setProgress(redis, jobId, 5)

  // Dedup check
  const existing = await redis.get(lockKey)
  if (existing) {
    await query(
      `UPDATE scrape_jobs SET status = 'completed', completed_at = now(), places_found = 0 WHERE id = $1`,
      [jobId]
    )
    await setProgress(redis, jobId, 100)
    return
  }

  // Run all Apify scrapers in parallel
  const [googlePlaces, tripAdvisorPlaces, eventbritePlaces] = await Promise.all([
    runGoogleMapsScraper({ lat, lng, radius }).catch(() => []),
    runTripAdvisorScraper({ lat, lng }).catch(() => []),
    runEventbriteScraper({ lat, lng }).catch(() => []),
  ])
  await setProgress(redis, jobId, 40)

  // Fetch reviews for top Google Maps places
  const topPlaceIds = googlePlaces
    .filter(p => p.placeId)
    .slice(0, 20)
    .map(p => p.placeId!)

  const reviewData = await runGoogleMapsReviewsScraper(topPlaceIds).catch(() => [])
  await setProgress(redis, jobId, 55)

  // Merge all places
  const allRaw = [...googlePlaces, ...tripAdvisorPlaces]
  const merged = mergePlaces(allRaw)
  await setProgress(redis, jobId, 65)

  // Build review map
  const reviewMap = new Map<string, string[]>()
  for (const rd of reviewData) {
    reviewMap.set(rd.placeId, rd.reviews.slice(0, 5).map(r => r.text).filter(Boolean))
  }

  // Enrich with DeepSeek
  const placesForAI = merged.map(p => ({
    name: p.name,
    type: 'attraction' as const,
    rating: p.rating,
    reviews: reviewMap.get(p.external_id ?? '') ?? [],
  }))
  const enrichments = await enrichInBatches(placesForAI)
  await setProgress(redis, jobId, 85)

  // Upsert places to DB
  for (let i = 0; i < merged.length; i++) {
    const p = merged[i]
    const e = enrichments[i]
    await query(
      `INSERT INTO places
        (name, type, category, latitude, longitude, rating, review_count,
         address, phone, website, opening_hours, photos, source, external_id,
         summary, pros, cons, best_for, visit_duration,
         hidden_gem_score, tourist_trap_score, ai_processed_at, scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now(),now())
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET
         rating = EXCLUDED.rating,
         summary = EXCLUDED.summary,
         pros = EXCLUDED.pros,
         cons = EXCLUDED.cons,
         best_for = EXCLUDED.best_for,
         hidden_gem_score = EXCLUDED.hidden_gem_score,
         tourist_trap_score = EXCLUDED.tourist_trap_score,
         ai_processed_at = now(),
         scraped_at = now(),
         updated_at = now()`,
      [
        p.name, 'attraction', p.category,
        p.latitude, p.longitude, p.rating, p.review_count,
        p.address, p.phone, p.website,
        JSON.stringify(p.opening_hours), JSON.stringify(p.photos),
        'google_maps', p.external_id,
        e?.summary ?? null, JSON.stringify(e?.pros ?? []),
        JSON.stringify(e?.cons ?? []), JSON.stringify(e?.best_for ?? []),
        e?.visit_duration ?? null, e?.hidden_gem_score ?? null, e?.tourist_trap_score ?? null,
      ]
    )
  }

  // Handle events separately
  for (const ev of eventbritePlaces) {
    if (!ev.title && !ev.name) continue
    await query(
      `INSERT INTO places (name, type, category, latitude, longitude, source, external_id, address, scraped_at)
       VALUES ($1,'event','event',$2,$3,'eventbrite',$4,$5,now())
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING`,
      [ev.name ?? ev.title, ev.latitude ?? lat, ev.longitude ?? lng, ev.placeId ?? null, ev.address ?? null]
    )
  }

  // Set dedup lock and finish
  await redis.setex(lockKey, DEDUP_TTL, '1')
  await query(
    `UPDATE scrape_jobs SET status = 'completed', completed_at = now(), places_found = $1 WHERE id = $2`,
    [merged.length, jobId]
  )
  await setProgress(redis, jobId, 100)
}
