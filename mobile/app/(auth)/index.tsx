import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
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
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }} className="flex-1 px-6">
        <View className="items-center mt-4 mb-8">
          <Image 
            source={require('../../assets/logo.png')}
            className="h-20 w-20 rounded-full mb-4"
            resizeMode="contain"
          />
          <Text className="text-2xl font-outfit-bold text-[#074033]">BreedSmart</Text>
          <Text className="mt-1 text-sm font-outfit-medium text-slate-500 text-center">
            Sign in to manage livestock services and records.
          </Text>
        </View>

        {/* Form Container */}
        <View className="space-y-4">

          {/* Google Sign in */}
          <View className="gap-2">
            <TouchableOpacity 
              className='flex-row items-center justify-center bg-white border border-slate-200 rounded-xl px-6 py-3.5 shadow-sm'
              onPress={() => handleSocialAuth("oauth_google")}
              disabled={loadingStrategy !== null}
            >
              {loadingStrategy === 'oauth_google' ? (
                <ActivityIndicator size="small" color="#074033" />
              ) : (
                <View className='flex-row items-center justify-center'>
                  <Image 
                    source={require('../../assets/google.png')} 
                    className='size-5 mr-3'
                    resizeMode='contain'
                  />
                  <Text className='text-slate-700 font-outfit-semibold text-[15px]'>Sign in with Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center my-4">
              <View className="flex-1 h-[1px] bg-gray-300" />
              <Text className="mx-4 text-slate-400 font-outfit-semibold text-xs">OR</Text>
              <View className="flex-1 h-[1px] bg-gray-300" />
          </View>
          
          {/* Identifier Field */}
          <View>
            <Text className="text-sm font-outfit-semibold text-slate-700 mb-2">Email or Username</Text>
            <TextInput
              className="w-full h-[52px] border border-slate-200 rounded-xl px-4 bg-white text-slate-800 font-outfit-medium focus:border-[#074033]"
              placeholder="Enter your email or username"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={identifier}
              onChangeText={setIdentifier}
            />
          </View>
          
          {/* Password Field */}
          <View className="mt-4">
            <Text className="text-sm font-outfit-semibold text-slate-700 mb-2">Password</Text>
            <View className="relative justify-center">
              <TextInput
                className="w-full h-[52px] border border-slate-200 rounded-xl px-4 pr-12 bg-white text-slate-800 font-outfit-medium focus:border-[#074033]"
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
              <Text className="text-[#074033] font-outfit-semibold text-sm">Forgot password?</Text>
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
                <Text className="text-white text-base font-outfit-bold">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

          {/* Footer Register Link */}
          <View className="flex-row justify-center mt-6">
            <Text className="text-slate-500 font-outfit-medium">Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text className="text-[#074033] font-outfit-bold">Register</Text>
            </TouchableOpacity>
          </View>
        <Text className="text-center text-slate-500 font-outfit text-xs mt-8 leading-5 px-2">
          By continuing, you agree to our <Text className="text-[#074033] font-outfit-semibold">Terms &amp; Conditions</Text> and <Text className="text-[#074033] font-outfit-semibold">Privacy Policy</Text>.
        </Text>
        <Text className="text-center text-slate-400 font-outfit-medium text-xs mt-8">
          © {new Date().getFullYear()} BreedSmart. All rights reserved.
        </Text>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default AuthScreen;
