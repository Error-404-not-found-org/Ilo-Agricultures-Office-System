import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import SafeScreen from '@/components/safeScreen';
import { ArrowLeft, ChevronDown, Calendar, Check, X, ArrowRight, Camera } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toast } from 'sonner-native';
import * as ImagePicker from 'expo-image-picker';

// --- OPTIONS ---
const SPECIES_OPTIONS = ['Beef', 'Dairy', 'Carabao'];
const BREED_OPTIONS = ['Native', 'Brahman', 'Holstein Sahiwal (HS)', 'PC Cross', 'Purebred'];
const AI_ATTEMPTS = ['Not Yet', '1', '2', '3', '4', '5+'];
const ESTRUS_OPTIONS = ['Natural', 'Synchronized'];
const PD_RESULTS = ['Positive', 'Negative', 'Re-heat'];
const CALVING_EASE = ['Normal', 'Difficult', 'Abortion', 'Stillbirth'];
const CALF_SEX = ['Male', 'Female'];

export default function AddAIRecord() {
  const router = useRouter();
  
  // --- WIZARD STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [farmers, setFarmers] = useState<string[]>([]);

  const [farmersList, setFarmersList] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const fetchFarmers = async () => {
      try {
        const res = await api.get('/user?role=farmer');
        if (res.data) {
          setFarmersList(res.data);
          const farmerNames = res.data.map((u: any) => u.name);
          setFarmers(farmerNames);
        }
      } catch (error: any) {
        console.error('Failed to fetch farmers:', error);
        toast.error(error.response?.data?.message || "Failed to load farmer list. Check your connection.");
      }
    };
    fetchFarmers();
  }, [api, isLoaded, isSignedIn]);

  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const [formData, setFormData] = useState({
    // Step 1: Identity
    farmer: '',
    ageYears: '',
    ageMonths: '', 
    animalId: '',
    earTag: '',
    brand: '',
    species: '',
    breed: '',
    color: '',
    
    // Step 2: AI
    aiDate: new Date().toLocaleDateString(),
    noOfAI: '', 
    estrusType: '',
    sireBreed: '',
    sireCode: '',

    // Step 3: PD
    pdDate: '',
    pdResult: '',

    // Step 4: Calf
    calfDate: '',
    calfId: '',
    calfSex: '',
    calvingEase: '',
  });

  // --- MODAL HELPERS ---
  const [modalVisible, setModalVisible] = useState(false);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalOptions, setModalOptions] = useState<string[]>([]);
  const [activeField, setActiveField] = useState('');

  // Open Standard Dropdown
  const openModal = (field: string, title: string, options: string[]) => {
    setActiveField(field);
    setModalTitle(title);
    setModalOptions(options);
    setModalVisible(true);
  };

  // Open Date Picker
  const openDatePicker = (field: string) => {
    setActiveField(field);
    setDateModalVisible(true);
  };

  const handleSelect = (val: string) => {
    setFormData({...formData, [activeField]: val});
    setModalVisible(false);
  };

  const handleNativeDateChange = (event: any, selectedDate: any) => {
    setDateModalVisible(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({...formData, [activeField]: selectedDate.toLocaleDateString()});
    }
  };

  const setDateToToday = (field: string) => {
    const today = new Date().toLocaleDateString();
    setFormData({...formData, [field]: today});
  }

  // --- NAVIGATION ---
  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
    } else {
        router.back();
    }
  };

  const handleSave = async () => {
    if (!formData.farmer) return toast.error("Please select a farmer.");
    if (!formData.species || !formData.breed) return toast.error("Please specify a species and breed.");

    const selectedFarmer = farmersList.find(f => f.name === formData.farmer);
    if (!selectedFarmer) return toast.error("Could not find Farmer ID.");

    // Dynamically compute birthDate from Age Years/Months
    const today = new Date();
    const yrs = parseInt(formData.ageYears || '0');
    const mos = parseInt(formData.ageMonths || '0');
    
    // Reverse time
    today.setFullYear(today.getFullYear() - yrs);
    today.setMonth(today.getMonth() - mos);

    const finalPayload = {
      farmerId: selectedFarmer._id,
      animalId: formData.animalId,
      earTag: formData.earTag,
      brand: formData.brand,
      species: formData.species,
      breed: formData.breed,
      color: formData.color,
      imageUrl: imageBase64,
      birthDate: today.toISOString(),
    };

    try {
      setLoading(true);
      await api.post('/animals/register', finalPayload);
      toast.success("Animal successfully registered.", {
        duration: 4000, 
        position: 'center'
      });
      router.back();
    } catch (error: any) {
      console.error("Failed to add animal:", error);
      toast.error(error.response?.data?.message || "Error registering the animal.", {
        duration: 5000,
        position: 'center'
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper date rendering
  const getPickerDate = () => {
      // @ts-ignore
      const str = formData[activeField];
      if (str) return new Date(str);
      return new Date();
  };

  return (
    <SafeScreen>
      <View className="flex-1 bg-white px-5"> 
        
        {/* --- COMPACT HEADER --- */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
            <TouchableOpacity onPress={handleBack} className="p-2 -ml-2 rounded-full active:bg-gray-100">
                <ArrowLeft size={22} color="black" />
            </TouchableOpacity>
            <View className="items-center">
                <Text className="text-base font-bold text-gray-900">New Record</Text>
                <Text className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Step {currentStep} / {TOTAL_STEPS}</Text>
            </View>
            <View className="w-8" /> 
        </View>

        {/* --- PROGRESS BAR --- */}
        <View className="flex-row h-1 bg-gray-100 rounded-full mb-6 overflow-hidden">
            <View className="bg-blue-600 h-full rounded-full" style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            
            {/* ========================================= */}
            {/* STEP 1: ANIMAL IDENTIFICATION             */}
            {/* ========================================= */}
            {currentStep === 1 && (
                <View>
                    <Text className="text-xl font-bold mb-1 text-gray-900">Animal Identity</Text>
                    <Text className="text-sm text-gray-500 mb-5">Select farmer and animal details.</Text>
                    
                    <View className="items-center mb-6 mt-2">
                        <TouchableOpacity onPress={pickImage} className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                            {imageUri ? (
                                <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <>
                                  <Camera size={24} color="#9CA3AF" />
                                  <Text className="text-[10px] text-gray-500 font-semibold text-center mt-1">Add Photo</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <SelectField 
                        label="Farmer / Owner" 
                        value={formData.farmer} 
                        placeholder="Select Farmer" 
                        onPress={() => openModal('farmer', 'Select Farmer', farmers)} 
                    />

                    <View className="flex-row gap-3">
                        <View className="flex-[1.5]">
                            <InputField 
                                label="Est. Age (Years)" 
                                value={formData.ageYears} 
                                onChangeText={(t: string) => setFormData({...formData, ageYears: t})} 
                                placeholder="e.g. 1" 
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="flex-[1.5]">
                            <InputField 
                                label="Months" 
                                value={formData.ageMonths} 
                                onChangeText={(t: string) => setFormData({...formData, ageMonths: t})} 
                                placeholder="e.g. 4" 
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <InputField label="Animal ID" value={formData.animalId} onChangeText={(t: string) => setFormData({...formData, animalId: t})} placeholder="ID-001" />
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
                </View>
            )}

            {/* ========================================= */}
            {/* STEP 2: ARTIFICIAL INSEMINATION           */}
            {/* ========================================= */}
            {currentStep === 2 && (
                <View>
                    <Text className="text-xl font-bold mb-1 text-gray-900">Insemination</Text>
                    <Text className="text-sm text-gray-500 mb-5">Enter AI details below.</Text>

                    {/* UPDATED: DATE PICKER FIELD */}
                    <DateSelector 
                        label="Date of AI" 
                        value={formData.aiDate} 
                        onPress={() => openDatePicker('aiDate')}
                        onSetToday={() => setDateToToday('aiDate')}
                        onSetNotYet={() => setFormData({...formData, aiDate: 'Not Yet'})}
                    />

                    <View className="flex-row gap-3">
                         <View className="w-1/2">
                            <SelectField 
                                label="No. of AI" 
                                value={formData.noOfAI} 
                                placeholder="Select" 
                                onPress={() => openModal('noOfAI', 'Select AI Attempt', AI_ATTEMPTS)} 
                            />
                         </View>
                    </View>

                    <SelectField label="Estrus Type" value={formData.estrusType} placeholder="Natural / Synchronized" onPress={() => openModal('estrusType', 'Estrus Type', ESTRUS_OPTIONS)} />

                    <View className="flex-row gap-3 mt-1">
                        <View className="flex-1">
                            <InputField label="Sire Breed" value={formData.sireBreed} onChangeText={(t: string) => setFormData({...formData, sireBreed: t})} placeholder="e.g. Brahman" />
                        </View>
                        <View className="flex-1">
                            <InputField label="Sire Code" value={formData.sireCode} onChangeText={(t: string) => setFormData({...formData, sireCode: t})} placeholder="Code" />
                        </View>
                    </View>
                </View>
            )}

            {/* ========================================= */}
            {/* STEP 3: PREGNANCY DIAGNOSIS               */}
            {/* ========================================= */}
            {currentStep === 3 && (
                <View>
                    <Text className="text-xl font-bold mb-1 text-gray-900">Pregnancy Check</Text>
                    <Text className="text-sm text-gray-500 mb-5">Enter PD results (Optional).</Text>

                    <DateSelector 
                        label="PD Date" 
                        value={formData.pdDate} 
                        onPress={() => openDatePicker('pdDate')}
                        onSetToday={() => setDateToToday('pdDate')}
                        onSetNotYet={() => setFormData({...formData, pdDate: 'Not Yet'})}
                    />

                    <SelectField label="Result" value={formData.pdResult} placeholder="Select Result" onPress={() => openModal('pdResult', 'PD Result', PD_RESULTS)} />
                </View>
            )}

            {/* ========================================= */}
            {/* STEP 4: CALF DROP                         */}
            {/* ========================================= */}
            {currentStep === 4 && (
                <View>
                    <Text className="text-xl font-bold mb-1 text-gray-900">Calf Drop</Text>
                    <Text className="text-sm text-gray-500 mb-5">Enter calving details (Optional).</Text>

                    <DateSelector 
                        label="Calving Date" 
                        value={formData.calfDate} 
                        onPress={() => openDatePicker('calfDate')}
                        onSetToday={() => setDateToToday('calfDate')}
                        onSetNotYet={() => setFormData({...formData, calfDate: 'Not Yet'})}
                    />

                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <InputField label="Calf ID" value={formData.calfId} onChangeText={(t: string) => setFormData({...formData, calfId: t})} placeholder="New ID" />
                        </View>
                        <View className="flex-1">
                            <SelectField label="Sex" value={formData.calfSex} placeholder="M/F" onPress={() => openModal('calfSex', 'Calf Sex', CALF_SEX)} />
                        </View>
                    </View>

                    <SelectField label="Calving Ease" value={formData.calvingEase} placeholder="Select Condition" onPress={() => openModal('calvingEase', 'Calving Ease', CALVING_EASE)} />
                </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>

        {/* --- BOTTOM BUTTONS --- */}
        <View className="py-4">
            {currentStep < TOTAL_STEPS ? (
                <TouchableOpacity onPress={handleNext} className="bg-blue-600 rounded-full py-3.5 items-center flex-row justify-center gap-2 shadow-sm">
                    <Text className="text-white font-bold text-base">Next Step</Text>
                    <ArrowRight size={18} color="white" />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity onPress={handleSave} disabled={loading} className={`rounded-full py-3.5 items-center flex-row justify-center gap-2 shadow-lg ${loading ? 'bg-blue-400' : 'bg-blue-600 shadow-blue-200'}`}>
                    {loading ? (
                       <ActivityIndicator color="white" size="small" />
                    ) : (
                       <>
                         <Check size={18} color="white" />
                         <Text className="text-white font-bold text-base">Save Record</Text>
                       </>
                    )}
                </TouchableOpacity>
            )}
        </View>

        {/* --- MODALS --- */}
        <SelectionModal visible={modalVisible} title={modalTitle} options={modalOptions} onClose={() => setModalVisible(false)} onSelect={handleSelect} />
        
        {dateModalVisible && (
            <DateTimePicker
                value={getPickerDate()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleNativeDateChange}
            />
        )}

      </View>
    </SafeScreen>
  );
}

// --- REUSABLE COMPACT COMPONENTS ---

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

// --- NEW DATE SELECTOR (COMPACT & NON-TYPING) ---
const DateSelector = ({ label, value, onPress, onSetToday, onSetNotYet }: any) => (
    <View className="mb-3">
        <View className="flex-row justify-between items-center mb-1 ml-1">
            <Text className="text-gray-700 font-medium text-xs uppercase tracking-wide">{label}</Text>
            <View className="flex-row gap-x-4">
                {onSetNotYet && (
                    <TouchableOpacity onPress={onSetNotYet} className="active:opacity-50">
                        <Text className="text-gray-500 text-[10px] font-bold">NOT YET</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onSetToday} className="active:opacity-50">
                    <Text className="text-blue-600 text-[10px] font-bold">SET TO TODAY</Text>
                </TouchableOpacity>
            </View>
        </View>
        <TouchableOpacity onPress={onPress} className="bg-white border border-gray-300 rounded-xl px-4 py-3 flex-row justify-between items-center">
            <Text className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>{value || "Select Date"}</Text>
            <Calendar size={18} color="gray" />
        </TouchableOpacity>
    </View>
);

// --- STANDARD SELECTION MODAL ---
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
                        <TouchableOpacity onPress={() => onSelect(item)} className="py-3.5 border-b border-gray-100 active:bg-blue-50">
                            <Text className="text-base text-gray-800">{item}</Text>
                        </TouchableOpacity>
                    )} 
                />
            </View>
        </View>
    </Modal>
);

