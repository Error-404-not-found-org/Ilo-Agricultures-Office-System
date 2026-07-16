import React from "react";
import { View, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/lib/theme";
import { AppPageHeader } from "@/components/AppPageHeader";

export function AnimalProfileSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader
        title="Animal Profile"
        subtitle="Loading identity, lifecycle, health, and service history"
        rightAction={<Skeleton width={36} height={36} radius={18} />}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

      {/* Main Avatar Card */}
      <View className="px-6 mb-6">
        <View 
          className="p-5 rounded-[32px] border flex-col items-center"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          {/* Avatar Image Placeholder */}
          <Skeleton width="100%" height={200} radius={24} style={{ marginBottom: 16 }} />
          
          {/* Name & Tag */}
          <Skeleton width="60%" height={24} radius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={16} radius={4} style={{ marginBottom: 16 }} />

          {/* Action buttons row */}
          <View className="flex-row gap-3 w-full">
            <View className="flex-1">
              <Skeleton width="100%" height={48} radius={16} />
            </View>
            <View className="flex-1">
              <Skeleton width="100%" height={48} radius={16} />
            </View>
          </View>
        </View>
      </View>

      {/* Metrics Row */}
      <View className="px-6 mb-6">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Skeleton width="100%" height={60} radius={16} />
          </View>
          <View className="flex-1">
            <Skeleton width="100%" height={60} radius={16} />
          </View>
          <View className="flex-1">
            <Skeleton width="100%" height={60} radius={16} />
          </View>
        </View>
      </View>

      {/* Tabs Placeholder */}
      <View className="flex-row px-6 mb-6 gap-4">
        <View className="flex-1">
          <Skeleton width="100%" height={40} radius={8} />
        </View>
        <View className="flex-1">
          <Skeleton width="100%" height={40} radius={8} />
        </View>
        <View className="flex-1">
          <Skeleton width="100%" height={40} radius={8} />
        </View>
      </View>

      {/* Detail Blocks */}
      <View className="px-6 gap-y-4">
        <Skeleton width="100%" height={120} radius={24} />
        <Skeleton width="100%" height={100} radius={24} />
        <Skeleton width="100%" height={80} radius={24} />
      </View>
      </ScrollView>
    </View>
  );
}
