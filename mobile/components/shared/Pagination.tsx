import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

export function Pagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}: PaginationProps) {
  const { colors } = useTheme();

  if (totalPages <= 1) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        marginTop: 10,
      }}
    >
      <TouchableOpacity
        onPress={onPrevious}
        disabled={page === 1}
        style={{ opacity: page === 1 ? 0.3 : 1 }}
        accessibilityLabel="Previous Page"
        accessibilityRole="button"
      >
        <ChevronLeft size={24} color={colors.primary} />
      </TouchableOpacity>
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_700Bold",
          fontSize: 13,
        }}
      >
        {page} / {totalPages}
      </Text>
      <TouchableOpacity
        onPress={onNext}
        disabled={page === totalPages}
        style={{ opacity: page === totalPages ? 0.3 : 1 }}
        accessibilityLabel="Next Page"
        accessibilityRole="button"
      >
        <ChevronRight size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
