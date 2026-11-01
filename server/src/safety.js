// Deterministic emergency red-flag screen. Runs on every patient free-text
// answer before any AI call, so urgent escalation never depends on the LLM.
// It errs on the side of escalating: a false alarm costs a conversation with
// staff, a miss could cost far more.

const RED_FLAGS = [
  { reason: 'Chest pain or pressure', patterns: [/chest (pain|pressure|tightness|tight)/, /pain in (my |the )?chest/, /crushing (pain|feeling)/, /heart attack/] },
  { reason: 'Difficulty breathing', patterns: [/(can'?t|cannot|unable to|struggling to|hard to|trouble|difficulty|difficult to) breath/, /short(ness)? of breath/, /breathless/, /gasping/, /choking/, /lips (are |turning )?(blue|grey|gray)/] },
  { reason: 'Possible stroke signs', patterns: [/face (is )?droop/, /drooping face/, /slurred speech/, /(can'?t|cannot|unable to) (speak|talk|move (my )?(arm|leg|side))/, /sudden (numbness|weakness)/, /one side of (my )?(body|face)/, /stroke/] },
  { reason: 'Loss of consciousness or seizure', patterns: [/passed out/, /fainted/, /unconscious/, /blacked out/, /seizure/, /convuls/, /\bfits?\b/] },
  { reason: 'Severe bleeding', patterns: [/(heavy|severe|uncontrolled|won'?t stop|not stopping) bleeding/, /bleeding (heavily|a lot|won'?t stop)/, /(vomiting|coughing|throwing up) (up )?blood/, /blood in (my )?vomit/] },
  { reason: 'Severe allergic reaction', patterns: [/anaphyla/, /(throat|tongue|lips?|face) (is |are )?(swelling|swollen|closing)/, /swelling of (my |the )?(throat|tongue|lips|face)/] },
  { reason: 'Thoughts of self-harm or suicide', patterns: [/suicid/, /kill (myself|my self)/, /end (my|it) (life|all)/, /self[- ]?harm/, /hurt(ing)? myself/, /want to die/] },
  { reason: 'Sudden severe headache', patterns: [/worst headache/, /thunderclap/, /sudden (and )?severe headache/] },
  { reason: 'Confusion or unresponsiveness', patterns: [/(sudden|severe) confusion/, /confused and/, /unresponsive/, /can'?t (stay awake|wake up)/] },
  { reason: 'Serious injury or poisoning', patterns: [/overdose/, /poison/, /swallowed (bleach|chemical|pills)/, /head injury/, /hit (my|his|her) head/, /broken bone.*(sticking|through)/] },
  { reason: 'Loss of bladder or bowel control', patterns: [/loss of (bladder|bowel) control/, /(can'?t|cannot|unable to) control (my )?(bladder|bowels?|urine)/, /incontinen/, /numb(ness)? (in|around) (my )?(groin|genitals|buttocks|inner thighs)/] },
  { reason: 'Severe abdominal pain', patterns: [/(severe|unbearable|excruciating) (abdominal|stomach|belly) pain/] },
  { reason: 'Stiff neck with fever or rash', patterns: [/stiff neck.*(fever|rash)/, /(fever|rash).*stiff neck/, /rash.*(doesn'?t|does not|won'?t) fade/] },
];

const NEGATIONS = /\b(no|not|never|without|denies|deny|don'?t|do not|didn'?t|haven'?t|isn'?t|any)\b/;

function isNegated(text, index) {
  // Look back over the few words immediately before the match.
  const before = text.slice(Math.max(0, index - 30), index);
  const lastWords = before.split(/[.,;!?]/).pop() ?? '';
  return NEGATIONS.test(lastWords);
}

/** Returns the reason string of the first red flag found, or null. */
export function detectRedFlags(...texts) {
  const text = texts.filter(Boolean).join(' . ').toLowerCase().replace(/[’']/g, "'");
  if (!text.trim()) return null;
  for (const flag of RED_FLAGS) {
    for (const pattern of flag.patterns) {
      const re = new RegExp(pattern.source, 'g');
      let m;
      while ((m = re.exec(text)) !== null) {
        if (!isNegated(text, m.index)) return flag.reason;
      }
    }
  }
  return null;
}

export const URGENT_MESSAGE =
  'Some of what you described may need urgent medical attention. ' +
  'Please tell the clinic staff or doctor right away. If you are not at the clinic, ' +
  'call your local emergency number (for example 112) or go to the nearest emergency department now.';
