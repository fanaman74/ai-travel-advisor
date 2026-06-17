import Redis from 'ioredis'

const g = globalThis as typeof globalThis & { _redis?: Redis }

export function getRedis(): Redis {
  if (!g._redis) {
    g._redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    })
  }
  return g._redis
}
