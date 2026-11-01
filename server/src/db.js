import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS doctors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
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
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at    TEXT
);

CREATE TABLE IF NOT EXISTS responses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  question_text TEXT NOT NULL,
  category      TEXT NOT NULL,           -- standard | followup
  position      INTEGER NOT NULL,
  answer_kind   TEXT NOT NULL,           -- answer | not_applicable | unsure | skipped
  answer_value  TEXT,
  input_method  TEXT,                    -- text | voice | options
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  liked      INTEGER NOT NULL DEFAULT 0,
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  question_key TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, id);

-- Consultation timings for the before/after time-saving comparison.
CREATE TABLE IF NOT EXISTS consultations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id),
  session_id   TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  phase        TEXT NOT NULL,            -- baseline | assisted
  complexity   TEXT NOT NULL,            -- low | medium | high
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  duration_sec INTEGER
);
`);

export function nowIso() {
  return new Date().toISOString();
}
