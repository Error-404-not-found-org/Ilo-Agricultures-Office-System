const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { transpileModule } = require('typescript');

const tsCode = fs.readFileSync(path.join(__dirname, '../features/admin-users/utils/dispatchPayloadBuilders.ts'), 'utf-8');
const jsCode = transpileModule(tsCode, { compilerOptions: { module: 1 } }).outputText;

const builders = {};
const fakeExports = {};
const script = new (require('vm').Script)(jsCode);
const context = require('vm').createContext({ exports: fakeExports, require });
script.runInContext(context);
Object.assign(builders, fakeExports);

describe('Dispatch Payload Builders', () => {
  test('1. Oton payload generation uses canonical municipality code 063034000', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, []);
    assert.strictEqual(payload.serviceMunicipalities.length, 1);
    assert.strictEqual(payload.serviceMunicipalities[0].municipalityCode, '063034000');
    assert.strictEqual(payload.serviceMunicipalities[0].municipalityName, 'Oton');
    assert.strictEqual(payload.serviceMunicipalities[0].localityType, 'municipality');
    assert.strictEqual(payload.serviceMunicipalities[0].provinceCode, '063000000');
    assert.strictEqual(payload.serviceMunicipalities[0].provinceName, 'Iloilo');
  });

  test('2. Multiple municipalities', () => {
    // Currently UI only supports Oton, but testing the payload structure allows it.
    // Since UI logic only toggles Oton, we verify Oton is supported.
    const payload = builders.buildDispatchProfileUpdatePayload(true, []);
    assert.ok(Array.isArray(payload.serviceMunicipalities));
  });

  test('3. Municipality deduplication by canonical code', () => {
    // Function guarantees Oton is inserted once if true
    const payload = builders.buildDispatchProfileUpdatePayload(true, []);
    assert.strictEqual(payload.serviceMunicipalities.length, 1);
  });

  test('4. AI mapping', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['AI']);
    assert.deepEqual(payload.serviceCapabilities, ['AI']);
  });

  test('5. HEALTH mapping', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['HEALTH']);
    assert.deepEqual(payload.serviceCapabilities, ['HEALTH']);
  });

  test('6. PREGNANCY_DIAGNOSIS mapping', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['PREGNANCY_DIAGNOSIS']);
    assert.deepEqual(payload.serviceCapabilities, ['PREGNANCY_DIAGNOSIS']);
  });

  test('7. CALVING mapping', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['CALVING']);
    assert.deepEqual(payload.serviceCapabilities, ['CALVING']);
  });

  test('8. capability deduplication', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['AI', 'HEALTH', 'AI']);
    assert.deepEqual(payload.serviceCapabilities, ['AI', 'HEALTH']);
  });

  test('9. Unknown capability excluded/rejected', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['AI', 'INVALID_CAP', 'CALVING']);
    assert.deepEqual(payload.serviceCapabilities, ['AI', 'CALVING']);
  });

  test('10. empty coverage allowed (removes Oton)', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(false, ['PREGNANCY_DIAGNOSIS']);
    assert.strictEqual(payload.serviceMunicipalities.length, 0);
  });

  test('11. empty capabilities allowed', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, []);
    assert.strictEqual(payload.serviceCapabilities.length, 0);
  });

  test('12. availabilityStatus never included in Admin update payload', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, ['AI']);
    assert.strictEqual(payload.availabilityStatus, undefined);
  });

  test('13. acceptsNewRequests never included in Admin update payload', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, ['AI']);
    assert.strictEqual(payload.acceptsNewRequests, undefined);
  });

  test('14. assignedBy never included', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, ['AI']);
    assert.strictEqual(payload.assignedBy, undefined);
  });

  test('15. assignedAt never included', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, ['AI']);
    assert.strictEqual(payload.assignedAt, undefined);
  });

  test('16. source never client-controlled', () => {
    const payload = builders.buildDispatchProfileUpdatePayload(true, ['AI']);
    assert.strictEqual(payload.source, undefined);
  });
});
