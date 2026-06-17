import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { query } from '@/lib/db'
import type { ScrapeJob } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const redis = getRedis()

  const progress = await redis.get(`job:${id}:status`)
  const [job] = await query<ScrapeJob>(
    `SELECT * FROM scrape_jobs WHERE id = $1`,
    [id]
  )

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    jobId: id,
    status: job.status,
    progress: progress ? parseInt(progress, 10) : 0,
    placesFound: job.places_found,
    completedAt: job.completed_at,
  })
}
