import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, StatusBar, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, Calendar, Check, X, Camera } from 'lucide-react-native';
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

// --- OPTIONS ---
const SPECIES_OPTIONS = ['Beef', 'Dairy', 'Carabao'];
const BREED_OPTIONS = ['Native', 'Brahman', 'Holstein Sahiwal (HS)', 'PC Cross', 'Purebred'];

const SPECIES_PREFIX: Record<string, string> = { Beef: 'BEF', Dairy: 'DAI', Carabao: 'CBU' };

export default function FarmerAddAnimal() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  
  const [formData, setFormData] = useState({
    animalId: '',
    earTag: '',
    brand: '',
    species: '',
    breed: '',
    color: '',
    ageYears: '',
    ageMonths: '',
  });

  const [loading, setLoading] = useState(false);
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
      toast.success("Photo selected!");
    }
  };

  // --- MODAL HELPERS ---
  const [modalVisible, setModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOptions, setModalOptions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState('');

  const openModal = (field: string, title: string, options: string[]) => {
    setActiveField(field);
    setModalTitle(title);
    setModalOptions(options);
    setModalVisible(true);
  };

  const openDatePicker = (field: string) => {
    setActiveField(field);
    setDateModalVisible(true);
  };

  const handleSelect = (val: string) => {
    const updated = {...formData, [activeField]: val};
    // Auto-update the Animal ID preview when species changes
    if (activeField === 'species') {
      const prefix = SPECIES_PREFIX[val] || 'ANM';
      const ts = Date.now().toString().slice(-4);
      updated.animalId = `${prefix}-${ts}`;
    }
    setFormData(updated);
    setModalVisible(false);
  };

  const handleDateSelect = (date: string) => {
    setFormData({...formData, [activeField]: date});
    setDateModalVisible(false);
  };

  const handleSave = async () => {
    if (!formData.species) return toast.error("Please select a species.");
    if (!formData.breed) return toast.error("Please select a breed.");
    
    try {
      setLoading(true);

      // Compute birthDate from age if provided
      let birthDate: string | undefined;
      const yrs = parseInt(formData.ageYears || '0');
      const mos = parseInt(formData.ageMonths || '0');
      if (yrs > 0 || mos > 0) {
        const d = new Date();
        d.setFullYear(d.getFullYear() - yrs);
        d.setMonth(d.getMonth() - mos);
        birthDate = d.toISOString();
      }

      const payload = {
        animalId: formData.animalId.trim() || undefined, // let backend auto-generate if blank
        earTag: formData.earTag,
        brand: formData.brand,
        species: formData.species,
        breed: formData.breed,
        color: formData.color,
        imageUrl: imageBase64,
        birthDate,
      };

      const res = await api.post('/animals/register', payload);
      toast.success(`Animal "${res.data.animal?.animalId}" registered!`, { position: 'top-center', duration: 4000 });
      router.back();
    } catch (error: any) {
      console.error("Failed to add animal:", error);
      toast.error(error.response?.data?.message || "Failed to register animal. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />

      {/* --- HEADER --- */}
      <View 
        style={{ paddingTop: insets.top + 16 }}
        className="px-6 pb-6 flex-row items-center gap-4 z-10"
      >
        <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/20 shadow-sm"
            activeOpacity={0.7}
        >
            <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <View>
            <Text className="text-[20px] font-bold text-white leading-tight">Register Animal</Text>
            <Text className="text-[12px] text-emerald-100 font-medium tracking-wide">Add a new animal to your farm</Text>
        </View>
      </View>

      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-8 mt-2 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            
            {/* --- PHOTO PLACEHOLDER (Optional) --- */}
            <TouchableOpacity onPress={pickImage} className="self-center bg-gray-100 h-24 w-24 rounded-full items-center justify-center mb-8 border border-gray-200 border-dashed overflow-hidden shadow-sm">
                {imageUri ? (
                    <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <>
                      <Camera size={28} color="#9CA3AF" />
                      <Text className="text-[10px] text-gray-500 font-semibold text-center mt-1">Add Photo</Text>
                    </>
                )}
            </TouchableOpacity>

            {/* --- FORM FIELDS --- */}
            <Text className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Animal Identification</Text>

            <View className="flex-row gap-3">
                <View className="flex-1">
                    <InputField label="Animal ID" value={formData.animalId} onChangeText={(t: string) => setFormData({...formData, animalId: t})} placeholder="Auto-generated if blank" />
                </View>
                <View className="flex-1">
                    <InputField label="Ear Tag" value={formData.earTag} onChangeText={(t: string) => setFormData({...formData, earTag: t})} placeholder="Tag-123" />
                </View>
            </View>

            <View className="flex-row gap-3 mt-1">
                <View className="flex-1">
                    <SelectField label="Species" value={formData.species} placeholder="Select" onPress={() => openModal('species', 'Select Species', SPECIES_OPTIONS)} />
                </View>
                <View className="flex-1">
                    <SelectField label="Breed" value={formData.breed} placeholder="Select" onPress={() => openModal('breed', 'Select Breed', BREED_OPTIONS)} />
                </View>
            </View>

            <View className="flex-row gap-3">
                <View className="flex-1">
                    <InputField label="Color" value={formData.color} onChangeText={(t: string) => setFormData({...formData, color: t})} placeholder="e.g. Black" />
                </View>
                <View className="flex-1">
                    <InputField label="Brand" value={formData.brand} onChangeText={(t: string) => setFormData({...formData, brand: t})} placeholder="(Optional)" />
                </View>
            </View>

            <View className="flex-row gap-3">
                <View className="flex-1">
                    <InputField label="Age (Years)" value={formData.ageYears} onChangeText={(t: string) => setFormData({...formData, ageYears: t})} placeholder="e.g. 2" keyboardType="numeric" />
                </View>
                <View className="flex-1">
                    <InputField label="Months" value={formData.ageMonths} onChangeText={(t: string) => setFormData({...formData, ageMonths: t})} placeholder="e.g. 4" keyboardType="numeric" />
                </View>
            </View>

            {/* --- SAVE BUTTON --- */}
            <TouchableOpacity 
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
                className={`rounded-full py-4 items-center mt-6 shadow-lg flex-row justify-center gap-2 ${loading ? 'bg-green-500' : 'bg-green-700 shadow-green-200'}`}
            >
                {loading ? (
                   <ActivityIndicator color="white" size="small" />
                ) : (
                   <>
                     <Check size={20} color="white" />
                     <Text className="text-white font-bold text-lg">Add to My Farm</Text>
                   </>
                )}
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* --- REUSED MODALS --- */}
        <SelectionModal visible={modalVisible} title={modalTitle} options={modalOptions} onClose={() => setModalVisible(false)} onSelect={handleSelect} />
        <CalendarModal visible={dateModalVisible} onClose={() => setDateModalVisible(false)} onSelect={handleDateSelect} />

      </View>
    </View>
  );
}

// --- SUB-COMPONENTS (Identical to Technician form for consistency) ---

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) => (
    <View className="mb-3">
        <Text className="text-gray-700 font-medium mb-1 ml-1 text-xs uppercase tracking-wide">{label}</Text>
        <TextInput 
            className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-500" 
            value={value} 
            onChangeText={onChangeText} 
            placeholder={placeholder} 
            placeholderTextColor="#9CA3AF"
            keyboardType={keyboardType}
        />
    </View>
);

const SelectField = ({ label, value, placeholder, onPress }: any) => (
    <View className="mb-3">
        <Text className="text-gray-700 font-medium mb-1 ml-1 text-xs uppercase tracking-wide">{label}</Text>
        <TouchableOpacity onPress={onPress} className="flex-row items-center justify-between bg-white border border-gray-300 rounded-xl px-4 py-3">
            <Text className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>{value || placeholder}</Text>
            <ChevronDown size={18} color="gray" />
        </TouchableOpacity>
    </View>
);

const DateSelector = ({ label, value, onPress }: any) => (
    <View className="mb-3">
        <Text className="text-gray-700 font-medium mb-1 ml-1 text-xs uppercase tracking-wide">{label}</Text>
        <TouchableOpacity onPress={onPress} className="bg-white border border-gray-300 rounded-xl px-4 py-3 flex-row justify-between items-center">
            <Text className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>{value || "Select Date"}</Text>
            <Calendar size={18} color="gray" />
        </TouchableOpacity>
    </View>
);

const SelectionModal = ({ visible, title, options, onClose, onSelect }: any) => (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[70%]">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-lg font-bold">{title}</Text>
                    <TouchableOpacity onPress={onClose} className="p-1 bg-gray-100 rounded-full"><X size={20} color="black" /></TouchableOpacity>
                </View>
                <FlatList 
                    data={options} 
                    keyExtractor={(item) => item} 
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => onSelect(item)} className="py-3.5 border-b border-gray-100 active:bg-green-50">
                            <Text className="text-base text-gray-800">{item}</Text>
                        </TouchableOpacity>
                    )} 
                />
            </View>
        </View>
    </Modal>
);

// Simplified Calendar for Demo
const CalendarModal = ({ visible, onClose, onSelect }: any) => {
    const days = Array.from({length: 30}, (_, i) => i + 1);
    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
                <View className="bg-white w-full rounded-3xl p-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-bold">Select Date</Text>
                        <TouchableOpacity onPress={onClose}><X size={20} color="gray" /></TouchableOpacity>
                    </View>
                    <View className="flex-row flex-wrap gap-2 justify-center">
                        {days.map((d) => (
                            <TouchableOpacity key={d} onPress={() => onSelect(`10/${d}/2023`)} className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 active:bg-green-600 active:text-white">
                                <Text className="text-gray-700">{d}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
};