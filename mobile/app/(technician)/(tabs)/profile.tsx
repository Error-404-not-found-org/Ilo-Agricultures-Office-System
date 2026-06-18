import { View, TouchableOpacity, ScrollView, Image, StatusBar, Platform, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut, Settings, HelpCircle, User, Briefcase, Sun, Moon, Shield, Bell, MapPin, Camera, Mail, Phone, ChevronDown, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Theme system and UI components
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useApi } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OTON_BARANGAYS } from '@/lib/constants';

const TechnicianProfile = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const api = useApi();
  const queryClient = useQueryClient();

  // Query database user profile
  const { data: dbUser } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data || {};
    }
  });

  const [editMode, setEditMode] = React.useState<'phone' | 'address' | null>(null);
  const [formData, setFormData] = React.useState({
    phoneNumber: '',
    street: '',
    barangay: '',
  });

  const [selectModal, setSelectModal] = React.useState({
    visible: false,
    title: '',
    options: [] as string[],
    onSelect: (val: string) => {}
  });

  React.useEffect(() => {
    if (dbUser) {
      setFormData({
        phoneNumber: dbUser.phoneNumber || '',
        street: dbUser.address?.street || '',
        barangay: dbUser.address?.barangay || '',
      });
    }
  }, [dbUser]);

  const mutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return await api.put(`/user/${dbUser?._id}`, updatedData);
    },
    onSuccess: () => {
      toast.success("Profile Updated!");
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      setEditMode(null);
    },
    onError: () => toast.error("Update failed.")
  });

  const handleUpdate = async () => {
    if (mutation.isPending) return;
    toast.dismiss();

    if (editMode === 'phone') {
      if (!/^09\d{9}$/.test(formData.phoneNumber)) {
        return toast.error("Invalid phone format. Must start with 09 and be 11 digits.");
      }
      mutation.mutate({
        phoneNumber: formData.phoneNumber
      });
    } else if (editMode === 'address') {
      if (!formData.barangay) {
        return toast.error("Barangay is required.");
      }
      mutation.mutate({
        address: {
          street: formData.street,
          barangay: formData.barangay,
          city: 'Oton',
          province: 'Iloilo',
          zipCode: '5020',
          region: 'Region VI'
        }
      });
    }
  };

  const { data: performanceData } = useQuery({
    queryKey: ['technician', 'performance'],
    queryFn: async () => {
      const res = await api.get('/analytics/my-performance');
      return res.data;
    }
  });

  const aiStats = performanceData?.ai || { totalAI: 0, successfulAI: 0, failedAI: 0, pendingPD: 0 };
  const healthStats = performanceData?.health || { totalResolved: 0, totalInProgress: 0 };
  const totalVisits = aiStats.totalAI + healthStats.totalResolved + healthStats.totalInProgress;
  const successRate = aiStats.totalAI > 0 
    ? Math.round((aiStats.successfulAI / aiStats.totalAI) * 100) 
    : 0;
  
  // Dynamic rating based on conception success rate, defaulting to 4.8
  const rating = totalVisits > 0 
    ? (4.0 + (successRate / 100) * 1.0).toFixed(1) 
    : "4.8";

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === 'dark' ? 'light' : 'dark';
    toggleColorScheme();
    try {
      await AsyncStorage.setItem('theme_preference', newScheme);
    } catch (e) {
      console.warn("Failed to save theme preference:", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out completely");
      router.replace('/(auth)');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        style={{ flex: 1 }}
      >
        {/* Profile Header Backdrop - forest green in both light/dark */}
        <View 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            height: 320, 
            backgroundColor: isDark ? "#064e3e" : "#00643B", 
            borderBottomLeftRadius: 40, 
            borderBottomRightRadius: 40 
          }} 
        />

        {/* Profile Header Content */}
        <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <Text variant="black" size={24} style={{ color: '#fff' }}>Account</Text>
            <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Profile Card component */}
          <Card style={{ borderRadius: 32, padding: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: isDark ? colors.background : '#f1f5f9', borderWidth: 4, borderColor: colors.card, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5, overflow: 'hidden' }}>
                {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <User size={40} color={colors.textMuted} />
                  </View>
                )}
                <TouchableOpacity style={{ position: 'absolute', bottom: 0, right: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)', height: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={12} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="black" size={20} style={{ color: colors.textPrimary }}>{user?.fullName || 'Technician'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <MapPin size={12} color={colors.textSecondary} />
                  <Text variant="medium" size={13} style={{ color: colors.textSecondary }}>
                    {dbUser?.address?.barangay ? `${dbUser.address.barangay}, Oton` : "Oton, Iloilo Office"}
                  </Text>
                </View>
                <View style={{ backgroundColor: isDark ? '#064e3b' : '#ecfdf5', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 }}>
                  <Text style={{ color: isDark ? '#34d399' : '#00643B', fontSize: 10, fontFamily: 'Outfit_800ExtraBold', textTransform: 'uppercase' }}>Senior Technician</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center' }}>
                <Text variant="extrabold" size={16} style={{ color: colors.textPrimary }}>{totalVisits}</Text>
                <Text variant="bold" size={10} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Visits</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: colors.border, alignSelf: 'center' }} />
              <View style={{ alignItems: 'center' }}>
                <Text variant="extrabold" size={16} style={{ color: colors.textPrimary }}>{successRate}%</Text>
                <Text variant="bold" size={10} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Success</Text>
              </View>
              <View style={{ width: 1, height: 20, backgroundColor: colors.border, alignSelf: 'center' }} />
              <View style={{ alignItems: 'center' }}>
                <Text variant="extrabold" size={16} style={{ color: colors.textPrimary }}>{rating}</Text>
                <Text variant="bold" size={10} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Rating</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Menu Sections */}
        <View style={{ paddingHorizontal: 24, gap: 24 }}>
          
          <View>
            <Text variant="extrabold" size={12} style={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Personal Workspace</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <MenuItem 
                icon={<Mail size={18} color={colors.textSecondary} />} 
                label="Email & Security" 
                value={user?.primaryEmailAddress?.emailAddress?.split('@')[0] + '...'}
                onPress={() => {}}
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Briefcase size={18} color={colors.textSecondary} />} 
                label="Service Schedule" 
                onPress={() => {}} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Bell size={18} color={colors.textSecondary} />} 
                label="Notifications" 
                onPress={() => router.push('/notifications')} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Phone size={18} color={dbUser?.phoneNumber ? colors.textSecondary : '#ef4444'} />} 
                label="Phone Number" 
                value={dbUser?.phoneNumber || "Unset ⚠️"}
                onPress={() => setEditMode('phone')} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<MapPin size={18} color={dbUser?.address?.barangay ? colors.textSecondary : '#ef4444'} />} 
                label="Service Barangay" 
                value={dbUser?.address?.barangay || "Unset ⚠️"}
                onPress={() => setEditMode('address')} 
              />
            </View>
          </View>

          <View>
            <Text variant="extrabold" size={12} style={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Preferences</Text>
            <View style={{ backgroundColor: colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <MenuItem 
                icon={colorScheme === 'dark' ? <Sun size={18} color={colors.textSecondary} /> : <Moon size={18} color={colors.textSecondary} />} 
                label="App Theme" 
                value={colorScheme === 'dark' ? "Dark" : "Light"}
                onPress={handleToggleTheme} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<Shield size={18} color={colors.textSecondary} />} 
                label="Privacy Policy" 
                onPress={() => router.push('/privacy-policy' as any)} 
              />
              <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 54 }} />
              <MenuItem 
                icon={<HelpCircle size={18} color={colors.textSecondary} />} 
                label="Help & Support" 
                onPress={() => router.push('/help-center')} 
              />
            </View>
          </View>

          {/* Sign Out Section */}
          <TouchableOpacity 
            onPress={handleSignOut}
            activeOpacity={0.7}
            style={{ 
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', 
              paddingVertical: 20, 
              borderRadius: 24, 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 10, 
              borderWidth: 1, 
              borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', 
              marginTop: 12 
            }}
          >
            <LogOut size={20} color="#ef4444" strokeWidth={2.5} />
            <Text variant="black" size={16} style={{ color: '#ef4444' }}>Log Out Account</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text variant="bold" size={11} style={{ color: colors.textMuted, textTransform: 'uppercase' }}>Version 2.4.0 — Premium Build</Text>
          </View>

        </View>

      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editMode !== null} transparent animationType="slide" onRequestClose={() => setEditMode(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setEditMode(null)}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Math.max(insets.bottom, 40) }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: colors.textPrimary }}>
                  {editMode === 'phone' ? 'Edit Phone Number' : 'Edit Service Barangay'}
                </Text>
                <TouchableOpacity onPress={() => setEditMode(null)}>
                  <X size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={{ gap: 0 }}>
                {editMode === 'phone' && (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <ProfileInputField
                      label="Phone Number"
                      value={formData.phoneNumber}
                      onChangeText={(t: string) => setFormData({ ...formData, phoneNumber: t })}
                      placeholder="09XXXXXXXXX"
                      keyboardType="phone-pad"
                      maxLength={11}
                    />
                  </View>
                )}

                {editMode === 'address' && (
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <ProfileInputField
                      label="Purok / Street (Optional)"
                      value={formData.street}
                      onChangeText={(t: string) => setFormData({ ...formData, street: t })}
                      placeholder="Purok / Street"
                      maxLength={50}
                    />

                    <SelectField
                      label="Barangay"
                      value={formData.barangay}
                      onPress={() =>
                        setSelectModal({
                          visible: true,
                          title: 'Select Barangay',
                          options: OTON_BARANGAYS,
                          onSelect: (val) => setFormData({ ...formData, barangay: val })
                        })
                      }
                    />
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  onPress={handleUpdate}
                  disabled={mutation.isPending}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 20,
                    height: 54,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 16,
                    opacity: mutation.isPending ? 0.6 : 1
                  }}
                >
                  {mutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 16, fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Select Options Dropdown Modal */}
      <Modal visible={selectModal.visible} transparent animationType="fade" onRequestClose={() => setSelectModal({ ...selectModal, visible: false })}>
        <TouchableOpacity 
          activeOpacity={1}
          onPress={() => setSelectModal({ ...selectModal, visible: false })}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        >
          <View style={{ width: '100%', maxHeight: '60%', backgroundColor: colors.card, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colors.textPrimary, marginBottom: 16 }}>
              {selectModal.title}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectModal.options.map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    selectModal.onSelect(opt);
                    setSelectModal({ ...selectModal, visible: false });
                  }}
                  style={{ paddingVertical: 16, borderBottomWidth: idx === selectModal.options.length - 1 ? 0 : 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: colors.textPrimary }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const MenuItem = ({ icon, label, value, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.6}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <Text variant="bold" size={15} style={{ color: colors.textPrimary }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {value && <Text variant="medium" size={13} style={{ color: colors.textMuted }}>{value}</Text>}
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

// Reusable components for editing
const ProfileInputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength, secureTextEntry = false }: any) => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4, letterSpacing: 1, color: colors.textMuted }}>
        {label}
      </Text>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          style={{
            borderWidth: 1,
            borderRadius: 16,
            paddingLeft: 16,
            paddingRight: 16,
            paddingVertical: 12,
            fontFamily: 'Outfit_500Medium',
            fontSize: 14,
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.textPrimary
          }}
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
};

const SelectField = ({ label, value, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Outfit_900Black', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4, letterSpacing: 1, color: colors.textMuted }}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        style={{
          borderWidth: 1,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 48,
          backgroundColor: colors.card,
          borderColor: colors.border
        }}
      >
        <Text
          style={{
            fontFamily: 'Outfit_500Medium',
            fontSize: 14,
            color: value ? colors.textPrimary : colors.textMuted
          }}
        >
          {value || "Select"}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

export default TechnicianProfile;
