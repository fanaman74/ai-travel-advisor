import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { Worker } from 'bullmq'
import { getRedis } from './src/lib/redis'
import { processScrapeLocation } from './src/worker/processor'
import { SCRAPE_QUEUE } from './src/lib/queue'

console.log('Worker starting...')

const worker = new Worker(
  SCRAPE_QUEUE,
  async job => {
    console.log(`Processing job ${job.id} (${job.name})`)
    await processScrapeLocation(job)
    console.log(`Completed job ${job.id}`)
  },
  {
    connection: getRedis() as any,
    concurrency: 2,
  }
)

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message)
})

worker.on('error', err => {
  console.error('Worker error:', err)
})

process.on('SIGTERM', async () => {
  await worker.close()
  process.exit(0)
})
