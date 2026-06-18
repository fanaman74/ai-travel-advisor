import { Pool } from 'pg'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

const g = globalThis as typeof globalThis & { _pgPool?: Pool }

export function getPool(): Pool {
  if (!g._pgPool) {
    g._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  }
  return g._pgPool
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params)
  return result.rows as T[]
}
