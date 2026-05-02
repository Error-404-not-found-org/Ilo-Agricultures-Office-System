import React, { useState, useEffect, useCallback } from 'react';
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
import { useUser, useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import { useApi } from '@/lib/api';
import { Mail, ArrowRight, LogOut, RefreshCcw } from 'lucide-react-native';


const PRIMARY = '#074033';

export default function VerifyScreen() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const api = useApi();

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const sendVerificationCode = useCallback(async () => {
    if (!user || countdown > 0) return;
    setIsSendingCode(true);
    try {
      await user.primaryEmailAddress?.prepareVerification({ strategy: 'email_code' });
      toast.success('Verification code sent to your email.');
      setCountdown(60);
    } catch {
      toast.error('Failed to send verification code.');
    } finally {
      setIsSendingCode(false);
    }
  }, [user, countdown]);

  useEffect(() => {
    if (isUserLoaded && user && user.primaryEmailAddress?.verification?.status !== 'verified') {
       sendVerificationCode();
    }
  }, [isUserLoaded, user, sendVerificationCode]);


  const onVerifyPress = async () => {
    if (!user || code.length < 6) return;
    setIsVerifying(true);
    try {
      const result = await user.primaryEmailAddress?.attemptVerification({ code });
      
      if (result?.verification.status === 'verified') {
        // Now that Clerk is happy, tell our backend to flip the metadata bit
        await api.post('/user/mark-verified');
        toast.success('Email verified successfully!');
        await user.reload();
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      toast.error('Invalid verification code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)');
  };

  if (!isUserLoaded) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-8 pt-20 pb-10">
          
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-6">
              <Mail size={40} color={PRIMARY} />
            </View>
            <Text className="text-3xl font-bold text-slate-800 text-center">Verify Email</Text>
            <Text className="text-slate-500 text-center mt-3 text-base leading-6">
              A 6-digit verification code was sent to{'\n'}
              <Text className="font-bold text-slate-700">{user?.primaryEmailAddress?.emailAddress}</Text>
            </Text>
          </View>

          <View className="space-y-6">
            <View>
              <Text className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3 ml-1">
                Verification Code
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor="#cbd5e1"
                keyboardType="number-pad"
                maxLength={6}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-5 text-center text-3xl font-bold tracking-[10px] text-slate-800"
              />
            </View>

            <TouchableOpacity
              onPress={onVerifyPress}
              disabled={isVerifying || code.length < 6}
              className={`flex-row items-center justify-center py-4 rounded-2xl shadow-sm ${code.length === 6 ? 'bg-[#074033]' : 'bg-slate-200'}`}
            >
              {isVerifying ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text className="text-white font-bold text-lg mr-2">Verify & Continue</Text>
                  <ArrowRight size={20} color="white" />
                </>
              )}
            </TouchableOpacity>

            <View className="items-center mt-4">
              <TouchableOpacity
                onPress={sendVerificationCode}
                disabled={isSendingCode || countdown > 0}
                className="flex-row items-center gap-2"
              >
                <RefreshCcw size={16} color={countdown > 0 ? '#94a3b8' : PRIMARY} />
                <Text className={`font-bold ${countdown > 0 ? 'text-slate-400' : 'text-[#074033]'}`}>
                  {isSendingCode ? 'Sending...' : countdown > 0 ? `Resend code in ${countdown}s` : 'Resend verification code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-auto pt-10">
            <TouchableOpacity
              onPress={handleSignOut}
              className="flex-row items-center justify-center gap-2 py-4 border border-slate-100 rounded-2xl bg-slate-50"
            >
              <LogOut size={18} color="#ef4444" />
              <Text className="text-red-500 font-bold">Sign out & use different account</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
