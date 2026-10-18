import pg from 'pg'

// No Vercel + Neon a variável DATABASE_URL é criada automaticamente (conexão com pool).
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL

let pool
export function getPool() {
  if (!connectionString) throw new Error('DATABASE_URL não configurada. Conecte um banco Neon ao projeto no Vercel ou crie um arquivo .env.')
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX) || 3,
      idleTimeoutMillis: 10_000,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : true,
    })
    // Conexões ociosas podem ser fechadas pelo servidor do banco; sem isso o processo cairia
    pool.on('error', (e) => console.error('Conexão com o banco encerrada:', e.message))
  }
  return pool
}

export const query = (text, params) => getPool().query(text, params)

export async function transaction(fn) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const r = await fn(client)
    await client.query('COMMIT')
    return r
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
