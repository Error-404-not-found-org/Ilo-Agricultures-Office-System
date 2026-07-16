import React from "react";
import {
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, PlusCircle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { ScreenLayout } from "@/components/ScreenLayout";

import { useTechnicianAnimals } from "../hooks/useTechnicianAnimals";
import { SearchBar, AsyncState, Pagination } from "@/components/shared";
import { AnimalListCard } from "../components/AnimalListCard";
import { BarangayFilter } from "@/features/technician-clients/components/BarangayFilter";

const ANIMAL_STATUS_FILTERS = [
  "All",
  "Normal",
  "In Heat",
  "Inseminated",
  "Likely Pregnant",
  "Pregnant",
  "Dry",
  "Lactating",
  "Post-partum",
] as const;

export default function TechnicianAnimalsScreen() {
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
    selectedStatus,
    setSelectedStatus,
    page,
    animals,
    totalPages,
    isLoading,
    isRefetching,
    isError,
    handleRefresh,
    goToPage,
  } = useTechnicianAnimals();

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
          Animal Registry
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        {/* Search Row: Search Bar (Left/Center) + Add Animal Button (Right) */}
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tag, breed, or owner"
              variant="directory"
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(technician)/register-animal" as any)}
            accessibilityRole="button"
            accessibilityLabel="Register a new animal"
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
              shadowColor: "#000",
              shadowOpacity: isDark ? 0 : 0.08,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            <PlusCircle size={18} color="#fff" />
            <Text variant="bold" size={13} style={{ color: "#fff" }}>
              Add Animal
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
            {ANIMAL_STATUS_FILTERS.map((status) => {
              const isActive = selectedStatus === status;

              return (
                <TouchableOpacity
                  key={status}
                  onPress={() => setSelectedStatus(status)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Show ${status.toLowerCase()} animals`}
                  style={{
                    minHeight: 42,
                    paddingHorizontal: 18,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    backgroundColor: isActive
                      ? colors.primary
                      : colors.card,
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
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Animals FlatList Container */}
        <FlatList
          data={animals}
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
          renderItem={({ item }) => <AnimalListCard item={item} />}
          ListEmptyComponent={
            isLoading ? (
              <AsyncState state="loading" />
            ) : isError ? (
              <AsyncState
                state="error"
                title="Could not load animals"
                message="Check the backend connection, then try again."
                onAction={handleRefresh}
              />
            ) : (
              <AsyncState
                state="empty"
                title="No animals found"
                message="Try searching for a different ear tag, breed, or owner."
              />
            )
          }
          ListFooterComponent={
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrevious={() => goToPage(page - 1)}
              onNext={() => goToPage(page + 1)}
            />
          }
        />
      </View>
    </ScreenLayout>
  );
}
