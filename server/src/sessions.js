import crypto from 'node:crypto';
import { nowIso, one, query } from './db.js';
import { STANDARD_QUESTIONS } from './questions.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  const bytes = crypto.randomBytes(6);
  return 'P-' + [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export async function createSession() {
  const id = crypto.randomUUID();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const now = nowIso();
      await query('INSERT INTO sessions (id, code, created_at, updated_at) VALUES ($1, $2, $3, $4)', [id, newCode(), now, now]);
      return id;
    } catch (err) {
      if (err.code !== '23505') throw err; // unique violation: retry with a new code
    }
  }
  throw new Error('Could not allocate a session code');
}

export function getSession(id) {
  return one('SELECT * FROM sessions WHERE id = $1', [id]);
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
  return query('SELECT * FROM responses WHERE session_id = $1 ORDER BY position', [sessionId]);
}

/** Analytics key for a question: standard id, or followup_N by position. */
export function questionKey(session, questionId) {
  const idx = getFollowups(session).findIndex((q) => q.id === questionId);
  return idx >= 0 ? `followup_${idx + 1}` : questionId;
}

export async function logEvent(sessionId, type, questionKeyValue = null) {
  await query('INSERT INTO events (session_id, type, question_key, created_at) VALUES ($1, $2, $3, $4)', [
    sessionId,
    type,
    questionKeyValue,
    nowIso(),
  ]);
}

export async function touch(sessionId, fields = {}) {
  const entries = Object.entries({ ...fields, updated_at: nowIso() });
  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE sessions SET ${sets} WHERE id = $1`, [sessionId, ...entries.map(([, v]) => v)]);
}

export async function escalate(sessionId, reason) {
  const s = await getSession(sessionId);
  if (s.status === 'escalated') return;
  await touch(sessionId, { status: 'escalated', urgent_reason: reason, submitted_at: nowIso() });
  await logEvent(sessionId, 'urgent_escalated');
}
