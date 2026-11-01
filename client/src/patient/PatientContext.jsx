import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '../api.js';

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/patient/session')
      .then(setState)
      .catch((err) => {
        if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 404)) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Wraps a call that returns the session state; a 409 "urgent" reply also carries state.
  const run = useCallback(async (fn) => {
    setError('');
    try {
      const next = await fn();
      if (next) setState(next);
      return next;
    } catch (err) {
      if (err instanceof ApiError && err.body?.state) {
        setState(err.body.state);
        return err.body.state;
      }
      setError(err.message);
      throw err;
    }
  }, []);

  const value = {
    state,
    loading,
    error,
    setError,
    start: () => run(() => api.post('/api/patient/sessions')),
    answer: (questionId, body) => run(() => api.put(`/api/patient/session/responses/${encodeURIComponent(questionId)}`, body)),
    requestFollowups: () => run(() => api.post('/api/patient/session/followups')),
    generateSummary: () => run(() => api.post('/api/patient/session/summary')),
    confirm: () => run(() => api.post('/api/patient/session/confirm')),
    sendFeedback: (body) => run(() => api.post('/api/patient/session/feedback', body)),
    viewed: (questionId) => api.post('/api/patient/session/events', { type: 'question_viewed', questionId }).catch(() => {}),
    end: async () => {
      await api.post('/api/patient/session/end').catch(() => {});
      setState(null);
    },
  };

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatient() {
  return useContext(PatientContext);
}
