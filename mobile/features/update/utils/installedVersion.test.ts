import assert from 'node:assert/strict';
import test from 'node:test';
import { getUpToDateMessage } from './installedVersion.ts';

test('up-to-date feedback uses the installed native version, never a fixed release string', () => {
  assert.equal(getUpToDateMessage('BreedSmart is up to date', '1.0.6'), 'BreedSmart is up to date (v1.0.6)');
  assert.equal(getUpToDateMessage('BreedSmart is up to date', null), 'BreedSmart is up to date');
});
