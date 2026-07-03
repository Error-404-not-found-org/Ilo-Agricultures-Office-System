import React from "react";
import { ScrollView, TouchableOpacity, Text, ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

export interface FilterChipOption {
  label: string;
  value: string;
}

interface FilterChipsProps {
  options: (string | FilterChipOption)[];
  value: string;
  onChange: (value: string) => void;
  containerStyle?: ViewStyle;
}

export function FilterChips({
  options,
  value,
  onChange,
  containerStyle,
}: FilterChipsProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        {
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 20,
        },
        containerStyle,
      ]}
    >
      {options.map((option) => {
        const optionLabel = typeof option === "string" ? option : option.label;
        const optionValue = typeof option === "string" ? option : option.value;
        const isActive = value === optionValue;

        return (
          <TouchableOpacity
            key={optionValue}
            onPress={() => onChange(optionValue)}
            style={{
              backgroundColor: isActive ? colors.primary : colors.card,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isActive ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: isActive ? "#fff" : colors.textSecondary,
                fontFamily: "Outfit_700Bold",
                fontSize: 12,
              }}
            >
              {optionLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
