import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRedFlags } from '../src/safety.js';

test('flags emergency warning signs', () => {
  assert.equal(detectRedFlags('I have crushing chest pain since an hour'), 'Chest pain or pressure');
  assert.equal(detectRedFlags("I can't breathe properly"), 'Difficulty breathing');
  assert.equal(detectRedFlags('My face is drooping and I have slurred speech'), 'Possible stroke signs');
  assert.equal(detectRedFlags('I have been thinking about suicide'), 'Thoughts of self-harm or suicide');
  assert.equal(detectRedFlags('This is the worst headache of my life'), 'Sudden severe headache');
  assert.equal(detectRedFlags('Dull ache; Loss of bladder control'), 'Loss of bladder or bowel control');
});

test('ignores simple negations and routine symptoms', () => {
  assert.equal(detectRedFlags('Headache for two days, no chest pain'), null);
  assert.equal(detectRedFlags('Mild cough and a runny nose'), null);
  assert.equal(detectRedFlags('I have not fainted'), null);
});

test('negation in one sentence does not hide a flag in another', () => {
  assert.equal(detectRedFlags('No fever. Chest pain when walking'), 'Chest pain or pressure');
});
