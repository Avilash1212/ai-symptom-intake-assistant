// Standard intake questions asked of every patient before AI follow-ups.
// Every question (except the opening description) also offers
// "Not applicable", "Don't know / Not sure" and "Skip" in the UI.
export const STANDARD_QUESTIONS = [
  {
    id: 'symptoms',
    text: 'What symptoms are you experiencing?',
    help: 'Describe in your own words. You can type or use the microphone.',
    type: 'text',
    options: [],
    multiSelect: false,
    required: true,
  },
  {
    id: 'onset',
    text: 'When did the symptoms begin?',
    type: 'choice',
    options: ['Today', '1–3 days ago', '4–7 days ago', '1–4 weeks ago', 'More than a month ago'],
    multiSelect: false,
  },
  {
    id: 'severity',
    text: 'How severe are the symptoms?',
    type: 'choice',
    options: ['Mild', 'Moderate', 'Severe', 'Very severe'],
    multiSelect: false,
  },
  {
    id: 'body_part',
    text: 'Which part of your body is affected?',
    help: 'Select all that apply.',
    type: 'choice',
    options: ['Head', 'Eyes / ears / nose', 'Throat / neck', 'Chest', 'Abdomen', 'Back', 'Arms / hands', 'Legs / feet', 'Skin', 'Whole body'],
    multiSelect: true,
  },
  {
    id: 'pattern',
    text: 'Are the symptoms continuous or intermittent?',
    type: 'choice',
    options: ['Continuous', 'Intermittent (comes and goes)'],
    multiSelect: false,
  },
];

export const ANSWER_KINDS = ['answer', 'not_applicable', 'unsure', 'skipped'];

export const MAX_FOLLOWUP_ROUNDS = 2;
export const MAX_FOLLOWUPS_TOTAL = 8;
export const MAX_FOLLOWUPS_PER_ROUND = 4;

export function standardById(id) {
  return STANDARD_QUESTIONS.find((q) => q.id === id);
}
