import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db, nowIso } from '../db.js';
import { DOCTOR_COOKIE, clearCookie, requireDoctor, setDoctorCookie } from '../auth.js';
import { getResponses, getSession } from '../sessions.js';
import { doctorMetrics, patientMetrics } from '../analytics.js';
import { aiEnabled } from '../ai.js';

export const doctorRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
// Compared against when the email is unknown so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

doctorRouter.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const doctor = db.prepare('SELECT * FROM doctors WHERE email = ?').get(email);
  const ok = await bcrypt.compare(password, doctor?.password_hash ?? DUMMY_HASH);
  if (!doctor || !ok) return res.status(401).json({ error: 'Incorrect email or password.' });
  setDoctorCookie(res, doctor);
  res.json({ id: doctor.id, name: doctor.name, email: doctor.email });
});

doctorRouter.post('/logout', (req, res) => {
  clearCookie(res, DOCTOR_COOKIE);
  res.status(204).end();
});

// Everything below requires an authenticated doctor.
doctorRouter.use(requireDoctor);

doctorRouter.get('/me', (req, res) => {
  const doctor = db.prepare('SELECT id, name, email FROM doctors WHERE id = ?').get(req.doctorId);
  if (!doctor) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ ...doctor, aiEnabled });
});

doctorRouter.get('/submissions', (req, res) => {
  const rows = db.prepare(`
    SELECT id, code, status, review_status, submitted_at, urgent_reason, summary_json
    FROM sessions WHERE status IN ('submitted', 'escalated')
    ORDER BY submitted_at DESC LIMIT 200`).all();
  res.json(rows.map(({ summary_json, ...r }) => ({
    ...r,
    mainSymptoms: summary_json ? JSON.parse(summary_json).main_symptoms : [],
  })));
});

function loadSubmission(req, res, next) {
  const s = getSession(req.params.id);
  if (!s || !['submitted', 'escalated'].includes(s.status)) return res.status(404).json({ error: 'Submission not found.' });
  req.submission = s;
  next();
}

doctorRouter.get('/submissions/:id', loadSubmission, (req, res) => {
  const s = req.submission;
  const consultations = db.prepare(
    'SELECT id, phase, complexity, started_at, ended_at, duration_sec FROM consultations WHERE session_id = ? ORDER BY id',
  ).all(s.id);
  res.json({
    id: s.id,
    code: s.code,
    status: s.status,
    reviewStatus: s.review_status,
    submittedAt: s.submitted_at,
    createdAt: s.created_at,
    urgentReason: s.urgent_reason,
    summary: s.summary_json ? JSON.parse(s.summary_json) : null,
    summarySource: s.summary_source,
    responses: getResponses(s.id).map((r) => ({
      questionId: r.question_id,
      question: r.question_text,
      category: r.category,
      kind: r.answer_kind,
      value: r.answer_value,
      inputMethod: r.input_method,
    })),
    consultations,
  });
});

doctorRouter.patch('/submissions/:id', loadSubmission, (req, res) => {
  const reviewStatus = req.body?.reviewStatus;
  if (!['new', 'reviewed'].includes(reviewStatus)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE sessions SET review_status = ? WHERE id = ?').run(reviewStatus, req.submission.id);
  res.json({ reviewStatus });
});

// ------------------------------------------------------- consultation timing

const PHASES = ['baseline', 'assisted'];
const COMPLEXITIES = ['low', 'medium', 'high'];

doctorRouter.post('/consultations/start', (req, res) => {
  const { sessionId, complexity } = req.body || {};
  if (!COMPLEXITIES.includes(complexity)) return res.status(400).json({ error: 'Choose a complexity.' });
  const s = sessionId ? getSession(sessionId) : null;
  if (sessionId && !s) return res.status(404).json({ error: 'Submission not found.' });
  const info = db.prepare(
    "INSERT INTO consultations (doctor_id, session_id, phase, complexity, started_at) VALUES (?, ?, 'assisted', ?, ?)",
  ).run(req.doctorId, s?.id ?? null, complexity, nowIso());
  res.status(201).json({ id: info.lastInsertRowid });
});

doctorRouter.post('/consultations/:id/end', (req, res) => {
  const c = db.prepare('SELECT * FROM consultations WHERE id = ? AND doctor_id = ?').get(req.params.id, req.doctorId);
  if (!c) return res.status(404).json({ error: 'Consultation not found.' });
  if (c.ended_at) return res.status(409).json({ error: 'Already ended.' });
  const ended = nowIso();
  const duration = Math.max(1, Math.round((Date.parse(ended) - Date.parse(c.started_at)) / 1000));
  db.prepare('UPDATE consultations SET ended_at = ?, duration_sec = ? WHERE id = ?').run(ended, duration, c.id);
  res.json({ id: c.id, durationSec: duration });
});

// Manual entry, mainly for baseline consultations from before the assistant was introduced.
doctorRouter.post('/consultations', (req, res) => {
  const { phase, complexity, startedAt, durationMinutes } = req.body || {};
  const minutes = Number(durationMinutes);
  const start = Date.parse(startedAt);
  if (!PHASES.includes(phase) || !COMPLEXITIES.includes(complexity) || !Number.isFinite(start) || !(minutes > 0 && minutes <= 240)) {
    return res.status(400).json({ error: 'Please fill in phase, complexity, start time and a duration between 1 and 240 minutes.' });
  }
  const startedIso = new Date(start).toISOString();
  const endedIso = new Date(start + minutes * 60000).toISOString();
  const info = db.prepare(`
    INSERT INTO consultations (doctor_id, phase, complexity, started_at, ended_at, duration_sec)
    VALUES (?, ?, ?, ?, ?, ?)`).run(req.doctorId, phase, complexity, startedIso, endedIso, Math.round(minutes * 60));
  res.status(201).json({ id: info.lastInsertRowid });
});

doctorRouter.get('/metrics', (req, res) => {
  const feedback = db.prepare(`
    SELECT f.liked, f.comment, f.created_at, s.code FROM feedback f JOIN sessions s ON s.id = f.session_id
    WHERE f.comment IS NOT NULL ORDER BY f.created_at DESC LIMIT 50`).all();
  res.json({ patient: patientMetrics(), doctor: doctorMetrics(), feedback });
});
