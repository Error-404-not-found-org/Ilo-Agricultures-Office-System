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
        borderRadius: 20,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <Skeleton width="100%" height={154} radius={0} />
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1 }}>
            <Skeleton width="52%" height={17} radius={6} />
            <Skeleton width="65%" height={12} radius={6} style={{ marginTop: 8 }} />
          </View>
          <Skeleton width={76} height={24} radius={12} />
        </View>
        <View style={{ marginTop: 14 }}>
          <Skeleton width="100%" height={58} radius={13} />
        </View>
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
