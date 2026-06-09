import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import { ArrowLeft, ChevronDown, Calendar, Check, X, ArrowRight, Camera, Save, Info, ChevronRight, User } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toast } from 'sonner-native';
import * as ImagePicker from 'expo-image-picker';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CATTLE_BREEDS, CATTLE_SPECIES, BREED_OPTIONS_BY_SPECIES } from '@/lib/constants';

const PRIMARY = '#00643B';

// --- OPTIONS ---
const SPECIES_OPTIONS = CATTLE_SPECIES;
const BREED_OPTIONS = CATTLE_BREEDS;
const AI_ATTEMPTS = ['Not Yet', '1', '2', '3', '4', '5+'];
const ESTRUS_OPTIONS = ['Natural', 'Synchronized'];
const PD_RESULTS = ['Positive', 'Negative', 'Re-heat'];
const CALVING_EASE = ['Normal', 'Difficult', 'Abortion', 'Stillbirth'];
const CALF_SEX = ['Male', 'Female'];

export default function AddAIRecord() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // --- WIZARD STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [farmers, setFarmers] = useState<string[]>([]);

  const [farmersList, setFarmersList] = useState<any[]>([]);
  const queryClient = useQueryClient();

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
    sireCode: `SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,

    // Step 3: PD
    pdDate: '',
    pdResult: '',

    // Step 4: Calf
    calfDate: '',
    calfId: '',
    calfSex: '',
    calvingEase: '',
  });

  const mutation = useOfflineMutation({
    url: '/animals/register',
    method: 'POST',
    description: `Register Animal: ${formData.earTag || formData.animalId}`
  }, {
    onSuccess: () => {
      toast.success("Animal successfully registered.", { duration: 4000, position: 'center' });
      queryClient.invalidateQueries({ queryKey: ['technician', 'dashboard'] });
      router.back();
    },
    onError: (error: any) => {
      if (error.message !== 'OFFLINE_SAVED') {
        toast.error(error.response?.data?.message || "Error registering the animal.", { duration: 5000, position: 'center' });
      } else {
        router.back();
      }
    }
  });

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

  useEffect(() => {
    if (formData.species) {
      const validBreeds = BREED_OPTIONS_BY_SPECIES[formData.species] || [];
      if (formData.breed && !validBreeds.includes(formData.breed)) {
        setFormData((prev) => ({ ...prev, breed: "" }));
      }
    }
  }, [formData.species]);
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

    mutation.mutate(finalPayload);
  };

  // Helper date rendering
  const getPickerDate = () => {
      // @ts-ignore
      const str = formData[activeField];
      if (str) return new Date(str);
      return new Date();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Header */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingTop: insets.top + 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={handleBack} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
            <ArrowLeft size={22} color="#1e293b" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: '#1e293b', fontFamily: 'Outfit_900Black', fontSize: 18 }}>New Record</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: PRIMARY, fontFamily: 'Outfit_800ExtraBold', fontSize: 10, textTransform: 'uppercase' }}>Step {currentStep} of {TOTAL_STEPS}</Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' }} />
              <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_700Bold', fontSize: 10, textTransform: 'uppercase' }}>
                {currentStep === 1 ? 'Identity' : currentStep === 2 ? 'Insemination' : currentStep === 3 ? 'Diagnosis' : 'Calving'}
              </Text>
            </View>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Progress System */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= currentStep ? PRIMARY : '#f1f5f9' }} />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
          
          {/* STEP 1: IDENTITY */}
          {currentStep === 1 && (
            <View>
              <View style={{ alignItems: 'center', marginBottom: 32 }}>
                <TouchableOpacity onPress={pickImage} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#cbd5e1', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Camera size={32} color="#cbd5e1" />
                      <Text style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'Outfit_700Bold', marginTop: 4 }}>PHOTO</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <SelectField 
                label="Farmer / Owner" 
                value={formData.farmer} 
                placeholder="Assign to a farmer" 
                onPress={() => openModal('farmer', 'Select Farmer', farmers)} 
              />

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <InputField label="Age (Years)" value={formData.ageYears} onChangeText={(t: string) => setFormData({...formData, ageYears: t})} placeholder="e.g. 2" keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField label="Months" value={formData.ageMonths} onChangeText={(t: string) => setFormData({...formData, ageMonths: t})} placeholder="e.g. 6" keyboardType="numeric" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <InputField label="Animal ID" value={formData.animalId} onChangeText={(t: string) => setFormData({...formData, animalId: t})} placeholder="ID-001" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField label="Ear Tag" value={formData.earTag} onChangeText={(t: string) => setFormData({...formData, earTag: t})} placeholder="Tag-XYZ" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <SelectField label="Species" value={formData.species} placeholder="Select" onPress={() => openModal('species', 'Select Species', SPECIES_OPTIONS)} />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField
                    label="Breed"
                    value={formData.breed}
                    placeholder="Select"
                    onPress={() => {
                      if (!formData.species) {
                        toast.error("Please select a species first.");
                        return;
                      }
                      openModal('breed', 'Select Breed', BREED_OPTIONS_BY_SPECIES[formData.species] || []);
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <InputField label="Color" value={formData.color} onChangeText={(t: string) => setFormData({...formData, color: t})} placeholder="e.g. Brown" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField label="Brand" value={formData.brand} onChangeText={(t: string) => setFormData({...formData, brand: t})} placeholder="(Optional)" />
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: INSEMINATION */}
          {currentStep === 2 && (
            <View>
              <DateSelector 
                label="Date of AI" 
                value={formData.aiDate} 
                onPress={() => openDatePicker('aiDate')}
                onSetToday={() => setDateToToday('aiDate')}
                onSetNotYet={() => setFormData({...formData, aiDate: 'Not Yet'})}
              />

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <SelectField label="No. of AI" value={formData.noOfAI} placeholder="Attempt" onPress={() => openModal('noOfAI', 'AI Attempt', AI_ATTEMPTS)} />
                </View>
                <View style={{ flex: 2 }}>
                  <SelectField label="Estrus Type" value={formData.estrusType} placeholder="Select Type" onPress={() => openModal('estrusType', 'Estrus Type', ESTRUS_OPTIONS)} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <InputField label="Sire Breed" value={formData.sireBreed} onChangeText={(t: string) => setFormData({...formData, sireBreed: t})} placeholder="e.g. PC Cross" />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField label="Sire Code" value={formData.sireCode} onChangeText={(t: string) => setFormData({...formData, sireCode: t})} placeholder="Code" />
                </View>
              </View>
            </View>
          )}

          {/* STEP 3: PREGNANCY */}
          {currentStep === 3 && (
            <View>
              <DateSelector 
                label="PD Date" 
                value={formData.pdDate} 
                onPress={() => openDatePicker('pdDate')}
                onSetToday={() => setDateToToday('pdDate')}
                onSetNotYet={() => setFormData({...formData, pdDate: 'Not Yet'})}
              />
              <SelectField label="Diagnosis Result" value={formData.pdResult} placeholder="Select Result" onPress={() => openModal('pdResult', 'PD Result', PD_RESULTS)} />
              
              <View style={{ backgroundColor: '#eff6ff', padding: 16, borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <Info size={20} color="#3b82f6" />
                <Text style={{ flex: 1, color: '#1e40af', fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18 }}>
                  PD is typically performed 60-90 days after insemination for accurate results.
                </Text>
              </View>
            </View>
          )}

          {/* STEP 4: CALVING */}
          {currentStep === 4 && (
            <View>
              <DateSelector 
                label="Calving Date" 
                value={formData.calfDate} 
                onPress={() => openDatePicker('calfDate')}
                onSetToday={() => setDateToToday('calfDate')}
                onSetNotYet={() => setFormData({...formData, calfDate: 'Not Yet'})}
              />

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <InputField label="Calf ID" value={formData.calfId} onChangeText={(t: string) => setFormData({...formData, calfId: t})} placeholder="ID-2026" />
                </View>
                <View style={{ flex: 1 }}>
                  <SelectField label="Sex" value={formData.calfSex} placeholder="Select" onPress={() => openModal('calfSex', 'Calf Sex', CALF_SEX)} />
                </View>
              </View>

              <SelectField label="Calving Ease" value={formData.calvingEase} placeholder="Condition" onPress={() => openModal('calvingEase', 'Calving Ease', CALVING_EASE)} />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Navigation Footer */}
      <View style={{ paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 24, paddingTop: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
        {currentStep < TOTAL_STEPS ? (
          <TouchableOpacity onPress={handleNext} activeOpacity={0.8} style={{ backgroundColor: PRIMARY, paddingVertical: 18, borderRadius: 24, alignItems: 'center', shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 18 }}>Continue</Text>
              <ArrowRight size={20} color="#fff" strokeWidth={3} />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} disabled={mutation.isPending} activeOpacity={0.8} style={{ backgroundColor: PRIMARY, paddingVertical: 18, borderRadius: 24, alignItems: 'center', shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Check size={22} color="#fff" strokeWidth={3} />
                <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 18 }}>Save Record</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Standard Modals */}
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
  );
}

const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ color: '#64748b', fontFamily: 'Outfit_700Bold', fontSize: 12, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }}>{label}</Text>
    <TextInput 
      style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, fontFamily: 'Outfit_600SemiBold', fontSize: 15, borderWidth: 1, borderColor: '#e2e8f0', color: '#1e293b' }}
      value={value} 
      onChangeText={onChangeText} 
      placeholder={placeholder} 
      placeholderTextColor="#cbd5e1"
      keyboardType={keyboardType}
    />
  </View>
);

const SelectField = ({ label, value, placeholder, onPress }: any) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ color: '#64748b', fontFamily: 'Outfit_700Bold', fontSize: 12, marginBottom: 8, marginLeft: 4, textTransform: 'uppercase' }}>{label}</Text>
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' }}>
      <Text style={{ color: value ? '#1e293b' : '#cbd5e1', fontFamily: 'Outfit_600SemiBold', fontSize: 15 }}>{value || placeholder}</Text>
      <ChevronDown size={20} color="#94a3b8" />
    </TouchableOpacity>
  </View>
);

const DateSelector = ({ label, value, onPress, onSetToday, onSetNotYet }: any) => (
  <View style={{ marginBottom: 24 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingHorizontal: 4 }}>
      <Text style={{ color: '#64748b', fontFamily: 'Outfit_700Bold', fontSize: 12, textTransform: 'uppercase' }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {onSetNotYet && (
          <TouchableOpacity onPress={onSetNotYet}>
            <Text style={{ color: '#94a3b8', fontFamily: 'Outfit_800ExtraBold', fontSize: 10, textTransform: 'uppercase' }}>NOT YET</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onSetToday}>
          <Text style={{ color: PRIMARY, fontFamily: 'Outfit_800ExtraBold', fontSize: 10, textTransform: 'uppercase' }}>TODAY</Text>
        </TouchableOpacity>
      </View>
    </View>
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: PRIMARY, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: value ? '#1e293b' : '#cbd5e1', fontFamily: 'Outfit_600SemiBold', fontSize: 15 }}>{value || "Select Date"}</Text>
      <Calendar size={20} color={PRIMARY} />
    </TouchableOpacity>
  </View>
);

const SelectionModal = ({ visible, title, options, onClose, onSelect }: any) => (
  <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '70%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: '#1e293b' }}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
        <FlatList 
          data={options} 
          keyExtractor={(item) => item} 
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onSelect(item)} activeOpacity={0.6} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#334155', fontFamily: 'Outfit_600SemiBold', fontSize: 16 }}>{item}</Text>
              <ChevronRight size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )} 
        />
      </View>
    </View>
  </Modal>
);

