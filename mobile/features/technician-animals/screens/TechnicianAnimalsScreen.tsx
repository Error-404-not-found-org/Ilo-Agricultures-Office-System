import React from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import {
  AppHeaderIconButton,
  AppPageHeader,
} from "@/components/AppPageHeader";

import { useTechnicianAnimals } from "../hooks/useTechnicianAnimals";
import {
  SearchBar,
  AsyncState,
  FilterChips,
  Pagination,
} from "@/components/shared";
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

type TechnicianAnimalsScreenProps = {
  showBackButton?: boolean;
};

export default function TechnicianAnimalsScreen({
  showBackButton = true,
}: TechnicianAnimalsScreenProps) {
  const [showFilters, setShowFilters] = React.useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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
  const filtersActive =
    selectedMunicipality !== "All" ||
    selectedBarangay !== "All" ||
    selectedStatus !== "All";

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader
        title="Animals"
        showBackButton={showBackButton}
        variant={showBackButton ? "detail" : "top-level"}
        rightAction={
          <AppHeaderIconButton
            onPress={() => router.push("/(technician)/register-animal" as any)}
            accessibilityLabel="Register a new animal"
          >
            <Plus size={19} color={colors.primary} />
          </AppHeaderIconButton>
        }
      />

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search tag, breed, or owner"
          variant="directory"
          onFilterPress={() => setShowFilters((current) => !current)}
          filterActive={filtersActive}
        />

        {showFilters ? (
          <View style={{ marginBottom: 16 }}>
            <View style={{ width: "100%", marginBottom: 12 }}>
              <BarangayFilter
                selectedMunicipality={selectedMunicipality}
                setSelectedMunicipality={setSelectedMunicipality}
                selectedBarangay={selectedBarangay}
                setSelectedBarangay={setSelectedBarangay}
              />
            </View>

            <FilterChips
              options={[...ANIMAL_STATUS_FILTERS]}
              value={selectedStatus}
              onChange={(value) =>
                setSelectedStatus(value as typeof selectedStatus)
              }
              containerStyle={{ paddingHorizontal: 0 }}
            />
          </View>
        ) : null}

        <FlatList
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + (showBackButton ? 24 : 96),
          }}
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
