import React from "react";
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, UserPlus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useTechnicianClients } from "../hooks/useTechnicianClients";
import { SearchBar, AsyncState, Pagination } from "@/components/shared";
import { ClientListCard } from "../components/ClientListCard";
import { BarangayFilter } from "../components/BarangayFilter";
import { Skeleton } from "@/components/ui/Skeleton";

const FARMER_ACCOUNT_FILTERS = [
  { label: "All", value: "all" },
  { label: "Connected", value: "connected" },
  { label: "No App Account", value: "no_app_account" },
  { label: "Profile Only", value: "profile_only" },
  { label: "Blocked", value: "blocked" },
] as const;

function ClientListSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {[1, 2, 3, 4].map((key) => (
        <View
          key={key}
          style={{
            padding: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Skeleton shape="circle" height={48} style={{ marginRight: 16 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={16} radius={4} />
              <Skeleton width="40%" height={12} radius={4} />
            </View>
            <Skeleton width={80} height={20} radius={8} />
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", gap: 16, flex: 1 }}>
              <Skeleton width="30%" height={14} radius={4} />
              <Skeleton width="30%" height={14} radius={4} />
            </View>
            <Skeleton shape="circle" height={32} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TechnicianClientsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const {
    searchQuery,
    setSearchQuery,
    selectedMunicipality,
    setSelectedMunicipality,
    selectedBarangay,
    setSelectedBarangay,
    selectedAccountStatus,
    setSelectedAccountStatus,
    page,
    clients,
    totalPages,
    isLoading,
    isRefetching,
    handleRefresh,
    goToPage,
  } = useTechnicianClients();

  return (
    <ScreenLayout edges={[]}>
      {/* Premium Header Container */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: isDark ? colors.card : "#fff",
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingTop: insets.top + 14,
          zIndex: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginRight: 12,
            padding: 8,
            backgroundColor: isDark ? "#1e293b" : "#f8fafc",
            borderRadius: 999,
          }}
        >
          <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
        </TouchableOpacity>
        <Text
          variant="black"
          size={20}
          style={{ color: colors.textPrimary, fontFamily: "Outfit_900Black" }}
        >
          Farmers
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        {/* Search Row: Search Bar (Left/Center) + New Farmer Button (Right) */}
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search farmers by name or email"
              variant="directory"
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(technician)/register-client" as any)}
            accessibilityRole="button"
            accessibilityLabel="Register a new farmer"
            style={{
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 28,
              backgroundColor: colors.primary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginBottom: 16,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <UserPlus size={16} color="#fff" />
            <Text variant="bold" size={12} style={{ color: "#fff" }}>
              New Farmer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Location Dropdowns Filter Row */}
        <View style={{ width: "100%", marginBottom: 12, flexShrink: 0 }}>
          <BarangayFilter
            selectedMunicipality={selectedMunicipality}
            setSelectedMunicipality={setSelectedMunicipality}
            selectedBarangay={selectedBarangay}
            setSelectedBarangay={setSelectedBarangay}
          />
        </View>

        <View style={{ marginBottom: 16, marginTop: 40 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {FARMER_ACCOUNT_FILTERS.map((filter) => {
              const isActive = selectedAccountStatus === filter.value;

              return (
                <TouchableOpacity
                  key={filter.value}
                  onPress={() => setSelectedAccountStatus(filter.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Show farmers with ${filter.label.toLowerCase()} status`}
                  style={{
                    minHeight: 42,
                    paddingHorizontal: 18,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    backgroundColor: isActive ? colors.primary : colors.card,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    variant="bold"
                    size={12}
                    style={{
                      color: isActive ? "#fff" : colors.textSecondary,
                    }}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Farmers FlatList Container */}
        {isLoading ? (
          <ClientListSkeleton />
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => <ClientListCard item={item} />}
            ListEmptyComponent={
              <AsyncState
                state="empty"
                title="No farmers found"
                message="Try searching for a different name or changing the barangay filter."
              />
            }
            ListFooterComponent={
              totalPages > 1 ? (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPrevious={() => goToPage(page - 1)}
                  onNext={() => goToPage(page + 1)}
                />
              ) : null
            }
          />
        )}
      </View>
    </ScreenLayout>
  );
}
