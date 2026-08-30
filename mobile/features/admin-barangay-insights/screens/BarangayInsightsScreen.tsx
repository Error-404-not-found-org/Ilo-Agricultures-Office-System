import React from "react";
import {
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ChevronRight,
  HeartPulse,
  MapPin,
  PawPrint,
  Syringe,
  UsersRound,
} from "lucide-react-native";
import Header from "@/components/Header";
import { AsyncState, SearchBar } from "@/components/shared";
import { ScreenLayout } from "@/components/ScreenLayout";
import { useTheme } from "@/lib/theme";
import { useBarangayInsights } from "../hooks/useBarangayInsights";
import type { BarangayInsightItem } from "../services/barangayInsights.service";
import { getPendingRequestCount } from "../utils/barangayWorkList";

const PRIMARY = "#1e3a5f";

export default function BarangayInsightsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const {
    summary,
    filteredBarangays,
    searchQuery,
    setSearchQuery,
    isLoading,
    isError,
    isRefetching,
    handleRefresh,
  } = useBarangayInsights();

  const openBarangay = (barangay: string) => {
    router.push({
      pathname: "/(admin)/barangay-details" as any,
      params: { name: barangay },
    });
  };

  const header = (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 24,
          fontFamily: "Outfit_800ExtraBold",
          color: colors.textPrimary,
          marginBottom: 14,
        }}
      >
        Barangay Insights
      </Text>

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 18,
        }}
      >
        <OverviewItem label="Barangays" value={summary.barangays} icon="map-marker-multiple-outline" />
        <OverviewItem label="Farmers" value={summary.farmers} icon="account-group-outline" />
        <OverviewItem label="Animals" value={summary.animals} icon="cow" />
      </View>

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search barangay..."
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
          Barangays
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>
          Sorted by pending requests
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenLayout edges={[]}>
      <StatusBar barStyle="light-content" />
      <View className="absolute top-0 left-0 right-0 h-[220px]" style={{ backgroundColor: PRIMARY }} />
      <Header />

      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? colors.background : "#F0F4FF",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          paddingHorizontal: 24,
          paddingTop: 24,
          marginTop: 8,
        }}
      >
        <FlatList
          data={isLoading ? [] : filteredBarangays}
          keyExtractor={(item) => [item.municipality || item.city, item.barangay].filter(Boolean).join("-")}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListHeaderComponent={header}
          ListEmptyComponent={() => {
            if (isLoading) return <AsyncState state="loading" />;
            if (isError) {
              return (
                <AsyncState
                  state="error"
                  title="Barangays unavailable"
                  message="Barangay information could not be loaded."
                  actionLabel="Retry"
                  onAction={handleRefresh}
                />
              );
            }
            return (
              <AsyncState
                state="empty"
                title="No barangays found"
                message={searchQuery ? "Try another barangay name." : "Barangay information will appear here."}
              />
            );
          }}
          renderItem={({ item }) => (
            <BarangayWorkCard item={item} onPress={() => openBarangay(item.barangay)} />
          )}
        />
      </View>
    </ScreenLayout>
  );
}

function OverviewItem({ label, value, icon }: { label: string; value: number; icon: string }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        paddingHorizontal: 8,
        paddingVertical: 12,
        alignItems: "center",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <MaterialCommunityIcons name={icon as any} size={17} color={isDark ? "#93c5fd" : PRIMARY} />
      <Text style={{ marginTop: 4, fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
        {label}
      </Text>
    </View>
  );
}

const BarangayWorkCard = React.memo(function BarangayWorkCard({
  item,
  onPress,
}: {
  item: BarangayInsightItem;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const pendingRequests = getPendingRequestCount(item);
  const municipality = item.municipality || item.city || "Oton";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View ${item.barangay} barangay details`}
      activeOpacity={0.72}
      onPress={onPress}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(147,197,253,0.12)" : "#e8eef7" }}>
          <MapPin size={18} color={isDark ? "#93c5fd" : PRIMARY} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 17, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
            {item.barangay}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
            {municipality}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 20, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
            {pendingRequests}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>
            Pending Requests
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        <FactItem icon={HeartPulse} label="Pending Health" value={item.pendingHealthRequests || 0} />
        <FactItem icon={Syringe} label="Pending AI" value={item.pendingAIRequests || 0} />
        <FactItem icon={UsersRound} label="Farmers" value={item.farmersCount || 0} />
        <FactItem icon={PawPrint} label="Animals" value={item.animalsCount || 0} />
      </View>

      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>View details</Text>
        <ChevronRight size={15} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
});

function FactItem({ icon: Icon, label, value }: { icon: typeof HeartPulse; label: string; value: number }) {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ width: "48%", minWidth: 0, flexGrow: 1, padding: 10, borderRadius: 12, backgroundColor: isDark ? "rgba(255,255,255,0.035)" : "#f8fafc" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon size={14} color={colors.textMuted} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
          {label}
        </Text>
      </View>
      <Text style={{ marginTop: 4, fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
        {value}
      </Text>
    </View>
  );
}
