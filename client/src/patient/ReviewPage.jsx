import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnswerText, SummaryView } from '../components/SummaryView.jsx';
import { Spinner } from '../components/Chrome.jsx';
import { Icon } from '../components/Icons.jsx';
import { NoSession } from './PatientLayout.jsx';
import { usePatient } from './PatientContext.jsx';

export function ReviewPage() {
  const { state, error, generateSummary, confirm } = usePatient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');

  if (!state) return <NoSession />;
  if (state.status === 'escalated') return <Navigate to="/patient/urgent" replace />;
  if (state.status === 'submitted') return <Navigate to="/patient/complete" replace />;
  if (!state.summary) return <Navigate to="/patient" replace />;
  if (busy === 'summary') return <Spinner title="Updating your summary…" />;

  const refresh = async () => {
    setBusy('summary');
    try {
      const next = await generateSummary();
      if (next?.status === 'escalated') navigate('/patient/urgent', { replace: true });
    } finally {
      setBusy('');
    }
  };

  const submit = async () => {
    setBusy('confirm');
    try {
      await confirm();
      navigate('/patient/complete', { replace: true });
    } catch {
      setBusy('');
    }
  };

  const answered = state.questions.filter((q) => state.responses[q.id]);

  return (
    <div className="stack">
      <div>
        <span className="eyebrow">Step 3 · Review</span>
        <h1 className="page-title" style={{ marginTop: 6 }}>Please check your summary</h1>
        <p className="page-sub">This is what your doctor will see. If anything is wrong or missing, edit your answer below before confirming.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {state.summaryStale && (
        <div className="alert alert-warn">
          <Icon.Info />
          <div style={{ flex: 1 }}>You changed an answer, so the summary needs updating before you can confirm.</div>
          <button type="button" className="btn btn-primary btn-sm" onClick={refresh}>Update summary</button>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Symptom summary</h2>
          <span className="badge badge-ai"><Icon.Sparkle /> Prepared from your answers</span>
        </div>
        <div className="card-body">
          <SummaryView summary={state.summary} />
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Your answers</h2></div>
        <div className="card-body">
          <ul className="response-list">
            {answered.map((q) => (
              <li className="response-item" key={q.id}>
                <div style={{ flex: 1 }}>
                  <div className="q">{q.text}</div>
                  <div className="a"><AnswerText {...state.responses[q.id]} /></div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/patient?edit=${encodeURIComponent(q.id)}`)}>
                  <Icon.Edit /> Edit
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="card card-pad">
        <p className="small muted">
          This summary only records what you told us. It is not a diagnosis and does not replace your consultation.
          By confirming, you agree to share it with the doctor at this clinic.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <span className="spacer" />
          <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={state.summaryStale || busy === 'confirm'}>
            {busy === 'confirm' ? 'Submitting…' : 'Confirm and send to doctor'}
          </button>
        </div>
      </div>
    </div>
  );
}
