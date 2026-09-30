import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import type { NativeUpdateState } from '../utils/updatePolicy';

type Notice = Extract<NativeUpdateState, { kind: 'required' | 'optional' }>;

export function UpdateNotice({ notice, onDismiss }: { notice: Notice | null; onDismiss: () => void }) {
  const [error, setError] = useState(false);
  const visible = notice?.kind === 'required' || notice?.kind === 'optional';
  const required = notice?.kind === 'required';

  const handlePrimaryAction = async () => {
    if (!notice) return;
    setError(false);
    try { await Linking.openURL(notice.downloadUrl); }
    catch { setError(true); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!required) onDismiss(); }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 16 }}>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 21, color: '#17221d' }}>
            {required ? 'BreedSmart Update Required' : 'BreedSmart Update Available'}
          </Text>
          <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, color: '#4b5563' }}>
            {required ? 'Please update BreedSmart to continue using this version.' : 'A newer version of BreedSmart is available.'}
          </Text>
          {error && <Text accessibilityRole="alert" style={{ color: '#b91c1c', fontSize: 14 }}>
            Couldn’t open the update link. Please try again.
          </Text>}
          <Pressable accessibilityRole="button" onPress={() => void handlePrimaryAction()}
            style={{ padding: 14, borderRadius: 12, backgroundColor: '#00643B', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold' }}>
              {required ? 'Update BreedSmart' : 'Update Now'}
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
