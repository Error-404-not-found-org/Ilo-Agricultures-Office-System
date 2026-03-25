import { View, Text, TextInput, TouchableOpacity, FlatList, StatusBar, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { Search, ArrowRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

const Animals = () => {
  const router = useRouter();
  const api = useApi();
  
  const [animals, setAnimals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAnimals = async (pageNumber: number, searchRaw: string, isRefresh = false) => {
    if (loading) return;
    setLoading(true);
    
    try {
      const res = await api.get(`/animals/all?page=${pageNumber}&limit=10&search=${encodeURIComponent(searchRaw)}`);
      if (res.data && res.data.animals) {
        if (isRefresh) {
          setAnimals(res.data.animals);
        } else {
          setAnimals(prev => [...prev, ...res.data.animals]);
        }
        setHasMore(pageNumber < res.data.pages);
      }
    } catch (error: any) {
      console.error("Failed to load animals:", error);
      toast.error(error.response?.data?.message || "Failed to load animals. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Run on first mount or search filter change
  useEffect(() => {
    setPage(1);
    fetchAnimals(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAnimals(nextPage, debouncedSearch, false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchAnimals(1, debouncedSearch, true);
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[190px] bg-[#00643B]" />

      <Header />
      
      {/* Overlapping White Curve Card */}
      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-5 pt-6 mt-2 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        <FlatList 
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          
          ListHeaderComponent={
            <View className="mb-5">
               {/* Title */}
               <Text className="text-[22px] font-bold text-slate-800 mb-4">
                  Animals Directory
                </Text>

                {/* Search Bar - Clean White Style */}
                <View className="flex-row items-center bg-white rounded-xl px-4 h-[48px] mb-2 border border-slate-100 shadow-sm" style={{ shadowColor: '#94a3b8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}>
                  <Search size={18} color="#94a3b8" />
                  <TextInput 
                    placeholder="Search by tag, ID, or owner..." 
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="flex-1 ml-3 text-[14px] font-medium text-slate-800"
                    placeholderTextColor="#94a3b8"
                    style={{ paddingVertical: 0 }} 
                  />
                </View>
            </View>
          }

          ListEmptyComponent={
            <View className="items-center justify-center pt-20">
              {loading ? <ActivityIndicator size="large" color="#00643B" /> : <Text className="text-slate-400 font-medium text-base">No animals found.</Text>}
            </View>
          }

          ListFooterComponent={
            <View className="py-4 items-center">
              {loading && hasMore && animals.length > 0 && <ActivityIndicator color="#00643B" />}
            </View>
          }

          renderItem={({ item }) => (
            <View 
                className="bg-white rounded-[20px] p-4 mb-3 border border-slate-100 shadow-sm relative overflow-hidden"
                style={{ shadowColor: '#94a3b8', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
            >
              
              {/* Card Header */}
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-row items-center gap-3">
                   {/* Compact Icon */}
                  <View className="w-10 h-10 bg-emerald-50 rounded-full items-center justify-center">
                     <MaterialCommunityIcons name="cow" size={22} color="#00643B" />
                  </View>
                  <View>
                     <Text className="text-[15px] font-bold text-slate-800">{item.animalId || 'No ID'} {item.earTag ? `(${item.earTag})` : ''}</Text>
                     <Text className="text-[12px] font-medium text-slate-500">{item.species || 'Unknown'} / {item.breed || 'Mixed'}</Text>
                  </View>
                </View>
              </View>

              {/* Details Compact Block */}
              <View className="ml-1 mb-4">
                <Text className="text-slate-600 text-[12px] mb-1">Owner: <Text className="font-semibold text-slate-800">{item.farmerId?.name || 'Unassigned'}</Text></Text>
              </View>

              {/* Action Ribbon */}
              <TouchableOpacity
                  onPress={() => router.push(`/(technician)/animal-details?id=${item._id}`)}
                  className="absolute bottom-0 right-0 bg-emerald-50 px-4 py-2.5 rounded-tl-[16px] flex-row items-center gap-1 active:opacity-75"
               >
                 <Text className="text-[#00643B] text-[12px] font-bold tracking-wide">VIEW</Text>
                 <ArrowRight size={14} color="#00643B" />
              </TouchableOpacity>

            </View>
          )}
        />
      </View>
    </View>
  )
}

export default Animals;