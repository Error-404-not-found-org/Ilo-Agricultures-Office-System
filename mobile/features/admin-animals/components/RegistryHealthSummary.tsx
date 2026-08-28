import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface RegistryHealthSummaryProps {
  duplicateEarTags: number;
  missingBreed: number;
  missingBirthdate: number;
  incompleteRecords: number;
}

export function RegistryHealthSummary({
  duplicateEarTags,
  missingBreed,
  missingBirthdate,
  incompleteRecords,
}: RegistryHealthSummaryProps) {
  const { colors, isDark } = useTheme();

  const Card = ({
    title,
    value,
    icon,
    color,
    bg,
  }: {
    title: string;
    value: number;
    icon: string;
    color: string;
    bg: string;
  }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: value > 0 ? color : colors.border,
        borderRadius: 20,
        padding: 16,
        minWidth: 130,
        marginRight: 10,
        flex: 1,
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 8,
        elevation: isDark ? 0 : 2,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: value > 0 ? bg : (isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9"),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={value > 0 ? color : colors.textMuted}
        />
      </View>
      <Text
        style={{
          fontSize: 18,
          fontFamily: "Outfit_800ExtraBold",
          color: value > 0 ? color : colors.textPrimary,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_600SemiBold",
          color: colors.textSecondary,
          marginTop: 2,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 20 }}
      contentContainerStyle={{ paddingHorizontal: 2 }}
    >
      <Card
        title="Duplicate Tags"
        value={duplicateEarTags}
        icon="alert-decagram-outline"
        color="#ef4444"
        bg={isDark ? "rgba(239,68,68,0.15)" : "#fef2f2"}
      />
      <Card
        title="Missing Breed"
        value={missingBreed}
        icon="help-circle-outline"
        color="#d97706"
        bg={isDark ? "rgba(217,119,6,0.15)" : "#fffbeb"}
      />
      <Card
        title="Missing DOB"
        value={missingBirthdate}
        icon="calendar-question"
        color="#2563EB"
        bg={isDark ? "rgba(37,99,235,0.15)" : "#eff6ff"}
      />
      <Card
        title="Incomplete"
        value={incompleteRecords}
        icon="file-percent-outline"
        color="#7c3aed"
        bg={isDark ? "rgba(124,58,237,0.15)" : "#f5f3ff"}
      />
    </ScrollView>
  );
}
