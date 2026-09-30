import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { updateService } from '../services/updateRuntime';
import type { NativeUpdateState, OtaCheckState } from '../utils/updatePolicy';

type Notice = NativeUpdateState | OtaCheckState;

export function UpdateNotice({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const visible = notice?.kind === 'required' || notice?.kind === 'optional' || notice?.kind === 'available';
  const native = notice?.kind === 'required' || notice?.kind === 'optional';
  const required = notice?.kind === 'required';

  const handlePrimaryAction = async () => {
    if (!notice || downloading) return;
    setError(false);
    if (native) {
      try { await Linking.openURL(notice.downloadUrl); }
      catch { setError(true); }
      return;
    }
    if (ready) {
      if (!(await updateService.restartOta())) setError(true);
      return;
    }
    setDownloading(true);
    const result = await updateService.downloadOta();
    setDownloading(false);
    if (result.kind === 'ready') setReady(true);
    else setError(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!required) onDismiss(); }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 16 }}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 21, color: '#17221d' }}>
            {required ? 'BreedSmart Update Required' : ready ? 'Update Ready' : 'BreedSmart Update Available'}
          </Text>
          <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, color: '#4b5563' }}>
            {required ? 'Please update BreedSmart to continue using this version.' :
              native ? 'A newer version of BreedSmart is available.' :
              ready ? 'Restart BreedSmart to apply the update.' :
              'A small update with improvements is available.'}
          </Text>
          {error && <Text accessibilityRole="alert" style={{ color: '#b91c1c', fontSize: 14 }}>
            {native ? 'Couldn’t open the update link. Please try again.' : 'Couldn’t check for updates right now. You can continue using BreedSmart and try again later.'}
          </Text>}
          <Pressable accessibilityRole="button" disabled={downloading} onPress={() => void handlePrimaryAction()}
            style={{ padding: 14, borderRadius: 12, backgroundColor: '#00643B', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold' }}>
              {downloading ? 'Downloading update...' : required ? 'Update BreedSmart' : ready ? 'Restart BreedSmart' : 'Update Now'}
            </Text>
          </Pressable>
          {!required && <Pressable accessibilityRole="button" onPress={onDismiss} style={{ padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#4b5563', fontFamily: 'Outfit_600SemiBold' }}>Later</Text>
          </Pressable>}
        </View>
      </View>
    </Modal>
  );
}
