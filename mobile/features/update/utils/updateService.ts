import type { NativeUpdateState, OtaCheckState } from './updatePolicy';

type UpdateDependencies = {
  otaSupported: () => boolean;
  checkOta: () => Promise<boolean>;
  downloadOta: () => Promise<boolean>;
  reloadOta: () => Promise<void>;
};

export function createUpdateService(dependencies: UpdateDependencies) {
  let ready = false;
  const service = {
    async checkOta(): Promise<OtaCheckState> {
      if (!dependencies.otaSupported()) return { kind: 'unsupported' };
      try { return { kind: (await dependencies.checkOta()) ? 'available' : 'current' }; }
      catch { return { kind: 'error' }; }
    },
    async checkForUpdates(checkNative: () => Promise<NativeUpdateState>): Promise<NativeUpdateState | OtaCheckState> {
      let native: NativeUpdateState;
      try { native = await checkNative(); }
      catch { native = { kind: 'unavailable' }; }
      if (native.kind === 'required' || native.kind === 'optional') return native;
      const ota = await service.checkOta();
      return native.kind === 'unavailable' && ota.kind !== 'available'
        ? { kind: ota.kind === 'error' ? 'error' : 'unavailable' }
        : ota;
    },
    async checkForStartupUpdates(checkNative: () => Promise<NativeUpdateState>): Promise<Extract<NativeUpdateState, { kind: 'required' | 'optional' }> | null> {
      const result = await service.checkForUpdates(checkNative);
      if (result.kind === 'required' || result.kind === 'optional') return result;
      if (result.kind === 'available') await service.downloadOta();
      return null;
    },
    async checkForManualUpdates(checkNative: () => Promise<NativeUpdateState>): Promise<NativeUpdateState | OtaCheckState | { kind: 'downloaded' }> {
      const result = await service.checkForUpdates(checkNative);
      if (result.kind !== 'available') return result;
      return (await service.downloadOta()).kind === 'ready' ? { kind: 'downloaded' } : { kind: 'error' };
    },
    async downloadOta(): Promise<{ kind: 'ready' | 'error' }> {
      ready = false;
      try {
        if (!dependencies.otaSupported() || !(await dependencies.downloadOta())) return { kind: 'error' };
        ready = true;
        return { kind: 'ready' };
      } catch { return { kind: 'error' }; }
    },
    async restartOta(): Promise<boolean> {
      if (!ready) return false;
      try { await dependencies.reloadOta(); return true; }
      catch { return false; }
    },
  };
  return service;
}
