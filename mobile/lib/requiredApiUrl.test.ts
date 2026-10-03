import assert from 'node:assert/strict';
import test from 'node:test';
import { requireApiUrl } from './requiredApiUrl.ts';

test('an explicit API URL is required so a missing preview value cannot select production', () => {
  assert.throws(() => requireApiUrl(undefined), /Missing EXPO_PUBLIC_API_URL/);
  assert.throws(() => requireApiUrl('  '), /Missing EXPO_PUBLIC_API_URL/);
  assert.equal(requireApiUrl('https://example.com/api'), 'https://example.com/api');
});
