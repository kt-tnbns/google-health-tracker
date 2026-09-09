import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

/**
 * Minimal forward-only SQL migration runner.
 * Files in ./migrations are applied in lexical order once each.
 */
export async function runMigrations(pool: Pool, dir = join(__dirname, 'migrations')): Promise<string[]> {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      applied.push(file);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return applied;
}

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  runMigrations(pool)
    .then((a) => {
      console.log(a.length ? `applied: ${a.join(', ')}` : 'up to date');
      return pool.end();
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
