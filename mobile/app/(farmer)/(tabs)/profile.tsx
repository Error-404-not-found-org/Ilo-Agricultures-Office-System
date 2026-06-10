import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, StatusBar, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ChevronRight,
  LogOut,
  Settings,
  HelpCircle,
  User,
  Phone,
  MapPin,
  Sun,
  Moon,
  Shield,
  ShieldCheck,
  Mail,
  Camera,
  Globe,
  Bell,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OTON_BARANGAYS } from '@/lib/constants';
import { useTheme } from '@/lib/theme';


const FarmerProfile = () => {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { colors, isDark } = useTheme();

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === 'dark' ? 'light' : 'dark';
    toggleColorScheme();
    try {
      await AsyncStorage.setItem('theme_preference', newScheme);
    } catch (e) {}
  };

  // Dialog States
  const [editMode, setEditMode] = useState<'phone' | 'address' | null>(null);

  const [selectModal, setSelectModal] = useState({
    visible: false,
    title: '',
    options: [] as string[],
    onSelect: (val: string) => {}
  });


  const { data: dbUser, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  const [formData, setFormData] = useState({
    phoneNumber: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
  });

  useEffect(() => {
    if (dbUser) {
      setFormData({
        phoneNumber: dbUser.phoneNumber || '',
        street: dbUser.address?.street || '',
        barangay: dbUser.address?.barangay || '',
        city: dbUser.address?.city || 'Oton',
        province: dbUser.address?.province || 'Iloilo',
      });
    }
  }, [dbUser]);

  const mutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return await api.put(`/user/${dbUser._id}`, updatedData);
    },
    onSuccess: () => {
      toast.success("Profile Updated!");
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      setEditMode(null);
    },
    onError: () => toast.error("Update failed.")
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)');
    } catch (e) {}
  };

  const handleUpdate = () => {
    if (editMode === 'phone') {
      if (!/^\+639\d{9}$/.test(formData.phoneNumber)) {
        return toast.error("Invalid format. Use +639XXXXXXXXX.");
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


  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950" style={{ backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        
        {/* Curved Header Background */}
        <View className="pt-14 pb-20 px-6 rounded-b-[40px] items-center relative shadow-lg" style={{ backgroundColor: '#00643B' }}>
           
           {/* Profile Picture & Info */}
           <View className="relative mt-4">
              <View className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden bg-slate-100 items-center justify-center">
                 {clerkUser?.imageUrl ? (
                    <Image source={{ uri: clerkUser.imageUrl }} className="w-full h-full" />
                 ) : (
                    <User size={48} color="#94a3b8" />
                 )}
              </View>
              <TouchableOpacity 
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center shadow-md"
                style={{ backgroundColor: colors.card }}
              >
                 <Camera size={14} color={isDark ? colors.primary : "#00643B"} />
              </TouchableOpacity>
           </View>

           <Text className="text-white font-outfit-bold text-xl mt-4">{clerkUser?.fullName}</Text>
           
           <View className="flex-row items-center gap-1.5 mt-1 bg-white/10 px-3 py-1 rounded-full">
              <ShieldCheck size={12} color="#34d399" />
              <Text className="text-emerald-100 text-[10px] font-outfit-bold uppercase tracking-wider">Registered Farmer</Text>
           </View>
        </View>

        {/* Stats Container (Shifted Upwards) */}
        <View className="px-6 -mt-10">
           <View 
             className="rounded-[28px] p-5 flex-row justify-between border shadow-xl dark:shadow-none"
             style={{ backgroundColor: colors.card, borderColor: colors.border }}
           >
              <StatItem label="Total Cows" value={dbUser?.stats?.totalAnimals || '0'} icon="cow" color={isDark ? colors.primary : "#00643B"} />
              <View className="w-[1px] my-1" style={{ backgroundColor: colors.border }} />
              <StatItem label="Active Cases" value={dbUser?.stats?.activeCases || '0'} icon="medical-bag" color="#eab308" />
              <View className="w-[1px] my-1" style={{ backgroundColor: colors.border }} />
              <StatItem label="Pregnant" value={dbUser?.stats?.activePregnancies || '0'} icon="heart-pulse" color="#0891b2" />
           </View>
        </View>

        <View className="px-6 mt-8">
           
           {/* Personal Information */}
           <Text className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1" style={{ color: colors.textMuted }}>Account Details</Text>
           
           <View className="rounded-3xl overflow-hidden border mb-6" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <DetailRow icon={<Mail size={18} color={colors.textMuted} />} label="Email Address" value={clerkUser?.primaryEmailAddress?.emailAddress} />
              <Divider />
              <DetailRow icon={<Phone size={18} color={colors.textMuted} />} label="Phone Number" value={dbUser?.phoneNumber || 'Not Set'} onPress={() => setEditMode('phone')} />
              <Divider />
              <DetailRow icon={<MapPin size={18} color={colors.textMuted} />} label="Farm Address" value={dbUser?.address?.barangay ? `${dbUser.address.street ? dbUser.address.street + ', ' : ''}${dbUser.address.barangay}, ${dbUser.address.city}, ${dbUser.address.province}` : 'Not Set'} onPress={() => setEditMode('address')} />
           </View>

           {/* Quick Actions */}
           <Text className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1" style={{ color: colors.textMuted }}>System & Support</Text>
           
           <View className="rounded-3xl overflow-hidden border mb-10" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
              <TouchableOpacity onPress={handleToggleTheme} style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? '#1e293b' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                       {isDark ? <Moon size={18} color="#94a3b8" /> : <Sun size={18} color="#f59e0b" />}
                    </View>
                    <View>
                       <Text style={{ fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: colors.textPrimary }}>Theme Mode</Text>
                       <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: colors.textMuted, textTransform: 'uppercase' }}>{isDark ? 'Dark Mode Active' : 'Light Mode Active'}</Text>
                    </View>
                 </View>
                 <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: isDark ? colors.primary : '#e2e8f0', padding: 2, justifyContent: 'center' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: isDark ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }} />
                 </View>
              </TouchableOpacity>
              <Divider />
              <ActionItem icon={<Settings size={18} color={colors.textSecondary} />} label="App Settings" onPress={() => router.push('/(farmer)/settings')} />
              <Divider />
              <ActionItem icon={<Shield size={18} color={colors.textSecondary} />} label="Privacy Policy" onPress={() => router.push('/privacy-policy' as any)} />
              <Divider />
              <ActionItem icon={<HelpCircle size={18} color={colors.textSecondary} />} label="Help Center" onPress={() => router.push('/help-center')} />
              <Divider />
              <ActionItem icon={<LogOut size={18} color={colors.error} />} label="Sign Out" onPress={handleSignOut} isDestructive />
           </View>

           <Text style={{ textAlign: 'center', color: colors.textMuted, fontFamily: 'Outfit_600SemiBold', fontSize: 11, marginBottom: 40 }}>ILO-AGRI HUB • VERSION 1.0.4</Text>
        </View>
      </ScrollView>

      {/* Editing Modal */}
      {editMode !== null && (
        <Modal visible={editMode !== null} transparent animationType="slide">
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
                     {editMode === 'phone' ? 'Edit Phone Number' : 'Edit Farm Address'}
                   </Text>
                   <TouchableOpacity onPress={() => setEditMode(null)}>
                      <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
                   </TouchableOpacity>
                </View>
                
                <View style={{ gap: 0 }}>
                   {/* Phone Number Mode */}
                   {editMode === 'phone' && (
                     <View className="flex-row gap-3">
                       <ProfileInputField
                         label="Phone Number"
                         value={formData.phoneNumber}
                         onChangeText={(t: string) => setFormData({ ...formData, phoneNumber: t })}
                         placeholder="+639XXXXXXXXX"
                         keyboardType="phone-pad"
                       />
                     </View>
                   )}

                   {/* Farm Address Mode */}
                   {editMode === 'address' && (
                     <View className="flex-row gap-3">
                       <ProfileInputField
                         label="Street / Purok"
                         value={formData.street}
                         onChangeText={(t: string) => setFormData({ ...formData, street: t })}
                         placeholder="Purok / Street"
                       />

                       <SelectField
                         label="Barangay"
                         value={formData.barangay}
                         onPress={() =>
                           setSelectModal({
                             visible: true,
                             title: "Select Barangay",
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
                     style={{ backgroundColor: isDark ? colors.primary : '#00643B', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 }}
                   >
                     {mutation.isPending
                       ? <ActivityIndicator color="#fff" />
                       : <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>Save Changes</Text>
                     }
                   </TouchableOpacity>
                </View>
             </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Barangay Options Selection Modal */}
      {selectModal.visible && (
        <Modal visible={selectModal.visible} transparent animationType="slide">
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => setSelectModal({ ...selectModal, visible: false })}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 200 }}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{ backgroundColor: colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 }}
            >
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colors.textPrimary }}>
                  {selectModal.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectModal({ ...selectModal, visible: false })}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {selectModal.options.map((opt: string) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        selectModal.onSelect(opt);
                        setSelectModal({ ...selectModal, visible: false });
                      }}
                      style={{
                        width: '48%',
                        paddingVertical: 14,
                        backgroundColor: isDark ? colors.background : '#f8fafc',
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: colors.textPrimary, textAlign: 'center' }}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const StatItem = ({ label, value, icon, color }: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center">
       <MaterialCommunityIcons name={icon} size={20} color={color} />
       <Text className="text-xl font-outfit-black mt-1" style={{ color: colors.textPrimary }}>{value}</Text>
       <Text className="text-[9px] font-outfit-bold uppercase tracking-widest" style={{ color: colors.textMuted }}>{label}</Text>
    </View>
  );
};

const DetailRow = ({ icon, label, value, onPress }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} className="p-4 flex-row items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800" style={{ backgroundColor: colors.card }}>
       <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: isDark ? colors.background : '#f8fafc' }}>
          {icon}
       </View>
       <View className="flex-1">
          <Text className="text-[9px] font-outfit-bold uppercase tracking-widest" style={{ color: colors.textMuted }}>{label}</Text>
          <Text className="text-sm font-outfit-semibold mt-0.5" style={{ color: colors.textPrimary }}>{value || 'Not Set'}</Text>
       </View>
       {onPress && <ChevronRight size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
};

const ActionItem = ({ icon, label, onPress, isDestructive }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} className="p-4 flex-row items-center justify-between active:bg-slate-50 dark:active:bg-slate-800" style={{ backgroundColor: colors.card }}>
       <View className="flex-row items-center gap-4">
          <View className={`w-9 h-9 rounded-xl items-center justify-center`} style={{ backgroundColor: isDestructive ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fef2f2') : (isDark ? colors.background : '#f8fafc') }}>
             {icon}
          </View>
          <Text className={`text-sm ${isDestructive ? 'font-outfit-bold' : 'font-outfit-semibold'}`} style={{ color: isDestructive ? colors.error : colors.textPrimary }}>{label}</Text>
       </View>
       <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

const Divider = () => {
  const { colors } = useTheme();
  return <View className="h-[1px] ml-16" style={{ backgroundColor: colors.border }} />;
};

// Reusable input field matching the add-animal.tsx style
const ProfileInputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength }: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        className="border rounded-2xl px-4 py-3 font-outfit-medium text-sm"
        style={{ backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
};

const SelectField = ({ label, value, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 mb-4">
      <Text className="text-[10px] font-outfit-black uppercase mb-1.5 ml-1 tracking-widest" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        className="border rounded-2xl px-4 py-3.5 flex-row justify-between items-center"
        style={{ height: 48, backgroundColor: colors.card, borderColor: colors.border }}
      >
        <Text
          className={`font-outfit-medium text-sm`}
          style={{ color: value ? colors.textPrimary : colors.textMuted }}
        >
          {value || "Select"}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

export default FarmerProfile;
