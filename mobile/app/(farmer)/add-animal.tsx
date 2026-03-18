import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, Calendar, Check, X, Camera } from 'lucide-react-native';
import React, { useState } from 'react';

// --- OPTIONS ---
const SPECIES_OPTIONS = ['Cow (Beef)', 'Cow (Dairy)', 'Carabao', 'Goat', 'Pig'];
const BREED_OPTIONS = ['Native', 'Brahman', 'Angus', 'Holstein', 'Crossbreed'];
const SEX_OPTIONS = ['Female', 'Male'];
const SOURCE_OPTIONS = ['Born on Farm', 'Purchased', 'Government Grant'];

export default function FarmerAddAnimal() {
  const router = useRouter();
  
  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    name: '',           // e.g. "Bella"
    species: '',
    breed: '',
    sex: '',
    birthDate: '',
    color: '',
    source: '',         // Where did they get it?
    notes: '',
  });

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
    setFormData({...formData, [activeField]: val});
    setModalVisible(false);
  };

  const handleDateSelect = (date: string) => {
    setFormData({...formData, [activeField]: date});
    setDateModalVisible(false);
  };

  const handleSave = () => {
    console.log("FARMER SAVING ANIMAL:", formData);
    router.back();
  };

  const insets = useSafeAreaInsets();

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
            <TouchableOpacity className="self-center bg-gray-100 h-24 w-24 rounded-full items-center justify-center mb-8 border border-gray-200 border-dashed">
                <Camera size={28} color="#9CA3AF" />
                <Text className="text-xs text-gray-400 mt-1">Add Photo</Text>
            </TouchableOpacity>

            {/* --- FORM FIELDS --- */}
            <Text className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Basic Details</Text>

            <InputField 
                label="Animal Name / ID" 
                value={formData.name} 
                onChangeText={(t: string) => setFormData({...formData, name: t})} 
                placeholder="e.g. Bella or #102" 
            />

            <View className="flex-row gap-3">
                <View className="flex-1">
                    <SelectField 
                        label="Species" 
                        value={formData.species} 
                        placeholder="Select" 
                        onPress={() => openModal('species', 'Select Species', SPECIES_OPTIONS)} 
                    />
                </View>
                <View className="flex-1">
                    <SelectField 
                        label="Sex" 
                        value={formData.sex} 
                        placeholder="M/F" 
                        onPress={() => openModal('sex', 'Select Sex', SEX_OPTIONS)} 
                    />
                </View>
            </View>

            <SelectField 
                label="Breed" 
                value={formData.breed} 
                placeholder="Select Breed" 
                onPress={() => openModal('breed', 'Select Breed', BREED_OPTIONS)} 
            />

            <View className="flex-row gap-3">
                <View className="flex-1">
                    <InputField 
                        label="Color / Markings" 
                        value={formData.color} 
                        onChangeText={(t: string) => setFormData({...formData, color: t})} 
                        placeholder="e.g. Black with white spots" 
                    />
                </View>
                <View className="flex-1">
                     <DateSelector 
                        label="Birth Date (Est.)" 
                        value={formData.birthDate} 
                        onPress={() => openDatePicker('birthDate')}
                    />
                </View>
            </View>

            <Text className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 mt-4">History</Text>

            <SelectField 
                label="Source" 
                value={formData.source} 
                placeholder="Where did it come from?" 
                onPress={() => openModal('source', 'Animal Source', SOURCE_OPTIONS)} 
            />

            <View className="mb-3">
                <Text className="text-gray-700 font-medium mb-1 ml-1 text-xs uppercase tracking-wide">Notes (Optional)</Text>
                <TextInput 
                    className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:border-blue-500 h-24" 
                    value={formData.notes} 
                    onChangeText={(t) => setFormData({...formData, notes: t})} 
                    placeholder="Any specific marks, previous sickness, etc." 
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                />
            </View>

            {/* --- SAVE BUTTON --- */}
            <TouchableOpacity 
                onPress={handleSave}
                activeOpacity={0.8}
                className="bg-green-700 rounded-full py-4 items-center mt-6 shadow-lg shadow-green-200 flex-row justify-center gap-2"
            >
                <Check size={20} color="white" />
                <Text className="text-white font-bold text-lg">Add to My Farm</Text>
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