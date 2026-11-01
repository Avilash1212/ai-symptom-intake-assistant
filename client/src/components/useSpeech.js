import { useCallback, useEffect, useRef, useState } from 'react';

// Speech-to-text via the browser Web Speech API (Chrome / Edge). The
// transcript is placed into the text box so the patient can review and edit it.
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function useSpeech(onFinalText) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const callbackRef = useRef(onFinalText);
  callbackRef.current = onFinalText;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!Recognition) return;
    setError('');
    const rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) callbackRef.current(result[0].transcript.trim());
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Microphone access was blocked. You can type instead.');
      else if (e.error === 'no-speech') setError('No speech was detected. Please try again.');
      else if (e.error !== 'aborted') setError('Voice input stopped unexpectedly. You can type instead.');
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported: Boolean(Recognition), listening, interim, error, start, stop };
}
