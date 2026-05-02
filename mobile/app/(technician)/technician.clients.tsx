import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import Header from "@/components/Header";
import {
  Search, MapPin, Phone, Users, UserPlus,
  ChevronLeft, ChevronRight,
} from "lucide-react-native";
import React, { useState, useCallback, useEffect } from "react";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";

const LIMIT = 10;
const PRIMARY = "#00643B";

type Client = {
  _id: string;
  name: string;
  email?: string;
  imageUrl?: string;
  phoneNumber?: string;
  address?: {
    houseNumber?: string;
    street?: string;
    subdivision?: string;
    barangay?: string;
    city?: string;
    province?: string;
    phoneNumber?: string;
  };
};

const getAddressString = (address: Client["address"]): string => {
  if (!address) return "No address on file";
  return [
    address.houseNumber, address.street, address.subdivision,
    address.barangay, address.city, address.province,
  ].filter(Boolean).join(", ") || "No address on file";
};

const getInitials = (name: string) =>
  name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";

// Pastel avatar colors cycling
const AVATAR_COLORS = ["#D1FAE5", "#DBEAFE", "#FEF3C7", "#FCE7F3", "#EDE9FE"];
const getAvatarColor = (name: string) =>
  AVATAR_COLORS[name?.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];
const getInitialColor = (name: string) => {
  const textColors = ["#065F46", "#1E40AF", "#92400E", "#9D174D", "#5B21B6"];
  return textColors[name?.charCodeAt(0) % textColors.length] || textColors[0];
};

export default function ClientsScreen() {
  const router = useRouter();
  const api = useApi();
  const { isSignedIn, isLoaded } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchClients = useCallback(
    async (pageNum: number, search: string, isRefresh = false) => {
      if (!isLoaded || !isSignedIn) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          role: "farmer",
          page: String(pageNum),
          limit: String(LIMIT),
          ...(search ? { search } : {}),
        });
        const res = await api.get(`/user?${params.toString()}`);
        const responseData = res.data;

        if (responseData?.data) {
          // Paginated response
          setClients(responseData.data);
          setTotal(responseData.total ?? 0);
          setTotalPages(responseData.totalPages ?? 1);
        } else if (Array.isArray(responseData)) {
          // Fallback flat array
          setClients(responseData);
          setTotal(responseData.length);
          setTotalPages(1);
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
    fetchClients(page, debouncedSearch);
  }, [page, debouncedSearch, fetchClients]);

  useFocusEffect(
    useCallback(() => {
      fetchClients(page, debouncedSearch, true);
    }, [fetchClients, page, debouncedSearch])
  );

  const handleRefresh = () => fetchClients(page, debouncedSearch, true);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  if (!isLoaded) {
    return (
      <View className="flex-1 bg-white dark:bg-slate-950 justify-center items-center">
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F9FAFB] dark:bg-slate-950">
      <StatusBar barStyle="light-content" />

      {/* Green hero background */}
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#00643B]" />
      <Header />

      <View
        className="flex-1 bg-[#F9FAFB] dark:bg-slate-950 rounded-t-[32px] px-3 pt-8 mt-2"
        style={{ elevation: 8, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 15 }}
      >
        <FlatList
          style={{ flex: 1 }}
          data={clients}
          keyExtractor={(item, i) => item._id || String(i)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
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
                  <Text className="text-[24px] font-black text-slate-800 dark:text-white leading-tight">Clients</Text>
                  <Text className="text-slate-400 dark:text-slate-400 text-xs font-medium mt-0.5">
                    {loading ? "Loading..." : `${total} registered farmer${total !== 1 ? "s" : ""}`}
                  </Text>
                </View>
                {/* Quick Actions */}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => router.push("/clients/register-client")}
                    className="flex-row items-center gap-1.5 bg-[#00643B] px-4 py-2.5 rounded-full"
                    style={{ elevation: 3, shadowColor: "#00643B", shadowOpacity: 0.3, shadowRadius: 6 }}
                  >
                    <UserPlus size={15} color="white" />
                    <Text className="text-white font-bold text-[12px]">New</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View
                className="flex-row items-center bg-white dark:bg-slate-800 rounded-2xl px-4 h-[50px] mb-2 border border-slate-100 dark:border-slate-700"
                style={{ elevation: 2, shadowColor: "#94a3b8", shadowOpacity: 0.08, shadowRadius: 8 }}
              >
                <Search size={18} color="#94a3b8" />
                <TextInput
                  placeholder="Search by name or email..."
                  className="flex-1 ml-3 text-[14px] font-medium text-slate-800 dark:text-white"
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={{ paddingVertical: 0 }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} className="p-1">
                    <Text className="text-slate-400 dark:text-slate-300 text-lg leading-none">×</Text>
                  </TouchableOpacity>
                )}
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
                  <View className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full items-center justify-center mb-2">
                    <Users size={36} color="#cbd5e1" />
                  </View>
                  <Text className="text-slate-500 dark:text-slate-200 font-bold text-base">No clients found</Text>
                  <Text className="text-slate-400 dark:text-slate-400 text-sm text-center px-8">
                    {debouncedSearch
                      ? `No farmers match "${debouncedSearch}"`
                      : "No registered clients yet. Tap New to add one."}
                  </Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            !loading && totalPages > 1 ? (
              <View
                className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex-row items-center justify-between px-8 py-2 mt-3"
                style={{ borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
              >
                {/* Label */}
                <Text className="text-[11px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">
                  Page {page} of {totalPages}
                </Text>

                {/* Buttons */}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => goToPage(page - 1)}
                    disabled={page === 1}
                    className="w-10 h-10 rounded-[12px] bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 items-center justify-center"
                    style={page === 1 ? { opacity: 0.4 } : { elevation: 1 }}
                  >
                    <ChevronLeft size={18} color={page === 1 ? "#94a3b8" : PRIMARY} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => goToPage(page + 1)}
                    disabled={page === totalPages}
                    className="w-10 h-10 rounded-[12px] bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 items-center justify-center"
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
          renderItem={({ item, index }) => (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push(`/(technician)/client-details?id=${item._id}` as any)}
              className="bg-white dark:bg-slate-800 rounded-[20px] mb-3 border border-slate-100 dark:border-slate-700 overflow-hidden"
              style={{ elevation: 2, shadowColor: "#94a3b8", shadowOpacity: 0.06, shadowRadius: 8 }}
            >
              {/* Left accent bar */}
              <View className="flex-row">
                <View style={{ width: 4, backgroundColor: PRIMARY, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 }} />

                <View className="flex-1 p-4">
                  {/* Row: Avatar + Name + Badge */}
                  <View className="flex-row items-center gap-3 mb-3">
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        className="w-12 h-12 rounded-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        className="w-12 h-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: getAvatarColor(item.name) }}
                      >
                        <Text
                          className="font-black text-lg"
                          style={{ color: getInitialColor(item.name) }}
                        >
                          {getInitials(item.name)}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-[15px] font-bold text-slate-800 dark:text-white" numberOfLines={1}>
                        {item.name || "Unnamed Client"}
                      </Text>
                      {item.email && (
                        <Text className="text-[11px] text-slate-400 dark:text-slate-300 font-medium" numberOfLines={1}>
                          {item.email}
                        </Text>
                      )}
                    </View>
                    <View className="bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900">
                      <Text className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                        Farmer
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View className="h-[1px] bg-slate-50 dark:bg-slate-700 mb-3" />

                  {/* Contact info */}
                  <View className="gap-y-1.5">
                    {(item.address?.phoneNumber || item.phoneNumber) && (
                      <View className="flex-row items-center gap-2">
                        <Phone size={12} color="#94a3b8" />
                        <Text className="text-slate-500 dark:text-slate-300 text-[12px] font-medium">
                          {item.address?.phoneNumber || item.phoneNumber}
                        </Text>
                      </View>
                    )}
                    {item.address && (
                      <View className="flex-row items-start gap-2">
                        <MapPin size={12} color="#94a3b8" style={{ marginTop: 1 }} />
                        <Text className="text-slate-500 dark:text-slate-300 text-[12px] leading-4 flex-1" numberOfLines={2}>
                          {getAddressString(item.address)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}