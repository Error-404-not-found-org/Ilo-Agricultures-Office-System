import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import type { RecordStats } from "../types/farmerReports.types";

type BentoKey = "all" | "history" | "breeding" | "pregnancy" | "calving";
type RecordType = "all" | "ai" | "health" | "calving";

interface ReportsBentoGridProps {
  activeBento: BentoKey;
  onBentoPress: (bento: BentoKey, recordType: RecordType) => void;
  recordStats: RecordStats;
  milestonesCount: number;
}

interface RecordCategory {
  key: BentoKey;
  recordType: RecordType;
  label: string;
  helper: string;
  icon: string;
  count: number;
  color: string;
  tint: string;
}

const ReportsBentoGrid = ({
  activeBento,
  onBentoPress,
  recordStats,
  milestonesCount,
}: ReportsBentoGridProps) => {
  const { colors, isDark } = useTheme();

  const categories: RecordCategory[] = [
    {
      key: "history",
      recordType: "health",
      label: "Health",
      helper: "Visits and treatment",
      icon: "stethoscope",
      count: recordStats.health,
      color: isDark ? "#fca5a5" : "#b91c1c",
      tint: isDark ? "rgba(239,68,68,0.13)" : "#fef2f2",
    },
    {
      key: "breeding",
      recordType: "ai",
      label: "AI services",
      helper: "Insemination history",
      icon: "needle",
      count: recordStats.ai,
      color: isDark ? "#93c5fd" : "#1d4ed8",
      tint: isDark ? "rgba(59,130,246,0.13)" : "#eff6ff",
    },
    {
      key: "pregnancy",
      recordType: "all",
      label: "Pregnancy",
      helper: "Checks and cycles",
      icon: "heart-pulse",
      count: milestonesCount,
      color: isDark ? "#f9a8d4" : "#be185d",
      tint: isDark ? "rgba(236,72,153,0.13)" : "#fdf2f8",
    },
    {
      key: "calving",
      recordType: "calving",
      label: "Calving",
      helper: "Birth and offspring",
      icon: "baby-carriage",
      count: recordStats.calving,
      color: isDark ? "#fcd34d" : "#a16207",
      tint: isDark ? "rgba(245,158,11,0.13)" : "#fffbeb",
    },
  ];

  const selectCategory = (category: RecordCategory) => {
    if (activeBento === category.key) {
      onBentoPress("all", "all");
      return;
    }
    onBentoPress(category.key, category.recordType);
  };

  const primary = isDark ? colors.primary : "#00643B";

  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_800ExtraBold",
          fontSize: 18,
        }}
      >
        Browse records
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_500Medium",
          fontSize: 12,
          lineHeight: 17,
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        Choose a category to find information faster.
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ selected: activeBento === "all" }}
        accessibilityLabel={`All records, ${recordStats.total} records`}
        onPress={() => onBentoPress("all", "all")}
        style={{
          minHeight: 64,
          borderRadius: 16,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor:
            activeBento === "all"
              ? isDark
                ? "rgba(16,185,129,0.12)"
                : "#ecfdf5"
              : colors.card,
          borderWidth: activeBento === "all" ? 2 : 1,
          borderColor: activeBento === "all" ? primary : colors.border,
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "#dcfce7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name="file-document-multiple-outline"
            size={21}
            color={primary}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_700Bold",
              fontSize: 15,
            }}
          >
            All records
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_500Medium",
              fontSize: 11,
              marginTop: 1,
            }}
          >
            Complete animal history
          </Text>
        </View>
        <Text
          style={{
            color: primary,
            fontFamily: "Outfit_800ExtraBold",
            fontSize: 17,
          }}
        >
          {recordStats.total}
        </Text>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginHorizontal: -5,
          marginBottom: -10,
        }}
      >
        {categories.map((category) => {
          const selected = activeBento === category.key;
          return (
            <View
              key={category.key}
              style={{ width: "50%", paddingHorizontal: 5, marginBottom: 10 }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${category.label}, ${category.count} records`}
                onPress={() => selectCategory(category)}
                style={{
                  minHeight: 104,
                  borderRadius: 16,
                  padding: 13,
                  backgroundColor: selected ? category.tint : colors.card,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? category.color : colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: category.tint,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons
                      name={category.icon as any}
                      size={18}
                      color={category.color}
                    />
                  </View>
                  <Text
                    style={{
                      color: category.color,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 16,
                    }}
                  >
                    {category.count}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                    marginTop: 9,
                  }}
                >
                  {category.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 10,
                    marginTop: 1,
                  }}
                >
                  {category.helper}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default ReportsBentoGrid;
