import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";

interface DetailRowProps {
  label: string;
  value?: string;
  highlightColor?: string;
}

const DetailRow = ({ label, value, highlightColor }: DetailRowProps) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_500Medium",
          color: colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: "Outfit_700Bold",
          color: highlightColor || colors.textPrimary,
          textTransform: "capitalize",
          textAlign: "right",
          flex: 1,
          marginLeft: 16,
        }}
      >
        {value || "N/A"}
      </Text>
    </View>
  );
};

export default DetailRow;
