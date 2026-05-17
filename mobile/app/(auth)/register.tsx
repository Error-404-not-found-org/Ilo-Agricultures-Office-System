import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSignUp } from '@clerk/clerk-expo';
import { toast } from 'sonner-native';
import { useRouter } from 'expo-router';
import { Check, X, Eye, EyeOff, ChevronRight } from 'lucide-react-native';
import useSocialAuth from '../../hooks/useSocialAuth';

const RegisterScreen = () => {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { loadingStrategy, handleSocialAuth } = useSocialAuth();

  // Password Validation States
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber;

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setLoading(true);

    const cleanUsername = username.trim();
    const cleanEmail = emailAddress.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail || !password) {
      toast.error("Required Fields", { description: "Please enter your email and password." });
      setLoading(false);
      return;
    }

    if (!isPasswordValid) {
      toast.error("Weak Password", { description: "Please ensure your password meets all requirements." });
      setLoading(false);
      return;
    }

    if (!emailRegex.test(cleanEmail)) {
      toast.error("Invalid Email", { description: "Please enter a valid email address." });
      setLoading(false);
      return;
    }

    try {
      // Create user via Clerk
      const signUpAttempt = await signUp.create({
        username: cleanUsername || undefined,
        firstName: cleanFirstName || undefined,
        lastName: cleanLastName || undefined,
        emailAddress: cleanEmail,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      router.push('/(auth)/verify');
    } catch (err: any) {
      console.warn("Register attempt failed:", err.message);
      const errorMessage = err.errors?.[0]?.message || "Could not complete registration. Check your inputs.";
      toast.error("Registration Failed", { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white h-full">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-8 pt-8 pb-4">
            
            <View className="items-center mb-6">
              <Image 
                source={require('../../assets/logo.png')}
                className="h-16 w-16 rounded-full mb-4"
                resizeMode="contain"
              />
              <Text className="text-2xl font-black text-slate-900 mb-1">Create your account</Text>
              <Text className="text-sm font-medium text-slate-500 text-center">Welcome! Please fill in the details to get started.</Text>
            </View>

            <View className="space-y-4">
              
              {/* Google Sign Up */}
              <TouchableOpacity 
                className='flex-row items-center justify-center bg-white border border-slate-200 rounded-xl px-6 py-3.5 shadow-sm'
                onPress={() => handleSocialAuth("oauth_google")}
                disabled={loadingStrategy !== null}
              >
                {loadingStrategy === 'oauth_google' ? (
                  <ActivityIndicator size="small" color="#0000ff" />
                ) : (
                  <View className='flex-row items-center justify-center'>
                    <Image 
                      source={require('../../assets/google.png')} 
                      className='size-5 mr-3'
                      resizeMode='contain'
                    />
                    <Text className='text-slate-700 font-bold text-[15px]'>Continue with Google</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center my-1">
                  <View className="flex-1 h-[1px] bg-slate-100" />
                  <Text className="mx-4 text-slate-400 font-medium text-xs uppercase tracking-wider">or</Text>
                  <View className="flex-1 h-[1px] bg-slate-100" />
              </View>

              {/* Name Row */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <View className="flex-row justify-between mb-1.5 px-0.5">
                    <Text className="text-[13px] font-bold text-slate-800">First name</Text>
                    <Text className="text-[11px] font-medium text-slate-400">Optional</Text>
                  </View>
                  <TextInput
                    className="w-full border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 focus:border-slate-400"
                    placeholder="First name"
                    placeholderTextColor="#94a3b8"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between mb-1.5 px-0.5">
                    <Text className="text-[13px] font-bold text-slate-800">Last name</Text>
                    <Text className="text-[11px] font-medium text-slate-400">Optional</Text>
                  </View>
                  <TextInput
                    className="w-full border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 focus:border-slate-400"
                    placeholder="Last name"
                    placeholderTextColor="#94a3b8"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              <View>
                <View className="flex-row justify-between mb-1.5 px-0.5">
                  <Text className="text-[13px] font-bold text-slate-800">Username</Text>
                  <Text className="text-[11px] font-medium text-slate-400">Optional</Text>
                </View>
                <TextInput
                  className="w-full border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 focus:border-slate-400"
                  placeholder=""
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>

              <View>
                <View className="flex-row justify-between mb-1.5 px-0.5">
                  <Text className="text-[13px] font-bold text-slate-800">Email address</Text>
                </View>
                <TextInput
                  className="w-full border border-slate-200 rounded-xl p-3.5 bg-white text-slate-800 focus:border-slate-400"
                  placeholder="Enter your email address"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                />
              </View>

              <View>
                <View className="flex-row justify-between mb-1.5 px-0.5">
                  <Text className="text-[13px] font-bold text-slate-800">Password</Text>
                </View>
                <View className="relative justify-center">
                  <TextInput
                    className="w-full border border-slate-200 rounded-xl p-3.5 pr-12 bg-white text-slate-800 focus:border-slate-400"
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity 
                    className="absolute right-4" 
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#94a3b8" />
                    ) : (
                      <Eye size={18} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>
                
                {/* Password Strength Indicator */}
                <View className="mt-2.5 space-y-1 px-0.5">
                  <View className="flex-row items-center">
                    {hasMinLength ? <Check size={12} color="#10b981" /> : <X size={12} color="#94a3b8" />}
                    <Text className={`ml-2 text-[11px] ${hasMinLength ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}`}>8 or more characters</Text>
                  </View>
                  <View className="flex-row items-center">
                    {hasUppercase ? <Check size={12} color="#10b981" /> : <X size={12} color="#94a3b8" />}
                    <Text className={`ml-2 text-[11px] ${hasUppercase ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}`}>At least 1 uppercase letter</Text>
                  </View>
                  <View className="flex-row items-center">
                    {hasNumber ? <Check size={12} color="#10b981" /> : <X size={12} color="#94a3b8" />}
                    <Text className={`ml-2 text-[11px] ${hasNumber ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium'}`}>At least 1 number</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                className="w-full bg-[#2d3748] py-3.5 rounded-xl mt-4 flex-row items-center justify-center shadow-sm"
                onPress={onSignUpPress}
                disabled={loading}
              >
                {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text className="text-white text-[15px] font-bold mr-1.5">Continue</Text>
                    <ChevronRight size={16} color="white" strokeWidth={3} />
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
          
          <View className="bg-slate-50 py-5 border-t border-slate-100 flex-row justify-center mt-auto">
            <Text className="text-slate-500 text-[13px]">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)')}>
              <Text className="text-slate-800 font-bold text-[13px]">Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default RegisterScreen;
