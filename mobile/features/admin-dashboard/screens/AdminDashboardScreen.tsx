import React from "react";
import { View, ScrollView, TouchableOpacity, Text } from "react-native";
import { Users, Syringe, UserPlus } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme";
import { useAdminDashboard } from "../hooks/useAdminDashboard";
import { DashboardHero } from "../components/DashboardHero";
import { AnalyticsGrid } from "../components/AnalyticsGrid";
import { AdminAttentionOverview } from "../components/AdminAttentionOverview";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { SkeletonGrid } from "../components/SkeletonLoader";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const {
    stats,
    isLoading,
    activities,
    isActivitiesLoading,
    isActivitiesError,
    refetchActivities,
    attention,
    isAttentionLoading,
    isAttentionError,
    refetchAttention,
  } = useAdminDashboard();

  return (
    <View className="flex-1 bg-[#F0F4FF] dark:bg-slate-950">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* 1. Dashboard Hero */}
        <DashboardHero />

        {/* 2. Management Actions (Quick Actions) */}
        <View
          style={{ paddingHorizontal: 24, marginBottom: 24, marginTop: 12 }}
        >
          <Text
            style={{
              fontSize: 16,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Management Actions
          </Text>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 24,
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: isDark ? 0 : 0.02,
              shadowRadius: 8,
              elevation: isDark ? 0 : 2,
              gap: 16,
            }}
          >
            {/* Row 1 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ActionCategory
                title="All Users"
                icon={<Users size={22} color="#2563EB" />}
                iconBg="rgba(37,99,235,0.1)"
                onPress={() =>
                  router.push("/(admin)/(tabs)/admin.users" as any)
                }
              />
              <ActionCategory
                title="All Animals"
                icon={
                  <MaterialCommunityIcons
                    name="cow"
                    size={22}
                    color="#7c3aed"
                  />
                }
                iconBg="rgba(124,58,237,0.1)"
                onPress={() =>
                  router.push("/(admin)/(tabs)/admin.animals" as any)
                }
              />
              <ActionCategory
                title="Create User"
                icon={<UserPlus size={22} color="#dc2626" />}
                iconBg="rgba(220,38,38,0.1)"
                onPress={() => router.push("/(admin)/create-user" as any)}
              />
              <ActionCategory
                title="Records"
                icon={<Syringe size={22} color="#0891b2" />}
                iconBg="rgba(8,145,178,0.1)"
                onPress={() =>
                  router.push("/(admin)/(tabs)/admin.records" as any)
                }
              />
            </View>

            {/* Row 2 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ActionCategory
                title="Claims"
                icon={
                  <MaterialCommunityIcons
                    name="clipboard-check-outline"
                    size={22}
                    color="#16a34a"
                  />
                }
                iconBg="rgba(22,163,74,0.1)"
                onPress={() => router.push("/(admin)/claim-monitoring" as any)}
              />
              <ActionCategory
                title="Requests"
                icon={
                  <MaterialCommunityIcons
                    name="bell-ring-outline"
                    size={22}
                    color="#ea580c"
                  />
                }
                iconBg="rgba(234,88,12,0.1)"
                onPress={() =>
                  router.push("/(admin)/request-monitoring" as any)
                }
              />
              <ActionCategory
                title="Workload"
                icon={
                  <MaterialCommunityIcons
                    name="briefcase-account-outline"
                    size={22}
                    color="#4f46e5"
                  />
                }
                iconBg="rgba(79,70,229,0.1)"
                onPress={() =>
                  router.push("/(admin)/technician-workload" as any)
                }
              />
              <ActionCategory
                title="Reports"
                icon={
                  <MaterialCommunityIcons
                    name="file-chart-outline"
                    size={22}
                    color="#0d9488"
                  />
                }
                iconBg="rgba(13,148,136,0.1)"
                onPress={() => router.push("/(admin)/reports" as any)}
              />
            </View>
          </View>
        </View>

        <AdminAttentionOverview
          data={attention}
          isLoading={isAttentionLoading}
          isError={isAttentionError}
          onRetry={refetchAttention}
        />

        {/* 4. Today's Activity / Analytics */}
        {isLoading ? <SkeletonGrid /> : <AnalyticsGrid stats={stats} />}

        {/* 9. Recent Activity / Activity Timeline */}
        <ActivityTimeline
          activities={activities}
          isLoading={isActivitiesLoading}
          isError={isActivitiesError}
          onRetry={refetchActivities}
        />
      </ScrollView>
    </View>
  );
}

const ActionCategory = ({
  title,
  icon,
  iconBg,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  onPress?: () => void;
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      activeOpacity={0.7}
      style={{
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
      onPress={onPress}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
          backgroundColor: iconBg,
        }}
      >
        {icon}
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          color: colors.textPrimary,
          fontSize: 12,
          fontFamily: "Outfit_700Bold",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};
