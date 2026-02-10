import { View, Text, Button } from 'react-native';
import { useClerk } from '@clerk/clerk-expo';
import { SafeAreaView } from 'react-native-safe-area-context';

const Profile = () => {
  const { signOut } = useClerk();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Profile Screen</Text>
        <Button title="Sign Out" onPress={() => signOut()} />
      </View>
    </SafeAreaView>
  );
};

export default Profile;