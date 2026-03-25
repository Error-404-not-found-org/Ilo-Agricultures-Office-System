import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Eye, EyeOff, CheckCircle, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import SafeScreen from '@/components/safeScreen';

const PRIMARY = '#1e3a5f';
const ROLES = ['farmer', 'technician', 'admin'] as const;
type Role = typeof ROLES[number];

const ROLE_LABELS: Record<Role, { label: string; color: string; bg: string }> = {
  farmer: { label: 'Farmer', color: '#065f46', bg: '#D1FAE5' },
  technician: { label: 'Technician', color: '#1d4ed8', bg: '#DBEAFE' },
  admin: { label: 'Administrator', color: '#92400e', bg: '#FEF3C7' },
};

export default function CreateUserScreen() {
  const router = useRouter();
  const api = useApi();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('farmer');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Success state
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      toast.error('Email and password are required.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/admin/create-user', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
      toast.success(`${ROLE_LABELS[role].label} created successfully!`);
      setCreatedCredentials(res.data.credentials || { email: email.trim().toLowerCase(), password });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create user.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const shareCredentials = async () => {
    if (!createdCredentials) return;
    try {
      await Share.share({
        message: `Login Credentials:\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${role}`,
        title: 'New User Credentials',
      });
    } catch (e) {
      toast.error('Failed to share credentials.');
    }
  };

  const handleCreateAnother = () => {
    setCreatedCredentials(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setRole('farmer');
  };

  // ✅ Success Screen
  if (createdCredentials) {
    return (
      <SafeScreen>
        <ScrollView className="flex-1 bg-gray-50 px-6 pt-8" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
              <CheckCircle size={40} color="#16a34a" />
            </View>
            <Text className="text-2xl font-bold text-slate-800 mb-1">User Created!</Text>
            <Text className="text-slate-500 text-center">Share these credentials with the new user.</Text>
          </View>

          <View className="bg-white rounded-[24px] p-6 border border-slate-100 shadow-sm mb-6">
            <Text className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Login Credentials</Text>

            <CredentialRow label="Email" value={createdCredentials.email} />
            <View className="h-[1px] bg-slate-100 my-3" />
            <CredentialRow label="Password" value={createdCredentials.password} />
            <View className="h-[1px] bg-slate-100 my-3" />
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 text-sm font-semibold">Role</Text>
              <View
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: ROLE_LABELS[role].bg }}
              >
                <Text style={{ color: ROLE_LABELS[role].color }} className="text-xs font-bold capitalize">{role}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={shareCredentials}
            className="py-4 rounded-2xl items-center mb-3 flex-row justify-center gap-2"
            style={{ backgroundColor: PRIMARY }}
          >
            <Share2 size={18} color="white" />
            <Text className="text-white font-bold text-base">Share Credentials</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCreateAnother}
            className="bg-white py-4 rounded-2xl items-center mb-3 border border-slate-200"
          >
            <Text className="text-slate-700 font-bold text-base">Create Another User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-slate-100 py-4 rounded-2xl items-center"
          >
            <Text className="text-slate-700 font-bold text-base">Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <StatusBar barStyle="dark-content" />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View className="px-6 pt-6 pb-6 bg-white rounded-b-[32px] shadow-sm mb-6 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-100 rounded-full items-center justify-center">
            <MaterialCommunityIcons name="arrow-left" size={20} color={PRIMARY} />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-900">Create New User</Text>
            <Text className="text-gray-400 text-sm">Admin Panel</Text>
          </View>
        </View>

        <View className="px-6 gap-y-5">
          {/* Role Picker */}
          <View>
            <Text className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Role</Text>
            <TouchableOpacity
              onPress={() => setShowRolePicker(!showRolePicker)}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons name="account-circle" size={22} color={ROLE_LABELS[role].color} />
                <Text className="font-semibold text-slate-800 text-base">{ROLE_LABELS[role].label}</Text>
              </View>
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: ROLE_LABELS[role].bg }}>
                <Text style={{ color: ROLE_LABELS[role].color }} className="text-xs font-bold capitalize">{role}</Text>
              </View>
            </TouchableOpacity>
            {showRolePicker && (
              <View className="bg-white border border-slate-200 rounded-2xl mt-2 overflow-hidden shadow-sm">
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => { setRole(r); setShowRolePicker(false); }}
                    className={`flex-row items-center justify-between px-4 py-3.5 ${role === r ? 'bg-blue-50' : ''}`}
                  >
                    <Text className={`font-semibold text-[15px] ${role === r ? 'text-blue-700' : 'text-slate-700'}`}>{ROLE_LABELS[r].label}</Text>
                    {role === r && <MaterialCommunityIcons name="check" size={18} color="#2563EB" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Name Fields */}
          <View className="flex-row gap-x-3">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-500 mb-2">First Name</Text>
              <TextInput
                className="bg-white border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 font-medium"
                placeholder="First name"
                placeholderTextColor="#94a3b8"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-500 mb-2">Last Name</Text>
              <TextInput
                className="bg-white border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 font-medium"
                placeholder="Last name"
                placeholderTextColor="#94a3b8"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          {/* Email */}
          <View>
            <Text className="text-sm font-semibold text-slate-500 mb-2">Email Address</Text>
            <TextInput
              className="bg-white border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 font-medium"
              placeholder="user@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View>
            <Text className="text-sm font-semibold text-slate-500 mb-2">Password</Text>
            <View className="bg-white border border-slate-200 rounded-2xl px-4 flex-row items-center">
              <TextInput
                className="flex-1 py-4 text-slate-800 font-medium"
                placeholder="Min. 8 characters"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="ml-2">
                {showPassword ? <EyeOff size={20} color="#94a3b8" /> : <Eye size={20} color="#94a3b8" />}
              </TouchableOpacity>
            </View>
            <Text className="text-slate-400 text-xs mt-1.5 ml-1">
              This password will be used to log in to the app.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            className="py-4 rounded-2xl items-center mt-2"
            style={{ backgroundColor: PRIMARY }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Create {ROLE_LABELS[role].label}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

const CredentialRow = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Text className="text-slate-400 text-xs font-semibold">{label}</Text>
    <Text selectable className="text-slate-800 font-bold text-base mt-0.5">{value}</Text>
  </View>
);
