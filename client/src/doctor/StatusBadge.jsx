export function StatusBadge({ status, reviewStatus }) {
  if (status === 'escalated') return <span className="badge badge-urgent">Urgent – escalated</span>;
  if (reviewStatus === 'reviewed') return <span className="badge badge-reviewed">Reviewed</span>;
  return <span className="badge badge-new">New</span>;
}
