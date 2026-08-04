import React from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface BarangayData {
  barangay: string;
  farmersCount: number;
  animalsCount: number;
  activePregnancies: number;
  pendingAIRequests: number;
  pendingHealthRequests: number;
  incompleteRecordsCount: number;
  aiSuccessRate: number | null;
  healthAlertsCount: number;
  activityScore: number;
  status: "critical" | "attention" | "healthy";
}

interface MunicipalityOverviewProps {
  barangays: BarangayData[];
  isLoading: boolean;
}

export function MunicipalityOverview({ barangays = [], isLoading }: MunicipalityOverviewProps) {
  const { colors, isDark } = useTheme();

  if (isLoading) {
    return (
      <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
          Municipality / City Overview
        </Text>
        <View style={{ height: 110, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (barangays.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
        Municipality / City Overview
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
        {barangays.map((item) => {
          const statusColor = item.status === "critical"
            ? "#ef4444"
            : item.status === "attention"
              ? "#d97706"
              : "#10b981";

          const statusBg = isDark
            ? (item.status === "critical"
                ? "rgba(239, 68, 68, 0.15)"
                : item.status === "attention"
                  ? "rgba(217, 119, 6, 0.15)"
                  : "rgba(16, 185, 129, 0.15)")
            : (item.status === "critical"
                ? "#fee2e2"
                : item.status === "attention"
                  ? "#fef3c7"
                  : "#d1fae5");

          return (
            <View
              key={item.barangay}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1.5,
                borderColor: isDark
                  ? (item.status === "critical"
                      ? "rgba(239, 68, 68, 0.3)"
                      : item.status === "attention"
                        ? "rgba(217, 119, 6, 0.3)"
                        : colors.border)
                  : (item.status === "critical"
                      ? "#fee2e2"
                      : item.status === "attention"
                        ? "#fef3c7"
                        : colors.border),
                borderRadius: 20,
                padding: 16,
                width: 200,
                shadowColor: "#000",
                shadowOpacity: isDark ? 0 : 0.02,
                shadowRadius: 8,
                elevation: isDark ? 0 : 2,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginRight: 8 }}>
                  Brgy. {item.barangay}
                </Text>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: statusColor,
                  }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Farmers:</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.farmersCount}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Animals:</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.animalsCount}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Active Pregnancies:</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#10b981" }}>{item.activePregnancies}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>AI Success Rate:</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Outfit_700Bold", color: "#2563EB" }}>
                    {item.aiSuccessRate !== null ? `${item.aiSuccessRate}%` : "—"}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
