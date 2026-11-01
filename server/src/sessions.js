import crypto from 'node:crypto';
import { db, nowIso } from './db.js';
import { STANDARD_QUESTIONS } from './questions.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  const bytes = crypto.randomBytes(6);
  return 'P-' + [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function createSession() {
  const id = crypto.randomUUID();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      db.prepare('INSERT INTO sessions (id, code) VALUES (?, ?)').run(id, newCode());
      return id;
    } catch (err) {
      if (!String(err.message).includes('UNIQUE')) throw err;
    }
  }
  throw new Error('Could not allocate a session code');
}

export function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function getFollowups(session) {
  return JSON.parse(session.followups_json || '[]');
}

/** All questions for a session in display order: standard first, then follow-ups. */
export function allQuestions(session) {
  const standard = STANDARD_QUESTIONS.map((q, i) => ({ ...q, category: 'standard', position: i }));
  const followups = getFollowups(session).map((q, i) => ({
    ...q,
    type: q.options.length ? 'choice' : 'text',
    category: 'followup',
    position: 100 + i,
  }));
  return [...standard, ...followups];
}

export function getResponses(sessionId) {
  return db.prepare('SELECT * FROM responses WHERE session_id = ? ORDER BY position').all(sessionId);
}

/** Analytics key for a question: standard id, or followup_N by position. */
export function questionKey(session, questionId) {
  const idx = getFollowups(session).findIndex((q) => q.id === questionId);
  return idx >= 0 ? `followup_${idx + 1}` : questionId;
}

export function logEvent(sessionId, type, questionKeyValue = null) {
  db.prepare('INSERT INTO events (session_id, type, question_key, created_at) VALUES (?, ?, ?, ?)').run(
    sessionId,
    type,
    questionKeyValue,
    nowIso(),
  );
}

export function touch(sessionId, fields = {}) {
  const keys = Object.keys(fields);
  const sets = keys.map((k) => `${k} = @${k}`).concat('updated_at = @updated_at').join(', ');
  db.prepare(`UPDATE sessions SET ${sets} WHERE id = @id`).run({ ...fields, updated_at: nowIso(), id: sessionId });
}

export function escalate(sessionId, reason) {
  const s = getSession(sessionId);
  if (s.status === 'escalated') return;
  touch(sessionId, { status: 'escalated', urgent_reason: reason, submitted_at: nowIso() });
  logEvent(sessionId, 'urgent_escalated');
}
