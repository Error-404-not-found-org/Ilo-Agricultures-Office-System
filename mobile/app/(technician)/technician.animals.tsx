import { View, Text, TextInput, TouchableOpacity, FlatList, StatusBar, ActivityIndicator, RefreshControl, Image } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import { Search, ChevronLeft, ChevronRight, PlusCircle, Dog } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useAuth } from "@clerk/clerk-expo";

const LIMIT = 10;
const PRIMARY = "#00643B";

const Animals = () => {
  const router = useRouter();
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  
  const [animals, setAnimals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAnimals = useCallback(async (pageNumber: number, searchRaw: string, isRefresh = false) => {
    if (!isLoaded || !isSignedIn) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const res = await api.get(`/animals/all?page=${pageNumber}&limit=${LIMIT}&search=${encodeURIComponent(searchRaw)}`);
      if (res.data) {
        setAnimals(res.data.animals || []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.pages || 1);
      }
    } catch (error: any) {
      console.error("Failed to load animals:", error);
      toast.error(error.response?.data?.message || "Failed to load animals.", { position: 'top-center' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchAnimals(page, debouncedSearch);
  }, [page, debouncedSearch, fetchAnimals]);

  const handleRefresh = () => {
    fetchAnimals(page, debouncedSearch, true);
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return (
    <View className="flex-1 bg-[#F9FAFB]">
      <StatusBar barStyle="light-content" />
      
      {/* Absolute Green Top Background */}
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />

      <Header />
      
      <View 
        className="flex-1 bg-[#F9FAFB] rounded-t-[32px] px-3 pt-8 mt-2"
        style={{ elevation: 8, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 15 }}
      >
        <FlatList 
          style={{ flex: 1 }}
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          
          ListHeaderComponent={
            <View className="mb-4">
               {/* Title + Count */}
               <View className="flex-row items-center justify-between mb-5">
                  <View>
                    <Text className="text-[24px] font-black text-slate-800 leading-tight">Animals</Text>
                    <Text className="text-slate-400 text-xs font-medium mt-0.5">
                      {loading ? "Loading..." : `${total} registered animal${total !== 1 ? "s" : ""}`}
                    </Text>
                  </View>
                  {/* Quick Actions */}
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => router.push("/clients/add-animal")}
                      className="flex-row items-center gap-1.5 bg-[#00643B] px-4 py-2.5 rounded-full"
                      style={{ elevation: 3, shadowColor: "#00643B", shadowOpacity: 0.3, shadowRadius: 6 }}
                    >
                      <PlusCircle size={15} color="white" />
                      <Text className="text-white font-bold text-[12px]">New</Text>
                    </TouchableOpacity>
                  </View>
               </View>

                {/* Search Bar */}
                <View 
                  className="flex-row items-center bg-white rounded-2xl px-4 h-[50px] mb-2 border border-slate-100" 
                  style={{ elevation: 2, shadowColor: '#94a3b8', shadowOpacity: 0.08, shadowRadius: 8 }}
                >
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

                {/* Result count label */}
                {!loading && debouncedSearch && (
                  <Text className="text-slate-400 text-[11px] font-medium mt-2 mb-1 ml-1">
                    Results for &quot;{debouncedSearch}&quot;
                  </Text>
                )}
            </View>
          }

          ListEmptyComponent={
            <View className="items-center justify-center py-20 gap-3">
              {loading ? (
                <ActivityIndicator size="large" color={PRIMARY} />
              ) : (
                <>
                  <View className="w-20 h-20 bg-slate-100 rounded-full items-center justify-center mb-2">
                    <Dog size={36} color="#cbd5e1" />
                  </View>
                  <Text className="text-slate-500 font-bold text-base">No animals found</Text>
                </>
              )}
            </View>
          }

          ListFooterComponent={
            !loading && totalPages > 1 ? (
              <View
                className="bg-white border-t border-slate-100 flex-row items-center justify-between px-8 py-2 mt-3"
                style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
              >
                <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Page {page} of {totalPages}
                </Text>

                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => goToPage(page - 1)}
                    disabled={page === 1}
                    className="w-10 h-10 rounded-[12px] bg-slate-50 border border-slate-100 items-center justify-center"
                    style={page === 1 ? { opacity: 0.4 } : { elevation: 1 }}
                  >
                    <ChevronLeft size={18} color={page === 1 ? "#94a3b8" : PRIMARY} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => goToPage(page + 1)}
                    disabled={page === totalPages}
                    className="w-10 h-10 rounded-[12px] bg-slate-50 border border-slate-100 items-center justify-center"
                    style={page === totalPages ? { opacity: 0.4 } : { elevation: 1 }}
                  >
                    <ChevronRight size={18} color={page === totalPages ? "#94a3b8" : PRIMARY} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ height: 24 }} />
            )
          }

          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push(`/(technician)/animal-details?id=${item._id}` as any)}
              className="bg-white rounded-[20px] mb-3 border border-slate-100 overflow-hidden"
              style={{ elevation: 2, shadowColor: "#94a3b8", shadowOpacity: 0.06, shadowRadius: 8 }}
            >
              <View className="flex-row">
                {/* Left accent bar */}
                <View style={{ width: 4, backgroundColor: PRIMARY, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />

                <View className="flex-1 p-4">
                  {/* Row: Icon + ID + Breed */}
                  <View className="flex-row items-center gap-3 mb-3">
                    {item.imageUrl ? (
                      <Image 
                        source={{ uri: item.imageUrl }} 
                        className="w-12 h-12 rounded-full" 
                        resizeMode="cover" 
                      />
                    ) : (
                      <View className="w-12 h-12 bg-emerald-50 rounded-full items-center justify-center">
                        <MaterialCommunityIcons name="cow" size={26} color={PRIMARY} />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-[15px] font-bold text-slate-800" numberOfLines={1}>
                        {item.animalId || 'No ID'} {item.earTag ? `(${item.earTag})` : ''}
                      </Text>
                      <Text className="text-[11px] text-slate-400 font-medium" numberOfLines={1}>
                        {item.species || 'Unknown'} • {item.breed || 'Mixed'}
                      </Text>
                    </View>
                    <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                      <Text className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">
                        Active
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View className="h-[1px] bg-slate-50 mb-3" />

                  {/* Owner Info */}
                  <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="account-outline" size={14} color="#94a3b8" />
                    <Text className="text-slate-500 text-[12px] font-medium">
                      Owner: <Text className="text-slate-800">{item.farmerId?.name || 'Unassigned'}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
};

export default Animals;