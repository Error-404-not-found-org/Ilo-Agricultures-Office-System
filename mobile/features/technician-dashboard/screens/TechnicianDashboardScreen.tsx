import React from "react";
import {
  View,
  ScrollView,
  StatusBar,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { AlertCircle } from "lucide-react-native";
import { useRouter } from "expo-router";

import { useTechnicianDashboardScreen } from "../hooks/useTechnicianDashboardScreen";
import { TechnicianHeroHeader } from "../components/TechnicianHeroHeader";
import { TechnicianStatsCard } from "../components/TechnicianStatsCard";
import {
  TechnicianQuickActions,
  getQuickActionGridMetrics,
} from "../components/TechnicianQuickActions";
import { TechnicianRouteSection } from "../components/TechnicianRouteSection";
import { TechnicianRequestsSection } from "../components/TechnicianRequestsSection";

export default function TechnicianDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const quickActionMetrics = getQuickActionGridMetrics(width);
  const [pastHeader, setPastHeader] = React.useState(false);

  const {
    clerkUser,
    loading,
    refreshing,
    onRefresh,
    unreadCount,
    todayWorkItems,
    dashboardStats,
    workLoading,
    pendingRequests,
    profileWarningVisible,
    setProfileWarningVisible,
    handleAction,
    handleRequestReview,
    isUpdating,
  } = useTechnicianDashboardScreen();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={pastHeader && !isDark ? "dark-content" : "light-content"}
        backgroundColor={
          pastHeader ? colors.background : isDark ? "#064e3e" : "#00643B"
        }
      />

      {/* Persistent Status Bar Safety Zone */}
      <View
        style={{
          height: insets.top,
          backgroundColor: pastHeader
            ? colors.background
            : isDark
              ? "#064e3e"
              : "#00643B",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const shouldUsePageColor = event.nativeEvent.contentOffset.y > 120;
          setPastHeader((current) =>
            current === shouldUsePageColor ? current : shouldUsePageColor,
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <TechnicianHeroHeader clerkUser={clerkUser} unreadCount={unreadCount} />

        <View
          style={{
            paddingHorizontal: quickActionMetrics.screenPadding,
            marginTop: -20,
            zIndex: 1,
            width: "100%",
            maxWidth: 960,
            alignSelf: "center",
          }}
        >
          <TechnicianStatsCard loading={loading} stats={dashboardStats} />

          <TechnicianQuickActions />

          <TechnicianRouteSection
            loading={workLoading}
            workItems={todayWorkItems}
            handleAction={handleAction}
          />

          <TechnicianRequestsSection
            loading={loading}
            pendingRequests={pendingRequests}
            isUpdating={isUpdating}
            handleAction={handleRequestReview}
          />
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={profileWarningVisible}
        onClose={() => setProfileWarningVisible(false)}
        onConfirm={() => {
          setProfileWarningVisible(false);
          router.push("/(technician)/(tabs)/profile" as any);
        }}
        title="Complete Your Profile"
        message="Please provide your contact number and service location in your profile so that farmers can reach you for veterinary and AI requests."
        confirmText="Go to Profile"
        cancelText="Cancel"
        isDestructive={true}
        icon={<AlertCircle size={26} color={colors.error} />}
      />
    </View>
  );
}
