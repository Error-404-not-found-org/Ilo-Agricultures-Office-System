import { View, Text, FlatList, TouchableOpacity, StatusBar, TextInput, ActivityIndicator, RefreshControl, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Search, MapPin, Phone, Users, UserPlus, ChevronLeft, ChevronRight, Filter, ArrowLeft } from "lucide-react-native";
import React, { useState, useCallback, useEffect } from "react";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { OTON_BARANGAYS } from "@/lib/constants";

const LIMIT = 10;
const PRIMARY = "#00643B";

export default function ClientsScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();

  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState("All");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchClients = useCallback(async (pageNum: number, search: string, brgy: string, isRefresh = false) => {
      if (!isLoaded || !isSignedIn) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          role: "farmer",
          page: String(pageNum),
          limit: String(LIMIT),
          ...(search ? { search } : {}),
          ...(brgy !== "All" ? { barangay: brgy } : {}),
        });
        const res = await api.get(`/user?${params.toString()}`);
        if (res.data?.data) {
          setClients(res.data.data);
          setTotal(res.data.total ?? 0);
          setTotalPages(res.data.totalPages ?? 1);
        }
      } catch (err) {
        console.error("[Clients] Failed to fetch:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, isLoaded, isSignedIn]
  );

  useEffect(() => {
    fetchClients(page, debouncedSearch, selectedBarangay);
  }, [page, debouncedSearch, selectedBarangay, fetchClients]);

  useFocusEffect(
    useCallback(() => {
      fetchClients(page, debouncedSearch, selectedBarangay, true);
    }, [fetchClients, page, debouncedSearch, selectedBarangay])
  );

  // Real-time polling for Farmer Status updates
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const interval = setInterval(() => {
      fetchClients(page, debouncedSearch, selectedBarangay, false); // Fetch silently
    }, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [fetchClients, page, debouncedSearch, selectedBarangay, isLoaded, isSignedIn]);

  const handleRefresh = () => fetchClients(page, debouncedSearch, selectedBarangay, true);

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
            <Text style={{ color: '#fff', fontFamily: 'Outfit_900Black', fontSize: 24 }}>Client Hub</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(technician)/register-client" as any)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
             <UserPlus size={16} color="#fff" />
             <Text style={{ color: '#fff', fontFamily: 'Outfit_700Bold', fontSize: 13 }}>New Farmer</Text>
          </TouchableOpacity>
        </View>

        {/* Moowie Client Relations */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 60, height: 60 }}>
            <Image 
              source={{ uri: 'https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png' }} 
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontFamily: 'Outfit_800ExtraBold', fontSize: 14 }}>Moowie Client Relations</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Outfit_500Medium', fontSize: 11, lineHeight: 15, marginTop: 2 }}>
               Managing {total} registered farmers. Keep their contact details updated for service notifications! 👨‍🌾
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -40, paddingHorizontal: 20 }}>
        {/* Search Bar */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' }}>
           <Search size={20} color="#94a3b8" style={{ marginLeft: 8 }} />
           <TextInput 
             placeholder="Search farmer by name or email..."
             placeholderTextColor="#94a3b8"
             style={{ flex: 1, marginLeft: 12, fontFamily: 'Outfit_600SemiBold', color: '#1e293b', fontSize: 14 }}
             value={searchQuery}
             onChangeText={setSearchQuery}
           />
        </View>

        {/* Barangay Filter Scroller */}
        <View style={{ marginBottom: 16 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={["All", ...OTON_BARANGAYS]}
            keyExtractor={(item) => item}
            contentContainerStyle={{ gap: 8, paddingRight: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedBarangay(item);
                  setPage(1);
                }}
                style={{
                  backgroundColor: selectedBarangay === item ? PRIMARY : '#fff',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selectedBarangay === item ? PRIMARY : '#e2e8f0'
                }}
              >
                <Text style={{ 
                  color: selectedBarangay === item ? '#fff' : '#64748b',
                  fontFamily: 'Outfit_700Bold',
                  fontSize: 12
                }}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <FlatList
          data={clients}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/(technician)/client-details?id=${item._id}` as any)}
              style={{ backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' }}
            >
              <View style={{ width: 56, height: 56, borderRadius: 18, overflow: 'hidden', backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                 {item.imageUrl ? (
                   <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} />
                 ) : (
                   <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#059669', fontSize: 20 }}>{item.name?.charAt(0)}</Text>
                 )}
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#1e293b' }} numberOfLines={1}>{item.name}</Text>
                    {item.isVerified && (
                       <MaterialCommunityIcons name="check-decagram" size={16} color={PRIMARY} />
                    )}
                 </View>
                 <Text style={{ fontSize: 11, fontFamily: 'Outfit_500Medium', color: '#94a3b8', marginTop: 1 }}>{item.email || 'No email provided'}</Text>
                 <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <MapPin size={10} color="#94a3b8" />
                    <Text style={{ fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: '#64748b' }} numberOfLines={1}>
                       {typeof item.address === 'string' ? item.address : (item.address?.barangay || 'Location unmapped')}
                    </Text>
                 </View>
              </View>
              <ChevronRight size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ marginTop: 60, alignItems: 'center' }}>
               {loading ? <ActivityIndicator color={PRIMARY} /> : (
                 <>
                   <Users size={60} color="#cbd5e1" />
                   <Text style={{ fontFamily: 'Outfit_700Bold', color: '#94a3b8', marginTop: 16 }}>No farmers found</Text>
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
}