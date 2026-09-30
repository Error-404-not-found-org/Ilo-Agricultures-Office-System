export type NativeUpdateState =
  | { kind: 'current' }
  | { kind: 'optional' | 'required'; downloadUrl: string; message: string }
  | { kind: 'unavailable' };

export type OtaCheckState = { kind: 'available' | 'current' | 'unsupported' | 'error' };

const VERSION = /^\d+\.\d+\.\d+$/;

export function selectReleaseTrack(channel: string | null): 'preview' | 'production' | null {
  return channel === 'preview' || channel === 'production' ? channel : null;
}

export function compareVersions(left: string, right: string): -1 | 0 | 1 {
  if (!VERSION.test(left) || !VERSION.test(right)) throw new Error('Invalid version');
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function validBuild(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
}

export function evaluateNativeRelease(metadata: unknown, installed: { version: string | null; buildCode: number | null }, expectedTrack: 'preview' | 'production'): NativeUpdateState {
  if (!metadata || typeof metadata !== 'object') return { kind: 'unavailable' };
  const data = metadata as Record<string, unknown>;
  if (data.platform !== 'android' || data.track !== expectedTrack || typeof data.latestVersion !== 'string' ||
      typeof data.minimumVersion !== 'string' || typeof data.downloadUrl !== 'string' ||
      typeof data.message !== 'string' ||
      !validBuild(data.latestBuildCode) || !validBuild(data.minimumBuildCode) ||
      !VERSION.test(data.latestVersion) || !VERSION.test(data.minimumVersion) ||
      !installed.version || !VERSION.test(installed.version) ||
      ((data.latestBuildCode !== null || data.minimumBuildCode !== null) && installed.buildCode === null) ||
      compareVersions(data.minimumVersion, data.latestVersion) > 0 ||
      (data.latestBuildCode !== null && data.minimumBuildCode !== null && data.minimumBuildCode > data.latestBuildCode)) {
    return { kind: 'unavailable' };
  }
  let validatedUrl: URL;
  try {
    const url = new URL(data.downloadUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return { kind: 'unavailable' };
    validatedUrl = url;
  } catch { return { kind: 'unavailable' }; }

  const belowMinimum = compareVersions(installed.version, data.minimumVersion) < 0 ||
    (data.minimumBuildCode !== null && installed.buildCode !== null && installed.buildCode < data.minimumBuildCode);
  const belowLatest = compareVersions(installed.version, data.latestVersion) < 0 ||
    (data.latestBuildCode !== null && installed.buildCode !== null && installed.buildCode < data.latestBuildCode);
  if (belowMinimum) return { kind: 'required', downloadUrl: validatedUrl.href, message: data.message };
  if (belowLatest) return { kind: 'optional', downloadUrl: validatedUrl.href, message: data.message };
  return { kind: 'current' };
}
