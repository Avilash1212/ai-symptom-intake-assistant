import { Router } from 'express';
import { db, nowIso } from '../db.js';
import { PATIENT_COOKIE, clearCookie, requirePatient, setPatientCookie } from '../auth.js';
import { generateFollowups, generateSummary } from '../ai.js';
import { detectRedFlags, URGENT_MESSAGE } from '../safety.js';
import { ANSWER_KINDS, MAX_FOLLOWUPS_TOTAL, MAX_FOLLOWUP_ROUNDS } from '../questions.js';
import {
  allQuestions, createSession, escalate, getFollowups, getResponses, getSession, logEvent, questionKey, touch,
} from '../sessions.js';

export const patientRouter = Router();

const EDITABLE = new Set(['in_progress', 'summary_ready']);
const busy = new Set(); // sessions with an AI call in flight

function stateFor(sessionId) {
  const s = getSession(sessionId);
  if (!s) return null;
  const responses = Object.fromEntries(
    getResponses(sessionId).map((r) => [r.question_id, { kind: r.answer_kind, value: r.answer_value }]),
  );
  const followups = getFollowups(s);
  const feedback = db.prepare('SELECT liked, comment FROM feedback WHERE session_id = ?').get(sessionId);
  return {
    code: s.code,
    status: s.status,
    questions: allQuestions(s),
    responses,
    followupsDone: Boolean(s.followups_done) || s.followup_rounds >= MAX_FOLLOWUP_ROUNDS || followups.length >= MAX_FOLLOWUPS_TOTAL,
    summary: s.summary_json ? JSON.parse(s.summary_json) : null,
    summaryStale: Boolean(s.summary_stale),
    urgent: s.status === 'escalated' ? { reason: s.urgent_reason, message: URGENT_MESSAGE } : null,
    feedback: feedback ? { liked: Boolean(feedback.liked), comment: feedback.comment } : null,
  };
}

function loadSession(req, res, next) {
  const s = getSession(req.sessionId);
  if (!s) {
    clearCookie(res, PATIENT_COOKIE);
    return res.status(404).json({ error: 'Intake session not found.' });
  }
  req.session = s;
  next();
}

function requireEditable(req, res, next) {
  if (req.session.status === 'escalated') return res.status(409).json({ error: 'urgent', state: stateFor(req.sessionId) });
  if (!EDITABLE.has(req.session.status)) return res.status(409).json({ error: 'This intake has already been submitted.' });
  next();
}

patientRouter.post('/sessions', (req, res) => {
  const id = createSession();
  setPatientCookie(res, id);
  logEvent(id, 'intake_started');
  res.status(201).json(stateFor(id));
});

// Ends the patient's access on this device (important on a shared clinic computer).
patientRouter.post('/session/end', (req, res) => {
  clearCookie(res, PATIENT_COOKIE);
  res.status(204).end();
});

patientRouter.use('/session', requirePatient, loadSession);

patientRouter.get('/session', (req, res) => res.json(stateFor(req.sessionId)));

patientRouter.post('/session/events', (req, res) => {
  const { type, questionId } = req.body || {};
  if (type !== 'question_viewed' || typeof questionId !== 'string') return res.status(400).json({ error: 'Invalid event.' });
  const exists = allQuestions(req.session).some((q) => q.id === questionId);
  if (!exists) return res.status(400).json({ error: 'Unknown question.' });
  logEvent(req.sessionId, 'question_viewed', questionKey(req.session, questionId));
  res.status(204).end();
});

patientRouter.put('/session/responses/:questionId', requireEditable, (req, res) => {
  const { questionId } = req.params;
  const question = allQuestions(req.session).find((q) => q.id === questionId);
  if (!question) return res.status(404).json({ error: 'Unknown question.' });

  const { kind, value, inputMethod } = req.body || {};
  if (!ANSWER_KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid answer type.' });
  const text = kind === 'answer' ? String(value ?? '').trim().slice(0, 2000) : null;
  if (kind === 'answer' && !text) return res.status(400).json({ error: 'Please enter an answer.' });
  if (question.required && kind !== 'answer') return res.status(400).json({ error: 'Please describe your symptoms to continue.' });
  const method = ['text', 'voice', 'options'].includes(inputMethod) ? inputMethod : null;

  db.prepare(`
    INSERT INTO responses (session_id, question_id, question_text, category, position, answer_kind, answer_value, input_method, updated_at)
    VALUES (@sid, @qid, @qtext, @cat, @pos, @kind, @val, @method, @now)
    ON CONFLICT (session_id, question_id) DO UPDATE SET
      answer_kind = excluded.answer_kind, answer_value = excluded.answer_value,
      input_method = excluded.input_method, updated_at = excluded.updated_at
  `).run({
    sid: req.sessionId, qid: questionId, qtext: question.text, cat: question.category, pos: question.position,
    kind, val: text, method, now: nowIso(),
  });

  // Any edit after a summary exists invalidates it until regenerated.
  if (req.session.summary_json) touch(req.sessionId, { status: 'in_progress', summary_stale: 1 });
  else touch(req.sessionId);
  logEvent(req.sessionId, kind === 'skipped' ? 'question_skipped' : 'question_answered', questionKey(req.session, questionId));

  if (kind === 'answer') {
    const flag = detectRedFlags(text);
    if (flag) escalate(req.sessionId, flag);
  }
  res.json(stateFor(req.sessionId));
});

patientRouter.post('/session/followups', requireEditable, async (req, res, next) => {
  const s = req.session;
  const followups = getFollowups(s);
  const state = stateFor(s.id);
  if (state.followupsDone) return res.json(state);
  if (!state.responses.symptoms) return res.status(400).json({ error: 'Please describe your symptoms first.' });
  if (busy.has(s.id)) return res.status(429).json({ error: 'Already preparing questions.' });

  busy.add(s.id);
  try {
    const responses = getResponses(s.id);
    const round = s.followup_rounds + 1;
    const result = await generateFollowups({
      responses,
      alreadyAsked: allQuestions(s).map((q) => q.text),
      maxQuestions: MAX_FOLLOWUPS_TOTAL - followups.length,
      round,
    });
    if (result.urgent) {
      escalate(s.id, result.urgentReason || 'Possible urgent symptoms reported');
      return res.json(stateFor(s.id));
    }
    const added = result.questions.map((q, i) => ({ id: `fu_${round}_${i + 1}`, ...q, source: result.source }));
    touch(s.id, {
      followups_json: JSON.stringify([...followups, ...added]),
      followup_rounds: round,
      followups_done: result.sufficient || added.length === 0 ? 1 : 0,
    });
    res.json(stateFor(s.id));
  } catch (err) {
    next(err);
  } finally {
    busy.delete(s.id);
  }
});

patientRouter.post('/session/summary', requireEditable, async (req, res, next) => {
  const s = req.session;
  const responses = getResponses(s.id);
  if (!responses.some((r) => r.question_id === 'symptoms' && r.answer_kind === 'answer')) {
    return res.status(400).json({ error: 'Please describe your symptoms first.' });
  }
  if (busy.has(s.id)) return res.status(429).json({ error: 'Already preparing your summary.' });

  busy.add(s.id);
  try {
    const { summary, source } = await generateSummary({ responses });
    touch(s.id, {
      summary_json: JSON.stringify(summary),
      summary_source: source,
      summary_stale: 0,
      followups_done: 1,
      status: 'summary_ready',
    });
    logEvent(s.id, 'summary_generated');
    res.json(stateFor(s.id));
  } catch (err) {
    next(err);
  } finally {
    busy.delete(s.id);
  }
});

patientRouter.post('/session/confirm', requireEditable, (req, res) => {
  const s = req.session;
  if (s.status !== 'summary_ready' || s.summary_stale) {
    return res.status(409).json({ error: 'Please review the latest summary before confirming.' });
  }
  touch(s.id, { status: 'submitted', submitted_at: nowIso() });
  logEvent(s.id, 'summary_confirmed');
  res.json(stateFor(s.id));
});

patientRouter.post('/session/feedback', (req, res) => {
  const s = req.session;
  if (s.status !== 'submitted') return res.status(409).json({ error: 'Feedback is available after submission.' });
  const liked = req.body?.liked ? 1 : 0;
  const comment = String(req.body?.comment ?? '').trim().slice(0, 1000) || null;
  if (!liked && !comment) return res.status(400).json({ error: 'Nothing to submit.' });
  const existing = db.prepare('SELECT id FROM feedback WHERE session_id = ?').get(s.id);
  db.prepare(`
    INSERT INTO feedback (session_id, liked, comment, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (session_id) DO UPDATE SET liked = excluded.liked, comment = excluded.comment
  `).run(s.id, liked, comment, nowIso());
  if (!existing) logEvent(s.id, 'feedback_submitted');
  res.json(stateFor(s.id));
});
