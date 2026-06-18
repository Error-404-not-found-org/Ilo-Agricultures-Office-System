import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import { useApi } from '@/lib/api';
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';

const PRIMARY = '#074033';

export default function ForgotPasswordScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const api = useApi();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);

  // Step 1: Request code
  const onRequestReset = async () => {
    if (!isLoaded) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return toast.error("Required Field", { description: "Please enter your email address or username." });
    }

    setLoading(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: cleanEmail,
      });
      toast.success("Verification code sent to your email.");
      setStep('verify');
    } catch (err: any) {
      console.warn("Forgot password request failed:", err.message || err);
      const errMsg = err.errors?.[0]?.message || err.message || "Failed to request password reset.";
      toast.error("Request Failed", { description: errMsg });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code and set new password
  const onVerifyAndReset = async () => {
    if (!isLoaded) return;
    if (!code || code.length < 6) {
      return toast.error("Invalid Code", { description: "Please enter the 6-digit verification code." });
    }
    if (!password) {
      return toast.error("Required Field", { description: "Please enter your new password." });
    }
    if (password.length < 8) {
      return toast.error("Password Length", { description: "New password must be at least 8 characters." });
    }
    if (password !== confirmPassword) {
      return toast.error("Password Mismatch", { description: "Passwords do not match." });
    }

    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        toast.success("Password reset successful!");
        
        // Sync user metadata to MongoDB
        try {
          await api.post("/user/sync-manual");
          console.log("✅ User synced to MongoDB");
        } catch (syncErr) {
          console.warn("⚠️ Sync failed:", syncErr);
        }
        
        // Clerk routing or app wrapper will redirect automatically, or we push
        router.replace('/(farmer)/(tabs)/profile');
      } else {
        toast.error("Reset Incomplete", { description: "Additional verification steps are required." });
      }
    } catch (err: any) {
      console.warn("Password reset verification failed:", err.message || err);
      const errMsg = err.errors?.[0]?.message || err.message || "Failed to reset password. Please check your code.";
      toast.error("Reset Failed", { description: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-8 pt-20 pb-10">
          
          {/* Back Button */}
          <TouchableOpacity 
            onPress={() => {
              if (step === 'verify') {
                setStep('request');
              } else {
                router.back();
              }
            }}
            className="flex-row items-center mb-6 self-start"
          >
            <ArrowLeft size={20} color={PRIMARY} />
            <Text className="text-[#074033] font-semibold ml-2">
              {step === 'verify' ? 'Back to Request' : 'Back to Login'}
            </Text>
          </TouchableOpacity>

          {step === 'request' ? (
            <View className="flex-1">
              <View className="items-center mb-10">
                <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-6">
                  <Mail size={40} color={PRIMARY} />
                </View>
                <Text className="text-3xl font-bold text-slate-800 text-center">Reset Password</Text>
                <Text className="text-slate-500 text-center mt-3 text-base leading-6">
                  Enter your email address or username and we will send you a 6-digit verification code to reset your password.
                </Text>
              </View>

              <View className="space-y-6">
                <View>
                  <Text className="text-sm font-semibold text-slate-700 mb-2">
                    Email or Username
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email or username"
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    className="w-full border border-gray-300 rounded-xl p-4 bg-white focus:border-[#074033] text-slate-800"
                  />
                </View>

                <TouchableOpacity
                  onPress={onRequestReset}
                  disabled={loading}
                  className="flex-row items-center justify-center py-4 rounded-xl bg-[#074033] shadow-sm mt-6"
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text className="text-white font-bold text-lg mr-2">Send Code</Text>
                      <ArrowRight size={20} color="white" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="flex-1">
              <View className="items-center mb-10">
                <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-6">
                  <Lock size={40} color={PRIMARY} />
                </View>
                <Text className="text-3xl font-bold text-slate-800 text-center">Verify & Reset</Text>
                <Text className="text-slate-500 text-center mt-3 text-base leading-6">
                  Please enter the 6-digit verification code sent to your email, along with your new secure password.
                </Text>
              </View>

              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-semibold text-slate-700 mb-2">
                    6-Digit Verification Code
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="000000"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-center text-2xl font-bold tracking-[10px] text-slate-800"
                  />
                </View>

                 <View className="mt-4">
                  <Text className="text-sm font-semibold text-slate-700 mb-2">
                    New Password
                  </Text>
                  <View style={{ justifyContent: 'center' }}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter new password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-4 bg-white focus:border-[#074033] text-slate-800"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 16, height: '100%', justifyContent: 'center' }}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color="#9ca3af" />
                      ) : (
                        <Eye size={18} color="#9ca3af" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="mt-4">
                  <Text className="text-sm font-semibold text-slate-700 mb-2">
                    Confirm New Password
                  </Text>
                  <View style={{ justifyContent: 'center' }}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      className="w-full border border-gray-300 rounded-xl pl-4 pr-12 py-4 bg-white focus:border-[#074033] text-slate-800"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: 16, height: '100%', justifyContent: 'center' }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} color="#9ca3af" />
                      ) : (
                        <Eye size={18} color="#9ca3af" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onVerifyAndReset}
                  disabled={loading}
                  className="flex-row items-center justify-center py-4 rounded-xl bg-[#074033] shadow-sm mt-6"
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text className="text-white font-bold text-lg mr-2">Reset Password</Text>
                      <ArrowRight size={20} color="white" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
