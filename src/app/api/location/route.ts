export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { enqueueScrapeJob } from '@/lib/queue'
import { toGeohash } from '@/lib/geo'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, radius = 5000 } = await req.json()

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 })
    }

    const jobId = randomUUID()
    const geohash = toGeohash(lat, lng)

    await query(
      `INSERT INTO scrape_jobs (id, lat, lng, radius) VALUES ($1, $2, $3, $4)`,
      [jobId, lat, lng, radius]
    )

    await enqueueScrapeJob({ jobId, lat, lng, radius })

    return NextResponse.json({ jobId, geohash })
  } catch (err) {
    console.error('/api/location error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
