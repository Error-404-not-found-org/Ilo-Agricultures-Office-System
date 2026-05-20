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


const FarmerProfile = () => {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { colorScheme, toggleColorScheme } = useColorScheme();

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
    }
    mutation.mutate({
      phoneNumber: formData.phoneNumber,
      address: {
        street: formData.street,
        barangay: formData.barangay,
        city: 'Oton',
        province: 'Iloilo',
        zipCode: '5020',
        region: 'Region VI'
      }
    });
  };


  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        
        {/* Curved Header Header Background */}
        <View className="bg-[#00643B] pt-14 pb-20 px-6 rounded-b-[40px] items-center relative shadow-lg shadow-[#00643b]/20">
           
           {/* Profile Picture & Info */}
           <View className="relative mt-4">
              <View className="w-24 h-24 rounded-full border-4 border-white/20 overflow-hidden bg-slate-100 items-center justify-center">
                 {clerkUser?.imageUrl ? (
                    <Image source={{ uri: clerkUser.imageUrl }} className="w-full h-full" />
                 ) : (
                    <User size={48} color="#94a3b8" />
                 )}
              </View>
              <TouchableOpacity className="absolute bottom-0 right-0 w-8 h-8 bg-white dark:bg-slate-800 rounded-full items-center justify-center shadow-md">
                 <Camera size={14} color="#00643B" />
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
           <View className="bg-white dark:bg-slate-900 rounded-[28px] p-5 flex-row justify-between border border-slate-100 dark:border-slate-800/80 shadow-xl shadow-slate-100/50 dark:shadow-none">
              <StatItem label="Total Cows" value={dbUser?.stats?.totalAnimals || '0'} icon="cow" color="#00643B" />
              <View className="w-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
              <StatItem label="Active Cases" value={dbUser?.stats?.activeCases || '0'} icon="medical-bag" color="#eab308" />
              <View className="w-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
              <StatItem label="Pregnant" value={dbUser?.stats?.activePregnancies || '0'} icon="heart-pulse" color="#0891b2" />
           </View>
        </View>

        <View className="px-6 mt-8">
           
           {/* Personal Information */}
           <Text className="font-outfit-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mb-3 ml-1">Account Details</Text>
           
           <View className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 mb-6">
              <DetailRow icon={<Mail size={18} color="#94a3b8" />} label="Email Address" value={clerkUser?.primaryEmailAddress?.emailAddress} />
              <Divider />
              <DetailRow icon={<Phone size={18} color="#94a3b8" />} label="Phone Number" value={dbUser?.phoneNumber || 'Not Set'} onPress={() => setEditMode('phone')} />
              <Divider />
              <DetailRow icon={<MapPin size={18} color="#94a3b8" />} label="Farm Address" value={dbUser?.address?.barangay ? `${dbUser.address.street ? dbUser.address.street + ', ' : ''}${dbUser.address.barangay}, ${dbUser.address.city}, ${dbUser.address.province}` : 'Not Set'} onPress={() => setEditMode('address')} />
           </View>

           {/* Quick Actions */}
           <Text className="font-outfit-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mb-3 ml-1">System & Support</Text>
           
           <View className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 mb-10">
              <TouchableOpacity onPress={handleToggleTheme} style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                       {colorScheme === 'dark' ? <Moon size={18} color="#94a3b8" /> : <Sun size={18} color="#f59e0b" />}
                    </View>
                    <View>
                       <Text style={{ fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: colorScheme === 'dark' ? '#f1f5f9' : '#334155' }}>Theme Mode</Text>
                       <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase' }}>{colorScheme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active'}</Text>
                    </View>
                 </View>
                 <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#00643B' : '#e2e8f0', padding: 2, justifyContent: 'center' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: colorScheme === 'dark' ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }} />
                 </View>
              </TouchableOpacity>
              <Divider />
              <ActionItem icon={<Settings size={18} color="#64748b" />} label="App Settings" onPress={() => router.push('/(farmer)/settings')} />
              <Divider />
              <ActionItem icon={<HelpCircle size={18} color="#64748b" />} label="Help Center" onPress={() => router.push('/(farmer)/help-center')} />
              <Divider />
              <ActionItem icon={<LogOut size={18} color="#ef4444" />} label="Sign Out" onPress={handleSignOut} isDestructive />
           </View>

           <Text style={{ textAlign: 'center', color: '#cbd5e1', fontFamily: 'Outfit_600SemiBold', fontSize: 11, marginBottom: 40 }}>ILO-AGRI HUB • VERSION 1.0.4</Text>
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
                style={{ backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Math.max(insets.bottom, 40) }}
             >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                   <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: colorScheme === 'dark' ? '#fff' : '#1e293b' }}>
                     {editMode === 'phone' ? 'Edit Phone Number' : 'Edit Farm Address'}
                   </Text>
                   <TouchableOpacity onPress={() => setEditMode(null)}>
                      <MaterialCommunityIcons name="close" size={24} color="#94a3b8" />
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
                     style={{ backgroundColor: '#00643B', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 }}
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
              style={{ backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 }}
            >
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 18, color: colorScheme === 'dark' ? '#fff' : '#1e293b' }}>
                  {selectModal.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectModal({ ...selectModal, visible: false })}>
                  <MaterialCommunityIcons name="close" size={24} color="#94a3b8" />
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
                        backgroundColor: colorScheme === 'dark' ? '#334155' : '#f8fafc',
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: colorScheme === 'dark' ? '#475569' : '#e2e8f0'
                      }}
                    >
                      <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 12, color: colorScheme === 'dark' ? '#fff' : '#475569', textAlign: 'center' }}>
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

const StatItem = ({ label, value, icon, color }: any) => (
  <View className="flex-1 items-center">
     <MaterialCommunityIcons name={icon} size={20} color={color} />
     <Text className="text-xl font-outfit-black text-slate-800 dark:text-white mt-1">{value}</Text>
     <Text className="text-[9px] font-outfit-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</Text>
  </View>
);

const DetailRow = ({ icon, label, value, onPress }: any) => (
  <TouchableOpacity onPress={onPress} disabled={!onPress} className="p-4 flex-row items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800">
     <View className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 items-center justify-center">
        {icon}
     </View>
     <View className="flex-1">
        <Text className="text-[9px] font-outfit-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</Text>
        <Text className="text-sm font-outfit-semibold text-slate-700 dark:text-slate-200 mt-0.5">{value || 'Not Set'}</Text>
     </View>
     {onPress && <ChevronRight size={16} color="#cbd5e1" />}
  </TouchableOpacity>
);

const ActionItem = ({ icon, label, onPress, isDestructive }: any) => (
  <TouchableOpacity onPress={onPress} className="p-4 flex-row items-center justify-between active:bg-slate-50 dark:active:bg-slate-800">
     <View className="flex-row items-center gap-4">
        <View className={`w-9 h-9 rounded-xl items-center justify-center ${isDestructive ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'}`}>
           {icon}
        </View>
        <Text className={`text-sm ${isDestructive ? 'font-outfit-bold text-red-600' : 'font-outfit-semibold text-slate-700 dark:text-slate-200'}`}>{label}</Text>
     </View>
     <ChevronRight size={16} color="#cbd5e1" />
  </TouchableOpacity>
);

const InputBox = ({ label, value, onChange, icon, isDark }: any) => (
  <View>
     <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>{label}</Text>
     <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#334155' : '#f8fafc', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: isDark ? '#475569' : '#e2e8f0', height: 56 }}>
        <MaterialCommunityIcons name={icon} size={20} color="#94a3b8" />
        <TextInput style={{ flex: 1, marginLeft: 12, fontFamily: 'Outfit_600SemiBold', color: isDark ? '#fff' : '#1e293b' }} value={value} onChangeText={onChange} />
     </View>
  </View>
);

const Divider = () => <View className="h-[1px] bg-slate-50 dark:bg-slate-800 ml-16" />;

// Reusable input field matching the add-animal.tsx style
const ProfileInputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength }: any) => (
  <View className="flex-1 mb-4">
    <Text className="text-[10px] font-outfit-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      maxLength={maxLength}
      className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 font-outfit-medium text-slate-800 dark:text-white text-sm"
      placeholderTextColor="#94a3b8"
    />
  </View>
);

const SelectField = ({ label, value, onPress }: any) => (
  <View className="flex-1 mb-4">
    <Text className="text-[10px] font-outfit-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">
      {label}
    </Text>
    <TouchableOpacity
      onPress={onPress}
      className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3.5 flex-row justify-between items-center"
      style={{ height: 48 }}
    >
      <Text
        className={`font-outfit-medium text-sm ${value ? "text-slate-800 dark:text-white" : "text-slate-400"}`}
      >
        {value || "Select"}
      </Text>
      <ChevronDown size={16} color="#94a3b8" />
    </TouchableOpacity>
  </View>
);

export default FarmerProfile;
