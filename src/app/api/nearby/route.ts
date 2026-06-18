export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import { toGeohash } from '@/lib/geo'
import { arePlacesClose } from '@/lib/geo'
import { fetchOsmRestaurants } from '@/lib/osm'
import type { Place } from '@/types'

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function mergePlacesWithFallback(primary: Place[], fallback: Place[]): Place[] {
  const merged = [...primary]

  for (const candidate of fallback) {
    const candidateName = normaliseName(candidate.name)
    const duplicate = merged.some(place => (
      normaliseName(place.name) === candidateName
      && arePlacesClose(place.latitude, place.longitude, candidate.latitude, candidate.longitude, 75)
    ))

    if (!duplicate) {
      merged.push(candidate)
    }
  }

  return merged
    .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))
    .slice(0, 100)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const radius = parseInt(searchParams.get('radius') ?? '5000', 10)
  const type = searchParams.get('type') ?? null

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const redis = getRedis()
  const cacheKey = `places:${toGeohash(lat, lng)}:${radius}:${type ?? 'all'}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    return NextResponse.json({ places: JSON.parse(cached), cached: true })
  }

  const params: unknown[] = [lng, lat, radius]
  let typeFilter = ''
  if (type) {
    params.push(type)
    typeFilter = `AND type = $${params.length}`
  }

  const places = await query<Place>(
    `SELECT
       id, name, type, category, latitude, longitude,
       rating::float8 AS rating,
       review_count,
       price_level,
       phone, website, address, opening_hours, photos, source, external_id,
       summary, pros, cons, best_for, visit_duration,
       hidden_gem_score,
       tourist_trap_score,
       ai_processed_at, scraped_at, created_at, updated_at,
       ST_Distance(location::geography, ST_MakePoint($1, $2)::geography)::float8 AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1, $2)::geography, $3)
       ${typeFilter}
     ORDER BY distance_m ASC
     LIMIT 100`,
    params
  )

  let result = places
  if (type === 'restaurant' && places.length < 25) {
    const osmRestaurants = await fetchOsmRestaurants({ lat, lng, radius }).catch(error => {
      console.warn(`OpenStreetMap restaurant fallback failed: ${error instanceof Error ? error.message : String(error)}`)
      return []
    })
    result = mergePlacesWithFallback(places, osmRestaurants)
  }

  await redis.setex(cacheKey, 3_600, JSON.stringify(result))

  return NextResponse.json({ places: result, cached: false })
}
