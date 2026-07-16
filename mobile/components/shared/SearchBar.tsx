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
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const isDirectory = variant === "directory";

  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: isDirectory ? 28 : 20,
        paddingHorizontal: isDirectory ? 14 : 12,
        paddingVertical: isDirectory ? 4 : 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : isDirectory ? 0.08 : 0.05,
        shadowRadius: isDirectory ? 16 : 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: isDark ? 0 : isDirectory ? 4 : 3,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isFocused ? colors.primary : colors.border,
        minHeight: isDirectory ? 40 : 52,
      }}
    >
      <View
        style={{
          width: isDirectory ? 26 : 28,
          height: isDirectory ? 26 : 28,
          borderRadius: 13,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: isDirectory ? 0 : 2,
        }}
      >
        <Search
          size={isDirectory ? 18 : 20}
          color={isDirectory ? colors.textPrimary : colors.textMuted}
        />
      </View>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={{
          flex: 1,
          marginLeft: isDirectory ? 8 : 12,
          fontFamily: "Outfit_500Medium",
          color: colors.textPrimary,
          fontSize: 14,
          paddingVertical: 2,
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
            width: isDirectory ? 28 : 38,
            height: isDirectory ? 28 : 38,
            borderRadius: isDirectory ? 10 : 12,
            backgroundColor: isDirectory
              ? isDark
                ? "rgba(148,163,184,0.08)"
                : "#f8fafc"
              : "transparent",
            alignItems: "center",
            justifyContent: "center",
            marginRight: isDirectory ? 0 : -6,
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
            width: isDirectory ? 32 : 42,
            height: isDirectory ? 32 : 42,
            borderRadius: isDirectory ? 16 : 21,
            backgroundColor: filterActive
              ? isDark
                ? "rgba(16,185,129,0.18)"
                : "#dcfce7"
              : isDark
                ? "rgba(255,255,255,0.06)"
                : "#f4f4f2",
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 6,
          }}
        >
          <SlidersHorizontal
            size={isDirectory ? 16 : 18}
            color={filterActive ? colors.primary : colors.textPrimary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
