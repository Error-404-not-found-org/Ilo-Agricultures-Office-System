import React from "react";
import { ScrollView, TouchableOpacity, ViewStyle } from "react-native";
import { Text } from "@/components/ui/Text";
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
      style={{ flexGrow: 0 }}
      contentContainerStyle={[
        {
          flexDirection: "row",
          alignItems: "center",
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
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Filter by ${optionLabel}`}
            className="rounded-full border border-gray-100 bg-white dark:border-slate-800 dark:bg-slate-900"
            style={{
              backgroundColor: isActive ? colors.tint : undefined,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              minHeight: 44,
              maxWidth: 160,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              textRole="label"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: isActive ? colors.primary : colors.textSecondary,
                textAlign: "center",
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
