import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import React from 'react';
import useSocialAuth from '../../hooks/useSocialAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
// 1. FIX: Import useRouter from 'expo-router' correctly
import { useRouter } from 'expo-router'; 

const AuthScreen = () => {
  // 2. FIX: Initialize the hook here
  const router = useRouter(); 
  const { loadingStrategy, handleSocialAuth } = useSocialAuth();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 h-full">
      <View className="flex-1 px-6 pt-10">
        
        {/* Centered Logo/Icon Area */}
        <View className="items-center mt-10 mb-8">
          <View className="h-24 w-24 bg-blue-200 rounded-full mb-4" />
        </View>

        {/* Form Container */}
        <View className="space-y-4">
          
          {/* Email Field */}
          <View>
            <Text className="text-base font-medium text-slate-700 mb-2">Email</Text>
            <TextInput
              className="w-full border border-gray-300 rounded-xl p-4 bg-white focus:border-blue-500"
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
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
            />
            <TouchableOpacity className="items-end mt-2">
              <Text className="text-blue-500 font-medium">Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Google Sign in */}
          <View className="mt-6 gap-2">
            <TouchableOpacity 
              className='flex-row items-center justify-center bg-white border border-gray-300 rounded-full px-6'
              onPress={() => handleSocialAuth("oauth_google")}
              disabled={loadingStrategy !== null}
              style={{
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                elevation: 2 
               }}
            >
              {loadingStrategy ? (
                <ActivityIndicator size="small" color="#0000ff" />
              ) : (
                <View className='flex-row items-center justify-center'>
                  <Image 
                    source={require('../../assets/google.png')} 
                    className='size-10 mr-3'
                    resizeMode='contain'
                  />
                  <Text className='text-black font-medium text-base'>Sign in with Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Apple Sign in */}
          <View className="mt-6 gap-2 ">
            <TouchableOpacity 
              className='flex-row items-center justify-center bg-white border border-gray-300 rounded-full px-6s'
              onPress={() => handleSocialAuth("oauth_apple")}
              disabled={loadingStrategy !== null}
              style={{
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                elevation: 2 
               }}
            >
              {loadingStrategy ? (
                <ActivityIndicator size="small" color="#0000ff" />
              ) : (
                <View className='flex-row items-center justify-center'>
                  <Image 
                    source={require('../../assets/apple.png')} 
                    className='size-10 mr-3'
                    resizeMode='contain'
                  />
                  <Text className='text-black font-medium text-base'>Sign in with Apple</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity className="w-full bg-blue-400 p-4 rounded-xl mt-6 items-center shadow-sm">
            <Text className="text-white text-lg font-bold">Sign in</Text>
          </TouchableOpacity>

          {/* Footer Register Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Don't have an account? </Text>
            <TouchableOpacity>
              <Text className="text-blue-500 font-bold">Register</Text>
            </TouchableOpacity>
          </View>

          {/* TEMP: DEV ONLY BUTTONS (JUST remove it later)*/}
          <View className="mt-8 pt-6 border-t border-gray-200">
              <Text className="text-center text-gray-400 text-xs mb-2">DEVELOPER MODE</Text>
              <View className="flex-row gap-4">
                  <TouchableOpacity 
                      // 3. FIX: Cast to 'as any' to avoid TypeScript errors while routes generate
                      onPress={() => router.push('/(tabs)' as any)} 
                      className="flex-1 bg-gray-200 p-3 rounded-lg items-center"
                  >
                      <Text className="font-bold text-gray-700">Tech View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                      onPress={() => router.push('/(farmer)' as any)} 
                      className="flex-1 bg-green-100 p-3 rounded-lg items-center"
                  >
                      <Text className="font-bold text-green-700">Farmer View</Text>
                  </TouchableOpacity>
              </View>
          </View>

        </View>
        <Text className="text-center text-gray-500 text-sm mt-10 leading-4">
          By Signing up, you agree to our <Text className="text-blue-500">Terms & Conditions</Text> and <Text className="text-blue-500">Privacy Policy</Text>.
        </Text>
        <Text className="text-center justify-center items-center text-gray-500 text-sm mt-10 leading-4">
          © 2024 Ilo Agricultures. All rights reserved.
        </Text>
      </View>
    </SafeAreaView>
  )
}

export default AuthScreen;