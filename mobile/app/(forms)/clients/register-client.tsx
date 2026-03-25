import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
import SafeScreen from '@/components/safeScreen';
import { ArrowLeft, Check, Square, CheckSquare } from 'lucide-react-native';
import { toast } from 'sonner-native';
import React, { useState } from 'react';
import { useApi } from '@/lib/api'; // ADDED IMPORT
import * as ImagePicker from 'expo-image-picker';

export default function RegisterClient() {
  const router = useRouter();

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    age: '',
    phone: '',
    email: '',
    houseNumber: '',
    address: '',
    barangay: '',
    city: '',
    province: 'Iloilo',
    region: 'Region VI',
    zipCode: '',
    password: '',
  });

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const [noMiddleName, setNoMiddleName] = useState(false);
  const [loading, setLoading] = useState(false);
  const api = useApi();

  // Toggle "No Middle Name" Logic
  const toggleNoMiddleName = () => {
    setNoMiddleName(!noMiddleName);
    if (!noMiddleName) {
        // If checking the box, clear the middle name
        setFormData({ ...formData, middleName: '' });
    }
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.phone) {
      toast.error("Please fill in all required fields (First Name, Last Name, Phone Number).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName !== 'N/A' ? formData.middleName : '',
        suffix: formData.suffix,
        email: formData.email,
        password: formData.password, // ADDED MISSING PASSWORD
        phoneNumber: formData.phone,
        imageUrl: imageBase64,
        address: {
          houseNumber: formData.houseNumber,
          street: formData.address || 'N/A',
          barangay: formData.barangay || 'N/A',
          city: formData.city || 'N/A',
          zipCode: formData.zipCode || '0000',
          province: formData.province || 'Iloilo',
          region: formData.region || 'Region VI',
          phoneNumber: formData.phone
        },
        role: "farmer", // Hardcoded to create Farmers
      };
      
      await api.post('/user/create-invited-user', payload);
      toast.success("Client successfully registered.");
      router.back();
    } catch (error: any) {
      console.error("Failed to create client:", error);
      toast.error(error.response?.data?.message || "An error occurred while creating the client.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen>
      <View className="flex-1 bg-white px-6">
        
        {/* --- HEADER --- */}
        <View className="flex-row items-center justify-between mb-6 mt-2">
            <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-gray-100">
                <ArrowLeft size={24} color="black" />
            </TouchableOpacity>
            <View>
                <Text className="text-xl font-bold text-gray-900">New Client</Text>
                <Text className="text-xs text-gray-500">Create a new profile</Text>
            </View>
            <View className="w-8" /> 
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            
            {/* ========================================= */}
            {/* PROFILE PICTURE UPLOAD                    */}
            {/* ========================================= */}
            <View className="items-center mt-4 mb-6">
              <TouchableOpacity onPress={pickImage} className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                {imageUri ? (
                  <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                ) : (
                  <Text className="text-xs text-blue-500 font-semibold text-center mt-2">Add Photo</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ========================================= */}
            {/* SECTION 1: PERSONAL INFO                  */}
            {/* ========================================= */}
            <SectionHeader title="Personal Information" />

            {/* First Name */}
            <InputField 
                label="First Name" 
                value={formData.firstName} 
                onChangeText={(t: string) => setFormData({...formData, firstName: t})} 
                placeholder="John" 
            />

            {/* Middle Name + Checkbox */}
            <View className="mb-4">
                <View className="flex-row justify-between items-center mb-1.5 ml-1">
                    <Text className={`font-medium text-sm ${noMiddleName ? 'text-gray-400' : 'text-gray-700'}`}>Middle Name</Text>
                    
                    <TouchableOpacity onPress={toggleNoMiddleName} className="flex-row items-center gap-1.5 active:opacity-60">
                         {noMiddleName ? <CheckSquare size={16} color="#2563EB" /> : <Square size={16} color="#6B7280" />}
                         <Text className="text-xs text-gray-500">I have no middle name</Text>
                    </TouchableOpacity>
                </View>
                <TextInput 
                    className={`border rounded-xl px-4 py-3.5 text-base ${noMiddleName ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
                    value={noMiddleName ? "N/A" : formData.middleName} 
                    onChangeText={(t) => setFormData({...formData, middleName: t})} 
                    placeholder="Zaragosa" 
                    placeholderTextColor="#9CA3AF"
                    editable={!noMiddleName} // DISABLE INPUT IF CHECKED
                />
            </View>

            {/* Last Name + Suffix */}
            <View className="flex-row gap-4">
                <View className="flex-[2]">
                    <InputField 
                        label="Last Name" 
                        value={formData.lastName} 
                        onChangeText={(t: string) => setFormData({...formData, lastName: t})} 
                        placeholder="Doe" 
                    />
                </View>
                <View className="flex-1">
                    <InputField 
                        label="Suffix" 
                        value={formData.suffix} 
                        onChangeText={(t: string) => setFormData({...formData, suffix: t})} 
                        placeholder="Jr./Sr." 
                    />
                </View>
            </View>

            <View className="flex-row gap-4">
                <View className="w-1/3">
                    <InputField 
                        label="Age" 
                        value={formData.age} 
                        onChangeText={(t: string) => setFormData({...formData, age: t})} 
                        placeholder="30" 
                        keyboardType="numeric" 
                    />
                </View>
                <View className="flex-1">
                    <InputField 
                        label="Mobile Number" 
                        value={formData.phone} 
                        onChangeText={(t: string) => setFormData({...formData, phone: t})} 
                        placeholder="0912 345 6789" 
                        keyboardType="phone-pad" 
                    />
                </View>
            </View>

            <InputField 
                label="Email Address" 
                value={formData.email} 
                onChangeText={(t: string) => setFormData({...formData, email: t})} 
                placeholder="client@example.com" 
                keyboardType="email-address" 
            />

            {/* ========================================= */}
            {/* SECTION 2: ADDRESS                        */}
            {/* ========================================= */}
            <SectionHeader title="Address Details" />

            <View className="flex-row gap-4">
                <View className="w-1/3">
                    <InputField 
                        label="House No." 
                        value={formData.houseNumber} 
                        onChangeText={(t: string) => setFormData({...formData, houseNumber: t})} 
                        placeholder="Blk 1" 
                    />
                </View>
                <View className="flex-1">
                    <InputField 
                        label="Street Address" 
                        value={formData.address} 
                        onChangeText={(t: string) => setFormData({...formData, address: t})} 
                        placeholder="Lot 1, Street Name" 
                    />
                </View>
            </View>

            <View className="flex-row gap-4">
                <View className="flex-1">
                    <InputField 
                        label="Barangay" 
                        value={formData.barangay} 
                        onChangeText={(t: string) => setFormData({...formData, barangay: t})} 
                        placeholder="Brgy. San Jose" 
                    />
                </View>
                <View className="flex-1">
                    <InputField 
                        label="City / Municipality" 
                        value={formData.city} 
                        onChangeText={(t: string) => setFormData({...formData, city: t})} 
                        placeholder="Iloilo City" 
                    />
                </View>
            </View>

            <View className="flex-row gap-4">
                <View className="flex-[2]">
                    <InputField 
                        label="Province" 
                        value={formData.province} 
                        onChangeText={(t: string) => setFormData({...formData, province: t})} 
                        placeholder="Iloilo" 
                    />
                </View>
                <View className="flex-1">
                    <InputField 
                        label="Region" 
                        value={formData.region} 
                        onChangeText={(t: string) => setFormData({...formData, region: t})} 
                        placeholder="Region VI" 
                    />
                </View>
            </View>

            <InputField 
                label="Zip Code" 
                value={formData.zipCode} 
                onChangeText={(t: string) => setFormData({...formData, zipCode: t})} 
                placeholder="5000" 
                keyboardType="numeric" 
            />

            {/* ========================================= */}
            {/* SECTION 3: SECURITY                       */}
            {/* ========================================= */}
            <SectionHeader title="Account Security" />

            <InputField 
                label="Password" 
                value={formData.password} 
                onChangeText={(t: string) => setFormData({...formData, password: t})} 
                placeholder="••••••••" 
                secureTextEntry={true} 
            />

            {/* --- SAVE BUTTON --- */}
            <TouchableOpacity 
                onPress={handleSave}
                activeOpacity={0.8}
                className="bg-blue-600 rounded-full py-4 items-center mt-6 shadow-lg shadow-blue-200 flex-row justify-center gap-2"
            >
                <Check size={20} color="white" />
                <Text className="text-white font-bold text-lg">Create Account</Text>
            </TouchableOpacity>

            {/* --- TERMS DISCLAIMER --- */}
            <Text className="text-xs text-gray-500 text-center mt-4 px-4 leading-5">
                By tapping <Text className="font-bold text-gray-700">Create Account</Text>, you agree with the <Text className="text-blue-600 underline">Terms and Conditions</Text> and <Text className="text-blue-600 underline">Privacy Notice</Text>.
            </Text>

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeScreen>
  );
}

// --- REUSABLE COMPONENTS ---

const SectionHeader = ({ title }: { title: string }) => (
    <View className="mt-4 mb-4 pb-2 border-b border-gray-100">
        <Text className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</Text>
    </View>
);

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false }: any) => (
    <View className="mb-4">
        <Text className="text-gray-700 font-medium mb-1.5 ml-1 text-sm">{label}</Text>
        <TextInput 
            className="bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-gray-900 text-base focus:border-blue-500" 
            value={value} 
            onChangeText={onChangeText} 
            placeholder={placeholder} 
            placeholderTextColor="#9CA3AF"
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
        />
    </View>
);