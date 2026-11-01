import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { QuestionCard } from '../components/QuestionCard.jsx';
import { Spinner } from '../components/Chrome.jsx';
import { NoSession } from './PatientLayout.jsx';
import { usePatient } from './PatientContext.jsx';

export function IntakePage() {
  const patient = usePatient();
  const { state } = patient;
  if (!state) return <NoSession />;
  if (state.status === 'escalated') return <Navigate to="/patient/urgent" replace />;
  if (state.status === 'submitted') return <Navigate to="/patient/complete" replace />;
  return <IntakeFlow />;
}

function IntakeFlow() {
  const { state, error, answer, requestFollowups, generateSummary, viewed } = usePatient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const questions = state.questions;
  const standardCount = questions.filter((q) => q.category === 'standard').length;

  const [index, setIndex] = useState(() => {
    if (editId) {
      const i = questions.findIndex((q) => q.id === editId);
      if (i >= 0) return i;
    }
    return questions.findIndex((q) => !state.responses[q.id]);
  });
  const [phase, setPhase] = useState('question'); // question | followups | summary
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  const summarize = useCallback(async () => {
    setPhase('summary');
    try {
      const next = await generateSummary();
      if (next?.status === 'escalated') return navigate('/patient/urgent', { replace: true });
      navigate('/patient/review');
    } catch {
      setPhase('question');
    }
  }, [generateSummary, navigate]);

  // Called once the patient is past the last available question.
  const continueAfter = useCallback(async (current, nextIndex) => {
    if (nextIndex < current.questions.length) return setIndex(nextIndex);
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (!current.followupsDone) {
        setPhase('followups');
        const next = await requestFollowups();
        if (next?.status === 'escalated') return navigate('/patient/urgent', { replace: true });
        if (next && nextIndex < next.questions.length) {
          setIndex(nextIndex);
          setPhase('question');
          return;
        }
      }
      await summarize();
    } catch {
      setPhase('question');
      setIndex(Math.max(0, current.questions.length - 1));
    } finally {
      busyRef.current = false;
    }
  }, [requestFollowups, summarize, navigate]);

  // Everything already answered (e.g. page reload): move straight on.
  useEffect(() => {
    if (index === -1) continueAfter(state, questions.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const question = index >= 0 ? questions[index] : null;
  useEffect(() => {
    if (question && phase === 'question') viewed(question.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, phase]);

  if (phase === 'followups') {
    return <Spinner title="Preparing a few follow-up questions…">Based on what you've told us so far.</Spinner>;
  }
  if (phase === 'summary' || !question) {
    return <Spinner title="Preparing your summary…">This usually takes a few seconds.</Spinner>;
  }

  const submit = async (body) => {
    setSaving(true);
    try {
      const next = await answer(question.id, body);
      if (next?.status === 'escalated') return navigate('/patient/urgent', { replace: true });
      if (editId) return navigate('/patient/review');
      await continueAfter(next, index + 1);
    } catch {
      /* error shown from context */
    } finally {
      setSaving(false);
    }
  };

  const isFollowup = question.category === 'followup';
  const followupCount = questions.length - standardCount;
  const expectedTotal = questions.length + (state.followupsDone ? 0 : 3);
  const progress = Math.min(100, Math.round((index / expectedTotal) * 100));

  return (
    <div>
      <div className="progress-wrap">
        <div className="progress-meta">
          <span>{isFollowup ? `Follow-up ${index - standardCount + 1} of ${followupCount}` : `Question ${index + 1} of ${standardCount}`}</span>
          {editId ? <span>Editing your answer</span> : <span>{isFollowup ? 'Almost done' : 'Standard questions'}</span>}
        </div>
        <div className="progress" aria-hidden="true"><span style={{ width: `${editId ? 100 : progress}%` }} /></div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      <QuestionCard
        key={question.id}
        question={question}
        response={state.responses[question.id]}
        saving={saving}
        stepLabel={index === 0 ? 'Step 1 · Describe your symptoms' : 'Standard question'}
        submitLabel={editId ? 'Save and return to review' : 'Continue'}
        onSubmit={submit}
        onBack={editId ? () => navigate('/patient/review') : index > 0 ? () => setIndex(index - 1) : null}
      />

      {!editId && isFollowup && (
        <p className="small muted" style={{ textAlign: 'center', marginTop: 18 }}>
          Follow-up questions are optional.{' '}
          <button type="button" className="link-btn" onClick={summarize}>Finish and review my summary</button>
        </p>
      )}
    </div>
  );
}
