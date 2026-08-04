import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
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
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 16,
        paddingHorizontal: 4,
        paddingBottom: 8,
      }}
    >
      <TouchableOpacity
        onPress={onPrevious}
        disabled={page === 1}
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          opacity: page === 1 ? 0.4 : 1,
        }}
        accessibilityLabel="Previous Page"
        accessibilityRole="button"
      >
        <ChevronLeft size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text textRole="label" color="secondary">
        Page {page} of {totalPages}
      </Text>
      <TouchableOpacity
        onPress={onNext}
        disabled={page === totalPages}
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          opacity: page === totalPages ? 0.4 : 1,
        }}
        accessibilityLabel="Next Page"
        accessibilityRole="button"
      >
        <ChevronRight size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
