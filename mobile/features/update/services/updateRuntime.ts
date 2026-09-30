import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { requireApiUrl } from '@/lib/requiredApiUrl';
import { evaluateNativeRelease, selectReleaseTrack, type NativeUpdateState } from '../utils/updatePolicy';
import { createUpdateService } from '../utils/updateService';

const service = createUpdateService({
  otaSupported: () => !__DEV__ && Updates.isEnabled && selectReleaseTrack(Updates.channel) !== null,
  checkOta: async () => (await Updates.checkForUpdateAsync()).isAvailable,
  downloadOta: async () => (await Updates.fetchUpdateAsync()).isNew,
  reloadOta: () => Updates.reloadAsync(),
});

async function checkNativeRelease(): Promise<NativeUpdateState> {
  if (__DEV__) return { kind: 'current' };
  if (Platform.OS !== 'android') return { kind: 'current' };
  const track = selectReleaseTrack(Updates.channel);
  if (!track) return { kind: 'unavailable' };
  const buildVersion = Application.nativeBuildVersion;
  const buildCode = buildVersion && /^\d+$/.test(buildVersion) ? Number(buildVersion) : null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const apiUrl = requireApiUrl(process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, '');
    const response = await fetch(`${apiUrl}/app-release/android?track=${track}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return { kind: 'unavailable' };
    return evaluateNativeRelease(await response.json(), {
      version: Application.nativeApplicationVersion,
      buildCode: buildCode && Number.isSafeInteger(buildCode) ? buildCode : null,
    }, track);
  } catch { return { kind: 'unavailable' }; }
  finally { clearTimeout(timeout); }
}

export const updateService = {
  ...service,
  checkForUpdates: () => service.checkForUpdates(checkNativeRelease),
};
