import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { generateAreaBriefing } from '@/lib/ai'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const city = searchParams.get('city') ?? 'your area'
  const district = searchParams.get('district') ?? ''

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const [counts] = await query<{ attractions: string; restaurants: string; events: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE type = 'attraction') AS attractions,
       COUNT(*) FILTER (WHERE type = 'restaurant') AS restaurants,
       COUNT(*) FILTER (WHERE type = 'event') AS events
     FROM places
     WHERE ST_DWithin(location::geography, ST_MakePoint($1, $2)::geography, 5000)`,
    [lng, lat]
  )

  const briefing = await generateAreaBriefing({
    city,
    district,
    attractionCount: parseInt(counts?.attractions ?? '0', 10),
    restaurantCount: parseInt(counts?.restaurants ?? '0', 10),
    eventCount: parseInt(counts?.events ?? '0', 10),
  })

  return NextResponse.json({ briefing })
}
