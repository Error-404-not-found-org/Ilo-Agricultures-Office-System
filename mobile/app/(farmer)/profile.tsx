import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronRight, LogOut, Settings, HelpCircle, User, Phone, MapPin, Sun, Moon, ShieldCheck, Mail, Camera } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useColorScheme } from 'nativewind';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  const { data: dbUser, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  const [isEditing, setIsEditing] = useState(false);
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
        city: dbUser.address?.city || 'Pototan',
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
      setIsEditing(false);
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
    if (!/^09\d{9}$/.test(formData.phoneNumber)) return toast.error("Invalid phone.");
    mutation.mutate({
      phoneNumber: formData.phoneNumber,
      address: { ...formData, zipCode: '5008', region: 'Region VI' }
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Profile Header */}
        <View style={{ backgroundColor: '#00643B', paddingBottom: 60, borderBottomLeftRadius: 48, borderBottomRightRadius: 48 }}>
           <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>Account</Text>
              <TouchableOpacity onPress={handleToggleTheme} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                 {colorScheme === 'dark' ? <Sun size={20} color="#fff" /> : <Moon size={20} color="#fff" />}
              </TouchableOpacity>
           </View>

           <View style={{ alignItems: 'center', marginTop: 30 }}>
              <View style={{ position: 'relative' }}>
                 <View style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', backgroundColor: '#fff' }}>
                    <Image source={{ uri: clerkUser?.imageUrl }} style={{ width: '100%', height: '100%' }} />
                 </View>
                 <TouchableOpacity style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
                    <Camera size={16} color="#00643B" />
                 </TouchableOpacity>
              </View>

              <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 22, marginTop: 16 }}>{clerkUser?.fullName || 'Farmer'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, marginTop: 8 }}>
                 <ShieldCheck size={12} color="#4ade80" />
                 <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Verified Farmer</Text>
              </View>
           </View>
        </View>

        {/* Content Section */}
        <View style={{ paddingHorizontal: 24, marginTop: -30 }}>
           
           {/* Summary Stats Card */}
           <View className="bg-white dark:bg-slate-900 rounded-3xl p-5 flex-row shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
              <StatItem label="Registered" value={dbUser?.stats?.totalAnimals || '0'} icon="cow" color="#059669" />
              <View style={{ width: 1, height: '60%', backgroundColor: '#f1f5f9', alignSelf: 'center' }} />
              <StatItem label="Calves" value={dbUser?.stats?.totalCalves || '0'} icon="baby-carriage" color="#00643B" />
              <View style={{ width: 1, height: '60%', backgroundColor: '#f1f5f9', alignSelf: 'center' }} />
              <StatItem label="Pregnant" value={dbUser?.stats?.activePregnancies || '0'} icon="heart-pulse" color="#0891b2" />
           </View>

           {/* Personal Information */}
           <Text className="font-outfit-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mb-3 ml-1">Account Details</Text>
           
           <View className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 mb-6">
              <DetailRow icon={<Mail size={18} color="#94a3b8" />} label="Email Address" value={clerkUser?.primaryEmailAddress?.emailAddress} />
              <Divider />
              <DetailRow icon={<Phone size={18} color="#94a3b8" />} label="Phone Number" value={dbUser?.phoneNumber || 'Not Set'} onPress={() => setIsEditing(true)} />
              <Divider />
              <DetailRow icon={<MapPin size={18} color="#94a3b8" />} label="Farm Location" value={dbUser?.address?.barangay ? `${dbUser.address.barangay}, Pototan` : 'Not Set'} onPress={() => setIsEditing(true)} />
           </View>

           {/* Quick Actions */}
           <Text className="font-outfit-black text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest mb-3 ml-1">System & Support</Text>
           
           <View className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 mb-10">
              <TouchableOpacity onPress={handleToggleTheme} style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#f8fafc' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                       {colorScheme === 'dark' ? <Moon size={18} color="#64748b" /> : <Sun size={18} color="#f59e0b" />}
                    </View>
                    <View>
                       <Text style={{ fontSize: 14, fontFamily: 'Outfit_600SemiBold', color: '#334155' }}>Theme Mode</Text>
                       <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase' }}>{colorScheme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active'}</Text>
                    </View>
                 </View>
                 <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#00643B' : '#e2e8f0', padding: 2, justifyContent: 'center' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: colorScheme === 'dark' ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }} />
                 </View>
              </TouchableOpacity>
              <Divider />
              <ActionItem icon={<Settings size={18} color="#64748b" />} label="App Settings" />
              <Divider />
              <ActionItem icon={<HelpCircle size={18} color="#64748b" />} label="Help Center" />
              <Divider />
              <ActionItem icon={<LogOut size={18} color="#ef4444" />} label="Sign Out" onPress={handleSignOut} isDestructive />
           </View>

           <Text style={{ textAlign: 'center', color: '#cbd5e1', fontFamily: 'Outfit_600SemiBold', fontSize: 11, marginBottom: 40 }}>ILO-AGRI HUB • VERSION 1.0.4</Text>
        </View>
      </ScrollView>

      {/* Editing Modal (Optional implementation or keeping it simple inline) */}
      {isEditing && (
         <TouchableOpacity 
           activeOpacity={1}
           onPress={() => setIsEditing(false)}
           style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 }}
         >
            <TouchableOpacity 
               activeOpacity={1}
               onPress={(e) => e.stopPropagation()}
               style={{ backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Math.max(insets.bottom, 40) + 70 }}
            >
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: '#1e293b' }}>Edit Profile</Text>
                  <TouchableOpacity onPress={() => setIsEditing(false)}>
                     <MaterialCommunityIcons name="close" size={24} color="#94a3b8" />
                  </TouchableOpacity>
               </View>
               
               <View style={{ gap: 16 }}>
                  <InputBox label="Mobile Number" value={formData.phoneNumber} onChange={(t: string) => setFormData({...formData, phoneNumber: t})} icon="phone" />
                  <InputBox label="Barangay" value={formData.barangay} onChange={(t: string) => setFormData({...formData, barangay: t})} icon="map-marker" />
                  
                  <TouchableOpacity onPress={handleUpdate} disabled={mutation.isPending} style={{ backgroundColor: '#00643B', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 8 }}>
                     {mutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 16 }}>Save Changes</Text>}
                  </TouchableOpacity>
               </View>
            </TouchableOpacity>
         </TouchableOpacity>
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

const InputBox = ({ label, value, onChange, icon }: any) => (
  <View>
     <Text style={{ fontSize: 11, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 }}>{label}</Text>
     <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#e2e8f0', height: 56 }}>
        <MaterialCommunityIcons name={icon} size={20} color="#94a3b8" />
        <TextInput style={{ flex: 1, marginLeft: 12, fontFamily: 'Outfit_600SemiBold', color: '#1e293b' }} value={value} onChangeText={onChange} />
     </View>
  </View>
);

const Divider = () => <View className="h-[1px] bg-slate-50 dark:bg-slate-800 ml-16" />;

export default FarmerProfile;
