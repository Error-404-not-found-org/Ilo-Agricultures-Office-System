import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/lib/theme";

export function TimelineSkeleton() {
  const { colors } = useTheme();

  return (
    <View className="gap-y-6">
      {/* Search / Filter bar skeleton */}
      <View className="flex-row gap-2 mb-2">
        <Skeleton width="40%" height={32} radius={16} />
        <Skeleton width="30%" height={32} radius={16} />
        <Skeleton width="25%" height={32} radius={16} />
      </View>

      {/* Timeline items */}
      {[1, 2, 3].map((key) => (
        <View key={key} className="flex-row">
          {/* Timeline Line/Circle Column */}
          <View className="items-center mr-4" style={{ width: 24 }}>
            <Skeleton width={16} height={16} radius={8} shape="circle" />
            <View 
              style={{ 
                width: 2, 
                height: 70, 
                backgroundColor: colors.border, 
                marginTop: 4,
                opacity: 0.5
              }} 
            />
          </View>
          {/* Content Box */}
          <View className="flex-1 pb-4">
            <Skeleton width="40%" height={16} radius={4} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={14} radius={4} style={{ marginBottom: 4 }} />
            <Skeleton width="60%" height={12} radius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}
