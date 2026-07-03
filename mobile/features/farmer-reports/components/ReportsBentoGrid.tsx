import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Syringe } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import type { RecordStats } from "../types/farmerReports.types";

interface ReportsBentoGridProps {
  activeBento: "all" | "history" | "breeding" | "pregnancy" | "calving";
  onBentoPress: (
    bento: "all" | "history" | "breeding" | "pregnancy" | "calving",
    recordType: "all" | "ai" | "health" | "calving"
  ) => void;
  recordStats: RecordStats;
  milestonesCount: number;
}

const ReportsBentoGrid = ({
  activeBento,
  onBentoPress,
  recordStats,
  milestonesCount,
}: ReportsBentoGridProps) => {
  const { colors, isDark } = useTheme();

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
        {/* Card 1: Animal History (Health) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (activeBento === "history") {
              onBentoPress("all", "all");
            } else {
              onBentoPress("history", "health");
            }
          }}
          style={{
            flex: 1,
            aspectRatio: 1,
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: 16,
            justifyContent: "space-between",
            borderWidth: activeBento === "history" ? 2 : 1,
            borderColor:
              activeBento === "history"
                ? isDark
                  ? colors.primary
                  : "#00643B"
                : colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark
                  ? "rgba(0, 100, 59, 0.15)"
                  : "rgba(0, 100, 59, 0.05)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="history"
                size={22}
                color={isDark ? colors.primary : "#00643B"}
              />
            </View>
            <View
              style={{
                backgroundColor: isDark
                  ? "rgba(0, 100, 59, 0.15)"
                  : "#ecfdf5",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_700Bold",
                  color: isDark ? colors.primary : "#00643B",
                }}
              >
                {recordStats.pending}
              </Text>
            </View>
          </View>
          <View>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Outfit_700Bold",
                color: colors.textPrimary,
                lineHeight: 18,
              }}
            >
              Animal History
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Movement & Health
            </Text>
          </View>
        </TouchableOpacity>

        {/* Card 2: AI & Breeding (AI) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (activeBento === "breeding") {
              onBentoPress("all", "all");
            } else {
              onBentoPress("breeding", "ai");
            }
          }}
          style={{
            flex: 1,
            aspectRatio: 1,
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: 16,
            justifyContent: "space-between",
            borderWidth: activeBento === "breeding" ? 2 : 1,
            borderColor:
              activeBento === "breeding"
                ? isDark
                  ? colors.primary
                  : "#00643B"
                : colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark
                  ? "rgba(37, 99, 235, 0.15)"
                  : "rgba(37, 99, 235, 0.05)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Syringe size={22} color="#2563eb" />
            </View>
            <View
              style={{
                backgroundColor: "rgba(37, 99, 235, 0.08)",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_700Bold",
                  color: "#2563eb",
                }}
              >
                {recordStats.approved}
              </Text>
            </View>
          </View>
          <View>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Outfit_700Bold",
                color: colors.textPrimary,
                lineHeight: 18,
              }}
            >
              AI & Breeding
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Insemination Logs
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
        {/* Card 3: Pregnancy Records (Cycles) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (activeBento === "pregnancy") {
              onBentoPress("all", "all");
            } else {
              onBentoPress("pregnancy", "all");
            }
          }}
          style={{
            flex: 1,
            aspectRatio: 1,
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: 16,
            justifyContent: "space-between",
            borderWidth: activeBento === "pregnancy" ? 2 : 1,
            borderColor:
              activeBento === "pregnancy"
                ? isDark
                  ? colors.primary
                  : "#00643B"
                : colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(16, 185, 129, 0.05)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="heart-pulse"
                size={22}
                color={isDark ? colors.primary : "#059669"}
              />
            </View>
            <View
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_700Bold",
                  color: isDark ? colors.primary : "#059669",
                }}
              >
                {milestonesCount}
              </Text>
            </View>
          </View>
          <View>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Outfit_700Bold",
                color: colors.textPrimary,
                lineHeight: 18,
              }}
            >
              Pregnancy Records
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Ultrasound & Cycles
            </Text>
          </View>
        </TouchableOpacity>

        {/* Card 4: Calving & Offspring (Calving) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            if (activeBento === "calving") {
              onBentoPress("all", "all");
            } else {
              onBentoPress("calving", "calving");
            }
          }}
          style={{
            flex: 1,
            aspectRatio: 1,
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: 16,
            justifyContent: "space-between",
            borderWidth: activeBento === "calving" ? 2 : 1,
            borderColor:
              activeBento === "calving"
                ? isDark
                  ? colors.primary
                  : "#00643B"
                : colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0 : 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark
                  ? "rgba(180, 83, 9, 0.15)"
                  : "rgba(180, 83, 9, 0.05)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="baby-carriage"
                size={22}
                color="#b45309"
              />
            </View>
            <View
              style={{
                backgroundColor: "rgba(180, 83, 9, 0.08)",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_700Bold",
                  color: "#b45309",
                }}
              >
                {recordStats.rejected}
              </Text>
            </View>
          </View>
          <View>
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Outfit_700Bold",
                color: colors.textPrimary,
                lineHeight: 18,
              }}
            >
              Calving & Offspring
            </Text>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Newborn Registry
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ReportsBentoGrid;
