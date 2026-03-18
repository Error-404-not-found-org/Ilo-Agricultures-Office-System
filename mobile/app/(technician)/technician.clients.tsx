import { View, Text, FlatList, TouchableOpacity, StatusBar, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import { Search, MapPin, Phone, Mail } from 'lucide-react-native';
import React, { useState } from 'react';
import { useApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export default function ClientsScreen() {
  const router = useRouter();
  const api = useApi();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: clients = [], isLoading: loading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/user?role=farmer');
      return res.data;
    }
  });

  const filteredClients = clients.filter((c: any) => 
     c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHeader = () => (
    <View className="mb-6">
      <Text className="text-[24px] font-bold text-slate-800 mb-6">Client Management</Text>
      
      {/* --- SELECTION CARDS --- */}
      <View className="flex-row gap-x-4 mb-8">
        <TouchableOpacity 
          onPress={() => router.push('/clients/register-client')}
          className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 items-center justify-center shadow-sm"
          style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
        >
          <View className="w-12 h-12 bg-emerald-50 rounded-full items-center justify-center mb-3">
             <MaterialCommunityIcons name="account-plus" size={24} color="#00643B" />
          </View>
          <Text className="font-bold text-slate-800 text-sm text-center">New Client</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/clients/add-animal')}
          className="flex-1 bg-white rounded-2xl p-4 border border-slate-100 items-center justify-center shadow-sm"
          style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
        >
          <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mb-3">
             <MaterialCommunityIcons name="cow" size={24} color="#3B82F6" />
          </View>
          <Text className="font-bold text-slate-800 text-sm text-center">Add Animal</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-[18px] font-bold text-slate-800 mb-4">All Clients</Text>

      {/* Search Bar */}
      <View className="flex-row items-center bg-white rounded-2xl px-4 h-[52px] mb-2 border border-slate-100 shadow-sm" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
        <Search size={20} color="#94a3b8" />
        <TextInput 
          placeholder="Search clients..." 
          className="flex-1 ml-3 text-[15px] font-medium text-slate-800"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{ paddingVertical: 0 }} 
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />

      <Header />

      {/* Overlapping White Curve Card */}
      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-6 pt-8 mt-2 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        {loading ? (
          <View className="flex-1 justify-center items-center">
             <ActivityIndicator size="large" color="#00643B" />
          </View>
        ) : (
          <FlatList 
            data={filteredClients}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={() => (
              <View className="items-center justify-center py-10">
                <Text className="text-gray-400">No clients found.</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View 
                  className="bg-white rounded-[24px] p-5 mb-4 border border-slate-100 shadow-sm"
                  style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
              >
                <View className="flex-row items-center gap-3 mb-4">
                  <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center">
                     <Text className="text-emerald-800 font-black text-lg">{item.name?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                     <Text className="text-[17px] font-bold text-slate-800">{item.name}</Text>
                     <View className="px-2 py-0.5 rounded-full bg-emerald-50 self-start mt-1">
                        <Text className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Farmer</Text>
                     </View>
                  </View>
                </View>

                <View className="gap-y-2 ml-1">
                  {item.phoneNumber && (
                    <View className="flex-row items-center gap-3">
                      <Phone size={14} color="#94a3b8" />
                      <Text className="text-slate-600 font-medium text-[13px]">{item.phoneNumber}</Text>
                    </View>
                  )}
                  {item.email && (
                    <View className="flex-row items-center gap-3">
                      <Mail size={14} color="#94a3b8" />
                      <Text className="text-slate-600 font-medium text-[13px]">{item.email}</Text>
                    </View>
                  )}
                  {item.address && (
                    <View className="flex-row items-start gap-3 pr-4">
                      <MapPin size={14} color="#94a3b8" style={{ marginTop: 2 }} />
                      <Text className="text-slate-600 font-medium text-[13px] leading-5">{item.address}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

// --- REUSABLE BIG BUTTON COMPONENT ---
const SelectionCard = ({ title, subtitle, icon, onPress }: { title: string, subtitle: string, icon: React.ReactNode, onPress: () => void }) => (
    <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.7}
        className="w-full bg-white rounded-[28px] p-6 justify-center border border-slate-100"
        style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
        {/* Icon Section */}
        {icon}

        {/* Text Section */}
        <View>
            <Text className="text-[19px] font-bold text-slate-800 mb-1.5">
                {title}
            </Text>
            <Text className="text-slate-500 text-[14px] leading-5 font-medium pr-4">
                {subtitle}
            </Text>
        </View>
    </TouchableOpacity>
);