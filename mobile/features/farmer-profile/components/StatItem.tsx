import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

interface StatItemProps {
  label: string;
  value: string | number;
  icon: any;
  color: string;
}

const StatItem = ({ label, value, icon, color }: StatItemProps) => {
  const { colors } = useTheme();
  return (
    <View className="flex-1 items-center">
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text
        className="text-xl font-outfit-black mt-1"
        style={{ color: colors.textPrimary }}
      >
        {value}
      </Text>
      <Text
        className="text-[9px] font-outfit-bold uppercase tracking-widest"
        style={{ color: colors.textMuted }}
      >
        {label}
      </Text>
    </View>
  );
};

export default StatItem;
