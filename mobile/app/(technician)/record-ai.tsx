import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Save, ChevronDown, Dog, X } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CATTLE_BREEDS, CATTLE_SPECIES, OTON_BARANGAYS } from '@/lib/constants';
import { getSireCodeByBreed } from '@/lib/sireRegistry';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RecordAIScreen() {
  const router = useRouter();
  const api = useApi();
  
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<any>(null);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  
  const [sireBreed, setSireBreed] = useState('');
  const [sireCode, setSireCode] = useState(`SIRE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
  const [estrus, setEstrus] = useState('Natural');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'done' | 'pending'>('done');
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [showSpeciesModal, setShowSpeciesModal] = useState(false);
  const [showQuickBreedModal, setShowQuickBreedModal] = useState(false);

  // Mission Date & Time Picker States
  const [inseminationDate, setInseminationDate] = useState(new Date());
  const [inseminationTime, setInseminationTime] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const getFormattedDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getFormattedTime = (date: Date) => {
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setInseminationDate(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setInseminationTime(selectedTime);
    }
  };

  // Quick Registration State
  const [isNewFarmer, setIsNewFarmer] = useState(false);
  const [newFarmer, setNewFarmer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    barangay: '',
    city: 'Oton',
  });
  const [newAnimal, setNewAnimal] = useState({
    animalId: '',
    earTag: '',
    species: CATTLE_SPECIES[0],
    breed: '',
    color: '',
  });

  const [showBrgyModal, setShowBrgyModal] = useState(false);
  const [searchBrgy, setSearchBrgy] = useState('');

  const filteredBarangays = OTON_BARANGAYS.filter(b => 
    b.toLowerCase().includes(searchBrgy.toLowerCase())
  );

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const res = await api.get('/user?role=farmer');
        setFarmers(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchFarmers();
  }, [api]);

  const handleFarmerSelect = async (farmer: any) => {
    setSelectedFarmer(farmer);
    setIsNewFarmer(false);
    setShowFarmerModal(false);
    setSelectedAnimal(null);
    setLoadingAnimals(true);
    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      // Defensive parsing for standardized response
      const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setAnimals(list);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load farmer animals');
    } finally {
      setLoadingAnimals(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (isNewFarmer) {
      if (!newFarmer.firstName || !newFarmer.lastName || !newFarmer.phone || !newFarmer.barangay || (!newAnimal.animalId && !newAnimal.earTag) || !newAnimal.breed) {
        toast.error('Please fill in both farmer and animal details.');
        return;
      }
    } else {
      if (!selectedFarmer) {
        toast.error('Please select a farmer.');
        return;
      }
      if (!selectedAnimal && !newAnimal.animalId && !newAnimal.earTag) {
        toast.error('Please select an animal or register a new one.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = isNewFarmer ? {
         firstName: newFarmer.firstName,
         lastName: newFarmer.lastName,
         phoneNumber: newFarmer.phone,
         email: newFarmer.email || undefined,
         address: {
           barangay: newFarmer.barangay,
           city: newFarmer.city
         },
         animalDetails: newAnimal,
         inseminationDetails: {
           sireBreed,
           sireCode,
           estrus,
           notes,
           status,
           inseminationDate: getFormattedDate(inseminationDate),
           time: getFormattedTime(inseminationTime)
         }
      } : {
         farmerId: selectedFarmer._id,
         animalId: selectedAnimal?._id,
         animalDetails: !selectedAnimal && (newAnimal.animalId || newAnimal.earTag) ? newAnimal : null,
         inseminationDetails: {
           sireBreed,
           sireCode,
           estrus,
           notes,
           status,
           inseminationDate: getFormattedDate(inseminationDate),
           time: getFormattedTime(inseminationTime)
         }
      };

      await api.post('/technician/walk-in-insemination', payload);
      toast.success('AI Record saved successfully');
      router.back();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const getAddressStr = (addr: any) => {
      if (!addr) return 'No address provided';
      if (typeof addr === 'string') return addr;
      return `${addr.street || ''} ${addr.barangay || ''} ${addr.city || ''}`.trim() || 'No address provided';
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <View className="flex-row items-center px-6 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-50 rounded-full">
          <ArrowLeft size={20} color="#1e2937" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Outfit_900Black', fontSize: 20, color: '#1e293b' }}>Record AI</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* FARMER SELECTION / REGISTRATION */}
        <View className="flex-row justify-between items-center mb-3 ml-1">
          <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest">Farmer Selection</Text>
          <TouchableOpacity 
            onPress={() => {
              setIsNewFarmer(!isNewFarmer);
              if (!isNewFarmer) setSelectedFarmer(null);
            }}
          >
            <Text className="text-[#00643B] font-outfit-bold text-[10px] uppercase tracking-wider">
              {isNewFarmer ? '← Back to List' : '+ Register New'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isNewFarmer ? (
          <TouchableOpacity 
             onPress={() => setShowFarmerModal(true)} 
             className="bg-white border border-slate-100 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
          >
             <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center mr-3">
                   <User size={20} color="#00643B" />
                </View>
                <View className="flex-1">
                   <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedFarmer ? 'text-slate-800' : 'text-slate-300'}`}>
                      {selectedFarmer ? selectedFarmer.name : 'Select Farmer...'}
                   </Text>
                </View>
             </View>
             <ChevronDown size={20} color="#94a3b8" />
          </TouchableOpacity>
        ) : (
          <View className="bg-white border border-emerald-100 rounded-[32px] p-6 mb-8 shadow-sm">
            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-emerald-900 text-sm mb-4">Quick Farmer Registration</Text>
            <View className="gap-y-4">
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">First Name</Text>
                    <TextInput
                      className="bg-slate-55 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium bg-slate-50"
                      placeholder="Juan"
                      value={newFarmer.firstName}
                      onChangeText={(v) => setNewFarmer({...newFarmer, firstName: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Last Name</Text>
                    <TextInput
                      className="bg-slate-55 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium bg-slate-50"
                      placeholder="Dela Cruz"
                      value={newFarmer.lastName}
                      onChangeText={(v) => setNewFarmer({...newFarmer, lastName: v})}
                    />
                  </View>
               </View>
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Email (Optional)</Text>
                    <TextInput
                      className="bg-slate-55 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium bg-slate-50"
                      placeholder="juan@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={newFarmer.email}
                      onChangeText={(v) => setNewFarmer({...newFarmer, email: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Contact Number</Text>
                    <TextInput
                      className="bg-slate-55 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium bg-slate-50"
                      placeholder="0912 345..."
                      keyboardType="phone-pad"
                      value={newFarmer.phone}
                      onChangeText={(v) => setNewFarmer({...newFarmer, phone: v})}
                    />
                  </View>
               </View>
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Barangay</Text>
                    <TouchableOpacity
                      onPress={() => setShowBrgyModal(true)}
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                      <Text className={`font-outfit-medium ${newFarmer.barangay ? 'text-slate-800' : 'text-slate-400'}`}>
                        {newFarmer.barangay || 'Select...'}
                      </Text>
                      <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Municipality</Text>
                    <TextInput
                      className="bg-slate-100 border border-slate-100 rounded-xl p-3 text-slate-400 font-outfit-medium"
                      value="OTON"
                      editable={false}
                    />
                  </View>
               </View>
            </View>

            <View style={{ height: 1, backgroundColor: '#f1f5f9', marginVertical: 20 }} />

            <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-emerald-900 text-sm mb-4">Quick Animal Registration</Text>
            <View className="gap-y-4">
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Animal ID</Text>
                    <TextInput
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="e.g. ANM-001"
                      value={newAnimal.animalId}
                      onChangeText={(v) => setNewAnimal({...newAnimal, animalId: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Ear Tag</Text>
                    <TextInput
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="104"
                      value={newAnimal.earTag}
                      onChangeText={(v) => setNewAnimal({...newAnimal, earTag: v})}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Species</Text>
                    <TouchableOpacity 
                        onPress={() => setShowSpeciesModal(true)}
                        className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                        <Text className="text-slate-800 font-outfit-medium">{newAnimal.species}</Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
               </View>
               <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Breed</Text>
                    <TouchableOpacity 
                        onPress={() => setShowQuickBreedModal(true)}
                        className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex-row justify-between items-center"
                    >
                        <Text className={`font-outfit-medium ${newAnimal.breed ? 'text-slate-800' : 'text-slate-400'}`}>
                            {newAnimal.breed || 'Select...'}
                        </Text>
                        <ChevronDown size={14} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Color</Text>
                    <TextInput
                      className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                      placeholder="White"
                      value={newAnimal.color}
                      onChangeText={(v) => setNewAnimal({...newAnimal, color: v})}
                    />
                  </View>
               </View>
            </View>
          </View>
        )}

        {/* ANIMAL SELECTION OR ADD NEW */}
        {!isNewFarmer && selectedFarmer && (
            <View className="mb-8">
              <View className="flex-row justify-between items-center mb-3 ml-1">
                <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest">Select Animal</Text>
                <TouchableOpacity onPress={() => {
                   if (newAnimal.animalId) {
                      setNewAnimal({ animalId: '', earTag: '', species: CATTLE_SPECIES[0], breed: '', color: '' });
                      setSelectedAnimal(null);
                   } else {
                      setSelectedAnimal(null);
                      // Clear and show registration fields below
                   }
                }}>
                    <Text className="text-emerald-600 font-outfit-bold text-[10px] uppercase tracking-wider">
                        {newAnimal.animalId ? '← Back to Selection' : '+ Register New for this Farmer'}
                    </Text>
                </TouchableOpacity>
              </View>

              {newAnimal.animalId || !selectedAnimal && !animals.length && !loadingAnimals ? (
                 <View className="bg-emerald-50/30 border border-dashed border-emerald-200 rounded-[32px] p-6">
                    <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-emerald-900 text-sm mb-4">On-the-fly Animal Registration</Text>
                    <View className="gap-y-4">
                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Animal ID</Text>
                                <TextInput
                                    className="bg-white border border-emerald-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                                    placeholder="e.g. ID-123"
                                    value={newAnimal.animalId}
                                    onChangeText={(v) => setNewAnimal({...newAnimal, animalId: v})}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Ear Tag</Text>
                                <TextInput
                                    className="bg-white border border-emerald-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                                    placeholder="104"
                                    value={newAnimal.earTag}
                                    onChangeText={(v) => setNewAnimal({...newAnimal, earTag: v})}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Species</Text>
                                <TouchableOpacity 
                                    onPress={() => setShowSpeciesModal(true)}
                                    className="bg-white border border-emerald-100 rounded-xl p-3 flex-row justify-between items-center"
                                >
                                    <Text className="text-slate-800 font-outfit-medium">{newAnimal.species}</Text>
                                    <ChevronDown size={14} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Breed</Text>
                                <TouchableOpacity 
                                    onPress={() => setShowQuickBreedModal(true)}
                                    className="bg-white border border-emerald-100 rounded-xl p-3 flex-row justify-between items-center"
                                >
                                    <Text className={`font-outfit-medium ${newAnimal.breed ? 'text-slate-800' : 'text-slate-400'}`}>
                                        {newAnimal.breed || 'Select...'}
                                    </Text>
                                    <ChevronDown size={14} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-[10px] font-outfit-bold mb-1 ml-1 uppercase">Color</Text>
                                <TextInput
                                    className="bg-white border border-emerald-100 rounded-xl p-3 text-slate-800 font-outfit-medium"
                                    placeholder="White"
                                    value={newAnimal.color}
                                    onChangeText={(v) => setNewAnimal({...newAnimal, color: v})}
                                />
                            </View>
                        </View>
                    </View>
                 </View>
              ) : (
                <TouchableOpacity 
                    onPress={() => setShowAnimalModal(true)}
                    className="bg-white border border-slate-100 rounded-2xl p-5 flex-row items-center justify-between shadow-sm"
                >
                    <View className="flex-row items-center flex-1">
                        <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-3">
                            <MaterialCommunityIcons name="cow" size={20} color="#3b82f6" />
                        </View>
                        <View className="flex-1">
                            <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-base ${selectedAnimal ? 'text-slate-800' : 'text-slate-300'}`}>
                                {selectedAnimal ? (selectedAnimal.earTag || selectedAnimal.animalId) : 'Choose Animal...'}
                            </Text>
                            {selectedAnimal && (
                                <Text className="text-slate-400 text-xs">{selectedAnimal.breed} · {selectedAnimal.species}</Text>
                            )}
                        </View>
                    </View>
                    {loadingAnimals ? <ActivityIndicator size="small" color="#00643B" /> : <ChevronDown size={20} color="#94a3b8" />}
                </TouchableOpacity>
              )}
            </View>
        )}

        {/* AI DETAILS */}
        <View className="bg-emerald-50/50 p-6 rounded-[32px] mb-8 border border-emerald-100">
            <View className="flex-row items-center gap-2 mb-4">
                <MaterialCommunityIcons name="needle" size={20} color="#00643B" />
                <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-emerald-800 text-sm uppercase tracking-widest">A.I. Procedure Details</Text>
            </View>
            
            <View className="gap-y-5">
              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Service Mode</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setStatus('done')}
                    className={`flex-1 py-3.5 rounded-2xl border items-center ${status === 'done' ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-emerald-100'}`}
                    style={status === 'done' ? { shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 } : {}}
                  >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[12px] ${status === 'done' ? 'text-white' : 'text-emerald-700'}`}>Complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setStatus('pending')}
                    className={`flex-1 py-3.5 rounded-2xl border items-center ${status === 'pending' ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-emerald-100'}`}
                    style={status === 'pending' ? { shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 } : {}}
                  >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[12px] ${status === 'pending' ? 'text-white' : 'text-emerald-700'}`}>Schedule</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Sire Breed</Text>
                <TouchableOpacity 
                    onPress={() => setShowBreedModal(true)}
                    className="bg-white border border-emerald-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className={sireBreed ? 'text-slate-800' : 'text-slate-300'}>
                        {sireBreed || 'Select Sire Breed...'}
                    </Text>
                    <ChevronDown size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Sire Code / Bull ID</Text>
                <View className="flex-row gap-2">
                    <TextInput
                        className="bg-slate-100 border border-emerald-50 rounded-2xl p-4 text-slate-500 font-outfit-medium shadow-sm flex-1"
                        placeholder="Automatic Code"
                        value={sireCode}
                        editable={false}
                    />
                </View>
              </View>

              {/* Mission Date & Time Selectors */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Mission Date</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    className="bg-white border border-emerald-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                  >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                      {inseminationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <MaterialCommunityIcons name="calendar" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View className="flex-1">
                  <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">T-Time</Text>
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    className="bg-white border border-emerald-100 rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
                  >
                    <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-xs">
                      {inseminationTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-emerald-700 text-[11px] font-outfit-bold mb-1.5 ml-1 uppercase">Estrus Cycle / Type</Text>
                <View className="flex-row gap-2">
                  {['Natural', 'Synchronized', 'Induced'].map(opt => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setEstrus(opt)}
                      className={`flex-1 py-3.5 rounded-xl border items-center ${estrus === opt ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-emerald-100'}`}
                      style={estrus === opt ? { shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2 } : {}}
                    >
                      <Text style={{ fontFamily: 'Outfit_700Bold' }} className={`text-[10px] ${estrus === opt ? 'text-white' : 'text-emerald-700'}`}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
        </View>

        <Text className="font-outfit-bold text-slate-400 uppercase text-[10px] tracking-widest mb-3 ml-1">Additional Notes</Text>
        <TextInput
            className="bg-white border border-slate-100 rounded-2xl p-4 h-32 text-slate-800 shadow-sm mb-10 font-outfit-medium"
            multiline
            textAlignVertical="top"
            placeholder="Any other details about the procedure..."
            placeholderTextColor="#cbd5e1"
            value={notes}
            onChangeText={setNotes}
        />

        {/* SAVE BUTTON */}
        <TouchableOpacity 
            className={`py-5 rounded-[24px] flex-row justify-center items-center shadow-lg mb-20 ${
              saving 
                ? 'bg-slate-400' 
                : status === 'done' 
                  ? 'bg-emerald-600' 
                  : 'bg-blue-600'
            }`}
            onPress={handleSave}
            disabled={saving}
            style={
              !saving
                ? status === 'done'
                  ? { shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }
                  : { shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 }
                : {}
            }
        >
            {saving ? <ActivityIndicator color="white" /> : (
               <>
                  <Save size={20} color="white" style={{ marginRight: 10 }} />
                  <Text style={{ fontFamily: 'Outfit_800ExtraBold' }} className="text-white text-base">
                     {status === 'done' ? 'Save AI Record' : 'Schedule Insemination'}
                  </Text>
               </>
            )}
        </TouchableOpacity>
      </ScrollView>

      {/* FARMER SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showFarmerModal} onRequestClose={() => setShowFarmerModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800">Select Farmer</Text>
                   <TouchableOpacity onPress={() => setShowFarmerModal(false)} className="bg-slate-100 p-2.5 rounded-full">
                       <X size={22} color="#64748b" />
                   </TouchableOpacity>
               </View>

               {farmers.length === 0 ? (
                   <ActivityIndicator size="large" color="#00643B" className="mt-10" />
               ) : (
                   <FlatList 
                      data={farmers}
                      keyExtractor={(item) => item._id}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                          <TouchableOpacity 
                             onPress={() => handleFarmerSelect(item)}
                             className="flex-row items-center bg-slate-50 border border-slate-100 p-5 rounded-[24px] mb-3"
                          >
                             <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center mr-4">
                                <User size={24} color="#00643B" />
                             </View>
                             <View className="flex-1">
                                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-base">{item.name}</Text>
                                <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>{getAddressStr(item.address)}</Text>
                             </View>
                          </TouchableOpacity>
                      )}
                   />
               )}
            </View>
         </View>
      </Modal>

      {/* BARANGAY SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showBrgyModal} onRequestClose={() => setShowBrgyModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800">Select Barangay</Text>
                   <TouchableOpacity onPress={() => { setShowBrgyModal(false); setSearchBrgy(''); }} className="bg-slate-100 p-2.5 rounded-full">
                       <X size={22} color="#64748b" />
                   </TouchableOpacity>
               </View>

               <TextInput
                 className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-slate-800 font-outfit-medium mb-4"
                 placeholder="Search barangay..."
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
                            setNewFarmer({...newFarmer, barangay: item});
                            setShowBrgyModal(false);
                            setSearchBrgy('');
                         }}
                         className="py-4 border-b border-slate-50"
                      >
                         <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                      </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>

      {/* ANIMAL SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showAnimalModal} onRequestClose={() => setShowAnimalModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[85%] min-h-[50%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800">Select Animal</Text>
                   <TouchableOpacity onPress={() => setShowAnimalModal(false)} className="bg-slate-100 p-2.5 rounded-full">
                       <X size={22} color="#64748b" />
                   </TouchableOpacity>
               </View>

               {animals.length === 0 ? (
                   <View className="items-center py-10">
                      <MaterialCommunityIcons name="cow-off" size={48} color="#cbd5e1" />
                      <Text className="text-slate-400 font-outfit-medium mt-4">No animals found for this farmer.</Text>
                   </View>
                ) : (
                   <FlatList 
                      data={animals}
                      keyExtractor={(item) => item._id}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                          <TouchableOpacity 
                             onPress={() => {
                                setSelectedAnimal(item);
                                setShowAnimalModal(false);
                             }}
                             className={`flex-row items-center bg-slate-50 border p-5 rounded-[24px] mb-3 ${selectedAnimal?._id === item._id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100'}`}
                          >
                             <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mr-4">
                                <MaterialCommunityIcons name="cow" size={24} color="#3b82f6" />
                             </View>
                             <View className="flex-1">
                                <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-base">{item.earTag || item.animalId}</Text>
                                <Text className="text-slate-500 text-xs mt-0.5">{item.breed} · {item.species}</Text>
                             </View>
                             {selectedAnimal?._id === item._id && <MaterialCommunityIcons name="check-circle" size={24} color="#00643B" />}
                          </TouchableOpacity>
                      )}
                   />
               )}
            </View>
         </View>
      </Modal>

      {/* SPECIES SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showSpeciesModal} onRequestClose={() => setShowSpeciesModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[50%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800">Select Species</Text>
                   <TouchableOpacity onPress={() => setShowSpeciesModal(false)} className="bg-slate-100 p-2.5 rounded-full">
                       <X size={22} color="#64748b" />
                   </TouchableOpacity>
               </View>

               <FlatList 
                  data={CATTLE_SPECIES}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                         onPress={() => {
                            setNewAnimal({...newAnimal, species: item});
                            setShowSpeciesModal(false);
                         }}
                         className="py-4 border-b border-slate-50"
                      >
                         <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                      </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>

      {/* QUICK BREED SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showQuickBreedModal} onRequestClose={() => setShowQuickBreedModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[70%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800">Select Breed</Text>
                   <TouchableOpacity onPress={() => setShowQuickBreedModal(false)} className="bg-slate-100 p-2.5 rounded-full">
                       <X size={22} color="#64748b" />
                   </TouchableOpacity>
               </View>

               <FlatList 
                  data={CATTLE_BREEDS}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                         onPress={() => {
                            setNewAnimal({...newAnimal, breed: item});
                            setShowQuickBreedModal(false);
                         }}
                         className="py-4 border-b border-slate-50"
                      >
                         <Text className="font-outfit-bold text-slate-700 text-base">{item}</Text>
                      </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>

      {/* BREED SELECTION MODAL (SIRE) */}
      <Modal animationType="slide" transparent={true} visible={showBreedModal} onRequestClose={() => setShowBreedModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[40px] p-8 pb-12 max-h-[70%] shadow-2xl">
               <View className="flex-row justify-between items-center mb-6">
                   <Text style={{ fontFamily: 'Outfit_900Black' }} className="text-2xl text-slate-800">Select Sire Breed</Text>
                   <TouchableOpacity onPress={() => setShowBreedModal(false)} className="bg-slate-100 p-2.5 rounded-full">
                       <X size={22} color="#64748b" />
                   </TouchableOpacity>
               </View>

               <FlatList 
                  data={CATTLE_BREEDS}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                         onPress={() => {
                            setSireBreed(item);
                            const code = getSireCodeByBreed(item);
                            if (code) setSireCode(code);
                            setShowBreedModal(false);
                         }}
                         className="flex-row items-center bg-slate-50 border border-slate-100 p-5 rounded-[24px] mb-3"
                      >
                         <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-4">
                            <Dog size={20} color="#3b82f6" />
                         </View>
                         <Text style={{ fontFamily: 'Outfit_700Bold' }} className="text-slate-800 text-base flex-1">{item}</Text>
                         {sireBreed === item && <MaterialCommunityIcons name="check-circle" size={20} color="#10b981" />}
                      </TouchableOpacity>
                  )}
               />
            </View>
         </View>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={inseminationDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={inseminationTime}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      )}
    </SafeAreaView>
  );
}
