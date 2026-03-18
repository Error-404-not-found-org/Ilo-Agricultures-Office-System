import { View, Text, TextInput, TouchableOpacity, FlatList, StatusBar } from 'react-native';
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Search, ArrowRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// --- MOCK DATA ---
const ANIMALS_DATA = [
  { id: '1', name: 'Cow # 1', owner: 'Nelmar', breed: 'Bulldog', address: 'Brgy. Di makita', status: 'Active' },
  { id: '2', name: 'Cow # 2', owner: 'Nelmar', breed: 'Bulldog', address: 'Brgy. Di makita', status: 'Assigned' },
  { id: '3', name: 'Cow # 3', owner: 'Nelmar', breed: 'Bulldog', address: 'Brgy. Di makita', status: 'Active' },
  { id: '4', name: 'Cow # 4', owner: 'Maria', breed: 'Brahman', address: 'Brgy. San Jose', status: 'Active' },
  { id: '5', name: 'Cow # 5', owner: 'Jose', breed: 'Native', address: 'Brgy. Poblacion', status: 'Active' },
  { id: '6', name: 'Cow # 6', owner: 'Pedro', breed: 'Angus', address: 'Brgy. Tacas', status: 'Assigned' },
];

const Animals = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAnimals = ANIMALS_DATA.filter((a: any) => 
     a.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     a.owner?.toLowerCase().includes(searchQuery.toLowerCase())
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
        <FlatList 
          data={filteredAnimals}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          
          ListHeaderComponent={
            <View className="mb-6">
               {/* Title */}
               <Text className="text-[24px] font-bold text-slate-800 mb-6">
                  Animals Assigned
                </Text>

                {/* Search Bar - Clean White Style */}
                <View className="flex-row items-center bg-white rounded-2xl px-4 h-[52px] mb-2 border border-slate-100 shadow-sm" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
                  <Search size={20} color="#94a3b8" />
                  <TextInput 
                    placeholder="Search by tag or owner..." 
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-3 text-[15px] font-medium text-slate-800"
                    placeholderTextColor="#94a3b8"
                    style={{ paddingVertical: 0 }} 
                  />
                </View>
            </View>
          }

          ListEmptyComponent={
            <View className="items-center justify-center pt-20">
              <Text className="text-slate-400 font-medium text-lg">No animals found.</Text>
            </View>
          }

          renderItem={({ item }) => (
            <View 
                className="bg-white rounded-[24px] p-5 mb-4 border border-slate-100 shadow-sm"
                style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
            >
              
              {/* Card Header */}
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-emerald-50 rounded-full items-center justify-center">
                     <MaterialCommunityIcons name="cow" size={26} color="#00643B" />
                  </View>
                  <Text className="text-[17px] font-bold text-slate-800">{item.name}</Text>
                </View>
                
                {/* Status Badge */}
                <View className={`px-2.5 py-1.5 rounded-lg ${item.status === 'Active' ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                    <Text className={`text-[11px] font-bold uppercase tracking-wider ${item.status === 'Active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {item.status}
                    </Text>
                </View>
              </View>

              {/* Details */}
              <View className="ml-1 mb-6 mt-3">
                <Text className="text-slate-400 text-[11px] uppercase tracking-widest font-bold mb-2">Details</Text>
                <Text className="text-slate-600 text-[13px] mb-1">Owner: <Text className="font-semibold text-slate-800">{item.owner}</Text></Text>
                <Text className="text-slate-600 text-[13px] mb-1">Species / Breed: <Text className="font-semibold text-slate-800">Cattle / {item.breed}</Text></Text>
                <Text className="text-slate-600 text-[13px]">Location: <Text className="font-semibold text-slate-800">{item.address}</Text></Text>
              </View>

              {/* Action */}
              <TouchableOpacity
                  onPress={() => router.push(`/(technician)/animal-details?id=${item.id}`)}
                  className="absolute bottom-5 right-5 flex-row items-center gap-1.5 active:opacity-50"
               >
                 <Text className="text-[#00643B] text-[13px] font-bold">View Details</Text>
                 <ArrowRight size={16} color="#00643B" />
              </TouchableOpacity>

            </View>
          )}
        />
      </View>
    </View>
  )
}

export default Animals;