import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, MapPin, Activity, History, Info as InfoIcon, Share, Edit2, Calendar } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';

// --- MOCK DATA ---
const MOCK_HISTORY = [
    { id: 1, type: 'insemination', attemptNumber: 1, status: 'success', date: 'October 12, 2025', strawUsed: 'Wagyu-X' },
    { id: 2, type: 'calving', status: 'pending', date: 'July 20, 2026', notes: 'Expected expected soon.' },
];

export default function AnimalDetails() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const [activeTab, setActiveTab] = useState<'Info' | 'History'>('Info');

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[280px] bg-[#00643B]" />

      {/* Header Actions */}
      <View className="pt-14 px-6 flex-row justify-between items-center z-10">
          <TouchableOpacity 
              onPress={() => router.back()} 
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
              <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg tracking-wide border-b-2 border-emerald-400 pb-1">Animal Profile</Text>
          <View className="flex-row gap-3">
             <TouchableOpacity className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
                 <Edit2 size={18} color="white" />
             </TouchableOpacity>
          </View>
      </View>

      {/* Header Profile Section */}
      <View className="px-6 items-center mt-6 z-10">
          <View className="w-24 h-24 bg-white rounded-full items-center justify-center border-4 border-emerald-100 shadow-lg mb-4">
              <MaterialCommunityIcons name="cow" size={48} color="#00643B" />
          </View>
          <Text className="text-2xl font-black text-white mb-1">Tag #12345</Text>
          <View className="flex-row items-center bg-white/20 px-3 py-1 rounded-full mb-3">
              <Text className="text-emerald-100 font-bold text-xs uppercase tracking-widest">Active</Text>
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
                            <InfoRow label="System ID" value="COW-A5F9B" />
                            <Divider />
                            <InfoRow label="Species" value="Cattle" />
                            <Divider />
                            <InfoRow label="Breed Type" value="Brahman" />
                            <Divider />
                            <InfoRow label="Color / Markings" value="White with brown spots" />
                            <Divider />
                            <InfoRow label="Gender" value={"Female"} />
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
                                 <Text className="text-emerald-800 font-black text-lg">N</Text>
                             </View>
                             <View className="flex-1">
                                 <Text className="text-base font-bold text-slate-800">Nelmar</Text>
                                 <View className="px-2 py-0.5 rounded-full bg-emerald-50 self-start mt-0.5">
                                    <Text className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Registered Owner</Text>
                                 </View>
                             </View>
                        </View>

                        <View className="gap-y-4">
                            <View className="flex-col gap-1">
                                <Text className="text-slate-500 font-medium text-[13px]">Location Address</Text>
                                <View className="flex-row items-start gap-2 mt-1 pr-4">
                                    <MapPin size={16} color="#00643B" style={{marginTop: 2}} />
                                    <Text className="text-slate-800 font-semibold text-[15px] leading-5 w-11/12">Brgy. Di makita, Iloilo City, 5000</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                </View>
            ) : (
                <View>
                    {MOCK_HISTORY.length > 0 ? (
                        <View className="mt-2 text-primary">
                            {MOCK_HISTORY.map((record, idx) => (
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
                                                record.status === 'success' ? 'text-emerald-600' : 
                                                record.status === 'failed' ? 'text-red-500' : 'text-slate-400'
                                            }`}>
                                                {record.status}
                                            </Text>
                                        </View>
                                        
                                        <View className="flex-row items-center gap-1 mb-2">
                                            <Calendar size={12} color="#94a3b8" />
                                            <Text className="text-slate-500 text-xs">{record.date}</Text>
                                        </View>

                                        {record.type === 'insemination' && record.strawUsed && (
                                            <Text className="text-slate-600 text-sm mt-1">Semen Straw: <Text className="font-semibold text-slate-800">{record.strawUsed}</Text></Text>
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