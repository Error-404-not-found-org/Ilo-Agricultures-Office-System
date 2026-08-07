import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Modal, FlatList, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, X, ChevronDown, Camera } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useTheme } from '@/lib/theme';
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { PhotoOptionModal } from "@/components/PhotoOptionModal";
import { AppPageHeader } from '@/components/AppPageHeader';
import { ScreenLayout } from '@/components/ScreenLayout';
import { Button } from '@/components/ui/Button';
import {
  TechnicianFormInfo,
  TechnicianFormSection,
} from '@/components/technician/TechnicianFormUI';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import {
  formatBarangayWithDistrict,
  getIloiloBarangayOptions,
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
} from '@/constants/address';

const REGISTER_FARMER_TOAST_ID = 'register-farmer-submit';
const SUBMIT_ERROR_COOLDOWN_MS = 2500;

export default function RegisterClientScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    barangay: '',
    city: '',
    district: '',
  });

  const [pickerState, setPickerState] = useState<null | 'city' | 'district' | 'barangay'>(null);
  const [searchPicker, setSearchPicker] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [isSubmitCoolingDown, setIsSubmitCoolingDown] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const handleSelectPhoto = async (source: "camera" | "library") => {
    const result = await pickImageFromSource(source, { aspect: [1, 1] });
    if (result) {
      setImageUri(result.uri);
      setImageBase64(result.base64);
    }
  };

  const barangayOptions = useMemo(
    () => getIloiloBarangayOptions(formData.city, formData.district),
    [formData.city, formData.district]
  );

  const pickerTitle = pickerState === 'city'
    ? 'Select Municipality / City'
    : pickerState === 'district'
      ? 'Select Iloilo City District'
      : 'Select Barangay';

  const pickerData = pickerState === 'city'
    ? ILOILO_MUNICIPALITY_OPTIONS
    : pickerState === 'district'
      ? ILOILO_CITY_DISTRICT_OPTIONS
      : barangayOptions;

  const filteredPickerData = pickerData.filter((item) =>
    item.toLowerCase().includes(searchPicker.toLowerCase())
  );

  const isSubmittingRef = React.useRef(false);
  const cooldownTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const releaseSubmitLock = (delay = 0) => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }

    if (delay <= 0) {
      isSubmittingRef.current = false;
      setIsSubmitCoolingDown(false);
      return;
    }

    setIsSubmitCoolingDown(true);
    cooldownTimerRef.current = setTimeout(() => {
      isSubmittingRef.current = false;
      setIsSubmitCoolingDown(false);
      cooldownTimerRef.current = null;
    }, delay);
  };

  const mutation = useOfflineMutation({
    url: '/technician/register-farmer',
    method: 'POST',
    description: `Register Farmer: ${formData.firstName} ${formData.lastName}`
  }, {
    onSuccess: (result) => {
      if (result.status === "synced") {
        const hasEmail = Boolean(formData.email.trim());
        toast.success('Farmer registered successfully!', {
          id: REGISTER_FARMER_TOAST_ID,
          description: hasEmail
            ? "An app invitation was sent to the farmer email."
            : "No email added. The farmer can later create an app account and verify this phone number to access their records.",
          duration: 5000,
        });
      }
      if (result.status === "queued" && result.data?._id) {
        const temporaryFarmerId = String(result.data._id);
        const farmerName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
        Alert.alert(
          "Farmer saved on this device",
          "Would you like to register an animal for this farmer now? Both changes will sync in order.",
          [
            { text: "Not now", style: "cancel", onPress: () => router.back() },
            {
              text: "Register Animal",
              onPress: () => router.replace({
                pathname: "/(technician)/register-animal" as any,
                params: {
                  farmerId: temporaryFarmerId,
                  farmerName,
                  phoneNumber: formData.phoneNumber.trim(),
                  barangay: formatBarangayWithDistrict(formData.barangay, formData.city, formData.district),
                  municipality: formData.city,
                  source: "offline-farmer",
                },
              }),
            },
          ],
        );
        return;
      }
      router.back();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to register farmer.', {
        id: REGISTER_FARMER_TOAST_ID,
        duration: 3500,
      });
      releaseSubmitLock(SUBMIT_ERROR_COOLDOWN_MS);
    }
  });

  const validate = () => {
    const newErrors: any = {};
    if (!formData.firstName.trim() || formData.firstName.length > 50) newErrors.firstName = "First name is required (max 50 chars)";
    if (!formData.lastName.trim() || formData.lastName.length > 50) newErrors.lastName = "Last name is required (max 50 chars)";
    if (!formData.phoneNumber.trim() || !/^09\d{9}$/.test(formData.phoneNumber)) newErrors.phoneNumber = "Phone must start with 09 and be exactly 11 digits";
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Invalid email format";
    if (!formData.city) newErrors.city = "Please select a municipality or city";
    if (formData.city === ILOILO_CITY_NAME && !formData.district) newErrors.district = "Please select a district";
    if (!formData.barangay) newErrors.barangay = "Please select a barangay";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (isSubmittingRef.current || mutation.isPending || isSubmitCoolingDown) return;
    isSubmittingRef.current = true;
    setIsSubmitCoolingDown(true);
    toast.dismiss(REGISTER_FARMER_TOAST_ID);

    if (!validate()) {
      toast.error("Please fix the highlighted errors", {
        id: REGISTER_FARMER_TOAST_ID,
      });
      releaseSubmitLock(800);
      return;
    }
    
    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      email: formData.email.trim() || undefined,
      imageUrl: imageBase64 || undefined,
      address: {
        barangay: formData.barangay,
        city: formData.city,
        district: formData.city === ILOILO_CITY_NAME ? formData.district : "",
        province: "Iloilo",
      }
    };

    mutation.mutate(payload);
  };

  const isSubmitDisabled =
    mutation.isPending || isSubmitCoolingDown || isSubmittingRef.current;

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader
        title="Register Farmer"
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          
          <TechnicianFormInfo
            icon={<UserPlus size={18} color={colors.primary} />}
          >
            Register a farmer for immediate service. If no email is added, they can later claim this profile by verifying the same phone number in the app.
          </TechnicianFormInfo>

          {/* Profile Photo Picker */}
          <View className="items-center py-4">
            <TouchableOpacity 
              onPress={() => setPhotoModalVisible(true)} 
              accessibilityRole="button"
              accessibilityLabel={imageUri ? "Change farmer photo" : "Add farmer photo"}
              className="w-[88px] h-[88px] rounded-full bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 items-center justify-center overflow-hidden"
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View className="items-center justify-center p-2">
                  <Camera size={26} color={isDark ? '#4b5563' : '#94a3b8'} />
                </View>
              )}
            </TouchableOpacity>
            <Text className="mt-2 text-[12px] font-outfit-bold text-slate-500 text-center">
              {imageUri ? "Change Photo" : "Add Photo"}
            </Text>
          </View>

          {/* PERSONAL DETAILS */}
          <TechnicianFormSection title="Personal Details">
          <View className="gap-4">
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
          </TechnicianFormSection>

          {/* CONTACT & ADDRESS */}
          <TechnicianFormSection title="Contact & Address">
          <View className="gap-4">
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

             <View>
                <View className="flex-row justify-between mb-1 ml-1">
                   <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">Municipality / City *</Text>
                   {errors.city && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.city}</Text>}
                </View>
                <TouchableOpacity
                   onPress={() => setPickerState('city')}
                   className={`bg-slate-50 dark:bg-slate-800 border ${errors.city ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 flex-row justify-between items-center`}
                >
                   <Text className={`font-outfit-medium ${formData.city ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                     {formData.city || 'Select municipality or city'}
                   </Text>
                   <ChevronDown size={14} color={isDark ? '#6b7280' : '#94a3b8'} />
                </TouchableOpacity>
             </View>

             {formData.city === ILOILO_CITY_NAME && (
               <View>
                  <View className="flex-row justify-between mb-1 ml-1">
                     <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">District *</Text>
                     {errors.district && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.district}</Text>}
                  </View>
                  <TouchableOpacity
                     onPress={() => setPickerState('district')}
                     className={`bg-slate-50 dark:bg-slate-800 border ${errors.district ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 flex-row justify-between items-center`}
                  >
                     <Text className={`font-outfit-medium ${formData.district ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                       {formData.district || 'Select Iloilo City district'}
                     </Text>
                     <ChevronDown size={14} color={isDark ? '#6b7280' : '#94a3b8'} />
                  </TouchableOpacity>
               </View>
             )}

             <View>
                   <View className="flex-row justify-between mb-1 ml-1">
                      <Text className="text-slate-700 dark:text-slate-300 text-[11px] font-outfit-bold uppercase">Barangay *</Text>
                      {errors.barangay && <Text className="text-red-500 text-[9px] font-outfit-bold">{errors.barangay}</Text>}
                   </View>
                   <TouchableOpacity
                      onPress={() => setPickerState('barangay')}
                      disabled={!formData.city || (formData.city === ILOILO_CITY_NAME && !formData.district)}
                      className={`bg-slate-50 dark:bg-slate-800 border ${errors.barangay ? 'border-red-300' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3.5 flex-row justify-between items-center`}
                   >
                      <Text className={`font-outfit-medium ${formData.barangay ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                        {formData.barangay || (!formData.city ? 'Select city first' : formData.city === ILOILO_CITY_NAME && !formData.district ? 'Select district first' : 'Select barangay')}
                      </Text>
                      <ChevronDown size={14} color={isDark ? '#6b7280' : '#94a3b8'} />
                   </TouchableOpacity>
             </View>
          </View>
          </TechnicianFormSection>

          {/* SAVE BUTTON */}
          <Button
              size="lg"
              className="mt-1 mb-4"
              onPress={handleSave}
              loading={mutation.isPending}
              disabled={isSubmitDisabled}
          >
              <UserPlus size={19} color="white" style={{ marginRight: 9 }} />
              <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-white text-sm">Register Farmer</Text>
          </Button>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ADDRESS SELECTION MODAL */}
      <Modal animationType="fade" transparent={true} visible={!!pickerState} onRequestClose={() => setPickerState(null)}>
         <KeyboardAvoidingView
           behavior={Platform.OS === "ios" ? "padding" : "height"}
           className="flex-1"
         >
           <View className="flex-1 bg-black/50 justify-center p-5">
              <View className="bg-white dark:bg-slate-900 rounded-[28px] p-6 min-h-[60%] max-h-[80%] shadow-2xl border border-slate-100 dark:border-slate-800">
                 <View className="flex-row justify-between items-center mb-6">
                     <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800 dark:text-white">{pickerTitle}</Text>
                     <TouchableOpacity onPress={() => { setPickerState(null); setSearchPicker(''); }} className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-full">
                         <X size={22} color={isDark ? '#94a3b8' : '#64748b'} />
                     </TouchableOpacity>
                 </View>

                 <TextInput
                   className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 text-slate-800 dark:text-white font-outfit-medium mb-4"
                   placeholder={`Search ${pickerState === 'city' ? 'municipality/city' : pickerState === 'district' ? 'district' : 'barangay'}...`}
                   placeholderTextColor={isDark ? '#6b7280' : '#94a3b8'}
                   value={searchPicker}
                   onChangeText={setSearchPicker}
                 />

                 <FlatList 
                    data={filteredPickerData}
                    keyExtractor={(item) => item}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                           onPress={() => {
                              if (pickerState === 'city') {
                                setFormData({...formData, city: item, district: '', barangay: ''});
                              } else if (pickerState === 'district') {
                                setFormData({...formData, district: item, barangay: ''});
                              } else if (pickerState === 'barangay') {
                                setFormData({...formData, barangay: item});
                              }
                              setPickerState(null);
                              setSearchPicker('');
                           }}
                           className="py-4 border-b border-slate-50 dark:border-slate-800"
                        >
                           <Text className="font-outfit-bold text-slate-700 dark:text-slate-200 text-base">{item}</Text>
                        </TouchableOpacity>
                    )}
                 />
              </View>
           </View>
         </KeyboardAvoidingView>
       </Modal>
      {/* PHOTO SELECTION MODAL */}
      <PhotoOptionModal
        visible={photoModalVisible}
        onClose={() => setPhotoModalVisible(false)}
        onSelectCamera={() => handleSelectPhoto("camera")}
        onSelectLibrary={() => handleSelectPhoto("library")}
      />
    </ScreenLayout>
  );
}
