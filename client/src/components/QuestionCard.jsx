import { useState } from 'react';
import { Icon } from './Icons.jsx';
import { VoiceTextArea } from './VoiceTextArea.jsx';

const SEP = '; ';

function parseExisting(question, response) {
  if (response?.kind !== 'answer' || !response.value) return { selected: [], text: '' };
  if (!question.options?.length) return { selected: [], text: response.value };
  const parts = response.value.split(SEP);
  return {
    selected: parts.filter((p) => question.options.includes(p)),
    text: parts.filter((p) => !question.options.includes(p)).join(SEP),
  };
}

/**
 * One intake question. Patients can answer with options and/or free text
 * (typed or spoken), or choose "Not applicable", "Don't know / Not sure" or
 * "Skip" - each is recorded as a distinct response type.
 * Mount with key={question.id} so state resets per question.
 */
export function QuestionCard({ question, response, onSubmit, onBack, saving, stepLabel, submitLabel = 'Continue' }) {
  const initial = parseExisting(question, response);
  const [selected, setSelected] = useState(initial.selected);
  const [text, setText] = useState(initial.text);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const hasOptions = question.options?.length > 0;
  const isFollowup = question.category === 'followup';

  const toggle = (opt) => {
    if (question.multiSelect) {
      setSelected((cur) => (cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]));
    } else {
      setSelected((cur) => (cur[0] === opt ? [] : [opt]));
    }
  };

  const ordered = question.options?.filter((o) => selected.includes(o)) ?? [];
  const value = [...ordered, text.trim()].filter(Boolean).join(SEP);
  const inputMethod = voiceUsed ? 'voice' : text.trim() ? 'text' : 'options';

  const submit = (kind) => {
    if (kind === 'answer') onSubmit({ kind, value, inputMethod });
    else onSubmit({ kind });
  };

  return (
    <form
      className="card question-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (value) submit('answer');
      }}
    >
      <span className={`question-tag${isFollowup ? ' ai' : ''}`}>
        {isFollowup ? <><Icon.Sparkle /> Follow-up question</> : stepLabel}
      </span>
      <h1 className="question-title">{question.text}</h1>
      {question.help && <p className="question-help">{question.help}</p>}
      {hasOptions && question.multiSelect && !question.help && <p className="question-help">Select all that apply.</p>}

      <div className="question-body">
        {hasOptions && (
          <div className="options" role={question.multiSelect ? 'group' : 'radiogroup'} aria-label={question.text}>
            {question.options.map((opt) => {
              const on = selected.includes(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  role={question.multiSelect ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  className={`option${question.multiSelect ? ' multi' : ''}`}
                  onClick={() => toggle(opt)}
                >
                  <span className="option-mark">{on && <Icon.Check />}</span>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        <div className={hasOptions ? 'other-field' : ''}>
          <VoiceTextArea
            id={`q-${question.id}`}
            label={hasOptions ? 'Add details in your own words (optional)' : undefined}
            large={question.id === 'symptoms'}
            value={text}
            onChange={setText}
            onVoiceUsed={() => setVoiceUsed(true)}
            placeholder={question.id === 'symptoms'
              ? 'For example: "I have had a headache and a mild fever since yesterday…"'
              : hasOptions ? 'Anything else about this?' : 'Type your answer here…'}
          />
        </div>

        {!question.required && (
          <div className="alt-answers">
            <span className="label">Or choose:</span>
            <button type="button" className={`chip-btn${response?.kind === 'not_applicable' ? ' selected' : ''}`} disabled={saving} onClick={() => submit('not_applicable')}>
              Not applicable
            </button>
            <button type="button" className={`chip-btn${response?.kind === 'unsure' ? ' selected' : ''}`} disabled={saving} onClick={() => submit('unsure')}>
              Don't know / Not sure
            </button>
          </div>
        )}
      </div>

      <div className="question-actions">
        {onBack && (
          <button type="button" className="btn btn-ghost" onClick={onBack} disabled={saving}>
            <Icon.Back /> Back
          </button>
        )}
        <span className="spacer" />
        {!question.required && (
          <button type="button" className="btn btn-secondary" onClick={() => submit('skipped')} disabled={saving}>
            Skip
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={!value || saving}>
          {saving ? 'Saving…' : submitLabel} {!saving && <Icon.Arrow />}
        </button>
      </div>
    </form>
  );
}
