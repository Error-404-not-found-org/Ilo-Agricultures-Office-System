import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Search, X } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onClear,
}: SearchBarProps) {
  const { colors, isDark } = useTheme();

  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
  };

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: isDark ? 0 : 0.05,
        shadowRadius: 10,
        elevation: isDark ? 0 : 3,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Search
        size={20}
        color={colors.textMuted}
        style={{ marginLeft: 8 }}
      />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={{
          flex: 1,
          marginLeft: 12,
          fontFamily: "Outfit_600SemiBold",
          color: colors.textPrimary,
          fontSize: 14,
        }}
        value={value}
        onChangeText={onChangeText}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={{
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
