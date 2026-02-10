import { View } from 'react-native'
import React, { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const safeScreen = ( {children}: {children:ReactNode}) => {

  const insets = useSafeAreaInsets();

  return (
    <View className='flex-1 bg-white' style={{paddingTop: insets.top, paddingBottom: insets.bottom}}>
      {children}
    </View>
  )
}

export default safeScreen;