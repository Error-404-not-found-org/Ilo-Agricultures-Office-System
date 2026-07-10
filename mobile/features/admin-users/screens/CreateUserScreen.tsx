import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  useColorScheme,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CheckCircle, Share2, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import SafeScreen from '@/components/safeScreen';
import { useCreateUser } from '../hooks/useCreateUser';
import {
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from '@/constants/address';

const PRIMARY = '#1e3a5f';
const ROLES = ['farmer', 'technician', 'admin'] as const;

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  farmer: { label: 'Farmer', color: '#065f46', bg: '#D1FAE5' },
  technician: { label: 'Technician', color: '#1d4ed8', bg: '#DBEAFE' },
  admin: { label: 'Administrator', color: '#92400e', bg: '#FEF3C7' },
};

export default function CreateUserScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    phoneNumber,
    setPhoneNumber,
    role,
    setRole,
    street,
    setStreet,
    city,
    setCity,
    district,
    setDistrict,
    barangay,
    setBarangay,
    showRolePicker,
    setShowRolePicker,
    loading,
    createdAccount,
    handleCreate,
    shareCredentials,
    handleCreateAnother,
  } = useCreateUser();
  const [picker, setPicker] = React.useState<null | 'city' | 'district' | 'barangay'>(null);
  const barangayOptions = React.useMemo(
    () => getIloiloBarangayOptions(city, district),
    [city, district],
  );
  const pickerOptions =
    picker === 'city'
      ? ILOILO_MUNICIPALITY_OPTIONS
      : picker === 'district'
        ? ILOILO_CITY_DISTRICT_OPTIONS
        : barangayOptions;
  const pickerTitle =
    picker === 'city'
      ? 'Select Municipality / City'
      : picker === 'district'
        ? 'Select Iloilo City District'
        : 'Select Barangay';

  // ✅ Success Screen
  if (createdAccount) {
    return (
      <SafeScreen>
        <ScrollView className="flex-1 bg-gray-50 dark:bg-slate-950 px-6 pt-8" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-green-100 dark:bg-emerald-950/50 rounded-full items-center justify-center mb-4">
              <CheckCircle size={40} color="#16a34a" />
            </View>
            <Text className="text-2xl font-bold text-slate-800 dark:text-white mb-1">User Created!</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-center">
              {createdAccount.invitationSent
                ? 'An invitation was sent. The user will set their own password.'
                : 'Offline farmer profile created. The farmer can claim it later.'}
            </Text>
          </View>

          <View className="bg-white dark:bg-slate-900 rounded-[24px] p-6 border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
            <Text className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Account Setup</Text>

            <CredentialRow label="Email" value={createdAccount.email || 'No email'} />
            {createdAccount.phoneNumber ? (
              <>
                <View className="h-[1px] bg-slate-100 dark:bg-slate-800 my-3" />
                <CredentialRow label="Phone" value={createdAccount.phoneNumber} />
              </>
            ) : null}
            <View className="h-[1px] bg-slate-100 dark:bg-slate-800 my-3" />
            <CredentialRow
              label="Password"
              value={createdAccount.invitationSent ? 'Set by user through Clerk invite' : 'Not created yet'}
            />
            <View className="h-[1px] bg-slate-100 dark:bg-slate-800 my-3" />
            <View className="flex-row justify-between items-center">
              <Text className="text-slate-400 dark:text-slate-500 text-sm font-semibold">Role</Text>
              <View
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: ROLE_LABELS[createdAccount.role].bg }}
              >
                <Text style={{ color: ROLE_LABELS[createdAccount.role].color }} className="text-xs font-bold capitalize">{createdAccount.role}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={shareCredentials}
            className="py-4 rounded-2xl items-center mb-3 flex-row justify-center gap-2"
            style={{ backgroundColor: PRIMARY }}
          >
            <Share2 size={18} color="white" />
            <Text className="text-white font-bold text-base">Share Setup Info</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCreateAnother}
            className="bg-white dark:bg-slate-900 py-4 rounded-2xl items-center mb-3 border border-slate-200 dark:border-slate-800"
          >
            <Text className="text-slate-700 dark:text-slate-200 font-bold text-base">Create Another User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-slate-100 dark:bg-slate-800 py-4 rounded-2xl items-center"
          >
            <Text className="text-slate-700 dark:text-slate-200 font-bold text-base">Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView className="flex-1 bg-gray-50 dark:bg-slate-950" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View className="px-6 pt-6 pb-6 bg-white dark:bg-slate-900 rounded-b-[32px] shadow-sm mb-6 flex-row items-center gap-3 border-b border-transparent dark:border-slate-800">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center"
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={PRIMARY} />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white">Create New User</Text>
            <Text className="text-gray-400 dark:text-slate-500 text-sm">Admin Panel</Text>
          </View>
        </View>

        <View className="px-6 gap-y-5">
          {/* Role Picker */}
          <View>
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Role</Text>
            <TouchableOpacity
              onPress={() => setShowRolePicker(!showRolePicker)}
              accessibilityRole="button"
              accessibilityLabel="Select user role"
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 flex-row justify-between items-center"
            >
              <View className="flex-row items-center gap-3">
                <MaterialCommunityIcons name="account-circle" size={22} color={ROLE_LABELS[role].color} />
                <Text className="font-semibold text-slate-800 dark:text-white text-base">{ROLE_LABELS[role].label}</Text>
              </View>
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: ROLE_LABELS[role].bg }}>
                <Text style={{ color: ROLE_LABELS[role].color }} className="text-xs font-bold capitalize">{role}</Text>
              </View>
            </TouchableOpacity>
            {showRolePicker && (
              <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mt-2 overflow-hidden shadow-sm">
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => { setRole(r); setShowRolePicker(false); }}
                    className={`flex-row items-center justify-between px-4 py-3.5 ${role === r ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                  >
                    <Text className={`font-semibold text-[15px] ${role === r ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>{ROLE_LABELS[r].label}</Text>
                    {role === r && <MaterialCommunityIcons name="check" size={18} color="#2563EB" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Name Fields */}
          <View className="flex-row gap-x-3">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">First Name</Text>
              <TextInput
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-800 dark:text-white font-medium"
                placeholder="First name"
                placeholderTextColor="#94a3b8"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Last Name</Text>
              <TextInput
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-800 dark:text-white font-medium"
                placeholder="Last name"
                placeholderTextColor="#94a3b8"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          {/* Email */}
          <View>
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Email Address</Text>
            <TextInput
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-800 dark:text-white font-medium"
              placeholder="user@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Phone Number</Text>
            <TextInput
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-800 dark:text-white font-medium"
              placeholder="09XXXXXXXXX"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <View className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-slate-100 dark:border-slate-800">
            <Text className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
              {role === 'technician' ? 'Assigned Service Area' : 'Address'}
            </Text>
            <Text className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              {role === 'technician'
                ? 'Used for workload views and municipality/barangay filtering.'
                : 'Used for admin records and location-based summaries.'}
            </Text>

            <View className="mb-3">
              <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Street / Purok</Text>
              <TextInput
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 text-slate-800 dark:text-white font-medium"
                placeholder="Optional"
                placeholderTextColor="#94a3b8"
                value={street}
                onChangeText={setStreet}
              />
            </View>

            <AddressPickerButton
              label="Municipality / City"
              value={city}
              placeholder="Select municipality or city"
              onPress={() => setPicker('city')}
            />

            {city === ILOILO_CITY_NAME && (
              <AddressPickerButton
                label="District"
                value={district}
                placeholder="Select district"
                onPress={() => setPicker('district')}
              />
            )}

            <AddressPickerButton
              label="Barangay"
              value={barangay}
              placeholder={
                !city
                  ? 'Select city first'
                  : city === ILOILO_CITY_NAME && !district
                    ? 'Select district first'
                    : 'Select barangay'
              }
              disabled={!city || (city === ILOILO_CITY_NAME && !district)}
              onPress={() => setPicker('barangay')}
            />
          </View>

          <View className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 px-4 py-3">
            <Text className="text-blue-900 dark:text-blue-200 font-bold text-sm mb-1">
              Password setup
            </Text>
            <Text className="text-blue-700 dark:text-blue-300 text-xs leading-5">
              Admins do not create or keep passwords. Users with email will receive a Clerk invite and set their own password. Farmer profiles without email can be claimed later through phone verification.
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

      <Modal visible={!!picker} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white dark:bg-slate-900 rounded-t-[28px] p-5 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-slate-900 dark:text-white">
                {pickerTitle}
              </Text>
              <TouchableOpacity
                onPress={() => setPicker(null)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    if (picker === 'city') {
                      setCity(item);
                      setDistrict('');
                      setBarangay('');
                    } else if (picker === 'district') {
                      setDistrict(item);
                      setBarangay('');
                    } else {
                      setBarangay(item);
                    }
                    setPicker(null);
                  }}
                  className="py-4 border-b border-slate-100 dark:border-slate-800"
                >
                  <Text className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const AddressPickerButton = ({
  label,
  value,
  placeholder,
  onPress,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <View className="mb-3">
    <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{label}</Text>
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
      style={{ opacity: disabled ? 0.55 : 1 }}
    >
      <Text className={`font-medium ${value ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>
        {value || placeholder}
      </Text>
      <MaterialCommunityIcons name="chevron-down" size={18} color="#94a3b8" />
    </TouchableOpacity>
  </View>
);

const CredentialRow = ({ label, value }: { label: string; value: string }) => (
  <View>
    <Text className="text-slate-400 dark:text-slate-500 text-xs font-semibold">{label}</Text>
    <Text selectable className="text-slate-800 dark:text-white font-bold text-base mt-0.5">{value}</Text>
  </View>
);
