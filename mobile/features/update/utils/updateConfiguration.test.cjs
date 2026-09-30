const assert = require('node:assert/strict');
const test = require('node:test');
const appConfig = require('../../../app.config.js');
const eas = require('../../../eas.json');

const resolveConfig = (variant) => {
  const previous = process.env.APP_VARIANT;
  try {
    if (variant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = variant;
    return appConfig();
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
};

test('new native baseline uses an app-version runtime and the existing EAS project', () => {
  const config = resolveConfig(undefined);
  assert.equal(config.version, '1.0.6');
  assert.deepEqual(config.runtimeVersion, { policy: 'appVersion' });
  assert.equal(config.extra.eas.projectId, '3fc4429f-8376-4203-808d-b8911ea21070');
  assert.equal(config.updates.url, `https://u.expo.dev/${config.extra.eas.projectId}`);
  assert.equal(config.updates.checkAutomatically, 'NEVER');
});

test('development is separate, while preview and production APKs share the updatable package', () => {
  assert.equal(resolveConfig('development').android.package, 'com.breedsmart.mobile.dev');
  assert.equal(resolveConfig('preview').android.package, 'com.breedsmart.mobile');
  assert.equal(resolveConfig(undefined).android.package, 'com.breedsmart.mobile');
  assert.equal(eas.build.development.env.APP_VARIANT, 'development');
  assert.equal(eas.build.preview.env?.APP_VARIANT, undefined);
});

test('each build profile selects its matching EAS environment and update channel', () => {
  for (const [profile, environment, channel] of [
    ['development', 'development', 'development'],
    ['preview', 'preview', 'preview'],
    ['production-apk', 'production', 'production'],
    ['production', 'production', 'production'],
  ]) {
    assert.equal(eas.build[profile].environment, environment);
    assert.equal(eas.build[profile].channel, channel);
  }
  for (const profile of ['preview', 'production-apk', 'production']) {
    assert.equal(eas.build[profile].env?.EXPO_PUBLIC_API_URL, undefined);
    assert.equal(eas.build[profile].env?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, undefined);
  }
  assert.equal(eas.build.preview.autoIncrement, true);
  assert.equal(eas.build['production-apk'].autoIncrement, true);
});
