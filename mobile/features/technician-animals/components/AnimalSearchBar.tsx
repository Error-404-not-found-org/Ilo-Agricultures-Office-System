import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Search, Filter } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface AnimalSearchBarProps {
  searchQuery: string;
  setSearchQuery: (text: string) => void;
}

export function AnimalSearchBar({ searchQuery, setSearchQuery }: AnimalSearchBarProps) {
  const { colors, isDark } = useTheme();

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
        placeholder="Search tag, species, or owner..."
        placeholderTextColor={colors.textMuted}
        style={{
          flex: 1,
          marginLeft: 12,
          fontFamily: "Outfit_600SemiBold",
          color: colors.textPrimary,
          fontSize: 14,
        }}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <TouchableOpacity
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Filter size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
