import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import SafeScreen from '@/components/safeScreen';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronRight, LogOut, Settings, HelpCircle, User, Phone, MapPin, Save, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/api';

const FarmerProfile = () => {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const { data: dbUser, isLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const res = await api.get('/user/me');
      return res.data;
    }
  });

  // ── Form State ──────────────────────────────────────────────────────────────
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
        phoneNumber: dbUser.phoneNumber || dbUser.address?.phoneNumber || '',
        street: dbUser.address?.street || '',
        barangay: dbUser.address?.barangay || '',
        city: dbUser.address?.city || '',
        province: dbUser.address?.province || '',
      });
    }
  }, [dbUser]);

  // ── Mutation ────────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return await api.put(`/user/${dbUser._id}`, updatedData);
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update profile.");
    }
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("You have Signed out.");
      router.replace('/(auth)');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Failed to sign out. Please try again.");
    }
  };

  const handleUpdate = () => {
    // 1. Phone Validation
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      return toast.error("Invalid phone number. Must be 11 digits starting with 09.");
    }

    // 2. Simple required checks
    if (!formData.barangay.trim() || !formData.street.trim()) {
      return toast.error("Street and Barangay are required.");
    }

    mutation.mutate({
      phoneNumber: formData.phoneNumber,
      address: {
        phoneNumber: formData.phoneNumber,
        street: formData.street,
        barangay: formData.barangay,
        city: formData.city || 'Pototan',
        province: formData.province || 'Iloilo',
        zipCode: '5008', // Default for Pototan
        region: 'Region VI',
      }
    });
  };

  return (
    <SafeScreen>
      <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View className="px-6 pt-6 pb-8 bg-white rounded-b-[32px] shadow-sm mb-6">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900">My Profile</Text>
                {isEditing ? (
                  <View className="flex-row gap-4">
                     <TouchableOpacity onPress={() => setIsEditing(false)}>
                        <Text className="text-gray-400 font-semibold">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleUpdate} disabled={mutation.isPending}>
                        {mutation.isPending ? <ActivityIndicator size="small" color="#2563EB" /> : <Text className="text-blue-600 font-bold">Save</Text>}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Text className="text-blue-600 font-semibold">Edit</Text>
                  </TouchableOpacity>
                )}
            </View>

            <View className="flex-row items-center gap-4">
                <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                    {clerkUser?.imageUrl ? (
                         <Image source={{ uri: clerkUser.imageUrl }} className="w-full h-full" />
                    ) : (
                        <User size={40} color="#9CA3AF" />
                    )}
                </View>
                <View className="flex-1">
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#2563EB" className="self-start mt-2" />
                    ) : (
                      <>
                        <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>{clerkUser?.fullName || dbUser?.name || 'Farmer'}</Text>
                        <Text className="text-gray-500 text-xs" numberOfLines={1}>{clerkUser?.primaryEmailAddress?.emailAddress || dbUser?.email || 'No email'}</Text>
                      </>
                    )}
                    <View className="bg-blue-100 px-2 py-0.5 rounded-md self-start mt-1">
                        <Text className="text-blue-700 text-[10px] font-black uppercase">Farmer Account</Text>
                    </View>
                </View>
            </View>
        </View>

        {/* Main Content Area */}
        <View key={isEditing ? 'edit-mode' : 'view-mode'} className="px-6 mb-8">
            {isEditing ? (
                <>
                    <Text className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Update Personal Info</Text>
                    <View className="bg-white rounded-3xl p-5 shadow-sm space-y-4 border border-blue-50">
                        {/* Phone */}
                        <View>
                            <Text className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Phone Number</Text>
                            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                                <Phone size={16} color="#94a3b8" />
                                <TextInput 
                                    className="flex-1 ml-3 text-gray-800 font-semibold"
                                    placeholder="09XXXXXXXXX"
                                    value={formData.phoneNumber}
                                    onChangeText={(val) => setFormData({...formData, phoneNumber: val})}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        {/* Street */}
                        <View>
                            <Text className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Street / House No.</Text>
                            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                                <MapPin size={16} color="#94a3b8" />
                                <TextInput 
                                    className="flex-1 ml-3 text-gray-800 font-semibold"
                                    placeholder="Poblacion St."
                                    value={formData.street}
                                    onChangeText={(val) => setFormData({...formData, street: val})}
                                />
                            </View>
                        </View>

                        {/* Barangay */}
                        <View>
                            <Text className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Barangay</Text>
                            <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                                <MapPin size={16} color="#94a3b8" />
                                <TextInput 
                                    className="flex-1 ml-3 text-gray-800 font-semibold"
                                    placeholder="Barangay Name"
                                    value={formData.barangay}
                                    onChangeText={(val) => setFormData({...formData, barangay: val})}
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Text className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 ml-1">City</Text>
                                <TextInput 
                                    className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-800 font-semibold border border-gray-100"
                                    value={formData.city}
                                    onChangeText={(val) => setFormData({...formData, city: val})}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-[11px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Province</Text>
                                <TextInput 
                                    className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-800 font-semibold border border-gray-100"
                                    value={formData.province}
                                    onChangeText={(val) => setFormData({...formData, province: val})}
                                />
                            </View>
                        </View>
                    </View>
                </>
            ) : (
                <>
                    <Text className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Contact & Location</Text>
                    <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                        <MenuItem 
                            icon={<Phone size={20} color="#4B5563" />} 
                            label={dbUser?.phoneNumber || 'Add Phone Number'} 
                            onPress={() => setIsEditing(true)}
                        />
                        <View className="h-[1px] bg-gray-100 ml-14" />
                        <MenuItem 
                            icon={<MapPin size={20} color="#4B5563" />} 
                            label={dbUser?.address?.barangay ? `${dbUser.address.street}, ${dbUser.address.barangay}` : 'Add Complete Address'} 
                            onPress={() => setIsEditing(true)}
                        />
                    </View>
                </>
            )}
        </View>

        {/* Existing Menu Options */}
        <View className="px-6 mb-8">
            <Text className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Account Settings</Text>
            
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <MenuItem 
                    icon={<MaterialCommunityIcons name="cow" size={20} color="#4B5563" />} 
                    label="My Animals" 
                    onPress={() => router.push('/(farmer)/animals' as any)} 
                />
                 <View className="h-[1px] bg-gray-100 ml-14" />
                <MenuItem 
                    icon={<Settings size={20} color="#4B5563" />} 
                    label="Preferences" 
                    onPress={() => console.log('Preferences')} 
                />
            </View>
        </View>

        <View className="px-6 mb-8">
           <Text className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Support</Text>
            
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <MenuItem 
                    icon={<HelpCircle size={20} color="#4B5563" />} 
                    label="Help & FAQ" 
                    onPress={() => console.log('Help')} 
                />
                <View className="h-[1px] bg-gray-100 ml-14" />
                <MenuItem 
                    icon={<MaterialCommunityIcons name="information-outline" size={20} color="#4B5563" />} 
                    label="About App" 
                    onPress={() => console.log('About')} 
                />
            </View>
        </View>

        {/* Sign Out Button */}
        <View className="px-6 mb-10">
            <TouchableOpacity 
                onPress={handleSignOut}
                className="flex-row items-center justify-center bg-red-50 py-4 rounded-xl active:bg-red-100"
            >
                <LogOut size={20} color="#EF4444" />
                <Text className="text-red-600 font-bold ml-2">Sign Out</Text>
            </TouchableOpacity>
            <Text className="text-center text-gray-400 text-xs mt-4">Version 1.0.0</Text>
        </View>

      </ScrollView>
    </SafeScreen>
  );
};

const MenuItem = ({ icon, label, onPress }: { icon: React.ReactNode, label: string, onPress: () => void }) => (
    <TouchableOpacity 
        onPress={onPress}
        className="flex-row items-center justify-between p-4 active:bg-gray-50"
    >
        <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                {icon}
            </View>
            <Text className="text-gray-700 font-medium text-[15px]">{label}</Text>
        </View>
        <ChevronRight size={18} color="#9CA3AF" />
    </TouchableOpacity>
);

export default FarmerProfile;
