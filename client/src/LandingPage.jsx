import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { Brand } from './components/Chrome.jsx';
import { Icon } from './components/Icons.jsx';

export function LandingPage() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  // Always begins a fresh intake, so a shared clinic computer never shows a
  // previous patient's session.
  const startPatient = async () => {
    setStarting(true);
    setError('');
    try {
      await api.post('/api/patient/sessions');
      navigate('/patient');
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  return (
    <div className="landing">
      <header className="topbar"><Brand /></header>
      <section className="landing-hero">
        <h1>Welcome to AI Symptom Intake Assistant. How would you like to continue?</h1>
        <p className="lead">Choose the option that describes you.</p>

        <div className="role-grid">
          <button type="button" className="role-card" onClick={startPatient} disabled={starting}>
            <span className="role-icon"><Icon.User /></span>
            <h2>I'm a patient</h2>
            <p>Tell us about your symptoms before you see the doctor. It takes about 3–5 minutes. No name or contact details needed.</p>
            <span className="role-cta">{starting ? 'Starting…' : <>Start symptom intake <Icon.Arrow /></>}</span>
          </button>
          <button type="button" className="role-card doctor" onClick={() => navigate('/doctor/login')}>
            <span className="role-icon"><Icon.Stethoscope /></span>
            <h2>I'm a doctor</h2>
            <p>Sign in securely to review symptom summaries submitted by patients before their consultation.</p>
            <span className="role-cta"><Icon.Lock /> Doctor sign-in <Icon.Arrow /></span>
          </button>
        </div>
        {error && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}

        <p className="disclaimer">
          This assistant only collects and organises your symptom information for the doctor. It does not diagnose, prescribe or give treatment advice.
          If you think you are having a medical emergency, tell the clinic staff immediately or call your local emergency number.
          Early-stage prototype – not a clinically validated medical device.
        </p>
      </section>
    </div>
  );
}
