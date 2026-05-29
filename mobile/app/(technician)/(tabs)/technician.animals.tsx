import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Dog,
  MapPin,
  Filter,
  ArrowLeft,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 1. Import your Theme hooks and Primitive Components
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";

const LIMIT = 10;

const Animals = () => {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();

  // 2. Instantiate your adaptive design tokens engine
  const { colors, isDark, themeStyle } = useTheme();

  const [animals, setAnimals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  const fetchAnimals = useCallback(
    async (pageNumber: number, searchRaw: string, isRefresh = false) => {
      if (!isLoaded || !isSignedIn) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await api.get(
          `/animals/all?page=${pageNumber}&limit=${LIMIT}&search=${encodeURIComponent(searchRaw)}`,
        );
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
    },
    [api, isLoaded, isSignedIn],
  );

  useEffect(() => {
    fetchAnimals(page, debouncedSearch);
  }, [page, debouncedSearch, fetchAnimals]);

  const handleRefresh = () => fetchAnimals(page, debouncedSearch, true);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  return (
    // 3. Connect the primary safe background color token dynamically
    <View style={[{ flex: 1 }, themeStyle]}>
      <StatusBar barStyle="light-content" />

      {/* Premium Header Overlay */}
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

            {/* 4. Use custom Text component to adapt to Light/Dark automatically */}
            <Text variant="black" size={24} style={{ color: "#fff" }}>
              Animal Hub
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/clients/add-animal")}
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
            <PlusCircle size={16} color="#fff" />
            <Text variant="bold" size={13} style={{ color: "#fff" }}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Moowie Herd Manager Sub-Banner Container */}
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
              Moowie Herd Manager
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
              Tracking {total} animals across the district. Use the search to
              find specific ear tags or owners! 🔎
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, marginTop: -40, paddingHorizontal: 20 }}>
        {/* Search & Filter Input Bar — Handles theme shift transitions nicely */}
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
            placeholder="Search tag, species, or owner..."
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
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Filter size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Core FlatList Engine rendering lists of animal structures */}
        <FlatList
          data={animals}
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
            // 5. Swap out the generic TouchableOpacity style block for the adaptive Card primitive
            <Card
              onPress={() =>
                router.push(
                  `/(technician)/animal-details?id=${item._id}` as any,
                )
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 18,
                  overflow: "hidden",
                  backgroundColor: colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="cow"
                    size={28}
                    color={colors.textSecondary}
                  />
                )}
              </View>

              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text
                  variant="bold"
                  size={16}
                  style={{ color: colors.textPrimary }}
                >
                  Tag #{item.earTag || item.animalId || "N/A"}
                </Text>
                <Text
                  variant="medium"
                  size={12}
                  style={{ color: colors.textSecondary }}
                >
                  {item.species || "Cattle"} • {item.breed || "Unknown Breed"}
                </Text>
                <Text
                  variant="medium"
                  size={12}
                  style={{ color: colors.textSecondary }}
                >
                  Owner: {item.farmerId?.name || item.farmer || "Unknown Owner"}
                </Text>
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
                  <Dog size={60} color={colors.textMuted} />
                  <Text variant="bold" color="muted" style={{ marginTop: 16 }}>
                    No animals found
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
};

export default Animals;
