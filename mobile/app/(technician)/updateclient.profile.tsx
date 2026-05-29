import { View, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, X, ChevronDown } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import SafeScreen from '@/components/safeScreen';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { OTON_BARANGAYS } from '@/lib/constants';

export default function UpdateClientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const api = useApi();
  const { colors, isDark, themeStyle } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
      name: '',
      email: '',
      phoneNumber: '',
      barangay: '',
      city: 'Oton',
      province: 'Iloilo'
  });

  const [showBrgyModal, setShowBrgyModal] = useState(false);
  const [searchBrgy, setSearchBrgy] = useState('');

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
            barangay: addr.barangay || '',
            city: addr.city || 'Oton',
            province: addr.province || 'Iloilo'
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
      if (!formData.phoneNumber.trim() || !/^\d{11}$/.test(formData.phoneNumber)) {
        return toast.error("Phone number must be exactly 11 digits.");
      }
      if (!formData.barangay) {
        return toast.error("Barangay is required.");
      }
      
      try {
          setSaving(true);
          const payload = {
              name: formData.name.trim(),
              email: formData.email.trim(),
              phoneNumber: formData.phoneNumber.trim(),
              address: {
                  phoneNumber: formData.phoneNumber.trim(), // Syncing backwards to support legacy nested schema
                  barangay: formData.barangay,
                  city: formData.city.trim(),
                  province: formData.province.trim()
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

  const filteredBarangays = OTON_BARANGAYS.filter(b => 
    b.toLowerCase().includes(searchBrgy.toLowerCase())
  );

  if (loading) {
      return (
          <View className="flex-1 items-center justify-center bg-[#F9FAFB] dark:bg-slate-950">
              <ActivityIndicator size="large" color={isDark ? "#10b981" : "#00643B"} />
          </View>
      );
  }

  return (
    <SafeScreen>
      <View style={[{ flex: 1, backgroundColor: colors.background }]} className="px-5"> 
        
        {/* COMPACT HEADER */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
              className="p-2 rounded-full border active:opacity-75"
            >
                <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text variant="bold" size={16} color="primary">Edit Profile</Text>
            <View className="w-10" /> 
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            
            <Card style={{ padding: 20 }} className="mt-2 mb-6">
                <Text variant="black" size={18} color="primary" className="mb-1">Personal Information</Text>
                <Text variant="medium" size={13} color="muted" className="mb-5">Ensure the profile data is accurate.</Text>
                
                <InputField 
                    label="Full Name *" 
                    value={formData.name} 
                    onChangeText={(t: string) => setFormData({...formData, name: t})} 
                    placeholder="Juan Dela Cruz" 
                />

                <InputField 
                    label="Phone Number *" 
                    value={formData.phoneNumber} 
                    onChangeText={(t: string) => setFormData({...formData, phoneNumber: t})} 
                    placeholder="09123456789" 
                    keyboardType="phone-pad"
                    maxLength={11}
                />

                <InputField 
                    label="Email Address" 
                    value={formData.email} 
                    onChangeText={(t: string) => setFormData({...formData, email: t})} 
                    placeholder="farmer@example.com" 
                    keyboardType="email-address"
                />
            </Card>

            <Card style={{ padding: 20 }} className="mb-4">
                <Text variant="black" size={18} color="primary" className="mb-1">Location Details</Text>
                <Text variant="medium" size={13} color="muted" className="mb-5">Update geographical sector address markers.</Text>

                {/* Barangay Selection Button */}
                <View className="mb-3">
                   <Text variant="bold" size={10} color="secondary" className="uppercase tracking-wider mb-1.5 ml-1">Barangay *</Text>
                   <TouchableOpacity
                     onPress={() => setShowBrgyModal(true)}
                     style={{
                       backgroundColor: colors.card,
                       borderColor: colors.border
                     }}
                     className="border rounded-xl p-3.5 flex-row justify-between items-center"
                   >
                     <Text variant="semibold" size={14} style={{ color: formData.barangay ? colors.textPrimary : colors.textMuted }}>
                       {formData.barangay || 'Select...'}
                     </Text>
                     <ChevronDown size={14} color={colors.textMuted} />
                   </TouchableOpacity>
                </View>

                <View className="flex-row gap-3">
                    <View className="flex-1">
                        <InputField 
                            label="Municipality" 
                            value={formData.city} 
                            onChangeText={(t: string) => setFormData({...formData, city: t})} 
                            placeholder="e.g. Oton" 
                            editable={false}
                        />
                    </View>
                    <View className="flex-1">
                        <InputField 
                            label="Province" 
                            value={formData.province} 
                            onChangeText={(t: string) => setFormData({...formData, province: t})} 
                            placeholder="e.g. Iloilo" 
                            editable={false}
                        />
                    </View>
                </View>
            </Card>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* BOTTOM SAVE BUTTON */}
        <View className="pt-4 pb-28">
             <TouchableOpacity 
                 onPress={handleSave} 
                 disabled={saving} 
                 style={{ 
                   backgroundColor: colors.primary,
                   shadowColor: colors.primary,
                   shadowOpacity: 0.1,
                   shadowRadius: 8
                 }}
                 className="rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg"
             >
                {saving ? (
                   <ActivityIndicator color="white" size="small" />
                ) : (
                   <>
                     <Save size={18} color="white" />
                     <Text variant="bold" size={15} style={{ color: '#fff' }}>Save Updates</Text>
                   </>
                )}
             </TouchableOpacity>
        </View>

      </View>

      {/* BARANGAY SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showBrgyModal} onRequestClose={() => setShowBrgyModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View style={{ backgroundColor: colors.background }} className="rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text variant="black" size={20} color="primary">Select Barangay</Text>
                   <TouchableOpacity 
                       onPress={() => { setShowBrgyModal(false); setSearchBrgy(''); }} 
                       style={{ backgroundColor: colors.card }}
                       className="p-2.5 rounded-full"
                   >
                       <X size={22} color={colors.textPrimary} />
                   </TouchableOpacity>
               </View>

               <TextInput
                 style={{
                   backgroundColor: colors.card,
                   borderColor: colors.border,
                   color: colors.textPrimary,
                   fontFamily: 'Outfit_600SemiBold'
                 }}
                 className="border rounded-xl p-3.5 text-sm mb-4"
                 placeholder="Search barangay..."
                 placeholderTextColor={colors.textMuted}
                 value={searchBrgy}
                 onChangeText={setSearchBrgy}
               />

               <FlatList 
                  data={filteredBarangays}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                         onPress={() => {
                            setFormData({...formData, barangay: item});
                            setShowBrgyModal(false);
                            setSearchBrgy('');
                         }}
                         style={{ borderBottomColor: colors.border }}
                         className="py-4 border-b"
                      >
                         <Text variant="bold" size={16} color="primary">{item}</Text>
                      </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>
    </SafeScreen>
  );
}

// Input component using Theme variables
const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', maxLength, editable = true }: any) => {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
        <Text variant="bold" size={10} color="secondary" className="uppercase tracking-wider mb-1.5 ml-1">{label}</Text>
        <TextInput 
            style={{
              backgroundColor: editable ? colors.card : colors.border,
              borderColor: colors.border,
              color: editable ? colors.textPrimary : colors.textMuted,
              fontFamily: 'Outfit_600SemiBold'
            }}
            className="border rounded-xl px-4 py-3.5 text-sm" 
            value={value} 
            onChangeText={onChangeText} 
            placeholder={placeholder} 
            placeholderTextColor={colors.textMuted}
            keyboardType={keyboardType}
            maxLength={maxLength}
            editable={editable}
        />
    </View>
  );
};
