import React from "react";
import {
  View,
  FlatList,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Text } from "@/components/ui/Text";
import { AppHeaderIconButton, AppPageHeader } from "@/components/AppPageHeader";
import { useTechnicianClients } from "../hooks/useTechnicianClients";
import {
  SearchBar,
  AsyncState,
  FilterChips,
  Pagination,
} from "@/components/shared";
import { ClientListCard } from "../components/ClientListCard";
import { BarangayFilter } from "../components/BarangayFilter";

const FARMER_ACCOUNT_FILTERS = [
  { label: "All", value: "all" },
  { label: "Connected", value: "connected" },
  { label: "No app account", value: "no_app_account" },
  { label: "Profile only", value: "profile_only" },
  { label: "Blocked", value: "blocked" },
] as const;

type TechnicianClientsScreenProps = {
  showBackButton?: boolean;
};

export default function TechnicianClientsScreen({
  showBackButton = true,
}: TechnicianClientsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const horizontalPadding = width >= 600 ? 24 : 16;

  const {
    searchQuery,
    setSearchQuery,
    selectedAccountStatus,
    setSelectedAccountStatus,
    selectedMunicipality,
    setSelectedMunicipality,
    selectedBarangay,
    setSelectedBarangay,
    page,
    pageSize,
    clients,
    total,
    totalPages,
    isLoading,
    isRefetching,
    handleRefresh,
    goToPage,
  } = useTechnicianClients();
  const firstFarmer = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastFarmer = Math.min(page * pageSize, total);

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader
        title="Farmers"
        showBackButton={showBackButton}
        variant={showBackButton ? "detail" : "top-level"}
        rightAction={
          <AppHeaderIconButton
            onPress={() => router.push("/(technician)/register-client" as any)}
            accessibilityLabel="Register a new farmer"
          >
            <UserPlus size={18} color={colors.primary} />
          </AppHeaderIconButton>
        }
      />

      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
          paddingHorizontal: horizontalPadding,
          paddingTop: 16,
        }}
      >
        <FlatList
          style={{ flex: 1 }}
          data={isLoading ? [] : clients}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: insets.bottom + (showBackButton ? 24 : 96),
          }}
          ListHeaderComponent={
            <View style={{ paddingBottom: 4 }}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by farmer name or email"
              />

              <FilterChips
                options={[...FARMER_ACCOUNT_FILTERS]}
                value={selectedAccountStatus}
                onChange={(value) =>
                  setSelectedAccountStatus(value as typeof selectedAccountStatus)
                }
                containerStyle={{ paddingHorizontal: 0, paddingBottom: 16 }}
              />

              <View style={{ marginBottom: 16 }}>
                <BarangayFilter
                  selectedMunicipality={selectedMunicipality}
                  setSelectedMunicipality={setSelectedMunicipality}
                  selectedBarangay={selectedBarangay}
                  setSelectedBarangay={setSelectedBarangay}
                />
              </View>

              {isLoading ? (
                <AsyncState state="loading" />
              ) : (
                <Text
                  textRole="label"
                  color="secondary"
                  style={{ marginBottom: 12 }}
                >
                  {total === 0
                    ? "0 farmers"
                    : `Showing ${firstFarmer}–${lastFarmer} of ${total} ${
                        total === 1 ? "farmer" : "farmers"
                      }`}
                </Text>
              )}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => <ClientListCard item={item} />}
          ListEmptyComponent={
            isLoading ? null : (
              <AsyncState
                state="empty"
                title="No farmers found"
                message="Try a different search or clear the active filters."
              />
            )
          }
          ListFooterComponent={
            !isLoading && totalPages > 1 ? (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPrevious={() => goToPage(page - 1)}
                onNext={() => goToPage(page + 1)}
              />
            ) : null
          }
        />
      </View>
    </ScreenLayout>
  );
}
