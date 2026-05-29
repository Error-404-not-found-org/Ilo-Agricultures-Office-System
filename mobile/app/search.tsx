import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react-native';
import SafeScreen from '@/components/safeScreen';

const SYSTEM_DATA = [
  { id: '1', title: 'Cow #1024', type: 'Animal', subtitle: 'Pending Insemination' },
  { id: '2', title: 'John Doe Farm', type: 'Client', subtitle: 'Registered: 2023' },
  { id: '3', title: 'Vaccination Task', type: 'Task', subtitle: 'Due Today' },
  { id: '4', title: 'Cow #991', type: 'Animal', subtitle: 'Pregnant' },
  { id: '5', title: 'Maria Garcia', type: 'Client', subtitle: 'New Profile' },
];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filteredData = SYSTEM_DATA.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <SafeScreen>
      <View className="px-6 flex-1">

        {/* Search Header */}
        <View className="flex-row items-center gap-4 mb-6 mt-2">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color="black" />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 py-3 h-12">
            <SearchIcon size={20} color="gray" />

            <TextInput
              placeholder="Search animals, clients..."
              placeholderTextColor="#9CA3AF"
              // FIX: text-gray-900 ensures text is dark gray (visible)
              className="flex-1 ml-2 text-base"
              autoFocus
              value={query}
              onChangeText={setQuery}
              style={{ 
                  color: 'black',       // Forces text to be black, ignoring Tailwind/Dark Mode
                  paddingVertical: 0    // Fixes "invisible text" bug on Android
                }}
            />
          </View>
        </View>

        {/* Results List */}
        <Text className="text-gray-500 font-semibold mb-4">Results</Text>

        <FlatList
          data={filteredData}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity className="flex-row items-center p-4 bg-white mb-3 rounded-2xl border border-gray-200 shadow-sm">
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900">{item.title}</Text>
                <Text className="text-sm text-gray-500">{item.subtitle}</Text>
              </View>
              <View className="bg-gray-100 px-3 py-1 rounded-lg">
                <Text className="text-xs font-bold text-gray-700">{item.type}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center mt-10">No results found for &quot;{query}&quot;</Text>
          }
        />

      </View>
    </SafeScreen>
  );
}