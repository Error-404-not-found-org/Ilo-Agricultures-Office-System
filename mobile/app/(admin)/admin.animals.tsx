import { View, Text, TextInput, TouchableOpacity, FlatList, StatusBar, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { Search, ArrowRight } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';

const PRIMARY = '#1e3a5f';

export default function AdminAnimalsScreen() {
  const router = useRouter();
  const api = useApi();

  const [animals, setAnimals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAnimals = async (pageNumber: number, searchRaw: string, isRefresh = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get(`/animals/all?page=${pageNumber}&limit=10&search=${encodeURIComponent(searchRaw)}`);
      if (res.data?.animals) {
        if (isRefresh) setAnimals(res.data.animals);
        else setAnimals(prev => [...prev, ...res.data.animals]);
        setHasMore(pageNumber < res.data.pages);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load animals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
    <View className="flex-1 bg-[#F0F4FF]">
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[190px]" style={{ backgroundColor: PRIMARY }} />
      <Header />
      <View
        className="flex-1 bg-[#F0F4FF] rounded-t-[32px] px-5 pt-6 mt-2 shadow-lg"
        style={{ shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 8 }}
      >
        <FlatList
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListHeaderComponent={
            <View className="mb-5">
              <Text className="text-[22px] font-bold text-slate-800 mb-4">Animals Directory</Text>
              <View className="flex-row items-center bg-white rounded-xl px-4 h-[48px] mb-2 border border-slate-100 shadow-sm">
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
              {loading ? (
                <ActivityIndicator size="large" color={PRIMARY} />
              ) : (
                <Text className="text-slate-400 font-medium text-base">No animals found.</Text>
              )}
            </View>
          }
          ListFooterComponent={
            <View className="py-4 items-center">
              {loading && hasMore && animals.length > 0 && <ActivityIndicator color={PRIMARY} />}
            </View>
          }
          renderItem={({ item }) => (
            <View className="bg-white rounded-[20px] p-4 mb-3 border border-slate-100 shadow-sm relative overflow-hidden">
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
                    <MaterialCommunityIcons name="cow" size={22} color={PRIMARY} />
                  </View>
                  <View>
                    <Text className="text-[15px] font-bold text-slate-800">
                      {item.animalId || 'No ID'} {item.earTag ? `(${item.earTag})` : ''}
                    </Text>
                    <Text className="text-[12px] font-medium text-slate-500">
                      {item.species || 'Unknown'} / {item.breed || 'Mixed'}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="ml-1 mb-4">
                <Text className="text-slate-600 text-[12px] mb-1">
                  Owner: <Text className="font-semibold text-slate-800">{item.farmerId?.name || 'Unassigned'}</Text>
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/(technician)/animal-details?id=${item._id}` as any)}
                className="absolute bottom-0 right-0 bg-blue-50 px-4 py-2.5 rounded-tl-[16px] flex-row items-center gap-1 active:opacity-75"
              >
                <Text style={{ color: PRIMARY }} className="text-[12px] font-bold tracking-wide">VIEW</Text>
                <ArrowRight size={14} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </View>
  );
}
