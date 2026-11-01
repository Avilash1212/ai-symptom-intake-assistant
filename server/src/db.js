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
    const { default: pg } = await import('pg');
    const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: local ? false : { rejectUnauthorized: false },
      // Serverless functions each hold their own pool; keep it small so the
      // free database's connection limit is not exhausted.
      max: config.isVercel ? 1 : 5,
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

export async function closeDb() {
  if (driver) await driver.close();
  driver = null;
  readyPromise = null;
}
