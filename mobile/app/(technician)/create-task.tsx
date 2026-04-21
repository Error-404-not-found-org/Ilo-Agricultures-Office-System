import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Save, ChevronDown, Dog, X } from 'lucide-react-native';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

const CATEGORIES = ["Urgent", "Routine", "Follow-up"];

export default function CreateTaskScreen() {
  const router = useRouter();
  const api = useApi();
  
  const [farmers, setFarmers] = useState<any[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  
  const [animals, setAnimals] = useState<any[]>([]);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
    setShowFarmerModal(false);
    setSelectedAnimalIds([]);
    setLoadingAnimals(true);
    try {
      const res = await api.get(`/animals/farmer/${farmer._id}`);
      setAnimals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnimals(false);
    }
  };

  const toggleAnimalSelect = (id: string) => {
    if (selectedAnimalIds.includes(id)) {
      setSelectedAnimalIds(prev => prev.filter(a => a !== id));
    } else {
      setSelectedAnimalIds(prev => [...prev, id]);
    }
  };

  const handleSave = async () => {
    if (!selectedFarmer || !category || !notes) {
      toast.error('Please fill in all required fields.');
      return;
    }
    
    setSaving(true);
    try {
      await api.post('/tasks', {
        farmerId: selectedFarmer._id,
        animalIds: selectedAnimalIds,
        category,
        notes
      });
      toast.success('Task created successfully!');
      router.back();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create task.');
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
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <ArrowLeft size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Create Task</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* FARMER SELECTION */}
        <Text className="font-bold text-slate-700 uppercase text-xs tracking-wider mb-2 ml-1">Assign To Farmer <Text className="text-red-500">*</Text></Text>
        <TouchableOpacity 
           onPress={() => setShowFarmerModal(true)} 
           className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center justify-between mb-6 shadow-sm"
        >
           <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center mr-3">
                 <User size={20} color="#0d9488" />
              </View>
              <View className="flex-1">
                 <Text className={`font-bold text-base ${selectedFarmer ? 'text-slate-800' : 'text-slate-400'}`}>
                    {selectedFarmer ? selectedFarmer.name : 'Select a Farmer...'}
                 </Text>
                 {selectedFarmer && (
                     <Text className="text-slate-500 text-xs mt-0.5">{getAddressStr(selectedFarmer.address)}</Text>
                 )}
              </View>
           </View>
           <ChevronDown size={20} color="#94a3b8" />
        </TouchableOpacity>

        {/* ANIMAL SELECTION (Conditional) */}
        {selectedFarmer && (
            <>
              <Text className="font-bold text-slate-700 uppercase text-xs tracking-wider mb-2 ml-1">Include Animals (Optional)</Text>
              
              <View className="mb-6">
                 {loadingAnimals ? (
                     <ActivityIndicator size="small" color="#0d9488" className="my-4" />
                 ) : animals.length === 0 ? (
                     <View className="bg-slate-100 rounded-2xl p-4 items-center border border-slate-200/60">
                         <Text className="text-slate-500 text-sm">No animals registered for this farmer.</Text>
                     </View>
                 ) : (
                     animals.map((a: any) => (
                        <TouchableOpacity
                            key={a._id}
                            className={`p-4 rounded-2xl mb-2 flex-row items-center justify-between border ${selectedAnimalIds.includes(a._id) ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-gray-200 shadow-sm'}`}
                            onPress={() => toggleAnimalSelect(a._id)}
                        >
                            <View className="flex-row items-center">
                                <Dog size={18} color={selectedAnimalIds.includes(a._id) ? "#10b981" : "#64748b"} className="mr-3" />
                                <View>
                                    <Text className={`font-bold text-sm ${selectedAnimalIds.includes(a._id) ? 'text-emerald-800' : 'text-slate-700'}`}>{a.animalId} - {a.species}</Text>
                                    <Text className="text-slate-500 text-xs mt-0.5">{a.breed} • {a.color}</Text>
                                </View>
                            </View>
                            {selectedAnimalIds.includes(a._id) && (
                                <View className="w-5 h-5 bg-emerald-500 rounded-full items-center justify-center">
                                    <Text className="text-white font-black text-[10px]">✓</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                     ))
                 )}
              </View>
            </>
        )}

        {/* CATEGORY SELECTION */}
        <Text className="font-bold text-slate-700 uppercase text-xs tracking-wider mb-2 ml-1">Task Category <Text className="text-red-500">*</Text></Text>
        <View className="flex-row gap-2 mb-6">
            {CATEGORIES.map(cat => (
               <TouchableOpacity
                  key={cat}
                  className={`flex-1 py-3 rounded-xl border items-center ${category === cat ? 'bg-[#0f766e] border-[#0f766e]' : 'bg-white border-slate-200 shadow-sm'}`}
                  onPress={() => setCategory(cat)}
               >
                  <Text className={`font-bold text-[13px] ${category === cat ? 'text-white' : 'text-slate-600'}`}>{cat}</Text>
               </TouchableOpacity>
            ))}
        </View>

        {/* NOTES INPUT */}
        <Text className="font-bold text-slate-700 uppercase text-xs tracking-wider mb-2 ml-1">Description <Text className="text-red-500">*</Text></Text>
        <TextInput
            className="bg-white border border-slate-200 rounded-2xl p-4 h-32 text-slate-800 shadow-sm mb-10"
            multiline
            textAlignVertical="top"
            placeholder="Provide task instructions or details..."
            placeholderTextColor="#94a3b8"
            value={notes}
            onChangeText={setNotes}
        />

        {/* SAVE BUTTON */}
        <TouchableOpacity 
            className={`py-4 rounded-full flex-row justify-center items-center shadow-md mb-20 ${saving ? 'bg-emerald-400' : 'bg-[#00643B] shadow-emerald-200'}`}
            onPress={handleSave}
            disabled={saving}
        >
            {saving ? <ActivityIndicator color="white" /> : (
               <>
                  <Save size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold text-base tracking-wide">Save Task</Text>
               </>
            )}
        </TouchableOpacity>

      </ScrollView>

      {/* FARMER SELECTION MODAL */}
      <Modal animationType="slide" transparent={true} visible={showFarmerModal} onRequestClose={() => setShowFarmerModal(false)}>
         <View className="flex-1 bg-slate-900/40 justify-end">
            <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[80%] min-h-[50%]">
               <View className="flex-row justify-between items-center mb-5">
                   <Text className="text-xl font-bold text-slate-800">Select Farmer</Text>
                   <TouchableOpacity onPress={() => setShowFarmerModal(false)} className="bg-slate-100 p-2 rounded-full">
                       <X size={20} color="#64748b" />
                   </TouchableOpacity>
               </View>

               {farmers.length === 0 ? (
                   <ActivityIndicator size="large" color="#0d9488" className="mt-10" />
               ) : (
                   <FlatList 
                      data={farmers}
                      keyExtractor={(item) => item._id}
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                          <TouchableOpacity 
                             onPress={() => handleFarmerSelect(item)}
                             className="flex-row items-center bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-3"
                          >
                             <View className="w-10 h-10 bg-emerald-100 rounded-full items-center justify-center mr-3">
                                <User size={20} color="#0d9488" />
                             </View>
                             <View className="flex-1">
                                <Text className="font-bold text-slate-800 text-base">{item.name}</Text>
                                <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>{getAddressStr(item.address)}</Text>
                             </View>
                          </TouchableOpacity>
                      )}
                   />
               )}
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}
