// components/sign-out-button.tsx
import { useClerk } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';
import { toast } from 'sonner-native';

export const SignOutButton = () => {
  const { signOut } = useClerk();
  const router = useRouter();

  const handleSignOut = async () => {
    console.log("Sign out pressed!"); // Debug log

    try {
      await signOut();
      toast.success("You have Signed out.");
      // Navigate to the auth group specifically to ensure we leave the tabs
      router.replace('/(auth)'); 
    } catch (err) {
      console.error("Sign out error:", err);
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleSignOut}
      activeOpacity={0.7} // Visual feedback when pressed
    >
      <Text style={styles.buttonText}>Log Out</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#EF4444', // Bright Red
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#DC2626',
    // Shadow for elevation to ensure it sits 'above' flat surfaces
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

// Required for Expo Router to stop complaining
export default SignOutButton;