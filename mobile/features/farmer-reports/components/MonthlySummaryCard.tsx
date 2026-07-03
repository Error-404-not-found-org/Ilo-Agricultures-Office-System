import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/lib/theme";

interface MonthlySummaryCardProps {
  pendingCount: number;
  totalCount: number;
}

const MonthlySummaryCard = ({ pendingCount, totalCount }: MonthlySummaryCardProps) => {
  const { colors, isDark } = useTheme();

  const completedCount = Math.max(0, totalCount - pendingCount);
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
          position: "relative",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Svg
          width={64}
          height={64}
          style={{ transform: [{ rotate: "-90deg" }] }}
        >
          <Circle
            cx="32"
            cy="32"
            r="26"
            fill="transparent"
            stroke={isDark ? colors.border : "#e2e8f0"}
            strokeWidth="5"
          />
          <Circle
            cx="32"
            cy="32"
            r="26"
            fill="transparent"
            stroke={isDark ? colors.primary : "#00643B"}
            strokeWidth="5"
            strokeDasharray={2 * Math.PI * 26}
            strokeDashoffset={2 * Math.PI * 26 * (1 - percentage / 100)}
            strokeLinecap="round"
          />
        </Svg>
        <View style={{ position: "absolute" }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Outfit_800ExtraBold",
              color: isDark ? colors.primary : "#00643B",
            }}
          >
            {percentage}%
          </Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: "Outfit_700Bold",
            color: colors.textPrimary,
          }}
        >
          Monthly Summary
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_500Medium",
            color: colors.textSecondary,
            marginTop: 2,
          }}
        >
          {pendingCount} records pending review. Keep up the good work!
        </Text>
      </View>
    </View>
  );
};

export default MonthlySummaryCard;
