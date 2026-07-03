import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { FilterType } from "../hooks/useTechnicianRecords";

const PRIMARY = "#00643B";

interface RecordFiltersProps {
  selectedFilter: FilterType;
  setSelectedFilter: (filter: FilterType) => void;
}

export function RecordFilters({
  selectedFilter,
  setSelectedFilter,
}: RecordFiltersProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ paddingHorizontal: 20, marginVertical: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 20 }}
      >
        {(
          ["All", "AI", "Pregnancy", "Calving", "Health"] as FilterType[]
        ).map((filter) => {
          const isActive = selectedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              onPress={() => setSelectedFilter(filter)}
              style={{
                backgroundColor: isActive
                  ? isDark
                    ? colors.primary
                    : PRIMARY
                  : colors.card,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isActive
                  ? isDark
                    ? colors.primary
                    : PRIMARY
                  : colors.border,
              }}
            >
              <Text
                style={{
                  color: isActive ? "#fff" : colors.textSecondary,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 12,
                }}
              >
                {filter === "AI"
                  ? "A.I."
                  : filter === "Health"
                    ? "Health Assistance"
                    : filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
