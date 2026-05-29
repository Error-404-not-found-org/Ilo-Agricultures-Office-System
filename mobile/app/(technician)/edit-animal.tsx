import { View, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApi } from '@/lib/api';
import { useAuth } from '@clerk/clerk-expo';
import SafeScreen from '@/components/safeScreen';
import { ArrowLeft, ChevronDown, Calendar, Check, X, Camera, Plus, Trash2, ChevronRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { toast } from 'sonner-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';

// --- OPTIONS ---
const SPECIES_OPTIONS = ['Beef Cattle', 'Dairy Cattle', 'Cattle', 'Carabao', 'Goat', 'Swine'];
const BREED_OPTIONS = ['Native', 'Brahman', 'Holstein Sahiwal (HS)', 'PC Cross', 'Purebred'];
const AI_ATTEMPTS = ['1', '2', '3', '4', '5+'];
const ESTRUS_OPTIONS = ['Natural', 'Synchronized'];
const PD_RESULTS = ['Pregnant', 'Empty'];
const CALVING_EASE = ['Normal', 'Natural', 'Difficult', 'Abortion', 'Stillbirth', 'Cesarean'];
const CALF_SEX = ['Male', 'Female'];

type TabType = 'Identity' | 'Insemination' | 'Pregnancy' | 'Calving';

export default function EditAnimalWizard() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const api = useApi();
  const { colors, isDark, themeStyle } = useTheme();
  
  const [activeTab, setActiveTab] = useState<TabType>('Identity');
  const { isLoaded, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Identity
    farmer: '',
    ageYears: '',
    ageMonths: '', 
    animalId: '',
    earTag: '',
    brand: '',
    species: '',
    breed: '',
    color: '',
    
    // Insemination
    aiDate: 'Not Yet',
    noOfAI: '1', 
    estrusType: '',
    sireBreed: '',
    sireCode: '',

    // Pregnancy Check
    pdDate: 'Not Yet',
    pdResult: '',

    // Calving Drop
    calfDate: 'Not Yet',
    calfId: '',
    calfSex: '',
    calvingEase: '',
  });

  // --- PRE-FILL DATA HOOK ---
  useEffect(() => {
    if (!id || !isLoaded || !isSignedIn) return;

    const loadAnimalData = async () => {
        try {
            const res = await api.get(`/animals/${id}`);
            const data = res.data;

            let yrs = ''; let mos = '';
            if (data.birthDate) {
                const birth = new Date(data.birthDate);
                const now = new Date();
                let diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                if (diffMonths < 0) diffMonths = 0;
                yrs = Math.floor(diffMonths / 12).toString();
                mos = (diffMonths % 12).toString();
            }

            const latestAI = data.inseminations?.[0] || {};
            const latestCalving = data.calvings?.[0] || {};

            setFormData({
                farmer: data.farmerId?.name || 'Unassigned',
                ageYears: yrs,
                ageMonths: mos,
                animalId: data.animalId || '',
                earTag: data.earTag || '',
                brand: data.brand || '',
                species: data.species || '',
                breed: data.breed || '',
                color: data.color || '',
                
                aiDate: latestAI.dateOfAI ? new Date(latestAI.dateOfAI).toLocaleDateString() : 'Not Yet',
                noOfAI: latestAI.attemptNumber ? latestAI.attemptNumber.toString() : '1',
                estrusType: latestAI.estrusType || '',
                sireBreed: latestAI.sireBreed || '',
                sireCode: latestAI.sireCode || '',

                pdDate: latestAI.dateOfPD ? new Date(latestAI.dateOfPD).toLocaleDateString() : 'Not Yet',
                pdResult: latestAI.pregnancyStatus !== 'Pending' ? latestAI.pregnancyStatus : '',

                calfDate: latestCalving.date ? new Date(latestCalving.date).toLocaleDateString() : 'Not Yet',
                calfId: latestCalving.calfId || '',
                calfSex: latestCalving.calfSex || '',
                calvingEase: latestCalving.calvingEase || ''
            });

            if (data.imageUrl) setImageUri(data.imageUrl);

        } catch (error) {
            console.error("Failed to preload animal:", error);
            toast.error("Could not fetch the medical history for this animal.");
        } finally {
            setFetching(false);
        }
    };

    loadAnimalData();
  }, [id, isLoaded, isSignedIn, api]);


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

  const handleNativeDateChange = (event: any, selectedDate: any) => {
    setDateModalVisible(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({...formData, [activeField]: selectedDate.toLocaleDateString()});
    }
  };

  const setDateToToday = (field: string) => {
    const today = new Date().toLocaleDateString();
    setFormData({...formData, [field]: today});
  };

  const setDateToNotYet = (field: string) => {
    setFormData({...formData, [field]: 'Not Yet'});
  };

  const handleSave = async () => {
    if (!formData.species || !formData.breed) return toast.error("Please specify a species and breed.");

    const today = new Date();
    const yrs = parseInt(formData.ageYears || '0');
    const mos = parseInt(formData.ageMonths || '0');
    today.setFullYear(today.getFullYear() - yrs);
    today.setMonth(today.getMonth() - mos);

    const finalPayload = {
      animalId: formData.animalId,
      earTag: formData.earTag,
      brand: formData.brand,
      species: formData.species,
      breed: formData.breed,
      color: formData.color,
      imageUrl: imageBase64 || imageUri, 
      birthDate: today.toISOString(),
      
      aiDate: formData.aiDate,
      noOfAI: formData.noOfAI,
      estrusType: formData.estrusType,
      sireBreed: formData.sireBreed,
      sireCode: formData.sireCode,

      pdDate: formData.pdDate,
      pdResult: formData.pdResult,
      
      calfDate: formData.calfDate,
      calfId: formData.calfId,
      calfSex: formData.calfSex,
      calvingEase: formData.calvingEase
    };

    try {
      setLoading(true);
      await api.put(`/animals/wizard/${id}`, finalPayload);
      toast.success("Animal records updated!", { duration: 4000, position: 'top-center' });
      router.back();
    } catch (error: any) {
      console.error("Failed to update animal:", error);
      toast.error(error.response?.data?.message || "Error updating animal records.", { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  const getPickerDate = () => {
      // @ts-ignore
      const str = formData[activeField];
      if (str && str !== 'Not Yet') return new Date(str);
      return new Date();
  };

  if (fetching) {
      return (
          <View className="flex-1 bg-white dark:bg-slate-950 items-center justify-center">
              <ActivityIndicator size="large" color={isDark ? "#10b981" : "#00643B"} />
          </View>
      );
  }

  return (
    <SafeScreen>
      <View style={[{ flex: 1, backgroundColor: colors.background }]} className="px-5"> 
        
        {/* --- HEADER --- */}
        <View className="flex-row items-center justify-between mb-4 mt-2">
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={{ backgroundColor: colors.card, borderColor: colors.border }}
              className="p-2 rounded-full border active:opacity-75"
            >
                <ArrowLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text variant="bold" size={16} color="primary">Edit Records</Text>
            <View className="w-10" /> 
        </View>

        {/* --- CATEGORY TABS --- */}
        <View className="mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 20 }}>
            {([
              { key: 'Identity', label: 'Identity', icon: 'card-account-details-outline' },
              { key: 'Insemination', label: 'Breeding', icon: 'needle' },
              { key: 'Pregnancy', label: 'Preg-Check', icon: 'heart-pulse' },
              { key: 'Calving', label: 'Calving', icon: 'baby-carriage' }
            ] as { key: TabType, label: string, icon: string }[]).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={{
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.border
                  }}
                  className="px-4 py-3 rounded-xl border flex-row items-center gap-2 active:opacity-75"
                >
                  <MaterialCommunityIcons 
                    name={tab.icon as any} 
                    size={16} 
                    color={isActive ? '#fff' : colors.textSecondary} 
                  />
                  <Text 
                    variant="bold" 
                    size={12} 
                    style={{ color: isActive ? '#fff' : colors.textSecondary }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            
            {/* --- TAB 1: IDENTITY --- */}
            {activeTab === 'Identity' && (
                <Card style={{ padding: 20 }} className="mt-2">
                    <Text variant="black" size={18} color="primary" className="mb-1">Animal Identity</Text>
                    <Text variant="medium" size={13} color="muted" className="mb-5">Manage tags and registration details.</Text>
                    
                    <View className="items-center mb-6 mt-2">
                        <TouchableOpacity 
                          onPress={pickImage} 
                          style={{ backgroundColor: colors.card, borderColor: colors.border }}
                          className="w-24 h-24 rounded-full items-center justify-center border border-dashed overflow-hidden active:opacity-75"
                        >
                            {imageUri ? (
                                <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <>
                                  <Camera size={24} color={colors.textMuted} />
                                  <Text variant="bold" size={9} color="muted" className="text-center mt-1">Photo</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <InputField label="Est. Age (Years)" value={formData.ageYears} onChangeText={(t: string) => setFormData({...formData, ageYears: t})} placeholder="0" keyboardType="numeric" />
                        </View>
                        <View className="flex-1">
                            <InputField label="Months" value={formData.ageMonths} onChangeText={(t: string) => setFormData({...formData, ageMonths: t})} placeholder="0" keyboardType="numeric" />
                        </View>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1"><InputField label="Animal ID" value={formData.animalId} onChangeText={(t: string) => setFormData({...formData, animalId: t})} placeholder="e.g. ID-001" /></View>
                        <View className="flex-1"><InputField label="Ear Tag" value={formData.earTag} onChangeText={(t: string) => setFormData({...formData, earTag: t})} placeholder="e.g. Tag-123" /></View>
                    </View>

                    <View className="flex-row gap-3 mt-1">
                        <View className="flex-1"><SelectField label="Species *" value={formData.species} placeholder="Select" onPress={() => openModal('species', 'Select Species', SPECIES_OPTIONS)} /></View>
                        <View className="flex-1"><SelectField label="Breed *" value={formData.breed} placeholder="Select" onPress={() => openModal('breed', 'Select Breed', BREED_OPTIONS)} /></View>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1"><InputField label="Color" value={formData.color} onChangeText={(t: string) => setFormData({...formData, color: t})} placeholder="e.g. Black" /></View>
                        <View className="flex-1"><InputField label="Brand" value={formData.brand} onChangeText={(t: string) => setFormData({...formData, brand: t})} placeholder="(Optional)" /></View>
                    </View>
                </Card>
            )}

            {/* --- TAB 2: INSEMINATION --- */}
            {activeTab === 'Insemination' && (
                <View className="mt-2">
                    {formData.aiDate === 'Not Yet' ? (
                        <PlaceholderCard 
                          title="No Insemination Record"
                          description="This animal does not currently have any active artificial insemination details attached."
                          buttonText="Add Insemination Details"
                          onAdd={() => setDateToToday('aiDate')}
                        />
                    ) : (
                        <Card style={{ padding: 20 }}>
                            <View className="flex-row justify-between items-center mb-4">
                              <Text variant="black" size={18} color="primary">Insemination Record</Text>
                              <TouchableOpacity 
                                onPress={() => setDateToNotYet('aiDate')}
                                className="flex-row items-center gap-1 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/50"
                              >
                                <Trash2 size={12} color="#ef4444" />
                                <Text variant="bold" size={9} style={{ color: '#ef4444' }}>Clear</Text>
                              </TouchableOpacity>
                            </View>

                            <DateSelector label="Date of AI" value={formData.aiDate} onPress={() => openDatePicker('aiDate')} onSetToday={() => setDateToToday('aiDate')} />

                            <View className="flex-row gap-3">
                                 <View className="w-1/2">
                                    <SelectField label="No. of AI" value={formData.noOfAI} placeholder="Select" onPress={() => openModal('noOfAI', 'Select AI Attempt', AI_ATTEMPTS)} />
                                 </View>
                            </View>

                            <SelectField label="Estrus Type" value={formData.estrusType} placeholder="Natural / Synchronized" onPress={() => openModal('estrusType', 'Estrus Type', ESTRUS_OPTIONS)} />

                            <View className="flex-row gap-3 mt-1">
                                <View className="flex-1"><InputField label="Sire Breed" value={formData.sireBreed} onChangeText={(t: string) => setFormData({...formData, sireBreed: t})} placeholder="e.g. Brahman" /></View>
                                <View className="flex-1"><InputField label="Sire Code" value={formData.sireCode} onChangeText={(t: string) => setFormData({...formData, sireCode: t})} placeholder="Code" /></View>
                            </View>
                        </Card>
                    )}
                </View>
            )}

            {/* --- TAB 3: PREGNANCY --- */}
            {activeTab === 'Pregnancy' && (
                <View className="mt-2">
                    {formData.pdDate === 'Not Yet' ? (
                        <PlaceholderCard 
                          title="No Pregnancy Diagnosis"
                          description="No active pregnancy verification records exist for this animal."
                          buttonText="Add Pregnancy Check"
                          onAdd={() => setDateToToday('pdDate')}
                        />
                    ) : (
                        <Card style={{ padding: 20 }}>
                            <View className="flex-row justify-between items-center mb-4">
                              <Text variant="black" size={18} color="primary">Pregnancy Diagnosis</Text>
                              <TouchableOpacity 
                                onPress={() => setDateToNotYet('pdDate')}
                                className="flex-row items-center gap-1 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/50"
                              >
                                <Trash2 size={12} color="#ef4444" />
                                <Text variant="bold" size={9} style={{ color: '#ef4444' }}>Clear</Text>
                              </TouchableOpacity>
                            </View>

                            <DateSelector label="PD Date" value={formData.pdDate} onPress={() => openDatePicker('pdDate')} onSetToday={() => setDateToToday('pdDate')} />
                            <SelectField label="Result" value={formData.pdResult} placeholder="Select Result" onPress={() => openModal('pdResult', 'PD Result', PD_RESULTS)} />
                        </Card>
                    )}
                </View>
            )}

            {/* --- TAB 4: CALVING --- */}
            {activeTab === 'Calving' && (
                <View className="mt-2">
                    {formData.calfDate === 'Not Yet' ? (
                        <PlaceholderCard 
                          title="No Calving Drop History"
                          description="There are currently no calving records associated with this animal."
                          buttonText="Add Calving Data"
                          onAdd={() => setDateToToday('calfDate')}
                        />
                    ) : (
                        <Card style={{ padding: 20 }}>
                            <View className="flex-row justify-between items-center mb-4">
                              <Text variant="black" size={18} color="primary">Calving Information</Text>
                              <TouchableOpacity 
                                onPress={() => setDateToNotYet('calfDate')}
                                className="flex-row items-center gap-1 bg-red-50 dark:bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/50"
                              >
                                <Trash2 size={12} color="#ef4444" />
                                <Text variant="bold" size={9} style={{ color: '#ef4444' }}>Clear</Text>
                              </TouchableOpacity>
                            </View>

                            <DateSelector label="Calving Date" value={formData.calfDate} onPress={() => openDatePicker('calfDate')} onSetToday={() => setDateToToday('calfDate')} />

                            <View className="flex-row gap-3">
                                <View className="flex-1"><InputField label="Calf ID" value={formData.calfId} onChangeText={(t: string) => setFormData({...formData, calfId: t})} placeholder="New ID" /></View>
                                <View className="flex-1"><SelectField label="Sex" value={formData.calfSex} placeholder="M/F" onPress={() => openModal('calfSex', 'Calf Sex', CALF_SEX)} /></View>
                            </View>

                            <SelectField label="Calving Ease" value={formData.calvingEase} placeholder="Select Condition" onPress={() => openModal('calvingEase', 'Calving Ease', CALVING_EASE)} />
                        </Card>
                    )}
                </View>
            )}

          </ScrollView>
        </KeyboardAvoidingView>

        {/* --- BOTTOM SAVE ACTION --- */}
        <View className="pt-4 pb-28">
            <TouchableOpacity 
                onPress={handleSave} 
                disabled={loading} 
                style={{ 
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.1,
                  shadowRadius: 8
                }}
                className="rounded-full py-4 items-center flex-row justify-center gap-2 shadow-lg"
            >
                {loading ? (
                   <ActivityIndicator color="white" size="small" />
                ) : (
                   <>
                     <Check size={18} color="white" />
                     <Text variant="bold" size={15} style={{ color: '#fff' }}>Save All Records</Text>
                   </>
                )}
            </TouchableOpacity>
        </View>

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

// Input component using Theme variables
const InputField = ({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) => {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
        <Text variant="bold" size={10} color="secondary" className="uppercase tracking-wider mb-1.5 ml-1">{label}</Text>
        <TextInput 
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: 'Outfit_600SemiBold'
            }}
            className="border rounded-xl px-4 py-3.5 text-sm" 
            value={value} 
            onChangeText={onChangeText} 
            placeholder={placeholder} 
            placeholderTextColor={colors.textMuted} 
            keyboardType={keyboardType} 
        />
    </View>
  );
};
 
// Select field component using Theme variables
const SelectField = ({ label, value, placeholder, onPress }: any) => {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
        <Text variant="bold" size={10} color="secondary" className="uppercase tracking-wider mb-1.5 ml-1">{label}</Text>
        <TouchableOpacity 
          onPress={onPress} 
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
          className="flex-row items-center justify-between border rounded-xl px-4 py-3.5"
        >
            <Text 
              variant="semibold" 
              size={14} 
              style={{ color: value ? colors.textPrimary : colors.textMuted }}
            >
              {value || placeholder}
            </Text>
            <ChevronDown size={16} color={colors.textMuted} />
        </TouchableOpacity>
    </View>
  );
};
 
// Date Selector field using Theme variables
const DateSelector = ({ label, value, onPress, onSetToday }: any) => {
  const { colors } = useTheme();
  return (
    <View className="mb-4">
        <View className="flex-row justify-between items-center mb-1.5 ml-1">
            <Text variant="bold" size={10} color="secondary" className="uppercase tracking-wider">{label}</Text>
            <TouchableOpacity onPress={onSetToday} className="active:opacity-50">
               <Text variant="bold" size={10} style={{ color: colors.primary }}>SET TO TODAY</Text>
            </TouchableOpacity>
        </View>
        <TouchableOpacity 
          onPress={onPress} 
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
          className="border rounded-xl px-4 py-3.5 flex-row justify-between items-center"
        >
            <Text 
              variant="semibold" 
              size={14} 
              style={{ color: value ? colors.textPrimary : colors.textMuted }}
            >
              {value || "Select Date"}
            </Text>
            <Calendar size={16} color={colors.textMuted} />
        </TouchableOpacity>
    </View>
  );
};
 
// Selection list modal using Theme variables
const SelectionModal = ({ visible, title, options, onClose, onSelect }: any) => {
  const { colors } = useTheme();
  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
        <View className="flex-1 bg-black/50 justify-end">
            <View style={{ backgroundColor: colors.background }} className="rounded-t-[32px] p-6 pb-10 max-h-[70%]">
                <View className="flex-row justify-between items-center mb-4">
                    <Text variant="black" size={18} color="primary">{title}</Text>
                    <TouchableOpacity 
                      onPress={onClose} 
                      style={{ backgroundColor: colors.card }}
                      className="p-1 rounded-full"
                    >
                      <X size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                </View>
                <FlatList 
                  data={options} 
                  keyExtractor={(item) => item} 
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                        onPress={() => onSelect(item)} 
                        style={{ borderBottomColor: colors.border }}
                        className="py-4 border-b active:opacity-50"
                      >
                          <Text variant="bold" size={16} color="primary">{item}</Text>
                      </TouchableOpacity>
                  )} 
                />
            </View>
        </View>
    </Modal>
  );
};

// Section Placeholder card using Theme variables
const PlaceholderCard = ({ title, description, buttonText, onAdd }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <Card style={{ padding: 32, alignItems: 'center' }}>
      <View 
        style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4' }} 
        className="w-16 h-16 rounded-full items-center justify-center mb-4"
      >
        <MaterialCommunityIcons name="plus-circle-outline" size={32} color={colors.primary} />
      </View>
      <Text variant="bold" size={18} color="primary" className="mb-2 text-center">{title}</Text>
      <Text variant="medium" size={13} color="muted" className="text-center px-4 leading-5 mb-6">
        {description}
      </Text>
      <TouchableOpacity
        onPress={onAdd}
        style={{ backgroundColor: colors.primary }}
        className="py-3.5 px-6 rounded-full flex-row items-center gap-2 active:opacity-75 shadow-sm"
      >
        <Plus size={16} color="white" />
        <Text variant="bold" size={13} style={{ color: '#fff' }}>{buttonText}</Text>
      </TouchableOpacity>
    </Card>
  );
}
