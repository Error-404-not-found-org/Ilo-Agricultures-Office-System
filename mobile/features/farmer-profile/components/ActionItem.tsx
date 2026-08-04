import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface ActionItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
}

const ActionItem = ({ icon, label, onPress, isDestructive }: ActionItemProps) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="p-4 flex-row items-center justify-between active:bg-slate-50 dark:active:bg-slate-800"
      style={{ backgroundColor: colors.card }}
    >
      <View className="flex-1 flex-row items-center gap-4 pr-3">
        <View
          className={`w-9 h-9 rounded-xl items-center justify-center`}
          style={{
            backgroundColor: isDestructive
              ? isDark
                ? "rgba(239, 68, 68, 0.2)"
                : "#fef2f2"
              : isDark
                ? colors.background
                : "#f8fafc",
          }}
        >
          {icon}
        </View>
        <Text
          numberOfLines={2}
          className={`text-sm ${isDestructive ? "font-outfit-bold" : "font-outfit-semibold"}`}
          style={{ flex: 1, color: isDestructive ? colors.error : colors.textPrimary }}
        >
          {label}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

export default ActionItem;
