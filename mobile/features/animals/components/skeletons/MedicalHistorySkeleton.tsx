import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/lib/theme";

export function MedicalHistorySkeleton() {
  const { colors } = useTheme();

  return (
    <View className="gap-y-4">
      {/* Search / Filter bar skeleton */}
      <View className="flex-row gap-2 mb-2">
        <Skeleton width="30%" height={32} radius={16} />
        <Skeleton width="30%" height={32} radius={16} />
        <Skeleton width="30%" height={32} radius={16} />
      </View>

      {/* Cards list */}
      {[1, 2, 3].map((key) => (
        <View 
          key={key}
          className="p-5 rounded-[24px] flex-row items-center border"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          {/* Avatar Icon placeholder */}
          <Skeleton width={48} height={48} radius={24} shape="circle" style={{ marginRight: 16 }} />
          
          {/* Text block */}
          <View className="flex-1">
            <View className="flex-row justify-between items-center mb-2">
              <Skeleton width="50%" height={16} radius={4} />
              <Skeleton width="20%" height={14} radius={7} />
            </View>
            <Skeleton width="80%" height={14} radius={4} style={{ marginBottom: 6 }} />
            <Skeleton width="60%" height={12} radius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}
