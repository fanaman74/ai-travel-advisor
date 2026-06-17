import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getRedis } from '@/lib/redis'
import { toGeohash } from '@/lib/geo'
import type { Place } from '@/types'

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
    `SELECT *,
       ST_Distance(location::geography, ST_MakePoint($1, $2)::geography) AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1, $2)::geography, $3)
       ${typeFilter}
     ORDER BY distance_m ASC
     LIMIT 100`,
    params
  )

  await redis.setex(cacheKey, 3_600, JSON.stringify(places))

  return NextResponse.json({ places, cached: false })
}
