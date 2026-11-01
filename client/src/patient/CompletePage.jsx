import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icons.jsx';
import { NoSession } from './PatientLayout.jsx';
import { usePatient } from './PatientContext.jsx';

export function CompletePage() {
  const { state, error, sendFeedback, end } = usePatient();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(state?.feedback?.liked ?? false);
  const [comment, setComment] = useState(state?.feedback?.comment ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(Boolean(state?.feedback));

  if (!state) return <NoSession />;
  if (state.status === 'escalated') return <Navigate to="/patient/urgent" replace />;
  if (state.status !== 'submitted') return <Navigate to="/patient" replace />;

  const submitFeedback = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await sendFeedback({ liked, comment });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const finish = async () => {
    await end();
    navigate('/', { replace: true });
  };

  return (
    <div className="stack">
      <div className="card card-pad" style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--success)', display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Icon.CheckCircle /></div>
        <h1 className="page-title">Your summary has been sent</h1>
        <p className="page-sub">The doctor will review it before your consultation. Please take a seat and wait to be called.</p>
        <p style={{ marginTop: 18 }}>
          <span className="session-pill" style={{ fontSize: 15 }}>Your reference <strong className="mono">{state.code}</strong></span>
        </p>
        <p className="tiny muted" style={{ marginTop: 10 }}>If your symptoms get worse while you wait, tell the clinic staff straight away.</p>
      </div>

      <form className="card card-pad" onSubmit={submitFeedback}>
        <h2 style={{ fontSize: 18 }}>How was your experience?</h2>
        <p className="small muted" style={{ marginTop: 4 }}>Optional. Your feedback helps us improve this assistant.</p>
        {sent ? (
          <div className="alert alert-success" style={{ marginTop: 16 }}>Thank you for your feedback.</div>
        ) : (
          <>
            <div style={{ marginTop: 16 }}>
              <button type="button" className={`btn ${liked ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={liked} onClick={() => setLiked(!liked)}>
                <Icon.ThumbUp /> {liked ? 'You liked this' : 'Like'}
              </button>
            </div>
            <label className="field" style={{ marginTop: 16 }}>
              <span className="field-label">Written feedback (optional)</span>
              <textarea className="textarea" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us what worked well or what could be better. Please don't include personal details." />
            </label>
            {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}
            <div className="row" style={{ marginTop: 16 }}>
              <span className="spacer" />
              <button type="submit" className="btn btn-secondary" disabled={sending || (!liked && !comment.trim())}>
                {sending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </>
        )}
      </form>

      <div className="row">
        <span className="spacer" />
        <button type="button" className="btn btn-primary btn-lg" onClick={finish}>Finish</button>
      </div>
      <p className="tiny muted" style={{ textAlign: 'right' }}>Pressing Finish clears your session from this computer for the next patient.</p>
    </div>
  );
}
