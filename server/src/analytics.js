import { one, query } from './db.js';
import { STANDARD_QUESTIONS } from './questions.js';

const pct = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);

export async function patientMetrics() {
  const count = async (sql) => (await one(sql)).n;

  const [started, completed, escalated, summariesGenerated, summariesConfirmed, feedbackCount, likes, answered] = await Promise.all([
    count('SELECT COUNT(*)::int n FROM sessions'),
    count("SELECT COUNT(*)::int n FROM sessions WHERE status = 'submitted'"),
    count("SELECT COUNT(*)::int n FROM sessions WHERE status = 'escalated'"),
    count("SELECT COUNT(DISTINCT session_id)::int n FROM events WHERE type = 'summary_generated'"),
    count("SELECT COUNT(DISTINCT session_id)::int n FROM events WHERE type = 'summary_confirmed'"),
    count('SELECT COUNT(*)::int n FROM feedback'),
    count('SELECT COUNT(*)::int n FROM feedback WHERE liked = 1'),
    count("SELECT COUNT(*)::int n FROM responses WHERE answer_kind != 'skipped'"),
  ]);

  const byType = (type) => query(
    'SELECT question_key k, COUNT(DISTINCT session_id)::int n FROM events WHERE type = $1 GROUP BY question_key',
    [type],
  );
  // Drop-off: for sessions that were abandoned (not submitted, not escalated),
  // the last question the patient viewed is where they left.
  const [viewed, answeredBy, skippedBy, dropped, reviewRow] = await Promise.all([
    byType('question_viewed'),
    byType('question_answered'),
    byType('question_skipped'),
    query(`
      SELECT e.question_key k, COUNT(*)::int n FROM events e
      JOIN sessions s ON s.id = e.session_id
      WHERE s.status IN ('in_progress', 'summary_ready')
        AND e.id = (SELECT MAX(id) FROM events e2 WHERE e2.session_id = e.session_id AND e2.type = 'question_viewed')
        AND NOT EXISTS (SELECT 1 FROM events e3 WHERE e3.session_id = e.session_id AND e3.type = 'summary_generated')
      GROUP BY e.question_key`),
    one(`
      SELECT COUNT(*)::int n FROM sessions s WHERE s.status IN ('in_progress', 'summary_ready')
        AND EXISTS (SELECT 1 FROM events e WHERE e.session_id = s.id AND e.type = 'summary_generated')`),
  ]);

  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.k, r.n]));
  const [v, a, sk, d] = [toMap(viewed), toMap(answeredBy), toMap(skippedBy), toMap(dropped)];
  const followupKeys = Object.keys(v).filter((k) => k?.startsWith('followup_'))
    .sort((x, y) => Number(x.split('_')[1]) - Number(y.split('_')[1]));
  const labels = Object.fromEntries(STANDARD_QUESTIONS.map((q) => [q.id, q.text]));
  const questionFunnel = [...STANDARD_QUESTIONS.map((q) => q.id), ...followupKeys].map((k) => ({
    key: k,
    label: labels[k] || `AI follow-up question #${k.split('_')[1]}`,
    viewed: v[k] || 0,
    answered: a[k] || 0,
    skipped: sk[k] || 0,
    droppedHere: d[k] || 0,
  }));

  return {
    started,
    completed,
    escalated,
    summariesGenerated,
    summariesConfirmed,
    feedbackCount,
    likes,
    totalQuestionsAnswered: answered,
    avgQuestionsAnswered: started ? Math.round((answered / started) * 10) / 10 : null,
    summaryGenerationRate: pct(summariesGenerated, started),
    completionRate: pct(completed, started),
    droppedAtReview: reviewRow.n,
    questionFunnel,
  };
}

/**
 * Before/after comparison of consultation throughput. Every figure is also
 * stratified by doctor-rated complexity so a shift in case mix is visible
 * rather than hidden in an average.
 */
export async function doctorMetrics() {
  const rows = await query(`
    SELECT phase, complexity, started_at, duration_sec FROM consultations
    WHERE duration_sec IS NOT NULL AND duration_sec > 0`);

  const phases = {};
  for (const phase of ['baseline', 'assisted']) {
    const list = rows.filter((r) => r.phase === phase);
    const byDay = {};
    for (const r of list) {
      const day = r.started_at.slice(0, 10);
      (byDay[day] ||= []).push(r);
    }
    const days = Object.values(byDay);
    // Patients per hour: consultations divided by the span of the clinic
    // session that day (first start to last end), minimum one hour.
    const perHour = days.map((d) => {
      const start = Math.min(...d.map((r) => Date.parse(r.started_at)));
      const end = Math.max(...d.map((r) => Date.parse(r.started_at) + r.duration_sec * 1000));
      return d.length / Math.max(1, (end - start) / 3600000);
    });
    const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
    const byComplexity = {};
    for (const c of ['low', 'medium', 'high']) {
      const cl = list.filter((r) => r.complexity === c);
      byComplexity[c] = { count: cl.length, avgMinutes: round1(avg(cl.map((r) => r.duration_sec / 60))) };
    }
    phases[phase] = {
      consultations: list.length,
      days: days.length,
      patientsPerDay: round1(avg(days.map((d) => d.length))),
      patientsPerHour: round1(avg(perHour)),
      avgMinutes: round1(avg(list.map((r) => r.duration_sec / 60))),
      byComplexity,
    };
  }
  return phases;
}
