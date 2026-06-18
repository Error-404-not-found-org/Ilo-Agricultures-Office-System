import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image } from 'react-native';
import React, { useState } from 'react';
import useSocialAuth from '../../hooks/useSocialAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignIn } from '@clerk/clerk-expo';
import { toast } from 'sonner-native';
import { useApi } from '@/lib/api';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

const AuthScreen = () => {

  const api = useApi();
  const router = useRouter();
  const { loadingStrategy, handleSocialAuth } = useSocialAuth();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setLoading(true);

    const cleanIdentifier = identifier.trim();
    
    if (!cleanIdentifier || !password) {
      toast.error("Required Fields", { description: "Please enter both identifier and password." });
      setLoading(false);
      return;
    }

    try {
      const completeSignIn = await signIn.create({
        identifier: cleanIdentifier,
        password,
      });

      if (completeSignIn.status === 'complete') {
        await setActive({ session: completeSignIn.createdSessionId });
        
        // 🔄 Sync user metadata to MongoDB
        try {
          await api.post("/user/sync-manual");
          console.log("✅ User synced to MongoDB");
        } catch (syncErr) {
          console.warn("⚠️ Sync failed:", syncErr);
        }
      } else {
        toast.error("Login Incomplete", { description: "Additional verification required." });
      }
    } catch (err: any) {
      // Use warn instead of error to avoid intrusive console overlays on some mobile devs
      console.warn("Login attempt failed:", err.message || "Invalid credentials");
      
      const errorMessage = err.errors?.[0]?.message || "Invalid credentials";
      const errorCode = err.errors?.[0]?.code;
      
      let friendlyMessage = errorMessage;
      if (errorMessage.includes("verification strategy is not valid") || errorCode === "strategy_for_user_invalid") {
        friendlyMessage = "This account was created using Google. Please sign in with the Google button above.";
      } else if (errorMessage === "Identifier is invalid.") {
        friendlyMessage = "No account found with this username or email.";
      }

      toast.error("Login Failed", { 
        description: friendlyMessage 
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
          
          {/* Identifier Field */}
          <View>
            <Text className="text-base font-medium text-slate-700 mb-2">Email or Username</Text>
            <TextInput
              className="w-full border border-gray-300 rounded-xl p-4 bg-white text-slate-800 focus:border-[#074033]"
              placeholder="Enter your email or username"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={identifier}
              onChangeText={setIdentifier}
            />
          </View>
          
          {/* Password Field */}
          <View className="mt-4">
            <Text className="text-base font-medium text-slate-700 mb-2">Password</Text>
            <View className="relative justify-center">
              <TextInput
                className="w-full border border-gray-300 rounded-xl p-4 pr-12 bg-white text-slate-800 focus:border-blue-500"
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 16, height: '100%', justifyContent: 'center' }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              className="items-end mt-2"
              onPress={() => router.push('/(auth)/forgot-password' as any)}
            >
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
                <Text className="text-white text-lg font-bold">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

          {/* Footer Register Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-gray-500">Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-blue-500 font-bold">Register</Text>
            </TouchableOpacity>
          </View>
        <Text className="text-center text-gray-500 text-sm mt-10 leading-4">
          By Signing up, you agree to our <Text className="text-[#074033]">Terms & Conditions</Text> and <Text className="text-[#074033]">Privacy Policy</Text>.
        </Text>
        <Text className="text-center justify-center items-center text-gray-500 text-sm mt-10 leading-4">
          © {new Date().getFullYear()} BreedSmart. All rights reserved.
        </Text>
      </View>
    </SafeAreaView>
  )
}

export default AuthScreen;