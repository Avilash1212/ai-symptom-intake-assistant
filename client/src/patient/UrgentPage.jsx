import { Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icons.jsx';
import { NoSession } from './PatientLayout.jsx';
import { usePatient } from './PatientContext.jsx';

export function UrgentPage() {
  const { state, end } = usePatient();
  const navigate = useNavigate();
  if (!state) return <NoSession />;
  if (state.status !== 'escalated') return <Navigate to="/patient" replace />;

  return (
    <div className="urgent-card" role="alert">
      <div className="urgent-icon"><Icon.Alert /></div>
      <h1>Please seek urgent medical help now</h1>
      <p className="msg">{state.urgent?.message}</p>
      {state.urgent?.reason && (
        <p className="small muted" style={{ marginTop: 14 }}>
          You mentioned: <strong>{state.urgent.reason}</strong>
        </p>
      )}
      <p className="small" style={{ marginTop: 18 }}>
        The routine questions have been stopped. Clinic staff can see your reference <strong className="mono">{state.code}</strong>.
      </p>
      <div style={{ marginTop: 28 }}>
        <button type="button" className="btn btn-secondary" onClick={async () => { await end(); navigate('/', { replace: true }); }}>
          I have told the clinic staff
        </button>
      </div>
    </div>
  );
}
