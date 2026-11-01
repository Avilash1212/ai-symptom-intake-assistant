import { Link } from 'react-router-dom';
import { Icon } from './Icons.jsx';

export function Brand({ to = '/', subtitle }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark"><Icon.Cross /></span>
      <span>
        AI Symptom Intake Assistant
        {subtitle && <small>{subtitle}</small>}
      </span>
    </Link>
  );
}

export function FooterNote() {
  return (
    <p className="footer-note">
      Early-stage prototype for demonstration only. It collects symptom information for your doctor and does not provide diagnosis or treatment advice.
    </p>
  );
}

export function Spinner({ title, children }) {
  return (
    <div className="card loading-card" role="status" aria-live="polite">
      <div className="spinner" />
      <h2 style={{ fontSize: 19 }}>{title}</h2>
      {children && <p className="muted" style={{ marginTop: 6 }}>{children}</p>}
    </div>
  );
}
