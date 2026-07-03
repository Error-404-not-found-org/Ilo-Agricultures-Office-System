import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/lib/theme";

export function AnimalCardSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Skeleton width={48} height={48} radius={12} />
      <View style={{ flex: 1, marginLeft: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Skeleton width="42%" height={15} radius={6} />
          <Skeleton width={70} height={18} radius={9} />
        </View>
        <Skeleton width="60%" height={11} radius={6} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

export function AnimalCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <AnimalCardSkeleton key={index} />
      ))}
    </View>
  );
}
