import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateItinerary } from '@/lib/ai'
import { getRedis } from '@/lib/redis'
import type { Place } from '@/types'

const RATE_LIMIT = 10
const WINDOW = 3_600

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('session_id')?.value ?? 'anon'
  const redis = getRedis()
  const rateLimitKey = `rate:itinerary:${sessionId}`
  const count = await redis.incr(rateLimitKey)
  if (count === 1) await redis.expire(rateLimitKey, WINDOW)
  if (count > RATE_LIMIT) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { lat, lng, durationHours, preferences, city } = await req.json()

  const places = await query<Place>(
    `SELECT name, type, visit_duration, address,
       ST_Distance(location::geography, ST_MakePoint($1,$2)::geography) AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1,$2)::geography, 5000)
     ORDER BY (hidden_gem_score + (5 - tourist_trap_score/20)) DESC NULLS LAST
     LIMIT 20`,
    [lng, lat]
  )

  const itinerary = await generateItinerary({
    city: city ?? 'the area',
    durationHours: durationHours ?? 4,
    preferences: preferences ?? {},
    places: places.map(p => ({
      name: p.name, type: p.type,
      visit_duration: p.visit_duration, address: p.address,
    })),
  })

  await query(
    `INSERT INTO itineraries (session_id, title, content, duration_hours, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, itinerary.title, JSON.stringify(itinerary), durationHours, lat, lng]
  )

  return NextResponse.json(itinerary)
}
