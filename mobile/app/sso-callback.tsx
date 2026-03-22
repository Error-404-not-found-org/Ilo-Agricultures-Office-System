import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';

export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="blue" />
      </View>
    );
  }
  if (isSignedIn) {
    return <Redirect href="/(auth)" />;
  }
  return <Redirect href="/(auth)" />;
}