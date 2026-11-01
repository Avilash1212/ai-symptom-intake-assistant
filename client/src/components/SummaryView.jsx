const REASON = { unsure: "Don't know / Not sure", skipped: 'Skipped' };

function Value({ children, empty = 'Not provided' }) {
  const isEmpty = children == null || (Array.isArray(children) && children.length === 0) || children === '';
  if (isEmpty) return <span className="none">{empty}</span>;
  if (Array.isArray(children)) {
    return <div className="tag-list">{children.map((t) => <span className="tag" key={t}>{t}</span>)}</div>;
  }
  return children;
}

const EMPTY_LABEL = {
  not_applicable: 'Not applicable',
  unsure: "Don't know / Not sure",
  skipped: 'Skipped',
};

/** Structured symptom summary, shared by the patient review and doctor views. */
export function SummaryView({ summary }) {
  if (!summary) return null;
  const emptyFor = (field) => EMPTY_LABEL[summary.field_status?.[field]] ?? 'Not provided';
  return (
    <div>
      {summary.overview && <p className="overview">{summary.overview}</p>}
      <dl className="summary-grid">
        <dt>Main symptoms</dt>
        <dd><Value>{summary.main_symptoms}</Value></dd>
        <dt>Duration</dt>
        <dd><Value empty={emptyFor('duration')}>{summary.duration}</Value></dd>
        <dt>Severity</dt>
        <dd><Value empty={emptyFor('severity')}>{summary.severity}</Value></dd>
        <dt>Affected body parts</dt>
        <dd><Value empty={emptyFor('affected_body_parts')}>{summary.affected_body_parts}</Value></dd>
        <dt>Pattern</dt>
        <dd><Value empty={emptyFor('pattern')}>{summary.pattern}</Value></dd>
        <dt>Additional symptoms</dt>
        <dd><Value empty="None reported">{summary.additional_symptoms}</Value></dd>
        <dt>Follow-up answers</dt>
        <dd>
          {summary.key_findings?.length ? summary.key_findings.map((f) => (
            <div className="finding" key={f.question}>
              <div className="q">{f.question}</div>
              <div>{f.answer}</div>
            </div>
          )) : <span className="none">None</span>}
        </dd>
        <dt>Could not provide</dt>
        <dd>
          {summary.not_provided?.length ? (
            <ul className="gap-list">
              {summary.not_provided.map((g) => (
                <li key={g.question}>
                  {g.question} <span className={`kind-label kind-${g.reason}`}>{REASON[g.reason]}</span>
                </li>
              ))}
            </ul>
          ) : <span className="none">Nothing missing</span>}
        </dd>
        <dt>Marked not applicable</dt>
        <dd>
          {summary.not_applicable?.length ? (
            <ul className="gap-list">{summary.not_applicable.map((q) => <li key={q}>{q}</li>)}</ul>
          ) : <span className="none">None</span>}
        </dd>
      </dl>
    </div>
  );
}

export function AnswerText({ kind, value }) {
  if (kind === 'answer') return value;
  if (kind === 'not_applicable') return <span className="kind-label kind-na">Not applicable</span>;
  if (kind === 'unsure') return <span className="kind-label kind-unsure">Don't know / Not sure</span>;
  return <span className="kind-label kind-skipped">Skipped</span>;
}
