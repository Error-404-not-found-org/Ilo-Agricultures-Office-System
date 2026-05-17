import { View, Text, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, MapPin, Info as InfoIcon, Edit2, Phone, Mail } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useCallback } from 'react';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

export default function ClientDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const api = useApi();
  
  const [activeTab, setActiveTab] = useState<'Info' | 'Animals'>('Info');
  
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      
      const fetchClient = async () => {
        try {
          const res = await api.get(`/user/${id}`);
          setClient(res.data);
        } catch (error: any) {
          console.error("Failed to fetch client details", error);
          if (error.response?.status === 404) {
             toast.info("This client record no longer exists.");
             router.replace("/(technician)/technician.clients" as any);
          } else {
             toast.error(error.response?.data?.message || "Could not load client details.");
          }
        } finally {
          setLoading(false);
        }
      };
      
      fetchClient();

      const interval = setInterval(fetchClient, 10000); // 10 seconds polling
      return () => clearInterval(interval);
    }, [id])
  );

  if (loading) {
     return (
        <View className="flex-1 items-center justify-center bg-[#F9FAFB]">
            <ActivityIndicator size="large" color="#00643B" />
        </View>
     );
  }

  if (!client) {
     return (
        <View className="flex-1 items-center justify-center bg-[#F9FAFB]">
            <Text className="text-slate-500 font-bold">Client Not Found.</Text>
            <TouchableOpacity onPress={() => router.back()} className="mt-4 px-6 py-3 bg-[#00643B] rounded-full">
                <Text className="text-white font-bold">Go Back</Text>
            </TouchableOpacity>
        </View>
     );
  }

  // Extract proper formats
  const clientName = client.name || 'Unknown Client';
  const addr = client.address;
  const clientPhone = addr?.phoneNumber || client.phoneNumber || 'No phone attached';
  const clientAddress = addr 
      ? [addr.street, addr.barangay, addr.city, addr.province].filter(Boolean).join(', ') 
      : 'Location Unregistered';

  const animalsList = client.stats?.animals || [];

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
          <Text className="text-white font-bold text-lg tracking-wide border-b-2 border-emerald-400 pb-1">Client Profile</Text>
          <View className="flex-row gap-3">
             <TouchableOpacity 
                 onPress={() => router.push(`/(technician)/client-details/edit?id=${client._id}` as any)}
                 className="w-10 h-10 bg-white/20 rounded-full items-center justify-center active:opacity-75"
             >
                 <Edit2 size={18} color="white" />
             </TouchableOpacity>
          </View>
      </View>

      {/* Header Profile Section */}
      <View className="px-6 items-center mt-6 z-10">
          <View className="w-24 h-24 bg-white rounded-full items-center justify-center border-4 border-emerald-100 shadow-lg mb-4 overflow-hidden">
              {client.imageUrl ? (
                 <Image source={{ uri: client.imageUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                 <Text className="text-emerald-800 font-black text-4xl">{clientName.charAt(0).toUpperCase()}</Text>
              )}
          </View>
          <Text className="text-2xl font-black text-white mb-1">{clientName}</Text>
          <View className="flex-row items-center bg-white/20 px-3 py-1 rounded-full mb-3">
              <Text className="text-emerald-100 font-bold text-xs uppercase tracking-widest">Farmer Account</Text>
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
                <Text className={`font-bold text-[15px] ${activeTab === 'Info' ? 'text-[#00643B]' : 'text-slate-400'}`}>Contact Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                onPress={() => setActiveTab('Animals')}
                className={`flex-1 py-3.5 border-b-2 items-center flex-row justify-center gap-2 ${activeTab === 'Animals' ? 'border-[#00643B]' : 'border-slate-200'}`}
            >
                <MaterialCommunityIcons name="cow" size={18} color={activeTab === 'Animals' ? '#00643B' : '#94a3b8'} />
                <Text className={`font-bold text-[15px] ${activeTab === 'Animals' ? 'text-[#00643B]' : 'text-slate-400'}`}>Registered Animals</Text>
            </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} className="px-6">
            
            {activeTab === 'Info' ? (
                <View className="gap-y-6">
                    
                    {/* Basic Info Section */}
                    <View className="bg-white p-5 rounded-3xl border border-slate-100" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                        
                        <View className="gap-y-5">
                            <View className="flex-row items-start gap-3">
                                <View className="mt-0.5"><Phone size={18} color="#00643B" /></View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 font-medium text-[13px] mb-0.5">Phone Number</Text>
                                    <Text className="text-slate-800 text-[15px] font-bold">{clientPhone}</Text>
                                </View>
                            </View>
                            <Divider />
                            
                            <View className="flex-row items-start gap-3">
                                <View className="mt-0.5"><Mail size={18} color="#00643B" /></View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 font-medium text-[13px] mb-0.5">Email Address</Text>
                                    <Text className="text-slate-800 text-[15px] font-bold">{client.email || 'Unregistered'}</Text>
                                </View>
                            </View>
                            <Divider />

                            <View className="flex-row items-start gap-3">
                                <View className="mt-0.5"><MapPin size={18} color="#00643B" /></View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 font-medium text-[13px] mb-0.5">Primary Location</Text>
                                    <Text className="text-slate-800 text-[15px] font-bold leading-5">{clientAddress}</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                </View>
            ) : (
                <View>
                    {animalsList.length > 0 ? (
                        <View className="mt-2 text-primary">
                            {animalsList.map((item: any, idx: number) => (
                                <View 
                                    key={idx}
                                    className="bg-white rounded-[20px] p-4 mb-3 border border-slate-100 shadow-sm relative overflow-hidden flex-row items-center"
                                    style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
                                >
                                    <View className="w-12 h-12 bg-emerald-50 rounded-full items-center justify-center mr-4">
                                        <MaterialCommunityIcons name="cow" size={26} color="#00643B" />
                                    </View>

                                    <View className="flex-1 pb-1">
                                        <Text className="text-[17px] font-bold text-slate-800 mb-0.5">{item.animalId || 'No ID'} {item.earTag ? `(${item.earTag})` : ''}</Text>
                                        <Text className="text-[13px] font-medium text-slate-500">{item.species || 'Unknown'} / {item.breed || 'Mixed'}</Text>
                                    </View>

                                    <TouchableOpacity 
                                       onPress={() => router.push(`/(technician)/animal-details?id=${item._id}`)}
                                       className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center ml-2 border border-slate-100"
                                    >
                                        <MaterialCommunityIcons name="chevron-right" size={24} color="#00643B" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="bg-white rounded-[32px] p-8 items-center border border-slate-100 mt-4" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-4">
                                <MaterialCommunityIcons name="cow" size={40} color="#94a3b8" />
                            </View>
                            <Text className="text-slate-700 font-bold text-lg mb-1">No Owned Animals</Text>
                            <Text className="text-slate-400 text-center text-sm px-4 leading-5">This client does not have any cattle registered to their name.</Text>
                        </View>
                    )}
                </View>
            )}

        </ScrollView>
      </View>
    </View>
  );
}

const Divider = () => <View className="h-[1px] w-full bg-slate-100 my-1" />;
