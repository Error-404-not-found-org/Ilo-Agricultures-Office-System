import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDispatchProfileUpdatePayload,
  isOtonMunicipalityCode,
  OTON_MUNICIPALITY,
} from './dispatchPayloadBuilders.ts';

test('Admin Oton dispatch writes use the canonical PSGC code', () => {
  const payload = buildDispatchProfileUpdatePayload(true, ['AI', 'HEALTH']);

  assert.equal(OTON_MUNICIPALITY.municipalityCode, '0603034000');
  assert.equal(OTON_MUNICIPALITY.provinceCode, '0603000000');
  assert.equal(payload.serviceMunicipalities[0].municipalityCode, '0603034000');
  assert.deepEqual(payload.serviceCapabilities, ['AI', 'HEALTH']);
});

test('Manage Dispatch recognizes both canonical and historical Oton codes', () => {
  assert.equal(isOtonMunicipalityCode('0603034000'), true);
  assert.equal(isOtonMunicipalityCode('063034000'), true);
  assert.equal(isOtonMunicipalityCode('0603020000'), false);
});
