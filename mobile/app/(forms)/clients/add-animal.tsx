import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import SafeScreen from '@/components/safeScreen';
import { ArrowLeft, ChevronDown, Calendar, Check, X, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';

// --- OPTIONS ---
const FARMER_OPTIONS = ['Leo Nabuab', 'Wilhelm Moyong', 'Diego Nim', 'Jaime Navarra', 'Vicente Nanas'];
const ANIMAL_COUNTS = ['1', '2', '3', '4', '5', 'Batch (6+)']; // New Dropdown Options
const SPECIES_OPTIONS = ['Beef', 'Dairy', 'Carabao'];
const BREED_OPTIONS = ['Native', 'Brahman', 'Holstein Sahiwal (HS)', 'PC Cross', 'Purebred'];
const AI_ATTEMPTS = ['1', '2', '3', '4', '5+'];
const ESTRUS_OPTIONS = ['Natural', 'Synchronized'];
const PD_RESULTS = ['Positive', 'Negative', 'Re-heat'];
const CALVING_EASE = ['Normal', 'Difficult', 'Abortion', 'Stillbirth'];
const CALF_SEX = ['Male', 'Female'];

export default function AddAIRecord() {
  const router = useRouter();
  
  // --- WIZARD STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 4;

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    // Step 1: Identity
    farmer: '',
    animalCount: '1', 
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

  const handleDateSelect = (date: string) => {
    setFormData({...formData, [activeField]: date});
    setDateModalVisible(false);
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

  const handleSave = () => {
    console.log("FINAL DATA:", formData);
    router.back();
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
                    
                    <SelectField 
                        label="Farmer / Owner" 
                        value={formData.farmer} 
                        placeholder="Select Farmer" 
                        onPress={() => openModal('farmer', 'Select Farmer', FARMER_OPTIONS)} 
                    />

                    
                    <SelectField 
                        label="No. of Animals" 
                        value={formData.animalCount} 
                        placeholder="1" 
                        onPress={() => openModal('animalCount', 'How many animals?', ANIMAL_COUNTS)} 
                    />

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
                <TouchableOpacity onPress={handleSave} className="bg-blue-600 rounded-full py-3.5 items-center flex-row justify-center gap-2 shadow-lg shadow-blue-200">
                    <Check size={18} color="white" />
                    <Text className="text-white font-bold text-base">Save Record</Text>
                </TouchableOpacity>
            )}
        </View>

        {/* --- MODALS --- */}
        <SelectionModal visible={modalVisible} title={modalTitle} options={modalOptions} onClose={() => setModalVisible(false)} onSelect={handleSelect} />
        <CalendarModal visible={dateModalVisible} onClose={() => setDateModalVisible(false)} onSelect={handleDateSelect} />

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
const DateSelector = ({ label, value, onPress, onSetToday }: any) => (
    <View className="mb-3">
        <View className="flex-row justify-between items-center mb-1 ml-1">
            <Text className="text-gray-700 font-medium text-xs uppercase tracking-wide">{label}</Text>
            <TouchableOpacity onPress={onSetToday} className="active:opacity-50">
                <Text className="text-blue-600 text-[10px] font-bold">SET TO TODAY</Text>
            </TouchableOpacity>
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

// --- CUSTOM CALENDAR MODAL (Simulated for Demo) ---
const CalendarModal = ({ visible, onClose, onSelect }: any) => {
    // Generate simple days for demo (Current Month)
    const days = Array.from({length: 30}, (_, i) => i + 1);
    
    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-center items-center px-6">
                <View className="bg-white w-full rounded-3xl p-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-bold">Select Date</Text>
                        <TouchableOpacity onPress={onClose}><X size={20} color="gray" /></TouchableOpacity>
                    </View>
                    
                    {/* Month Header */}
                    <View className="flex-row justify-between items-center mb-4 bg-gray-50 p-2 rounded-xl">
                        <ChevronLeft size={20} color="gray" />
                        <Text className="font-bold text-gray-800">October 2023</Text>
                        <ChevronRight size={20} color="gray" />
                    </View>

                    {/* Days Grid */}
                    <View className="flex-row flex-wrap gap-2 justify-center">
                        {days.map((d) => (
                            <TouchableOpacity 
                                key={d} 
                                onPress={() => onSelect(`10/${d}/2023`)}
                                className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 active:bg-blue-600 active:text-white"
                            >
                                <Text className="text-gray-700">{d}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    
                    <TouchableOpacity onPress={onClose} className="mt-4 items-center">
                        <Text className="text-gray-500 text-sm">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};