import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import Header from "@/components/Header";
import {
  AsyncState,
  SearchBar,
  SelectDropdown,
  StatusBadge,
} from "@/components/shared";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useTheme } from "@/lib/theme";
import { useAdminAnimals } from "../hooks/useAdminAnimals";
import type { AnimalItem } from "../types/adminAnimals.types";

const PRIMARY = "#1e3a5f";

export default function AdminAnimalsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { search } = useLocalSearchParams<{ search?: string }>();
  const {
    searchQuery,
    setSearchQuery,
    animals,
    matchingAnimalsCount,
    registrySummary,
    isSummaryLoading,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    isRefetching,
    handleLoadMore,
    handleRefresh,
    speciesFilter,
    setSpeciesFilter,
    reproductiveStatusFilter,
    setReproductiveStatusFilter,
    availableSpecies,
    availableReproductiveStatuses,
  } = useAdminAnimals(search || "");

  const metrics = [
    {
      label: "Total Animals",
      value: registrySummary?.total,
      icon: "paw" as const,
      color: "#2563eb",
    },
    {
      label: "Confirmed Pregnant",
      value: registrySummary?.pregnant,
      icon: "heart-pulse" as const,
      color: "#16a34a",
    },
    {
      label: "Total Cattle",
      value: registrySummary?.cattle,
      icon: "cow" as const,
      color: "#0284c7",
    },
    {
      label: "Available for Breeding",
      value: registrySummary?.available,
      icon: "chart-timeline-variant" as const,
      color: "#d97706",
    },
  ];

  const headerElement = (
    <View style={{ marginBottom: 8 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_800ExtraBold",
          fontSize: 24,
          marginBottom: 14,
        }}
      >
        Animals
      </Text>

      <View
        accessibilityLabel="Animal registry overview"
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {metrics.map((metric) => (
          <View
            key={metric.label}
            style={{
              alignItems: "center",
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: 16,
              borderWidth: 1,
              flexBasis: "47%",
              flexDirection: "row",
              flexGrow: 1,
              gap: 10,
              minHeight: 74,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : metric.color + "12",
                borderRadius: 12,
                height: 34,
                justifyContent: "center",
                width: 34,
              }}
            >
              <MaterialCommunityIcons
                name={metric.icon}
                size={18}
                color={metric.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 19,
                }}
              >
                {isSummaryLoading ? "—" : (metric.value ?? 0)}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 11,
                  lineHeight: 14,
                }}
              >
                {metric.label}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search by tag or owner..."
      />
      <View
        style={{ flexDirection: "row", gap: 8, marginBottom: 12, marginTop: 4 }}
      >
        <SelectDropdown
          label="Species"
          options={availableSpecies.map((value) => ({ label: value, value }))}
          value={speciesFilter}
          onChange={setSpeciesFilter}
          variant="pill"
          flex={1}
        />
        <SelectDropdown
          label="Reproductive Status"
          options={availableReproductiveStatuses.map((value) => ({
            label: value,
            value,
          }))}
          value={reproductiveStatusFilter}
          onChange={setReproductiveStatusFilter}
          variant="pill"
          flex={1}
        />
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 12,
          marginBottom: 10,
        }}
      >
        {matchingAnimalsCount}{" "}
        {matchingAnimalsCount === 1 ? "animal" : "animals"}
      </Text>
    </View>
  );

  return (
    <ScreenLayout edges={[]}>
      <StatusBar barStyle="light-content" />
      <View
        className="absolute top-0 left-0 right-0 h-[220px]"
        style={{ backgroundColor: PRIMARY }}
      />
      <Header />
      <View
        style={{
          backgroundColor: isDark ? colors.background : "#F0F4FF",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          elevation: 8,
          flex: 1,
          marginTop: 8,
          paddingHorizontal: 24,
          paddingTop: 24,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 15,
        }}
      >
        <FlatList
          data={animals}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          ListHeaderComponent={headerElement}
          ListEmptyComponent={() => {
            if (isLoading && animals.length === 0)
              return <AsyncState state="loading" />;
            if (isError)
              return (
                <AsyncState
                  state="error"
                  message="Failed to load animals."
                  onAction={handleRefresh}
                />
              );
            return (
              <AsyncState
                state="empty"
                title="No animals found"
                message="Try searching or adjusting filters."
              />
            );
          }}
          ListFooterComponent={
            isFetchingNextPage && hasNextPage ? (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <ActivityIndicator color={PRIMARY} size="small" />
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  Loading more animals...
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <AnimalCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/(admin)/animal-details" as never,
                  params: { id: item._id },
                })
              }
            />
          )}
        />
      </View>
    </ScreenLayout>
  );
}

interface AnimalCardProps {
  item: AnimalItem;
  onPress: () => void;
}

const AnimalCard = React.memo(function AnimalCard({
  item,
  onPress,
}: AnimalCardProps) {
  const { colors, isDark } = useTheme();
  const identifier = item.earTag
    ? `Tag #${item.earTag}`
    : item.animalId || `ID ${item._id.slice(-6).toUpperCase()}`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View details for animal ${identifier}`}
      accessibilityHint="Opens the animal record, including administrative actions"
      activeOpacity={0.72}
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderRadius: 18,
        borderWidth: 1,
        elevation: isDark ? 0 : 1,
        marginBottom: 12,
        padding: 15,
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.025,
        shadowRadius: 6,
      }}
    >
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
        <View
          style={{
            alignItems: "center",
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#eff6ff",
            borderRadius: 14,
            height: 42,
            justifyContent: "center",
            width: 42,
          }}
        >
          <MaterialCommunityIcons
            name={
              item.species?.toLowerCase().includes("swine")
                ? "pig-variant-outline"
                : "cow"
            }
            size={21}
            color={PRIMARY}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              alignItems: "flex-start",
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 16,
                }}
              >
                {identifier}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {item.species || "Species not recorded"} ·{" "}
                {item.breed || "Breed not recorded"}
              </Text>
            </View>
            <StatusBadge
              label={item.reproductiveStatus || "Not recorded"}
              variant={
                item.reproductiveStatus === "Pregnant" ? "success" : "default"
              }
            />
          </View>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 6,
              marginTop: 10,
            }}
          >
            <MaterialCommunityIcons
              name="account-outline"
              size={15}
              color={colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={{
                color: colors.textSecondary,
                flex: 1,
                fontFamily: "Outfit_500Medium",
                fontSize: 13,
              }}
            >
              Owner: {item.farmerId?.name || "Unassigned"}
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textMuted}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
