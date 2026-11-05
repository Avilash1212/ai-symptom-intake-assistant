// Creates (or updates) the doctor account from DOCTOR_EMAIL / DOCTOR_PASSWORD.
// With --demo, also inserts SYNTHETIC intake submissions and consultation
// timings so the dashboard can be demonstrated. No real patient data.
// Uses DATABASE_URL from .env when set (e.g. your Supabase database),
// otherwise the local development database.
import bcrypt from 'bcryptjs';
import { closeDb, nowIso, one, query, ready } from '../src/db.js';
import { createSession, logEvent, touch } from '../src/sessions.js';
import { STANDARD_QUESTIONS } from '../src/questions.js';

const email = (process.env.DOCTOR_EMAIL || '').trim().toLowerCase();
const password = (process.env.DOCTOR_PASSWORD || '').trim();
const name = process.env.DOCTOR_NAME || 'Clinic Doctor';

if (!email || password.length < 10) {
  console.error('Set DOCTOR_EMAIL and DOCTOR_PASSWORD (min 10 characters) in .env first.');
  process.exit(1);
}

await ready();
const hash = bcrypt.hashSync(password, 12);
await query(`
  INSERT INTO doctors (email, name, password_hash, created_at) VALUES ($1, $2, $3, $4)
  ON CONFLICT (email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash
`, [email, name, hash, nowIso()]);
const doctorId = (await one('SELECT id FROM doctors WHERE email = $1', [email])).id;
console.log(`Doctor account ready: ${email}`);

if (process.argv.includes('--demo')) {
  const q = Object.fromEntries(STANDARD_QUESTIONS.map((x) => [x.id, x.text]));
  const demo = [
    {
      answers: { symptoms: 'Headache since yesterday morning, feels like pressure around my forehead. Slight nausea.', onset: '1–3 days ago', severity: 'Moderate', body_part: 'Head', pattern: 'Continuous' },
      followups: [
        ['Which part of your head is affected?', 'Forehead; Temples', ['Forehead', 'Temples', 'Back of the head', 'One side', 'All over']],
        ['How would you describe the headache?', 'Pressing / tight', ['Throbbing', 'Pressing / tight', 'Sharp', 'Dull ache']],
        ['Are you experiencing any other symptoms alongside the headache?', 'Nausea or vomiting; Sensitivity to light', ['Nausea or vomiting', 'Sensitivity to light', 'Blurred vision', 'Dizziness', 'Fever', 'None of these']],
      ],
      summary: {
        overview: 'Patient reports a pressing headache across the forehead and temples that started 1–3 days ago, rated moderate, with nausea and sensitivity to light.',
        main_symptoms: ['Headache (pressure around forehead)'], additional_symptoms: ['Nausea', 'Sensitivity to light'],
      },
      status: 'submitted',
    },
    {
      answers: { symptoms: 'Dry cough and sore throat for about a week. Mild fever at night.', onset: '4–7 days ago', severity: 'Mild', body_part: 'Throat / neck; Chest', pattern: '__unsure' },
      followups: [
        ['Is the cough dry or are you bringing up phlegm?', 'Dry', ['Dry', 'With phlegm', 'Both']],
        ['Have you measured your temperature? If so, what was the highest reading?', '__unsure', []],
        ['Is it painful to swallow?', 'Only sometimes', ['Yes', 'No', 'Only sometimes']],
      ],
      summary: {
        overview: 'Patient reports a dry cough and sore throat for 4–7 days, rated mild, with a mild fever at night.',
        main_symptoms: ['Dry cough', 'Sore throat'], additional_symptoms: ['Mild fever at night'],
      },
      status: 'submitted',
    },
    {
      answers: { symptoms: 'Itchy red rash on both forearms, started after gardening.', onset: 'Today', severity: 'Mild', body_part: 'Arms / hands; Skin', pattern: '__na' },
      followups: [
        ['How would you describe the rash?', 'Red; Raised / bumpy', ['Red', 'Raised / bumpy', 'Blistering', 'Dry / scaly']],
        ['Have you started anything new recently, such as a food, product or medicine?', '__skip', []],
      ],
      summary: {
        overview: 'Patient reports an itchy, red, raised rash on both forearms that started today after gardening, rated mild.',
        main_symptoms: ['Itchy red rash on both forearms'], additional_symptoms: [],
      },
      status: 'submitted',
    },
    {
      answers: { symptoms: 'Sudden chest pain spreading to my left arm and I feel sweaty.' },
      urgent: 'Chest pain or pressure',
      status: 'escalated',
    },
  ];

  const kindOf = (v) => (v === '__unsure' ? 'unsure' : v === '__na' ? 'not_applicable' : v === '__skip' ? 'skipped' : 'answer');
  const insert = (...params) => query(`
    INSERT INTO responses (session_id, question_id, question_text, category, position, answer_kind, answer_value, input_method, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [...params, nowIso()]);

  for (const [idx, d] of demo.entries()) {
    const id = await createSession();
    const submittedAt = new Date(Date.now() - (demo.length - idx) * 23 * 60000).toISOString();
    await logEvent(id, 'intake_started');
    const responses = [];
    for (const [i, sq] of STANDARD_QUESTIONS.entries()) {
      if (!(sq.id in d.answers)) continue;
      const v = d.answers[sq.id];
      const kind = kindOf(v);
      await insert(id, sq.id, q[sq.id], 'standard', i, kind, kind === 'answer' ? v : null, sq.id === 'symptoms' ? 'text' : 'options');
      responses.push({ question: q[sq.id], kind });
      await logEvent(id, 'question_viewed', sq.id);
      await logEvent(id, kind === 'skipped' ? 'question_skipped' : 'question_answered', sq.id);
    }
    const followups = (d.followups || []).map(([text, , options], i) => ({ id: `fu_1_${i + 1}`, text, options, multiSelect: options.length > 3, source: 'rules' }));
    for (const [i, [text, v]] of (d.followups || []).entries()) {
      const kind = kindOf(v);
      await insert(id, `fu_1_${i + 1}`, text, 'followup', 100 + i, kind, kind === 'answer' ? v : null, 'options');
      responses.push({ question: text, kind, value: v, followup: true });
      await logEvent(id, 'question_viewed', `followup_${i + 1}`);
      await logEvent(id, kind === 'skipped' ? 'question_skipped' : 'question_answered', `followup_${i + 1}`);
    }

    if (d.status === 'escalated') {
      await touch(id, { status: 'escalated', urgent_reason: d.urgent, submitted_at: submittedAt });
      await logEvent(id, 'urgent_escalated');
      continue;
    }
    const a = d.answers;
    const ans = (k) => (kindOf(a[k]) === 'answer' ? a[k] : null);
    const summary = {
      ...d.summary,
      field_status: { duration: kindOf(a.onset), severity: kindOf(a.severity), affected_body_parts: kindOf(a.body_part), pattern: kindOf(a.pattern) },
      duration: ans('onset'),
      severity: ans('severity'),
      affected_body_parts: ans('body_part') ? ans('body_part').split('; ') : [],
      pattern: ans('pattern'),
      key_findings: responses.filter((r) => r.followup && r.kind === 'answer').map((r) => ({ question: r.question, answer: r.value })),
      not_provided: responses.filter((r) => r.kind === 'unsure' || r.kind === 'skipped').map((r) => ({ question: r.question, reason: r.kind })),
      not_applicable: responses.filter((r) => r.kind === 'not_applicable').map((r) => r.question),
    };
    await touch(id, {
      status: 'submitted', submitted_at: submittedAt, summary_json: JSON.stringify(summary), summary_source: 'rules',
      followups_json: JSON.stringify(followups), followup_rounds: 1, followups_done: 1,
    });
    await logEvent(id, 'summary_generated');
    await logEvent(id, 'summary_confirmed');
    if (idx === 0) {
      await query('INSERT INTO feedback (session_id, liked, comment, created_at) VALUES ($1, 1, $2, $3)', [id, 'Quick and easy to use.', nowIso()]);
      await logEvent(id, 'feedback_submitted');
    }
  }

  // Synthetic consultation timings: two baseline days, two assisted days.
  const consult = (...params) => query(`
    INSERT INTO consultations (doctor_id, phase, complexity, started_at, ended_at, duration_sec) VALUES ($1, $2, $3, $4, $5, $6)`, params);
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    d.setHours(10, 0, 0, 0);
    return d.getTime();
  };
  const plan = [
    ['baseline', 30, [['low', 11], ['medium', 15], ['low', 10], ['high', 22], ['medium', 14], ['low', 12]]],
    ['baseline', 29, [['medium', 16], ['low', 11], ['medium', 15], ['high', 24], ['low', 10]]],
    ['assisted', 2, [['low', 8], ['medium', 12], ['low', 7], ['high', 19], ['medium', 11], ['low', 8], ['medium', 12]]],
    ['assisted', 1, [['medium', 11], ['low', 8], ['high', 20], ['low', 7], ['medium', 12], ['low', 9]]],
  ];
  for (const [phase, offset, list] of plan) {
    let t = day(offset);
    for (const [complexity, minutes] of list) {
      await consult(doctorId, phase, complexity, new Date(t).toISOString(), new Date(t + minutes * 60000).toISOString(), minutes * 60);
      t += (minutes + 3) * 60000;
    }
  }
  console.log(`Inserted ${demo.length} synthetic submissions and sample consultation timings.`);
}

await closeDb();
