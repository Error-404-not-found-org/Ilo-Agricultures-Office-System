import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserPlus, X, ChevronDown } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { OTON_BARANGAYS } from '@/lib/constants';
import { useTheme } from '@/lib/theme';

export default function RegisterClientScreen() {
  const router = useRouter();
  const api = useApi();
  const { isDark, colors } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    barangay: '',
  });

  const [showBrgyModal, setShowBrgyModal] = useState(false);
  const [searchBrgy, setSearchBrgy] = useState('');
  const [errors, setErrors] = useState<any>({});

  const validate = () => {
    const newErrors: any = {};
    if (!formData.firstName.trim() || formData.firstName.length > 50) newErrors.firstName = "First name is required (max 50 chars)";
    if (!formData.lastName.trim() || formData.lastName.length > 50) newErrors.lastName = "Last name is required (max 50 chars)";
    if (!formData.phoneNumber.trim() || !/^09\d{9}$/.test(formData.phoneNumber)) newErrors.phoneNumber = "Phone must start with 09 and be exactly 11 digits";
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Invalid email format";
    if (!formData.barangay) newErrors.barangay = "Please select a barangay";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted errors");
      return;
    }
    
    setLoading(true);
    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim() || undefined,
        address: {
          barangay: formData.barangay,
          city: "Oton",
          province: "Iloilo",
        }
      };

      await api.post('/technician/register-farmer', payload);
      toast.success('Farmer registered successfully!');
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to register farmer.');
    } finally {
      setLoading(false);
    }
  };

  // Filter barangays based on text input
  const filteredBarangays = OTON_BARANGAYS.filter(b => 
    b.toLowerCase().includes(searchBrgy.toLowerCase())
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC] dark:bg-slate-950">
      <View className="flex-row items-center px-6 py-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
          <ArrowLeft size={20} color={isDark ? '#f8fafc' : '#1e293b'} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: colors.textPrimary }}>
          Walk-in Registration
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          <View className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 mb-6 border border-emerald-100 dark:border-emerald-800/50 flex-row items-center">
             <View className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full items-center justify-center mr-3">
                <UserPlus size={20} color={isDark ? '#34d399' : '#059669'} />
              </View>
             <Text style={{ fontFamily: 'Outfit_600SemiBold' }} className="text-emerald-800 dark:text-emerald-300 text-xs flex-1">
               Register a new farmer for immediate service. An offline profile will be created.
             </Text>
          </View>

          {/* PERSONAL DETAILS */}
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Personal Details</Text>
          <View className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-6 gap-4">
             <View>
                <View className="flex-row justify-between mb-1 ml-1">
                   <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">First Name *</Text>
                   {errors.firstName && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.firstName}</Text>}
                </View>
                <TextInput
                  className={`bg-slate-50 dark:bg-slate-800 border ${errors.firstName ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 text-slate-800 dark:text-white font-outfit-medium`}
                  placeholder="Juan"
                  placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                  value={formData.firstName}
                  onChangeText={(t) => setFormData({...formData, firstName: t})}
                  maxLength={50}
                />
             </View>

             <View>
                <View className="flex-row justify-between mb-1 ml-1">
                   <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">Last Name *</Text>
                   {errors.lastName && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.lastName}</Text>}
                </View>
                <TextInput
                  className={`bg-slate-50 dark:bg-slate-800 border ${errors.lastName ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 text-slate-800 dark:text-white font-outfit-medium`}
                  placeholder="Dela Cruz"
                  placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                  value={formData.lastName}
                  onChangeText={(t) => setFormData({...formData, lastName: t})}
                  maxLength={50}
                />
             </View>
          </View>

          {/* CONTACT & ADDRESS */}
          <Text className="font-outfit-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest mb-3 ml-1">Contact & Address</Text>
          <View className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-6 gap-4">
             <View>
                <View className="flex-row justify-between mb-1 ml-1">
                   <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">Phone Number *</Text>
                   {errors.phoneNumber && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.phoneNumber}</Text>}
                </View>
                <TextInput
                  className={`bg-slate-50 dark:bg-slate-800 border ${errors.phoneNumber ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 text-slate-800 dark:text-white font-outfit-medium`}
                  placeholder="09123456789"
                  placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={formData.phoneNumber}
                  onChangeText={(t) => setFormData({...formData, phoneNumber: t})}
                />
             </View>

             <View>
                <View className="flex-row justify-between mb-1 ml-1">
                   <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">Email (Optional)</Text>
                   {errors.email && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.email}</Text>}
                </View>
                <TextInput
                  className={`bg-slate-50 dark:bg-slate-800 border ${errors.email ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 text-slate-800 dark:text-white font-outfit-medium`}
                  placeholder="farmer@example.com"
                  placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(t) => setFormData({...formData, email: t})}
                />
             </View>

             {/* SEARCHABLE BARANGAY & PRE-POPULATED MUNICIPALITY OTON */}
             <View className="flex-row gap-3">
                <View className="flex-1">
                   <View className="flex-row justify-between mb-1 ml-1">
                     <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">Barangay *</Text>
                     {errors.barangay && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.barangay}</Text>}
                   </View>
                   <TouchableOpacity
                     onPress={() => setShowBrgyModal(true)}
                     className={`bg-slate-50 dark:bg-slate-800 border ${errors.barangay ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 flex-row justify-between items-center`}
                   >
                     <Text className={`font-outfit-medium ${formData.barangay ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                       {formData.barangay || 'Select...'}
                     </Text>
                     <ChevronDown size={14} color={isDark ? '#6b7280' : '#94a3b8'} />
                   </TouchableOpacity>
                </View>

                <View className="flex-1">
                   <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Municipality</Text>
                   <TextInput
                     className="bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-slate-400 dark:text-slate-500 font-outfit-medium"
                     value="OTON"
                     editable={false}
                   />
                </View>
             </View>
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity 
              className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-10 ${loading ? 'bg-slate-400' : 'bg-[#00643B]'}`}
              onPress={handleSave}
              disabled={loading}
          >
              {loading ? <ActivityIndicator color="white" /> : (
                 <>
                    <UserPlus size={20} color="white" style={{ marginRight: 10 }} />
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-base">Register Farmer</Text>
                 </>
              )}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* BARANGAY SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showBrgyModal} onRequestClose={() => setShowBrgyModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white dark:bg-slate-900 rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800 dark:text-white">Select Barangay</Text>
                   <TouchableOpacity onPress={() => { setShowBrgyModal(false); setSearchBrgy(''); }} className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-full">
                       <X size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                   </TouchableOpacity>
               </View>

               <TextInput
                 className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-slate-800 dark:text-white font-outfit-medium mb-4"
                 placeholder="Search barangay..."
                 placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
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
                         className="py-4 border-b border-slate-50 dark:border-slate-800"
                      >
                         <Text className="font-outfit-bold text-slate-700 dark:text-slate-200 text-base">{item}</Text>
                      </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}
