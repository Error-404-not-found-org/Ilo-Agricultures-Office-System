import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';

export default function SSOCallback() {
  const { isSignedIn, isLoaded } = useAuth();

  // Show a spinner while Clerk processes the new token
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="blue" />
      </View>
    );
  }

  // If the sign-in works, go to the tabs
  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  // If it fails, go back to login
  return <Redirect href="/(auth)" />;
}