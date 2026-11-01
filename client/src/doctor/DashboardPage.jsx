import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatDateTime } from '../api.js';
import { Spinner } from '../components/Chrome.jsx';
import { StatusBadge } from './StatusBadge.jsx';

const FILTERS = [
  ['all', 'All'],
  ['new', 'New'],
  ['urgent', 'Urgent'],
  ['reviewed', 'Reviewed'],
];

function matches(row, filter) {
  if (filter === 'urgent') return row.status === 'escalated';
  if (filter === 'new') return row.status !== 'escalated' && row.review_status === 'new';
  if (filter === 'reviewed') return row.review_status === 'reviewed';
  return true;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    const load = () => api.get('/api/doctor/submissions')
      .then((r) => alive && (setRows(r), setError('')))
      .catch((err) => {
        if (err.status === 401) navigate('/doctor/login', { replace: true });
        else if (alive) setError(err.message);
      });
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [navigate]);

  if (!rows && !error) return <Spinner title="Loading submissions…" />;
  const visible = (rows || []).filter((r) => matches(r, filter));
  const urgentCount = (rows || []).filter((r) => r.status === 'escalated' && r.review_status === 'new').length;

  return (
    <div className="stack">
      <div className="row wrap">
        <div>
          <h1 className="page-title">Patient submissions</h1>
          <p className="page-sub">Symptom summaries submitted by patients before consultation. Updates automatically.</p>
        </div>
      </div>

      {urgentCount > 0 && (
        <div className="alert alert-danger">
          <strong>{urgentCount} urgent escalation{urgentCount > 1 ? 's' : ''}</strong>&nbsp;– the patient was advised to seek urgent help. Please check on them.
        </div>
      )}
      {error && <div className="alert alert-danger">{error}</div>}

      <section className="card">
        <div className="card-head">
          <h2>{visible.length} {visible.length === 1 ? 'patient' : 'patients'}</h2>
          <div className="tabs" role="tablist">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={`tab${filter === key ? ' active' : ''}`} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="empty">No submissions to show yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient / session ID</th>
                <th>Submitted</th>
                <th>Status</th>
                <th className="hide-sm">Main symptoms</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => navigate(`/doctor/patients/${r.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/doctor/patients/${r.id}`)}
                >
                  <td><strong className="mono">{r.code}</strong></td>
                  <td>{formatDateTime(r.submitted_at)}</td>
                  <td><StatusBadge status={r.status} reviewStatus={r.review_status} /></td>
                  <td className="hide-sm muted">
                    {r.status === 'escalated' ? r.urgent_reason : (r.mainSymptoms || []).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
