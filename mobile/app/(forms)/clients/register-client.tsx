import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, User, Square, CheckSquare } from 'lucide-react-native';
import { toast } from 'sonner-native';
import React, { useState } from 'react';
import { useApi } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { OTON_BARANGAYS } from '@/lib/constants';
import { ChevronDown, X } from 'lucide-react-native';
import { Modal, FlatList } from 'react-native';

const PRIMARY = '#00643B';

export default function RegisterClient() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const [barangayModalVisible, setBarangayModalVisible] = useState(false);

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
  const api = useApi();
  const queryClient = useQueryClient();

  const mutation = useOfflineMutation({
    url: '/user/create-invited-user',
    method: 'POST',
    description: `Register Farmer: ${formData.firstName} ${formData.lastName}`
  }, {
    onSuccess: () => {
      toast.success("Client successfully registered.");
      queryClient.invalidateQueries({ queryKey: ['technician', 'dashboard'] });
      router.back();
    },
    onError: (error: any) => {
      if (error.message !== 'OFFLINE_SAVED') {
        toast.error(error.response?.data?.message || "An error occurred while creating the client.");
      } else {
        router.back();
      }
    }
  });

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

    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName !== 'N/A' ? formData.middleName : '',
      suffix: formData.suffix,
      email: formData.email,
      password: formData.password,
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
      role: "farmer",
    };
    
    mutation.mutate(payload);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingTop: insets.top + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
            <ArrowLeft size={22} color="#1e293b" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: '#1e293b', fontFamily: 'Outfit_900Black', fontSize: 22 }}>Register Farmer</Text>
            <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_500Medium', fontSize: 13 }}>Create a professional profile</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
          
          {/* Profile Upload Section */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <TouchableOpacity onPress={pickImage} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <User size={32} color="#cbd5e1" />
                  <Text style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Outfit_700Bold', marginTop: 4 }}>PHOTO</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <SectionHeader title="Identity Details" />
          
          <InputField 
            label="First Name" 
            value={formData.firstName} 
            onChangeText={(t: string) => setFormData({...formData, firstName: t})} 
            placeholder="e.g. Juan" 
          />

          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}>
              <Text style={{ color: noMiddleName ? '#cbd5e1' : '#64748b', fontFamily: 'Outfit_700Bold', fontSize: 12, textTransform: 'uppercase' }}>Middle Name</Text>
              <TouchableOpacity onPress={toggleNoMiddleName} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name={noMiddleName ? "checkbox-marked" : "checkbox-blank-outline"} size={18} color={noMiddleName ? PRIMARY : '#94a3b8'} />
                <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Outfit_600SemiBold' }}>N/A</Text>
              </TouchableOpacity>
            </View>
            <TextInput 
              style={{ backgroundColor: noMiddleName ? '#f1f5f9' : '#fff', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 15, borderWidth: 1, borderColor: noMiddleName ? '#f1f5f9' : '#e2e8f0', color: noMiddleName ? '#94a3b8' : '#1e293b' }}
              value={noMiddleName ? "N/A" : formData.middleName} 
              onChangeText={(t) => setFormData({...formData, middleName: t})} 
              placeholder="Dela Cruz" 
              editable={!noMiddleName}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 2 }}>
              <InputField 
                label="Last Name" 
                value={formData.lastName} 
                onChangeText={(t: string) => setFormData({...formData, lastName: t})} 
                placeholder="Santos" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <InputField 
                label="Suffix" 
                value={formData.suffix} 
                onChangeText={(t: string) => setFormData({...formData, suffix: t})} 
                placeholder="Jr." 
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ width: 100 }}>
              <InputField 
                label="Age" 
                value={formData.age} 
                onChangeText={(t: string) => setFormData({...formData, age: t})} 
                placeholder="35" 
                keyboardType="numeric" 
              />
            </View>
            <View style={{ flex: 1 }}>
              <InputField 
                label="Phone Number" 
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
            placeholder="farmer@example.com" 
            keyboardType="email-address" 
          />

          <SectionHeader title="Location Info" />

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <InputField 
                label="House No." 
                value={formData.houseNumber} 
                onChangeText={(t: string) => setFormData({...formData, houseNumber: t})} 
                placeholder="Blk 1" 
              />
            </View>
            <View style={{ flex: 2 }}>
              <InputField 
                label="Street" 
                value={formData.address} 
                onChangeText={(t: string) => setFormData({...formData, address: t})} 
                placeholder="Main Street" 
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#64748b', fontFamily: 'Outfit_700Bold', fontSize: 12, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }}>Barangay</Text>
              <TouchableOpacity 
                onPress={() => setBarangayModalVisible(true)}
                style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
              >
                <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: formData.barangay ? '#1e293b' : '#cbd5e1' }}>
                  {formData.barangay || 'Select'}
                </Text>
                <ChevronDown size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <InputField 
                label="City" 
                value={formData.city || 'Oton'} 
                onChangeText={(t: string) => setFormData({...formData, city: t})} 
                placeholder="Oton" 
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 2 }}>
              <InputField 
                label="Province" 
                value={formData.province} 
                onChangeText={(t: string) => setFormData({...formData, province: t})} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <InputField 
                label="Zip Code" 
                value={formData.zipCode} 
                onChangeText={(t: string) => setFormData({...formData, zipCode: t})} 
                placeholder="5020" 
                keyboardType="numeric" 
              />
            </View>
          </View>

          <SectionHeader title="Account Security" />

          <InputField 
            label="Password" 
            value={formData.password} 
            onChangeText={(t: string) => setFormData({...formData, password: t})} 
            placeholder="••••••••" 
            secureTextEntry={true} 
          />

          <TouchableOpacity 
            onPress={handleSave}
            disabled={mutation.isPending}
            activeOpacity={0.8}
            style={{ backgroundColor: PRIMARY, marginTop: 32, paddingVertical: 18, borderRadius: 24, alignItems: 'center', shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Check size={22} color="#fff" strokeWidth={3} />
                <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 18 }}>Complete Registration</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={{ textAlign: 'center', color: '#94a3b8', fontFamily: 'Outfit_500Medium', fontSize: 12, marginTop: 24, paddingHorizontal: 20 }}>
            By registering, you agree to our <Text style={{ color: PRIMARY, fontFamily: 'Outfit_700Bold' }}>Terms of Service</Text> and <Text style={{ color: PRIMARY, fontFamily: 'Outfit_700Bold' }}>Privacy Policy</Text>.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barangay Modal */}
      <Modal visible={barangayModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Outfit_800ExtraBold', color: '#1e293b' }}>Select Barangay</Text>
              <TouchableOpacity onPress={() => setBarangayModalVisible(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <FlatList 
              data={OTON_BARANGAYS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => {
                    setFormData({...formData, barangay: item});
                    setBarangayModalVisible(false);
                  }}
                  style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                >
                  <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 16, color: '#1e293b' }}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const SectionHeader = ({ title }: { title: string }) => (
  <View style={{ marginTop: 8, marginBottom: 16, paddingLeft: 4 }}>
    <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#1e293b', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Text>
    <View style={{ width: 30, height: 3, backgroundColor: PRIMARY, marginTop: 4, borderRadius: 2 }} />
  </View>
);

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false }: any) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ color: '#64748b', fontFamily: 'Outfit_700Bold', fontSize: 12, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }}>{label}</Text>
    <TextInput 
      style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b' }}
      value={value} 
      onChangeText={onChangeText} 
      placeholder={placeholder} 
      placeholderTextColor="#cbd5e1"
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
    />
  </View>
);