import {
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Search,
  MapPin,
  Phone,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowLeft,
} from "lucide-react-native";
import React, { useState, useCallback, useEffect } from "react";
import { useApi } from "@/lib/api";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { OTON_BARANGAYS } from "@/lib/constants";

// Import your Theme System and Primitives
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";

const LIMIT = 10;

export default function ClientsScreen() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();

  // Dynamic theme engine hook
  const { colors, isDark, themeStyle } = useTheme();

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

  const fetchClients = useCallback(
    async (
      pageNum: number,
      search: string,
      brgy: string,
      isRefresh = false,
    ) => {
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
    [api, isLoaded, isSignedIn],
  );

  useEffect(() => {
    fetchClients(page, debouncedSearch, selectedBarangay);
  }, [page, debouncedSearch, selectedBarangay, fetchClients]);

  useFocusEffect(
    useCallback(() => {
      fetchClients(page, debouncedSearch, selectedBarangay, true);
    }, [fetchClients, page, debouncedSearch, selectedBarangay]),
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const interval = setInterval(() => {
      fetchClients(page, debouncedSearch, selectedBarangay, false);
    }, 10000);
    return () => clearInterval(interval);
  }, [
    fetchClients,
    page,
    debouncedSearch,
    selectedBarangay,
    isLoaded,
    isSignedIn,
  ]);

  const handleRefresh = () =>
    fetchClients(page, debouncedSearch, selectedBarangay, true);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return (
    <View style={[{ flex: 1 }, themeStyle]}>
      <StatusBar barStyle="light-content" />

      {/* Premium Header Container */}
      <View
        style={{
          backgroundColor: isDark ? "#064e3e" : "#00643B",
          paddingBottom: 80,
          borderBottomLeftRadius: 40,
          borderBottomRightRadius: 40,
          paddingHorizontal: 24,
          paddingTop: insets.top + 20,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <Text variant="black" size={24} style={{ color: "#fff" }}>
              Client Hub
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(technician)/register-client" as any)}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <UserPlus size={16} color="#fff" />
            <Text variant="bold" size={13} style={{ color: "#fff" }}>
              New Farmer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Moowie Client Relations Header Banner Info Block */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 24,
            padding: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <View style={{ width: 60, height: 60 }}>
            <Image
              source={{
                uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
              }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="extrabold" size={14} style={{ color: "#fff" }}>
              Moowie Client Relations
            </Text>
            <Text
              variant="medium"
              size={11}
              style={{
                color: "rgba(255,255,255,0.8)",
                lineHeight: 15,
                marginTop: 2,
              }}
            >
              Managing {total} registered farmers. Keep their contact details
              updated for service notifications! 👨‍🌾
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -40, paddingHorizontal: 20 }}>
        {/* Search Bar Input Container */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: isDark ? 0 : 0.05,
            shadowRadius: 10,
            elevation: isDark ? 0 : 3,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Search
            size={20}
            color={colors.textMuted}
            style={{ marginLeft: 8 }}
          />
          <TextInput
            placeholder="Search farmer by name or email..."
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              marginLeft: 12,
              fontFamily: "Outfit_600SemiBold",
              color: colors.textPrimary,
              fontSize: 14,
            }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Barangay Filter Horizontal Scroller */}
        <View style={{ marginBottom: 16 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={["All", ...OTON_BARANGAYS]}
            keyExtractor={(item) => item}
            contentContainerStyle={{ gap: 8, paddingRight: 20 }}
            renderItem={({ item }) => {
              const isSelected = selectedBarangay === item;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedBarangay(item);
                    setPage(1);
                  }}
                  style={{
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    variant="bold"
                    size={12}
                    style={{
                      color: isSelected ? "#fff" : colors.textSecondary,
                    }}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Clients FlatList Container */}
        <FlatList
          data={clients}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() =>
                router.push(
                  `/(technician)/client.profile?id=${item._id}` as any,
                )
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              {/* Profile Avatar Frame */}
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: colors.tint,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <Text variant="extrabold" size={20} color="brand">
                    {item.name?.charAt(0)}
                  </Text>
                )}
              </View>

              {/* Farmer Info Area */}
              <View style={{ flex: 1, marginLeft: 16 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    variant="bold"
                    size={16}
                    color="primary"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.isVerified && (
                    <MaterialCommunityIcons
                      name="check-decagram"
                      size={16}
                      color={colors.primary}
                    />
                  )}
                </View>
                <Text
                  variant="medium"
                  size={11}
                  color="muted"
                  style={{ marginTop: 1 }}
                >
                  {item.email || "No email provided"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  <MapPin size={10} color={colors.textMuted} />
                  <Text
                    variant="semibold"
                    size={11}
                    color="secondary"
                    numberOfLines={1}
                  >
                    {typeof item.address === "string"
                      ? item.address
                      : item.address?.barangay || "Location unmapped"}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Card>
          )}
          ListEmptyComponent={
            <View style={{ marginTop: 60, alignItems: "center" }}>
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Users size={60} color={colors.textMuted} />
                  <Text variant="bold" color="muted" style={{ marginTop: 16 }}>
                    No farmers found
                  </Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            !loading && totalPages > 1 ? (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 20,
                  marginTop: 10,
                }}
              >
                <TouchableOpacity
                  onPress={() => goToPage(page - 1)}
                  disabled={page === 1}
                  style={{ opacity: page === 1 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={24} color={colors.primary} />
                </TouchableOpacity>
                <Text variant="extrabold" size={13} color="secondary">
                  {page} / {totalPages}
                </Text>
                <TouchableOpacity
                  onPress={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  style={{ opacity: page === totalPages ? 0.3 : 1 }}
                >
                  <ChevronRight size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </View>
    </View>
  );
}
