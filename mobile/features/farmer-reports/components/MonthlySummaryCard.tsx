import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

interface MonthlySummaryCardProps {
  totalCount: number;
}

const MonthlySummaryCard = ({ totalCount }: MonthlySummaryCardProps) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 24,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0 : 0.03,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 18,
        backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ecfdf5",
      }}
    >
        <MaterialCommunityIcons
          name="file-document-check-outline"
          size={28}
          color={isDark ? colors.primary : "#00643B"}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Outfit_700Bold",
            color: colors.textPrimary,
          }}
        >
          Official Animal History
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_500Medium",
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          {totalCount === 0
            ? "Completed service records will appear here."
            : `${totalCount} completed ${totalCount === 1 ? "record" : "records"} available across your animals.`}
        </Text>
      </View>
    </View>
  );
};

export default MonthlySummaryCard;
