import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Brand } from '../components/Chrome.jsx';
import { Icon } from '../components/Icons.jsx';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/doctor/login', { email, password });
      const from = location.state?.from;
      navigate(from && from.startsWith('/doctor') ? from : '/doctor', { replace: true });
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <header className="topbar"><Brand subtitle="Doctor access" /></header>
      <div className="login-wrap">
        <form className="card login-card" onSubmit={submit}>
          <div className="row" style={{ gap: 8, color: 'var(--muted)' }}><Icon.Lock /><span className="small">Secure doctor sign-in</span></div>
          <h1 className="page-title" style={{ marginTop: 10 }}>Sign in</h1>
          <p className="page-sub">View patient symptom summaries submitted before consultation.</p>
          <label className="field" style={{ marginTop: 24 }}>
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field" style={{ marginTop: 16 }}>
            <span className="field-label">Password</span>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error-text" role="alert" style={{ marginTop: 12 }}>{error}</p>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 22 }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="small" style={{ marginTop: 18, textAlign: 'center' }}>
            <Link to="/">Back to start</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
