import { Pool } from 'pg'

const g = globalThis as typeof globalThis & { _pgPool?: Pool }

export function getPool(): Pool {
  if (!g._pgPool) {
    g._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
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
