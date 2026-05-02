import { View } from 'react-native';
import React, { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SafeScreen = ({ children }: { children: ReactNode }) => {
  const insets = useSafeAreaInsets();

  return (
    <View className='flex-1 bg-white dark:bg-slate-900' style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {children}
    </View>
  );

};

export default SafeScreen;