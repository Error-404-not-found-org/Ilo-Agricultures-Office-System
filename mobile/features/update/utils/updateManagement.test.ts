import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, evaluateNativeRelease, selectReleaseTrack } from './updatePolicy.ts';
import { createUpdateService } from './updateService.ts';

const release = {
  platform: 'android', track: 'preview', latestVersion: '1.10.0', latestBuildCode: 110,
  minimumVersion: '1.8.0', minimumBuildCode: 108,
  downloadUrl: 'https://example.com/breedsmart.apk',
  message: 'A new release is available.',
};

test('semantic versions compare numerically rather than lexicographically', () => {
  assert.equal(compareVersions('1.9.0', '1.10.0'), -1);
  assert.equal(compareVersions('1.10.0', '1.10.0'), 0);
});

test('native release distinguishes current, optional, and required installed binaries', () => {
  assert.equal(evaluateNativeRelease(release, { version: '1.10.0', buildCode: 110 }, 'preview').kind, 'current');
  assert.equal(evaluateNativeRelease(release, { version: '1.9.0', buildCode: 109 }, 'preview').kind, 'optional');
  assert.equal(evaluateNativeRelease(release, { version: '1.7.0', buildCode: 107 }, 'preview').kind, 'required');
  assert.equal(evaluateNativeRelease(release, { version: '1.10.0', buildCode: 107 }, 'preview').kind, 'required');
});

test('malformed metadata and insecure download URLs cannot require an update', () => {
  assert.equal(evaluateNativeRelease({ ...release, downloadUrl: 'http://example.com/a.apk' }, { version: '1.0.0', buildCode: 1 }, 'preview').kind, 'unavailable');
  assert.equal(evaluateNativeRelease({ ...release, minimumVersion: 'bad' }, { version: '1.0.0', buildCode: 1 }, 'preview').kind, 'unavailable');
  assert.equal(evaluateNativeRelease(release, { version: '1.0.0', buildCode: null }, 'preview').kind, 'unavailable');
});

test('a release response for a different build track cannot require an update', () => {
  assert.equal(evaluateNativeRelease({ ...release, track: 'production' },
    { version: '1.0.0', buildCode: 1 }, 'preview').kind, 'unavailable');
});

test('native updates take priority over compatible OTA in the canonical check', async () => {
  let otaChecks = 0;
  const service = createUpdateService({
    otaSupported: () => true,
    checkOta: async () => { otaChecks++; return true; },
    downloadOta: async () => true,
    reloadOta: async () => {},
  });
  assert.equal((await service.checkForUpdates(async () => ({ kind: 'required', downloadUrl: release.downloadUrl, message: '' }))).kind, 'required');
  assert.equal((await service.checkForUpdates(async () => ({ kind: 'optional', downloadUrl: release.downloadUrl, message: '' }))).kind, 'optional');
  assert.equal(otaChecks, 0);
  assert.equal((await service.checkForUpdates(async () => ({ kind: 'current' }))).kind, 'available');
  assert.equal(otaChecks, 1);
});

test('an unavailable native check still offers a compatible OTA without requiring an APK', async () => {
  let otaChecks = 0;
  const service = createUpdateService({
    otaSupported: () => true,
    checkOta: async () => { otaChecks++; return true; },
    downloadOta: async () => true,
    reloadOta: async () => {},
  });
  const result = await service.checkForUpdates(async () => ({ kind: 'unavailable' }));
  assert.equal(result.kind, 'available');
  assert.equal(otaChecks, 1);
});

test('a failed native request falls through to OTA while failed OTA remains non-blocking', async () => {
  const service = createUpdateService({
    otaSupported: () => true,
    checkOta: async () => { throw Error('offline'); },
    downloadOta: async () => true,
    reloadOta: async () => {},
  });
  assert.equal((await service.checkForUpdates(async () => { throw Error('offline'); })).kind, 'error');
});

test('the embedded Expo channel selects only a known release track', () => {
  assert.equal(selectReleaseTrack('preview'), 'preview');
  assert.equal(selectReleaseTrack('production'), 'production');
  assert.equal(selectReleaseTrack(null), null);
  assert.equal(selectReleaseTrack('development'), null);
});

test('OTA service skips unsupported runtime and never fetches without user action', async () => {
  let checks = 0;
  let downloads = 0;
  const service = createUpdateService({
    otaSupported: () => false,
    checkOta: async () => { checks++; return true; },
    downloadOta: async () => { downloads++; return true; },
    reloadOta: async () => {},
  });
  assert.deepEqual(await service.checkOta(), { kind: 'unsupported' });
  assert.equal(checks, 0);
  assert.equal(downloads, 0);
});

test('OTA service distinguishes no update, available, failed check and failed download', async () => {
  let available = false;
  let failCheck = false;
  let failDownload = false;
  let reloads = 0;
  const service = createUpdateService({
    otaSupported: () => true,
    checkOta: async () => { if (failCheck) throw Error('offline'); return available; },
    downloadOta: async () => { if (failDownload) throw Error('offline'); return true; },
    reloadOta: async () => { reloads++; },
  });
  assert.deepEqual(await service.checkOta(), { kind: 'current' });
  available = true;
  assert.deepEqual(await service.checkOta(), { kind: 'available' });
  failDownload = true;
  assert.deepEqual(await service.downloadOta(), { kind: 'error' });
  failDownload = false;
  assert.deepEqual(await service.downloadOta(), { kind: 'ready' });
  assert.equal(reloads, 0);
  await service.restartOta();
  assert.equal(reloads, 1);
  failCheck = true;
  assert.deepEqual(await service.checkOta(), { kind: 'error' });
});
