import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import React from 'react';
import SafeScreen from '@/components/safeScreen';
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
  return (
    <SafeScreen>
      <Header />
      
      <View className="flex-1 px-6">
        <FlatList 
          data={ANIMALS_DATA}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          
          // 2. MOVE TITLE & SEARCH HERE (So they scroll away)
          ListHeaderComponent={
            <View className="mb-6">
               {/* Title */}
               <Text className="text-3xl font-bold text-center text-gray-900 mb-6">
                  Animals Assigned
                </Text>

                {/* Search Bar - Smaller & Cleaner */}
                <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 h-12 mb-2">
                  <Search size={18} color="#9CA3AF" />
                  <TextInput 
                    placeholder="Search animals..." 
                    className="flex-1 ml-3 text-base text-gray-900"
                    placeholderTextColor="#9CA3AF"
                    style={{ paddingVertical: 0 }} // Fix for Android text alignment
                  />
                  {/* Removed the Burger Menu Icon here */}
                </View>
            </View>
          }

          // 3. THE LIST ITEMS
          renderItem={({ item }) => (
            <View className="bg-gray-100 rounded-[24px] p-5 mb-4 border border-transparent active:border-gray-200">
              
              {/* Card Header */}
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm">
                     <MaterialCommunityIcons name="cow" size={24} color="black" />
                  </View>
                  <Text className="text-xl font-bold text-gray-900">{item.name}</Text>
                </View>
                
                {/* Status Badge */}
                <View className={`px-2 py-1 rounded-lg ${item.status === 'Active' ? 'bg-green-100' : 'bg-gray-200'}`}>
                    <Text className={`text-xs font-bold ${item.status === 'Active' ? 'text-green-700' : 'text-gray-600'}`}>
                        {item.status}
                    </Text>
                </View>
              </View>

              {/* Details */}
              <View className="ml-1 mb-6 mt-1">
                <Text className="text-gray-500 text-xs uppercase font-bold mb-1">Details</Text>
                <Text className="text-gray-800 text-sm">Owner: <Text className="font-semibold">{item.owner}</Text></Text>
                <Text className="text-gray-800 text-sm">Breed: <Text className="font-semibold">{item.breed}</Text></Text>
                <Text className="text-gray-800 text-sm">Location: <Text className="font-semibold">{item.address}</Text></Text>
              </View>

              {/* Action */}
              <TouchableOpacity
                  onPress={() => router.push('/animal-details')}
                  className="absolute bottom-5 right-5 flex-row items-center gap-1 active:opacity-50">
                    <Text className="text-gray-900 text-xs font-bold">View Details</Text>
                    <ArrowRight size={16} color="black" />
                </TouchableOpacity>

            </View>
          )}
        />
      </View>
    </SafeScreen>
  )
}

export default Animals;