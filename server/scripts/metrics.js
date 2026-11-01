// Builder-only product metrics. Deliberately not exposed through the web app or
// API: only people with access to the server and its database can run it.
//
//   npm run metrics                     print the report
//   npm run metrics -- --json           print the report as JSON
//   npm run metrics -- add-consultation --phase baseline --complexity low \
//       --start 2026-10-01T10:00 --minutes 12
//                                       record a consultation timing manually
//                                       (e.g. baseline data from before the assistant)
import { db } from '../src/db.js';
import { doctorMetrics, patientMetrics } from '../src/analytics.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function addConsultation() {
  const phase = flag('phase');
  const complexity = flag('complexity');
  const start = Date.parse(flag('start') ?? '');
  const minutes = Number(flag('minutes'));
  if (!['baseline', 'assisted'].includes(phase) || !['low', 'medium', 'high'].includes(complexity)
    || !Number.isFinite(start) || !(minutes > 0 && minutes <= 240)) {
    console.error('Usage: add-consultation --phase baseline|assisted --complexity low|medium|high --start <date-time> --minutes <1-240>');
    process.exit(1);
  }
  const doctor = db.prepare('SELECT id FROM doctors ORDER BY id LIMIT 1').get();
  if (!doctor) {
    console.error('No doctor account exists. Run `npm run seed` first.');
    process.exit(1);
  }
  db.prepare(`
    INSERT INTO consultations (doctor_id, phase, complexity, started_at, ended_at, duration_sec)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    doctor.id, phase, complexity,
    new Date(start).toISOString(), new Date(start + minutes * 60000).toISOString(), Math.round(minutes * 60),
  );
  console.log(`Recorded ${phase} consultation: ${complexity} complexity, ${minutes} min.`);
}

function change(before, after) {
  if (before == null || after == null || before === 0) return '—';
  const pct = Math.round(((after - before) / before) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function report() {
  const patient = patientMetrics();
  const doctor = doctorMetrics();
  const feedback = db.prepare(`
    SELECT s.code, f.liked, f.comment, f.created_at FROM feedback f JOIN sessions s ON s.id = f.session_id
    WHERE f.comment IS NOT NULL ORDER BY f.created_at DESC LIMIT 20`).all();

  if (args.includes('--json')) {
    console.log(JSON.stringify({ patient, doctor, feedback }, null, 2));
    return;
  }

  const p = patient;
  console.log('\n=== Patient journey ===');
  console.table({
    'Summary generation rate (key)': `${p.summaryGenerationRate ?? '—'}%`,
    'Intakes started': p.started,
    'Intakes completed': `${p.completed} (${p.completionRate ?? '—'}%)`,
    'Urgent escalations': p.escalated,
    'Summaries generated': p.summariesGenerated,
    'Summaries confirmed & submitted': p.summariesConfirmed,
    'Questions answered (total)': p.totalQuestionsAnswered,
    'Questions answered (avg per intake)': p.avgQuestionsAnswered ?? '—',
    'Patients giving feedback': `${p.feedbackCount} (${p.likes} liked)`,
    'Left at summary review': p.droppedAtReview,
  });

  console.log('\n=== Drop-off by question ===');
  console.table(p.questionFunnel.map((q) => ({
    Question: q.label, Reached: q.viewed, Answered: q.answered, Skipped: q.skipped, 'Left here': q.droppedHere,
  })));

  const { baseline: b, assisted: a } = doctor;
  console.log('\n=== Doctor time: before vs. with the assistant ===');
  console.log('Split by doctor-rated complexity so case-mix shifts stay visible.');
  console.log('Faster consultations do not by themselves mean better clinical outcomes.');
  const rows = {
    'Consultations recorded': [`${b.consultations} / ${b.days} day(s)`, `${a.consultations} / ${a.days} day(s)`, '—'],
    'Patients per hour': [b.patientsPerHour, a.patientsPerHour, change(b.patientsPerHour, a.patientsPerHour)],
    'Patients per day': [b.patientsPerDay, a.patientsPerDay, change(b.patientsPerDay, a.patientsPerDay)],
    'Avg consultation (min)': [b.avgMinutes, a.avgMinutes, change(b.avgMinutes, a.avgMinutes)],
  };
  for (const c of ['low', 'medium', 'high']) {
    const [bc, ac] = [b.byComplexity[c], a.byComplexity[c]];
    rows[`  Avg min – ${c} complexity`] = [`${bc.avgMinutes ?? '—'} (n=${bc.count})`, `${ac.avgMinutes ?? '—'} (n=${ac.count})`, change(bc.avgMinutes, ac.avgMinutes)];
  }
  console.table(Object.fromEntries(Object.entries(rows).map(([k, [before, after, delta]]) => [k, { Before: before ?? '—', 'With assistant': after ?? '—', Change: delta }])));

  console.log('\n=== Recent written feedback ===');
  if (!feedback.length) console.log('(none)');
  for (const f of feedback) console.log(`- [${f.created_at.slice(0, 16)}] ${f.code}${f.liked ? ' (liked)' : ''}: ${f.comment}`);
  console.log('');
}

if (args[0] === 'add-consultation') addConsultation();
else report();
