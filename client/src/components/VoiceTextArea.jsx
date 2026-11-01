import { useSpeech } from './useSpeech.js';
import { Icon } from './Icons.jsx';

export function VoiceTextArea({ value, onChange, onVoiceUsed, placeholder, large, id, label }) {
  const speech = useSpeech((text) => {
    if (!text) return;
    onVoiceUsed?.();
    onChange((prev) => (prev ? `${prev.replace(/\s+$/, '')} ${text}` : text));
  });

  return (
    <div>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <textarea
        id={id}
        className={`textarea${large ? ' lg' : ''}`}
        value={value}
        placeholder={placeholder}
        maxLength={2000}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="voice-row">
        {speech.supported ? (
          <button
            type="button"
            className={`btn btn-secondary btn-sm voice-btn${speech.listening ? ' listening' : ''}`}
            onClick={speech.listening ? speech.stop : speech.start}
            aria-pressed={speech.listening}
          >
            {speech.listening ? <><span className="pulse" /> Stop recording</> : <><Icon.Mic /> Speak instead</>}
          </button>
        ) : (
          <span className="tiny muted">Voice input is not available in this browser. Use Chrome or Edge to speak your answer.</span>
        )}
        {speech.listening && <span className="interim">{speech.interim || 'Listening… speak clearly, then review the text above.'}</span>}
        {speech.error && <span className="error-text">{speech.error}</span>}
      </div>
    </div>
  );
}
