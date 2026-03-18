import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image, Alert } from 'react-native';
import React, { useState } from 'react';
import useSocialAuth from '../../hooks/useSocialAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router'; 
import { useSignIn } from '@clerk/clerk-expo';
import { toast } from 'sonner-native';

const AuthScreen = () => {
  const router = useRouter(); 
  const { loadingStrategy, handleSocialAuth } = useSocialAuth();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) {
      return;
    }
    setLoading(true);
    try {
      const completeSignIn = await signIn.create({
        identifier: emailAddress,
        password,
      });

      // This indicates the user is signed in
      await setActive({ session: completeSignIn.createdSessionId });
      // Redirection is handled by _layout.tsx
      toast.success('Successfully logged in!');
    } catch (err: any) {
      toast.error("Login Failed", { 
        description: err.errors[0]?.message || "An error occurred" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 h-full">
      <View className="flex-1 px-6 pt-10">
        
        <View className="items-center mt-10 mb-8">
          <Image 
            source={require('../../assets/logo.png')} // Changed to relative path to newly copied logo
            className="h-24 w-24 rounded-full mb-4"
            resizeMode="contain"
          />
           <Text className="text-2xl font-bold text-[#074033]">BreedSmart</Text>
        </View>

        {/* Form Container */}
        <View className="space-y-4">

          {/* Google Sign in */}
          <View className="gap-2">
            <TouchableOpacity 
              className='flex-row items-center justify-center bg-white border border-gray-300 rounded-xl px-6 py-4 shadow-sm'
              onPress={() => handleSocialAuth("oauth_google")}
              disabled={loadingStrategy !== null}
            >
              {loadingStrategy === 'oauth_google' ? (
                <ActivityIndicator size="small" color="#0000ff" />
              ) : (
                <View className='flex-row items-center justify-center'>
                  <Image 
                    source={require('../../assets/google.png')} 
                    className='size-6 mr-3'
                    resizeMode='contain'
                  />
                  <Text className='text-black font-medium text-base'>Sign in with Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center my-4">
              <View className="flex-1 h-[1px] bg-gray-300" />
              <Text className="mx-4 text-gray-500 font-medium">OR</Text>
              <View className="flex-1 h-[1px] bg-gray-300" />
          </View>
          
          {/* Email Field */}
          <View>
            <Text className="text-base font-medium text-slate-700 mb-2">Email</Text>
            <TextInput
              className="w-full border border-gray-300 rounded-xl p-4 bg-white focus:border-blue-500"
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={emailAddress}
              onChangeText={setEmailAddress}
            />
          </View>

          {/* Password Field */}
          <View className="mt-4">
            <Text className="text-base font-medium text-slate-700 mb-2">Password</Text>
            <TextInput
              className="w-full border border-gray-300 rounded-xl p-4 bg-white focus:border-blue-500"
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity className="items-end mt-2">
              <Text className="text-blue-500 font-medium">Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity 
            className="w-full bg-[#074033] p-4 rounded-xl mt-6 items-center shadow-sm"
            onPress={onSignInPress}
            disabled={loading}
          >
            {loading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <Text className="text-white text-lg font-bold">Sign in with Email</Text>
            )}
          </TouchableOpacity>
        </View>

          {/* Footer Register Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Don't have an account? </Text>
            <TouchableOpacity>
              <Text className="text-blue-500 font-bold">Register</Text>
            </TouchableOpacity>
          </View>
        <Text className="text-center text-gray-500 text-sm mt-10 leading-4">
          By Signing up, you agree to our <Text className="text-[#074033]">Terms & Conditions</Text> and <Text className="text-[#074033]">Privacy Policy</Text>.
        </Text>
        <Text className="text-center justify-center items-center text-gray-500 text-sm mt-10 leading-4">
          © {new Date().getFullYear()} Ilo Agricultures. All rights reserved.
        </Text>
      </View>
    </SafeAreaView>
  )
}

export default AuthScreen;