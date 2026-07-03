import React from "react";
import { View, TouchableOpacity } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

interface AnimalPaginationProps {
  page: number;
  totalPages: number;
  goToPage: (p: number) => void;
}

export function AnimalPagination({
  page,
  totalPages,
  goToPage,
}: AnimalPaginationProps) {
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
        onPress={() => goToPage(page - 1)}
        disabled={page === 1}
        style={{ opacity: page === 1 ? 0.3 : 1 }}
      >
        <ChevronLeft size={24} color={colors.primary} />
      </TouchableOpacity>
      <Text variant="extrabold" size={13} color="secondary">
        {page} / {totalPages}
      </Text>
      <TouchableOpacity
        onPress={() => goToPage(page + 1)}
        disabled={page === totalPages}
        style={{ opacity: page === totalPages ? 0.3 : 1 }}
      >
        <ChevronRight size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}
