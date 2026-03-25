import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import SafeScreen from '@/components/safeScreen';

export default function EditClientProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
      name: '',
      email: '',
      phoneNumber: '',
      street: '',
      barangay: '',
      city: '',
      province: ''
  });

  useEffect(() => {
    if (!id) return;
    const fetchClient = async () => {
      try {
        const res = await api.get(`/user/${id}`);
        const user = res.data;
        const addr = user.address || {};
        
        setFormData({
            name: user.name || '',
            email: user.email || '',
            phoneNumber: addr.phoneNumber || user.phoneNumber || '',
            street: addr.street || '',
            barangay: addr.barangay || '',
            city: addr.city || '',
            province: addr.province || ''
        });
      } catch (error) {
        console.error("Failed to load user for editing:", error);
        toast.error("Could not load client details");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id]);

  const handleSave = async () => {
      if (!formData.name.trim()) return toast.error("Farmer Name cannot be empty.");
      
      try {
          setSaving(true);
          const payload = {
              name: formData.name,
              email: formData.email,
              phoneNumber: formData.phoneNumber,
              address: {
                  phoneNumber: formData.phoneNumber, // Syncing backwards to support legacy nested schema
                  street: formData.street,
                  barangay: formData.barangay,
                  city: formData.city,
                  province: formData.province
              }
          };

          await api.put(`/user/${id}`, payload);
          toast.success("Profile Updated!", { duration: 3000, position: 'top-center' });
          router.back(); // Kick user directly back to the Profile Display!
      } catch (error: any) {
          console.error("Failed to save profile modifications:", error);
          toast.error(error.response?.data?.message || "Error saving profile. Try again.");
      } finally {
          setSaving(false);
      }
  };

  if (loading) {
      return (
          <View className="flex-1 items-center justify-center bg-[#F9FAFB]">
              <ActivityIndicator size="large" color="#00643B" />
          </View>
      );
  }

  return (
    <SafeScreen>
      <View className="flex-1 bg-white px-5"> 
        
        {/* COMPACT HEADER */}
        <View className="flex-row items-center justify-between mb-2 mt-2">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
                <ArrowLeft size={22} color="black" />
            </TouchableOpacity>
            <View className="items-center">
                <Text className="text-base font-bold text-gray-900">Edit Profile</Text>
            </View>
            <View className="w-8" /> 
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            
            <View className="mt-4">
                <Text className="text-xl font-bold mb-1 text-gray-900">Personal Information</Text>
                <Text className="text-sm text-gray-500 mb-5">Ensure the full name is accurate.</Text>
                
                <InputField 
                    label="Full Name" 
                    value={formData.name} 
                    onChangeText={(t: string) => setFormData({...formData, name: t})} 
                    placeholder="e.g. Juan Dela Cruz" 
                />

                <InputField 
                    label="Phone Number" 
                    value={formData.phoneNumber} 
                    onChangeText={(t: string) => setFormData({...formData, phoneNumber: t})} 
                    placeholder="e.g. 0912 345 6789" 
                    keyboardType="phone-pad"
                />

                <InputField 
                    label="Email" 
                    value={formData.email} 
                    onChangeText={(t: string) => setFormData({...formData, email: t})} 
                    placeholder="e.g. [EMAIL_ADDRESS]" 
                    keyboardType="email-address"
                />
            </View>

            <View className="mt-6">
                <Text className="text-xl font-bold mb-1 text-gray-900">Location Settings</Text>
                <Text className="text-sm text-gray-500 mb-5">Update specific address markers.</Text>

                <InputField 
                    label="Street / House No." 
                    value={formData.street} 
                    onChangeText={(t: string) => setFormData({...formData, street: t})} 
                    placeholder="Optional" 
                />

                <InputField 
                    label="Barangay" 
                    value={formData.barangay} 
                    onChangeText={(t: string) => setFormData({...formData, barangay: t})} 
                    placeholder="Essential Area Marker" 
                />

                <View className="flex-row gap-3">
                    <View className="flex-1">
                        <InputField 
                            label="City" 
                            value={formData.city} 
                            onChangeText={(t: string) => setFormData({...formData, city: t})} 
                            placeholder="e.g. Passi" 
                        />
                    </View>
                    <View className="flex-1">
                        <InputField 
                            label="Province" 
                            value={formData.province} 
                            onChangeText={(t: string) => setFormData({...formData, province: t})} 
                            placeholder="e.g. Iloilo" 
                        />
                    </View>
                </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* BOTTOM SAVE BUTTON */}
        <View className="pt-4 pb-28">
             <TouchableOpacity onPress={handleSave} disabled={saving} className={`rounded-full py-3.5 items-center flex-row justify-center gap-2 shadow-lg ${saving ? 'bg-emerald-400' : 'bg-[#00643B] shadow-emerald-200'}`}>
                {saving ? (
                   <ActivityIndicator color="white" size="small" />
                ) : (
                   <>
                     <Save size={18} color="white" />
                     <Text className="text-white font-bold text-base">Save Updates</Text>
                   </>
                )}
             </TouchableOpacity>
        </View>

      </View>
    </SafeScreen>
  );
}

// Reuse Standard Minimalist Input component
const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) => (
    <View className="mb-3">
        <Text className="text-gray-700 font-medium mb-1 ml-1 text-xs uppercase tracking-wide">{label}</Text>
        <TextInput 
            className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-emerald-600" 
            value={value} 
            onChangeText={onChangeText} 
            placeholder={placeholder} 
            placeholderTextColor="#9CA3AF"
            keyboardType={keyboardType}
        />
    </View>
);
