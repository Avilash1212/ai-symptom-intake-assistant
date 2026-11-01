import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDateTime } from '../api.js';
import { Spinner } from '../components/Chrome.jsx';

const fmt = (v, suffix = '') => (v == null ? '—' : `${v}${suffix}`);

function Stat({ label, value, hint, keyMetric }) {
  return (
    <div className={`card stat${keyMetric ? ' key' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function change(before, after, higherIsBetter) {
  if (before == null || after == null || before === 0) return '—';
  const pct = Math.round(((after - before) / before) * 100);
  const good = higherIsBetter ? pct > 0 : pct < 0;
  return <span style={{ color: pct === 0 ? 'inherit' : good ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{pct > 0 ? '+' : ''}{pct}%</span>;
}

export function MetricsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.get('/api/doctor/metrics').then(setData).catch((err) => {
    if (err.status === 401) navigate('/doctor/login', { replace: true });
    else setError(err.message);
  }), [navigate]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Spinner title="Loading metrics…" />;
  const p = data.patient;
  const { baseline: b, assisted: a } = data.doctor;
  const maxViewed = Math.max(1, ...p.questionFunnel.map((q) => q.viewed));

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Product metrics</h1>
        <p className="page-sub">How patients move through the intake, and whether consultation time changes. Prototype figures for evaluation only.</p>
      </div>

      <h2 className="section-title">Patient journey</h2>
      <div className="stat-grid">
        <Stat keyMetric label="Summary generation rate" value={fmt(p.summaryGenerationRate, '%')} hint="Summaries generated ÷ intakes started" />
        <Stat label="Intakes started" value={p.started} />
        <Stat label="Intakes completed" value={p.completed} hint={`${fmt(p.completionRate, '%')} of started`} />
        <Stat label="Urgent escalations" value={p.escalated} hint="Routine intake stopped" />
        <Stat label="Summaries generated" value={p.summariesGenerated} />
        <Stat label="Summaries confirmed & submitted" value={p.summariesConfirmed} />
        <Stat label="Questions answered" value={p.totalQuestionsAnswered} hint={`${fmt(p.avgQuestionsAnswered)} per intake on average`} />
        <Stat label="Patients giving feedback" value={p.feedbackCount} hint={`${p.likes} liked`} />
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Drop-off by question</h3>
          <span className="small muted">{p.droppedAtReview} left at the summary review step</span>
        </div>
        <table className="table compact">
          <thead>
            <tr><th>Question</th><th className="num">Reached</th><th className="num">Answered</th><th className="num">Skipped</th><th>Left the intake here</th></tr>
          </thead>
          <tbody>
            {p.questionFunnel.map((q) => (
              <tr key={q.key}>
                <td>{q.label}</td>
                <td className="num">{q.viewed}</td>
                <td className="num">{q.answered}</td>
                <td className="num">{q.skipped}</td>
                <td>
                  <div className="bar-cell">
                    <div className="bar drop"><span style={{ width: `${(q.droppedHere / maxViewed) * 100}%` }} /></div>
                    <span className="num" style={{ minWidth: 24 }}>{q.droppedHere}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="section-title">Doctor time: before vs. after the assistant</h2>
      <div className="alert alert-info">
        Compare like with like: averages are split by doctor-rated complexity, and patients per day reflects clinic workload.
        Faster consultations do not by themselves mean better clinical outcomes – interpret alongside clinical judgement.
      </div>
      <section className="card">
        <table className="table compact">
          <thead>
            <tr><th>Measure</th><th className="num">Before (baseline)</th><th className="num">With assistant</th><th className="num">Change</th></tr>
          </thead>
          <tbody>
            <tr><td>Consultations recorded</td><td className="num">{b.consultations} over {b.days} day(s)</td><td className="num">{a.consultations} over {a.days} day(s)</td><td className="num">—</td></tr>
            <tr><td>Patients consulted per hour</td><td className="num">{fmt(b.patientsPerHour)}</td><td className="num">{fmt(a.patientsPerHour)}</td><td className="num">{change(b.patientsPerHour, a.patientsPerHour, true)}</td></tr>
            <tr><td>Patients consulted per day</td><td className="num">{fmt(b.patientsPerDay)}</td><td className="num">{fmt(a.patientsPerDay)}</td><td className="num">{change(b.patientsPerDay, a.patientsPerDay, true)}</td></tr>
            <tr><td>Average consultation time (all)</td><td className="num">{fmt(b.avgMinutes, ' min')}</td><td className="num">{fmt(a.avgMinutes, ' min')}</td><td className="num">{change(b.avgMinutes, a.avgMinutes, false)}</td></tr>
            {['low', 'medium', 'high'].map((c) => (
              <tr key={c}>
                <td>&nbsp;&nbsp;Average time – {c} complexity</td>
                <td className="num">{fmt(b.byComplexity[c].avgMinutes, ' min')} <span className="muted tiny">(n={b.byComplexity[c].count})</span></td>
                <td className="num">{fmt(a.byComplexity[c].avgMinutes, ' min')} <span className="muted tiny">(n={a.byComplexity[c].count})</span></td>
                <td className="num">{change(b.byComplexity[c].avgMinutes, a.byComplexity[c].avgMinutes, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ConsultationLogForm onSaved={load} />

      <section className="card">
        <div className="card-head"><h3>Recent written feedback</h3></div>
        {data.feedback.length === 0 ? <div className="empty">No written feedback yet.</div> : (
          <ul className="response-list card-body">
            {data.feedback.map((f) => (
              <li className="response-item" key={`${f.code}-${f.created_at}`}>
                <div style={{ flex: 1 }}>
                  <div className="q">{formatDateTime(f.created_at)} · <span className="mono">{f.code}</span>{f.liked ? ' · 👍 Liked' : ''}</div>
                  <div className="a">{f.comment}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConsultationLogForm({ onSaved }) {
  const [form, setForm] = useState({ phase: 'baseline', complexity: 'medium', startedAt: '', durationMinutes: '' });
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/api/doctor/consultations', { ...form, startedAt: new Date(form.startedAt).toISOString() });
      setForm({ ...form, durationMinutes: '' });
      setMsg('Saved.');
      onSaved();
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head"><h3>Log a consultation manually</h3><span className="small muted">For baseline data from before the assistant</span></div>
      <div className="card-body">
        <div className="form-grid">
          <label className="field"><span className="field-label">Period</span>
            <select className="select" value={form.phase} onChange={set('phase')}>
              <option value="baseline">Before assistant</option>
              <option value="assisted">With assistant</option>
            </select>
          </label>
          <label className="field"><span className="field-label">Complexity</span>
            <select className="select" value={form.complexity} onChange={set('complexity')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </label>
          <label className="field"><span className="field-label">Started at</span>
            <input className="input" style={{ minHeight: 44 }} type="datetime-local" required value={form.startedAt} onChange={set('startedAt')} />
          </label>
          <label className="field"><span className="field-label">Duration (min)</span>
            <input className="input" style={{ minHeight: 44 }} type="number" min="1" max="240" required value={form.durationMinutes} onChange={set('durationMinutes')} />
          </label>
          <button className="btn btn-secondary" style={{ minHeight: 44 }}>Add</button>
        </div>
        {msg && <p className="small" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
    </form>
  );
}
