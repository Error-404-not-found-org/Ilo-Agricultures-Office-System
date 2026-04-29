import { View, Text, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, User, MapPin, Activity, History, Info as InfoIcon, Calendar, Trash2 } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

export default function AnimalDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const api = useApi();
  
  const [activeTab, setActiveTab] = useState<'Info' | 'History'>('Info');
  
  const [animal, setAnimal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
    if (!id) return;
    
    const fetchAnimal = async () => {
      try {
        const res = await api.get(`/animals/${id}`);
        setAnimal(res.data);
      } catch (error: any) {
        console.error("Failed to fetch animal details", error);
        toast.error(error.response?.data?.message || "Could not load animal details.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnimal();
  }, [id, api])
 );

  const handleDelete = () => {
    Alert.alert(
      "Delete Animal",
      "Are you sure you want to permanently delete this animal and all its history? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              setDeleting(true);
              await api.delete(`/animals/${id}`);
              toast.success("Animal deleted successfully");
              router.replace('/(farmer)/farmer.records' as any);
            } catch (error: any) {
              console.error("Delete Error:", error);
              toast.error(error.response?.data?.message || "Failed to delete animal");
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
     return (
        <View className="flex-1 items-center justify-center bg-[#F9FAFB]">
            <ActivityIndicator size="large" color="#00643B" />
        </View>
     );
  }

  if (!animal) {
     return (
        <View className="flex-1 items-center justify-center bg-[#F9FAFB]">
            <Text className="text-slate-500 font-bold">Animal Not Found.</Text>
            <TouchableOpacity onPress={() => router.back()} className="mt-4 px-6 py-3 bg-[#00643B] rounded-full">
                <Text className="text-white font-bold">Go Back</Text>
            </TouchableOpacity>
        </View>
     );
  }

  // Extract proper formats
  const farmerName = animal.farmerId?.name || 'Unassigned';
  const addr = animal.farmerId?.address;
  const farmerPhone = addr?.phoneNumber || animal.farmerId?.phone || 'No phone attached';
  const farmerAddress = addr 
      ? [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(', ') 
      : 'Location Unregistered';

  // Compute dynamic age based on birthDate subtraction
  let ageDisplay = "Unknown";
  if (animal.birthDate) {
      const birth = new Date(animal.birthDate);
      const now = new Date();
      let diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      if (diffMonths < 0) diffMonths = 0;
      
      const years = Math.floor(diffMonths / 12);
      const months = diffMonths % 12;

      if (years > 0 && months > 0) ageDisplay = `${years} Yr${years > 1 ? 's' : ''}, ${months} Mo${months > 1 ? 's' : ''}`;
      else if (years > 0) ageDisplay = `${years} Year${years > 1 ? 's' : ''}`;
      else if (months > 0) ageDisplay = `${months} Month${months > 1 ? 's' : ''}`;
      else ageDisplay = "Newborn";
  }

  // Combine and sort medical history
  const combinedHistory = [
      ...(animal.inseminations || []).map((i: any) => ({ ...i, type: 'insemination', recordDate: i.dateOfAI || i.createdAt })),
      ...(animal.calvings || []).map((c: any) => ({ ...c, type: 'calving', recordDate: c.date || c.createdAt }))
  ].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[280px] bg-[#00643B]" />

      {/* Header Actions */}
      <View className="pt-14 px-6 flex-row justify-between items-center z-10">
          <TouchableOpacity 
              onPress={() => router.push('/(farmer)/farmer.records' as any)} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
              <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg tracking-wide border-b-2 border-emerald-400 pb-1">Animal Profile</Text>
          <View className="flex-row gap-3">
             <TouchableOpacity 
                onPress={handleDelete}
                disabled={deleting}
                className="w-10 h-10 bg-red-500/20 rounded-full items-center justify-center"
             >
                {deleting ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                    <Trash2 size={20} color="#ef4444" />
                )}
             </TouchableOpacity>
          </View>
      </View>

      {/* Header Profile Section */}
      <View className="px-6 items-center mt-6 z-10">
          <View className="w-24 h-24 bg-white rounded-full items-center justify-center border-4 border-emerald-100 shadow-lg mb-4">
              <MaterialCommunityIcons name="cow" size={48} color="#00643B" />
          </View>
          <Text className="text-2xl font-black text-white mb-1">Tag {animal.earTag ? `#${animal.earTag}` : 'N/A'}</Text>
          <View className="flex-row items-center bg-white/20 px-3 py-1 rounded-full mb-3">
              <Text className="text-emerald-100 font-bold text-xs uppercase tracking-widest">Active 🐄</Text>
          </View>
      </View>

      {/* Overlapping White Curve Card */}
      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] pt-6 mt-4 shadow-lg flex-col"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        
        {/* Customized Tabs */}
        <View className="flex-row px-6 mb-6">
            <TouchableOpacity 
                onPress={() => setActiveTab('Info')}
                className={`flex-1 py-3.5 border-b-2 items-center flex-row justify-center gap-2 ${activeTab === 'Info' ? 'border-[#00643B]' : 'border-slate-200'}`}
            >
                <InfoIcon size={18} color={activeTab === 'Info' ? '#00643B' : '#94a3b8'} />
                <Text className={`font-bold text-[15px] ${activeTab === 'Info' ? 'text-[#00643B]' : 'text-slate-400'}`}>General Info</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => setActiveTab('History')}
                className={`flex-1 py-3.5 border-b-2 items-center flex-row justify-center gap-2 ${activeTab === 'History' ? 'border-[#00643B]' : 'border-slate-200'}`}
            >
                <History size={18} color={activeTab === 'History' ? '#00643B' : '#94a3b8'} />
                <Text className={`font-bold text-[15px] ${activeTab === 'History' ? 'text-[#00643B]' : 'text-slate-400'}`}>Medical History</Text>
            </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} className="px-6">
            
            {activeTab === 'Info' ? (
                <View className="gap-y-6">
                    
                    {/* Basic Info Section */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                        <View className="flex-row items-center mb-5 gap-2">
                            <Activity size={20} color="#00643B" />
                            <Text className="text-lg font-bold text-slate-800">Biological Details</Text>
                        </View>
                        
                        <View className="gap-y-4">
                            <InfoRow label="System ID" value={animal.animalId || 'Missing'} />
                            <Divider />
                            <InfoRow label="Current Age" value={ageDisplay} />
                            <Divider />
                            <InfoRow label="Species" value={animal.species || 'Missing'} />
                            <Divider />
                            <InfoRow label="Breed Type" value={animal.breed || 'Missing'} />
                            <Divider />
                            <InfoRow label="Color / Markings" value={animal.color || 'Unregistered'} />
                            <Divider />
                            <InfoRow label="Brand Mark" value={animal.brand || 'Unbranded'} />
                        </View>
                    </View>

                    {/* Owner Info Section */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                        <View className="flex-row items-center mb-5 gap-2">
                            <User size={20} color="#00643B" />
                            <Text className="text-lg font-bold text-slate-800">Ownership Details</Text>
                        </View>
                        
                        <View className="flex-row items-center gap-4 mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                             <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center">
                                 <Text className="text-emerald-800 font-black text-lg">
                                    {(animal.farmerId?.name || '?').charAt(0).toUpperCase()}
                                 </Text>
                             </View>
                             <View className="flex-1">
                                 <Text className="text-base font-bold text-slate-800">{farmerName}</Text>
                                 <Text className="text-slate-500 font-medium text-[12px] mt-0.5">{farmerPhone}</Text>
                                 <View className="px-2 py-0.5 rounded-full bg-emerald-50 self-start mt-1.5">
                                    <Text className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Registered Owner</Text>
                                 </View>
                             </View>
                        </View>

                        <View className="gap-y-5">
                            <View className="flex-col gap-1">
                                <Text className="text-slate-500 font-medium text-[13px]">Location Address</Text>
                                <View className="flex-row items-start gap-2 mt-1 pr-4">
                                    <MapPin size={16} color="#00643B" style={{marginTop: 2}} />
                                    <Text className="text-slate-800 font-semibold text-[15px] leading-5 w-11/12">
                                       {farmerAddress}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                </View>
            ) : (
                <View>
                    {combinedHistory.length > 0 ? (
                        <View className="mt-2 text-primary">
                            {combinedHistory.map((record: any, idx: number) => (
                                <View key={idx} className="bg-white p-5 rounded-[24px] mb-4 border border-slate-100 flex-row" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
                                    
                                    <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${record.type === 'insemination' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                                       {record.type === 'insemination' 
                                            ? <MaterialCommunityIcons name="needle" size={24} color="#3B82F6" />
                                            : <MaterialCommunityIcons name="baby-carriage" size={24} color="#F97316" />
                                       }
                                    </View>

                                    <View className="flex-1">
                                        <View className="flex-row justify-between items-start mb-1">
                                            <Text className="font-bold text-[16px] text-slate-800">
                                                {record.type === 'insemination' ? `A.I. Attempt #${record.attemptNumber || 1}` : 'Calving Event'}
                                            </Text>
                                            <Text className={`text-[12px] font-bold capitalize ${
                                                record.result === 'Positive' ? 'text-emerald-600' : 
                                                record.result === 'Negative' ? 'text-red-500' : 'text-slate-400'
                                            }`}>
                                                {record.result || 'Pending'}
                                            </Text>
                                        </View>
                                        
                                        <View className="flex-row items-center gap-1 mb-2">
                                            <Calendar size={12} color="#94a3b8" />
                                            <Text className="text-slate-500 text-xs">
                                              {new Date(record.recordDate).toLocaleDateString()}
                                            </Text>
                                        </View>

                                        {record.type === 'insemination' && record.sireCode && (
                                            <Text className="text-slate-600 text-sm mt-1">Semen Straw: <Text className="font-semibold text-slate-800">{record.sireCode}</Text></Text>
                                        )}
                                        {record.type === 'calving' && record.notes && (
                                            <Text className="text-slate-600 text-sm mt-1">Notes: <Text className="font-semibold text-slate-800">{record.notes}</Text></Text>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="bg-white rounded-[32px] p-8 items-center border border-slate-100 mt-4" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-4">
                                <History size={32} color="#94a3b8" />
                            </View>
                            <Text className="text-slate-700 font-bold text-lg mb-1">No Medical Records</Text>
                            <Text className="text-slate-400 text-center text-sm px-4 leading-5">This animal does not have any recorded artificial inseminations or pregnancy checks yet.</Text>
                        </View>
                    )}
                </View>
            )}

        </ScrollView>
      </View>
    </View>
  );
}

// --- HELPER COMPONENT FOR ROWS ---
const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <View className="flex-row justify-between items-center">
        <Text className="text-slate-500 font-medium text-[13px]">{label}</Text>
        <Text className="text-slate-800 text-[15px] font-bold">{value}</Text>
    </View>
);

const Divider = () => <View className="h-[1px] w-full bg-slate-100" />;
