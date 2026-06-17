import { Queue } from 'bullmq'
import { getRedis } from './redis'
import type { ScrapeLocationJobData } from '@/types'

export const SCRAPE_QUEUE = 'scrape-location'

let scrapeQueue: Queue<ScrapeLocationJobData> | null = null

export function getScrapeQueue(): Queue<ScrapeLocationJobData> {
  if (!scrapeQueue) {
    scrapeQueue = new Queue<ScrapeLocationJobData>(SCRAPE_QUEUE, {
      connection: getRedis() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  }
  return scrapeQueue
}

export async function enqueueScrapeJob(data: ScrapeLocationJobData): Promise<string> {
  const queue = getScrapeQueue()
  const job = await queue.add('scrape', data, {
    jobId: data.jobId,
    deduplication: { id: data.jobId },
  })
  return job.id ?? data.jobId
}
