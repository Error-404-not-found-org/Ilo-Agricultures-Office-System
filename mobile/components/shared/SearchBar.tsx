import React, { useState } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  variant?: "default" | "directory";
  onFilterPress?: () => void;
  filterActive?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onClear,
  variant = "default",
  onFilterPress,
  filterActive = false,
}: SearchBarProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const isDirectory = variant === "directory";

  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View
      className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      style={[
        {
          paddingHorizontal: 12,
          paddingVertical: 4,
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 16,
          minHeight: 48,
        },
        isFocused ? { borderColor: colors.primary } : null,
      ]}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 0,
        }}
      >
        <Search size={18} color={colors.textMuted} />
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={{
          flex: 1,
          marginLeft: 8,
          fontFamily: "Outfit_400Regular",
          color: colors.textPrimary,
          fontSize: 14,
          lineHeight: 20,
          paddingVertical: 8,
        }}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginRight: -8,
          }}
        >
          <X size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
      {isDirectory && onFilterPress && (
        <TouchableOpacity
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel="Show search filters"
          accessibilityState={{ selected: filterActive }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: filterActive ? colors.tint : colors.surfaceSubtle,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 4,
            marginRight: -8,
          }}
        >
          <SlidersHorizontal
            size={18}
            color={filterActive ? colors.primary : colors.textPrimary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
