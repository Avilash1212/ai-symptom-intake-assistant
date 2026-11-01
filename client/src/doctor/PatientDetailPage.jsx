import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDateTime } from '../api.js';
import { Spinner } from '../components/Chrome.jsx';
import { Icon } from '../components/Icons.jsx';
import { AnswerText, SummaryView } from '../components/SummaryView.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const METHOD = { voice: 'Spoken', text: 'Typed', options: 'Selected' };

export function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/doctor/submissions/${encodeURIComponent(id)}`)
      .then(setData)
      .catch((err) => (err.status === 401 ? navigate('/doctor/login', { replace: true }) : setError(err.message)));
  }, [id, navigate]);

  if (error) return <div className="alert alert-danger">{error} <Link to="/doctor">Back to patients</Link></div>;
  if (!data) return <Spinner title="Loading patient summary…" />;

  const setReview = async (reviewStatus) => {
    const r = await api.patch(`/api/doctor/submissions/${data.id}`, { reviewStatus });
    setData({ ...data, reviewStatus: r.reviewStatus });
  };

  return (
    <div className="stack">
      <Link to="/doctor" className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
        <Icon.Back /> All patients
      </Link>
      <div className="row wrap">
        <div>
          <div className="row" style={{ gap: 12 }}>
            <h1 className="page-title mono">{data.code}</h1>
            <StatusBadge status={data.status} reviewStatus={data.reviewStatus} />
          </div>
          <p className="page-sub">Submitted {formatDateTime(data.submittedAt)}</p>
        </div>
        <span className="spacer" />
        {data.reviewStatus === 'reviewed' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReview('new')}>Mark as not reviewed</button>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setReview('reviewed')}>Mark as reviewed</button>
        )}
      </div>

      {data.status === 'escalated' && (
        <div className="alert alert-danger">
          <Icon.Alert width={22} height={22} />
          <div>
            <strong>Urgent escalation: {data.urgentReason}.</strong> Routine intake was stopped and the patient was advised to seek urgent help
            immediately. No summary was generated; the patient's original responses are shown below.
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="stack">
          {data.summary && (
            <section className="card">
              <div className="card-head">
                <h2>Symptom summary</h2>
                <span className="badge badge-ai"><Icon.Sparkle /> {data.summarySource === 'ai' ? 'AI-generated' : 'Auto-generated'} · confirmed by patient</span>
              </div>
              <div className="card-body">
                <SummaryView summary={data.summary} />
                <p className="tiny muted" style={{ marginTop: 14 }}>
                  Generated from patient-reported answers only. It contains no diagnosis and should be verified with the patient during consultation.
                </p>
              </div>
            </section>
          )}
          <section className="card">
            <div className="card-head"><h2>Original patient responses</h2></div>
            <div className="card-body">
              <ul className="response-list">
                {data.responses.map((r) => (
                  <li className="response-item" key={r.questionId}>
                    <div style={{ flex: 1 }}>
                      <div className="q">
                        {r.question}
                        {r.category === 'followup' && <span className="badge badge-plain" style={{ marginLeft: 8 }}>Follow-up</span>}
                      </div>
                      <div className="a"><AnswerText kind={r.kind} value={r.value} /></div>
                    </div>
                    {r.kind === 'answer' && r.inputMethod && <span className="tiny muted">{METHOD[r.inputMethod]}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
        <ConsultationTimer sessionId={data.id} existing={data.consultations} />
      </div>
    </div>
  );
}

function ConsultationTimer({ sessionId, existing }) {
  const open = existing.find((c) => !c.ended_at);
  const [active, setActive] = useState(open ? { id: open.id, startedAt: Date.parse(open.started_at) } : null);
  const [complexity, setComplexity] = useState(open?.complexity || 'medium');
  const [done, setDone] = useState(existing.filter((c) => c.duration_sec));
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const start = async () => {
    setError('');
    try {
      const r = await api.post('/api/doctor/consultations/start', { sessionId, complexity });
      setActive({ id: r.id, startedAt: Date.now() });
      setNow(Date.now());
    } catch (err) { setError(err.message); }
  };
  const stop = async () => {
    try {
      const r = await api.post(`/api/doctor/consultations/${active.id}/end`);
      setDone([...done, { id: r.id, duration_sec: r.durationSec, complexity }]);
      setActive(null);
    } catch (err) { setError(err.message); }
  };

  const elapsed = active ? Math.max(0, Math.floor((now - active.startedAt) / 1000)) : 0;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <section className="card">
      <div className="card-head"><h2>Consultation timing</h2></div>
      <div className="card-body stack">
        <p className="small muted">Optional. Timing consultations lets the clinic compare consultation time before and after introducing the assistant.</p>
        <label className="field">
          <span className="field-label">Case complexity (your judgement)</span>
          <select className="select" value={complexity} disabled={Boolean(active)} onChange={(e) => setComplexity(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        {active ? (
          <div className="row">
            <span className="timer">{mmss}</span>
            <span className="spacer" />
            <button type="button" className="btn btn-danger" onClick={stop}>End consultation</button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-block" onClick={start}>Start consultation timer</button>
        )}
        {error && <p className="error-text">{error}</p>}
        {done.length > 0 && (
          <p className="small muted">
            Recorded: {done.map((c) => `${Math.round(c.duration_sec / 6) / 10} min (${c.complexity})`).join(', ')}
          </p>
        )}
      </div>
    </section>
  );
}
