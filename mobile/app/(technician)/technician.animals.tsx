import { View, Text, TextInput, TouchableOpacity, FlatList, StatusBar, ActivityIndicator, RefreshControl, Image } from 'react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, PlusCircle, Dog, MapPin, Filter, ArrowLeft } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApi } from '@/lib/api';
import { toast } from 'sonner-native';
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LIMIT = 10;
const PRIMARY = "#00643B";

const Animals = () => {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
  
  const [animals, setAnimals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
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
        setAnimals(Array.isArray(res.data.animals) ? res.data.animals : []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.pages || 1);
      }
    } catch (error: any) {
      toast.error("Failed to load animal hub.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchAnimals(page, debouncedSearch);
  }, [page, debouncedSearch, fetchAnimals]);

  const handleRefresh = () => fetchAnimals(page, debouncedSearch, true);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <StatusBar barStyle="light-content" />
      
      {/* Premium Header Overlay */}
      <View style={{ backgroundColor: PRIMARY, paddingBottom: 80, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, paddingHorizontal: 24, paddingTop: insets.top + 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
               <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>Animal Hub</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/clients/add-animal")} style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
             <PlusCircle size={16} color="#fff" />
             <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 13 }}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Moowie Herd Manager */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 60, height: 60 }}>
            <Image 
              source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 14 }}>Moowie Herd Manager</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 15, marginTop: 2 }}>
               Tracking {total} animals across the district. Use the search to find specific ear tags or owners! 🔎
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -40, paddingHorizontal: 20 }}>
        {/* Search & Filter Bar */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' }}>
           <Search size={20} color="#94a3b8" style={{ marginLeft: 8 }} />
           <TextInput 
             placeholder="Search tag, species, or owner..."
             placeholderTextColor="#94a3b8"
             style={{ flex: 1, marginLeft: 12, fontFamily: 'Outfit_600SemiBold', color: '#1e293b', fontSize: 14 }}
             value={searchQuery}
             onChangeText={setSearchQuery}
           />
           <TouchableOpacity style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Filter size={20} color={PRIMARY} />
           </TouchableOpacity>
        </View>

        <FlatList 
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/(technician)/animal-details?id=${item._id}` as any)}
              style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' }}
            >
              <View style={{ width: 60, height: 60, borderRadius: 18, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                 {item.imageUrl ? (
                   <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
                 ) : (
                   <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="cow" size={32} color="#cbd5e1" />
                   </View>
                 )}
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#1e293b' }}>{item.earTag || item.animalId}</Text>
                    <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                       <Text style={{ fontSize: 9, fontFamily: 'Outfit_800ExtraBold', color: '#059669' }}>ACTIVE</Text>
                    </View>
                 </View>
                 <Text style={{ fontSize: 12, fontFamily: 'Outfit_500Medium', color: '#64748b', marginTop: 2 }}>{item.species} · {item.breed}</Text>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <MaterialCommunityIcons name="account" size={12} color="#94a3b8" />
                    <Text style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: '#475569' }}>{item.farmerId?.name || 'Unknown Owner'}</Text>
                 </View>
              </View>
              <ChevronRight size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ marginTop: 60, alignItems: 'center' }}>
               {loading ? <ActivityIndicator color={PRIMARY} /> : (
                 <>
                   <MaterialCommunityIcons name="cow-off" size={60} color="#cbd5e1" />
                   <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', marginTop: 16 }}>No animals found</Text>
                 </>
               )}
            </View>
          }
          ListFooterComponent={
            !loading && totalPages > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 10 }}>
                <TouchableOpacity onPress={() => goToPage(page - 1)} disabled={page === 1} style={{ opacity: page === 1 ? 0.3 : 1 }}>
                  <ChevronLeft size={24} color={PRIMARY} />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#475569', fontSize: 13 }}>{page} / {totalPages}</Text>
                <TouchableOpacity onPress={() => goToPage(page + 1)} disabled={page === totalPages} style={{ opacity: page === totalPages ? 0.3 : 1 }}>
                  <ChevronRight size={24} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
};

export default Animals;