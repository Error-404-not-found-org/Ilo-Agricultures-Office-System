import React from "react";
import { View } from "react-native";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";

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
        alignItems: "flex-start",
        paddingVertical: 6,
      }}
    >
      <Text
        textRole="label"
        style={{
          flex: 0.9,
          color: colors.textSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        textRole="bodyStrong"
        style={{
          color: highlightColor || colors.textPrimary,
          textAlign: "right",
          flex: 1.2,
          marginLeft: 16,
        }}
      >
        {value || "Not recorded"}
      </Text>
    </View>
  );
};

export default DetailRow;
