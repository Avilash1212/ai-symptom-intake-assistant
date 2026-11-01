import { Outlet, useNavigate } from 'react-router-dom';
import { Brand, FooterNote, Spinner } from '../components/Chrome.jsx';
import { PatientProvider, usePatient } from './PatientContext.jsx';

function Frame() {
  const { state, loading, end } = usePatient();
  const navigate = useNavigate();

  const exit = async () => {
    if (state && !['submitted', 'escalated'].includes(state.status)
      && !window.confirm('Leave the intake? Your answers will not be sent to the doctor.')) return;
    await end();
    navigate('/');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <Brand subtitle="Patient symptom intake" to="/patient" />
        <div className="topbar-right">
          {state?.code && <span className="session-pill">Your reference <strong className="mono">{state.code}</strong></span>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={exit}>Exit</button>
        </div>
      </header>
      <main className="main narrow">
        {loading ? <Spinner title="Loading…" /> : <Outlet />}
      </main>
      <FooterNote />
    </div>
  );
}

export function PatientLayout() {
  return (
    <PatientProvider>
      <Frame />
    </PatientProvider>
  );
}

export function NoSession() {
  const { start } = usePatient();
  const navigate = useNavigate();
  return (
    <div className="card card-pad stack" style={{ textAlign: 'center' }}>
      <h1 className="page-title">No active intake</h1>
      <p className="muted">Your previous intake has ended or expired. You can start a new one.</p>
      <div>
        <button type="button" className="btn btn-primary" onClick={async () => { await start(); navigate('/patient'); }}>
          Start a new symptom intake
        </button>
      </div>
    </div>
  );
}
