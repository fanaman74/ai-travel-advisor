import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateRecommendations } from '@/lib/ai'
import type { Place } from '@/types'

export async function POST(req: NextRequest) {
  const { lat, lng, timeOfDay, preferences } = await req.json()

  const places = await query<Place>(
    `SELECT name, type, summary,
       ST_Distance(location::geography, ST_MakePoint($1,$2)::geography) AS distance_m
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1,$2)::geography, 5000)
     ORDER BY distance_m LIMIT 30`,
    [lng, lat]
  )

  const recommendations = await generateRecommendations({
    city: 'the area',
    timeOfDay: timeOfDay ?? new Date().toLocaleTimeString(),
    preferences: preferences ?? {},
    places: places.map(p => ({ name: p.name, type: p.type, summary: p.summary })),
  })

  return NextResponse.json({ recommendations })
}
