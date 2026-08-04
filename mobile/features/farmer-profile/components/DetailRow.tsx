import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  onPress?: () => void;
}

const DetailRow = ({ icon, label, value, onPress }: DetailRowProps) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className="p-4 flex-row items-center gap-4 active:bg-slate-50 dark:active:bg-slate-800"
      style={{ backgroundColor: colors.card }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: isDark ? colors.background : "#f8fafc" }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          className="text-[9px] font-outfit-bold uppercase tracking-widest"
          style={{ color: colors.textMuted }}
        >
          {label}
        </Text>
        <Text
          className="text-sm font-outfit-semibold mt-0.5"
          style={{ color: colors.textPrimary }}
        >
          {value || "Not Set"}
        </Text>
      </View>
      {onPress && <ChevronRight size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
};

export default DetailRow;
