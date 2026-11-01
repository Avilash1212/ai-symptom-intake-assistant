import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

// Postgres access. In production (Vercel) this is a hosted Postgres such as
// Supabase, reached through DATABASE_URL / POSTGRES_URL. Locally, without a
// URL, an embedded Postgres (PGlite) stores data in server/data/pglite.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS doctors (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- One row per patient intake. No names or contact details are collected:
-- the patient is identified only by the short session code.
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'in_progress', -- in_progress | summary_ready | submitted | escalated
  review_status   TEXT NOT NULL DEFAULT 'new',         -- new | reviewed
  followups_json  TEXT NOT NULL DEFAULT '[]',
  followup_rounds INTEGER NOT NULL DEFAULT 0,
  followups_done  INTEGER NOT NULL DEFAULT 0,
  summary_json    TEXT,
  summary_source  TEXT,                                -- ai | rules
  summary_stale   INTEGER NOT NULL DEFAULT 0,
  urgent_reason   TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  submitted_at    TEXT
);

CREATE TABLE IF NOT EXISTS responses (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  question_text TEXT NOT NULL,
  category      TEXT NOT NULL,           -- standard | followup
  position      INTEGER NOT NULL,
  answer_kind   TEXT NOT NULL,           -- answer | not_applicable | unsure | skipped
  answer_value  TEXT,
  input_method  TEXT,                    -- text | voice | options
  updated_at    TEXT NOT NULL,
  UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id         SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  liked      INTEGER NOT NULL DEFAULT 0,
  comment    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  question_key TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, id);

-- Consultation timings for the before/after time-saving comparison.
CREATE TABLE IF NOT EXISTS consultations (
  id           SERIAL PRIMARY KEY,
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id),
  session_id   TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  phase        TEXT NOT NULL,            -- baseline | assisted
  complexity   TEXT NOT NULL,            -- low | medium | high
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  duration_sec INTEGER
);
`;

let driver;

async function getDriver() {
  if (driver) return driver;
  if (config.databaseUrl) {
    if (/\[?YOUR[-_]PASSWORD\]?/i.test(config.databaseUrl)) throw new Error('DATABASE_URL still contains the [YOUR-PASSWORD] placeholder.');
    const { default: pg } = await import('pg');
    const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
    // An sslmode in the URL (Vercel's Supabase integration adds
    // ?sslmode=require) makes pg verify the certificate chain, which fails
    // against Supabase's pooler. Strip it and configure SSL below instead.
    const url = new URL(config.databaseUrl);
    for (const p of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'supa', 'pgbouncer']) url.searchParams.delete(p);
    const pool = new pg.Pool({
      connectionString: url.toString(),
      ssl: local ? false : { rejectUnauthorized: false },
      // Serverless functions each hold their own pool; keep it small so the
      // free database's connection limit is not exhausted.
      max: config.isVercel ? 1 : 5,
      connectionTimeoutMillis: 10000,
    });
    driver = {
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  } else {
    if (config.isVercel) throw new Error('DATABASE_URL (or POSTGRES_URL) must be set on Vercel.');
    const { PGlite } = await import('@electric-sql/pglite');
    fs.mkdirSync(config.localDbDir, { recursive: true });
    const lite = await PGlite.create(config.localDbDir);
    driver = {
      query: (sql, params) => lite.query(sql, params),
      exec: (sql) => lite.exec(sql),
      close: () => lite.close(),
    };
  }
  return driver;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Runs a parameterised query ($1, $2, ...) and returns the rows. */
export async function query(sql, params = []) {
  const d = await getDriver();
  const result = await d.query(sql, params);
  return result.rows;
}

export async function one(sql, params = []) {
  return (await query(sql, params))[0];
}

// Creates the doctor account from DOCTOR_EMAIL / DOCTOR_PASSWORD if it does
// not exist yet, so a fresh deployment can be signed into without running a script.
async function bootstrapDoctor() {
  const email = (process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
  const password = process.env.DOCTOR_PASSWORD || '';
  if (!email || password.length < 10) return;
  const existing = await one('SELECT id FROM doctors WHERE email = $1', [email]);
  if (existing) return;
  await query(
    'INSERT INTO doctors (email, name, password_hash, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
    [email, process.env.DOCTOR_NAME || 'Clinic Doctor', bcrypt.hashSync(password, 12), nowIso()],
  );
  console.log(`[db] Created doctor account ${email}`);
}

let readyPromise;

/** Ensures the schema exists. Safe to call on every request (runs once per instance). */
export function ready() {
  readyPromise ||= (async () => {
    const d = await getDriver();
    await d.exec(SCHEMA);
    await bootstrapDoctor();
  })().catch((err) => {
    readyPromise = null;
    throw err;
  });
  return readyPromise;
}

/**
 * Plain-language explanation of a database failure for the health check.
 * Never includes the connection string or password.
 */
export function describeDbError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  if (msg.includes('must be set on Vercel')) return 'DATABASE_URL is not set in the Vercel environment variables.';
  if (msg.includes('[YOUR-PASSWORD] placeholder')) return 'DATABASE_URL still contains [YOUR-PASSWORD]. Replace it (including the brackets) with your Supabase database password.';
  if (err instanceof TypeError && /Invalid URL/i.test(msg)) return 'DATABASE_URL is not a valid connection string. Copy it again from Supabase (Connect > Transaction pooler).';
  if (code === '28P01' || /password authentication failed/i.test(msg)) return 'Wrong database password in DATABASE_URL. Check that [YOUR-PASSWORD] was replaced with your Supabase database password.';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'Database host not found. Check the host part of DATABASE_URL.';
  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') return 'Database host unreachable. Use the Supabase "Transaction pooler" string (pooler.supabase.com, port 6543), not the direct connection.';
  if (code === 'ECONNREFUSED' || /timeout/i.test(msg)) return 'Could not connect to the database in time. Check the host and port (6543) in DATABASE_URL and that the Supabase project is not paused.';
  if (/tenant or user not found/i.test(msg)) return 'Supabase does not recognise the user in DATABASE_URL. Copy the Transaction pooler string again; the user should look like postgres.<project-ref>.';
  if (/certificate|SSL|TLS/i.test(msg)) return 'SSL error connecting to the database.';
  return `Database error${code ? ` (${code})` : ''}.`;
}

export async function closeDb() {
  if (driver) await driver.close();
  driver = null;
  readyPromise = null;
}
