import React from "react";
import { View, ScrollView, TouchableOpacity, Text, LayoutAnimation } from "react-native";
import { Users, Syringe, UserPlus } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "@/lib/theme";
import { useAdminDashboard } from "../hooks/useAdminDashboard";
import { DashboardHero } from "../components/DashboardHero";
import { AnalyticsGrid } from "../components/AnalyticsGrid";
import { MunicipalityOverview } from "../components/MunicipalityOverview";
import { TechnicianPerformance } from "../components/TechnicianPerformance";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { RegistryHealthCard } from "../components/RegistryHealthCard";
import { SystemHealthCard } from "../components/SystemHealthCard";
import { MoowieInsightsCard } from "../components/MoowieInsightsCard";
import { AlertsPanel } from "../components/AlertsPanel";
import { BackupMonitorPanel } from "../components/BackupMonitorPanel";
import { SkeletonGrid, SkeletonCard, SkeletonMoowieCard } from "../components/SkeletonLoader";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [diagnosticsExpanded, setDiagnosticsExpanded] = React.useState(false);
  const {
    stats,
    isLoading,
    monitoring,
    isMonitoringLoading,
    barangays,
    isBarangaysLoading,
    triggerBackup,
    isBackingUp,
  } = useAdminDashboard();

  const showMonitoring = !isMonitoringLoading && !!monitoring;

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
        <View style={{ paddingHorizontal: 24, marginBottom: 24, marginTop: 12 }}>
          <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <ActionCategory
                title="All Users"
                icon={<Users size={22} color="#2563EB" />}
                iconBg="rgba(37,99,235,0.1)"
                onPress={() => router.push("/(admin)/(tabs)/admin.users" as any)}
              />
              <ActionCategory
                title="All Animals"
                icon={<MaterialCommunityIcons name="cow" size={22} color="#7c3aed" />}
                iconBg="rgba(124,58,237,0.1)"
                onPress={() => router.push("/(admin)/(tabs)/admin.animals" as any)}
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
                onPress={() => router.push("/(admin)/(tabs)/admin.records" as any)}
              />
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <ActionCategory
                title="Claims"
                icon={<MaterialCommunityIcons name="clipboard-check-outline" size={22} color="#16a34a" />}
                iconBg="rgba(22,163,74,0.1)"
                onPress={() => router.push("/(admin)/claim-monitoring" as any)}
              />
              <ActionCategory
                title="Requests"
                icon={<MaterialCommunityIcons name="bell-ring-outline" size={22} color="#ea580c" />}
                iconBg="rgba(234,88,12,0.1)"
                onPress={() => router.push("/(admin)/request-monitoring" as any)}
              />
              <ActionCategory
                title="Workload"
                icon={<MaterialCommunityIcons name="briefcase-account-outline" size={22} color="#4f46e5" />}
                iconBg="rgba(79,70,229,0.1)"
                onPress={() => router.push("/(admin)/technician-workload" as any)}
              />
              <ActionCategory
                title="Reports"
                icon={<MaterialCommunityIcons name="file-chart-outline" size={22} color="#0d9488" />}
                iconBg="rgba(13,148,136,0.1)"
                onPress={() => router.push("/(admin)/reports" as any)}
              />
            </View>
          </View>
        </View>

        {/* System Administration Operations Row */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 12 }}>
            System Administration
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Support Tickets Button */}
            <TouchableOpacity
              onPress={() => router.push("/(admin)/support-tickets" as any)}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialCommunityIcons name="face-agent" size={18} color="#3b82f6" />
              <View>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Support</Text>
                <Text style={{ fontSize: 9, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>Tickets</Text>
              </View>
            </TouchableOpacity>

            {/* Audit Logs Button */}
            <TouchableOpacity
              onPress={() => router.push("/(admin)/audit-logs" as any)}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialCommunityIcons name="history" size={18} color="#16a34a" />
              <View>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Audit Logs</Text>
                <Text style={{ fontSize: 9, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>History Feed</Text>
              </View>
            </TouchableOpacity>

            {/* System Settings Button */}
            <TouchableOpacity
              onPress={() => router.push("/(admin)/system-settings" as any)}
              style={{
                flex: 1,
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <MaterialCommunityIcons name="cog-outline" size={18} color="#7c3aed" />
              <View>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Settings</Text>
                <Text style={{ fontSize: 9, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>App Config</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

    
        {/* 4. Today's Activity / Analytics */}
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <AnalyticsGrid stats={stats} />
        )}

        {/* 4.5 Municipality/Barangay Overview */}
        <MunicipalityOverview barangays={barangays} isLoading={isBarangaysLoading} />

        {/* Alerts and Monitoring Loading Check */}
        {isMonitoringLoading && !monitoring ? (
          <>
            {/* Skeleton for Alerts */}
            <SkeletonCard rows={2} style={{ marginHorizontal: 24, marginBottom: 24 }} />

            {/* Skeleton for Moowie */}
            <SkeletonMoowieCard />
          </>
        ) : (
          <>
            {/* 5. Alerts */}
            <AlertsPanel alerts={monitoring?.alerts} />

            {/* 6. Moowie Executive Summary */}
            <MoowieInsightsCard data={monitoring?.moowieInsights} />
          </>
        )}

        {/* 7. Technician Performance Metrics
        <TechnicianPerformance /> */}

        {/* 8. Registry Statistics */}
        {showMonitoring && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 24,
                padding: 20,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialCommunityIcons name="database-outline" size={22} color="#7c3aed" />
                <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  Registry Statistics
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="alert-decagram" size={20} color="#ef4444" />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {monitoring?.registryMonitor?.duplicateEarTags ?? 0}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Duplicate Ear Tags</Text>
                  </View>
                </View>

                <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#d97706" />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {monitoring?.registryMonitor?.missingAnimalData ?? 0}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Missing Breed/DOB</Text>
                  </View>
                </View>

                <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="archive-outline" size={20} color="#64748b" />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {monitoring?.registryMonitor?.archivedRecords ?? 0}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Archived Records</Text>
                  </View>
                </View>

                <View style={{ width: "47%", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="cloud-alert" size={20} color="#3b82f6" />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {monitoring?.systemHealth?.pendingSync ?? 0}
                    </Text>
                    <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Pending Syncs</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 9. Recent Activity / Activity Timeline */}
        <ActivityTimeline />

        {/* 10. System Diagnostics (collapsed) */}
        {showMonitoring && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setDiagnosticsExpanded(!diagnosticsExpanded);
              }}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 24,
                padding: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="shield-bug-outline" size={22} color="#64748b" />
                <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  System Diagnostics
                </Text>
              </View>
              <MaterialCommunityIcons
                name={diagnosticsExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {diagnosticsExpanded && (
              <View style={{ marginTop: 12, gap: 12 }}>
                {/* System Health Status Widget */}
                <SystemHealthCard data={monitoring?.systemHealth} />

                {/* Registry Health & Integrity Widget */}
                <RegistryHealthCard
                  data={monitoring?.registryMonitor}
                  pendingSync={monitoring?.systemHealth?.pendingSync}
                />

                {/* Database Backup Monitor */}
                <BackupMonitorPanel
                  data={monitoring?.backupMonitor}
                  onTriggerBackup={triggerBackup}
                  isBackingUp={isBackingUp}
                />
              </View>
            )}
          </View>
        )}
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
          fontSize: 11,
          fontFamily: "Outfit_700Bold",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};
