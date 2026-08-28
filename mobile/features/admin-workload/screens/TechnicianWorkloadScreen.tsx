import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AsyncState, StatusBadge } from "@/components/shared";
import { useRouter } from "expo-router";
import { BriefcaseBusiness, CircleAlert, CircleCheck, Inbox, MapPin } from "lucide-react-native";
import {
  getAvailabilityLabel,
  getCapabilityLabels,
  getDispatchReadinessPresentation,
  getFieldAreaLabel,
  getReceiveRequestsPresentation,
} from "@/features/admin-users/utils/dispatchPresentation";
import { getAdminRequestLocation } from "@/features/admin-requests/utils/adminRequestPresentation";

const PRIMARY = "#1e3a5f";
const TABS = ["Workload Overview", "Unassigned Requests", "Performance Board"];

export default function TechnicianWorkloadScreen() {
  const { colors } = useTheme();
  const api = useApi();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  // 1. Fetch Technicians
  const {
    data: technicians = [],
    isLoading: isTechsLoading,
    refetch: refetchTechs,
    isRefetching: isRefetchingTechs,
    isError: isTechsError,
  } = useQuery<any[]>({
    queryKey: ["admin-technicians-list"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 2. Fetch AI Requests
  const {
    data: aiRequests = [],
    isLoading: isAiLoading,
    refetch: refetchAi,
    isRefetching: isRefetchingAi,
    isError: isAiError,
  } = useQuery<any[]>({
    queryKey: ["admin-ai-requests"],
    queryFn: async () => {
      const res = await api.get("/ai-request?limit=100");
      return Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  // 3. Fetch Health Requests
  const {
    data: healthRequests = [],
    isLoading: isHealthLoading,
    refetch: refetchHealth,
    isRefetching: isRefetchingHealth,
    isError: isHealthError,
  } = useQuery<any[]>({
    queryKey: ["admin-health-requests"],
    queryFn: async () => {
      const res = await api.get("/health-request?limit=100");
      return Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = isTechsLoading || isAiLoading || isHealthLoading;
  const isError = isTechsError || isAiError || isHealthError;
  const isRefreshing = isRefetchingTechs || isRefetchingAi || isRefetchingHealth;

  const handleRefresh = async () => {
    await Promise.all([refetchTechs(), refetchAi(), refetchHealth()]);
  };

  // Compute workloads per technician
  const technicianWorkloads = useMemo(() => {
    return technicians.map((tech) => {
      const techId = tech._id;

      // Filter AI requests assigned to this technician
      const techAi = aiRequests.filter(
        (r) => (r.technicianId?._id || r.technicianId || r.approvedBy?._id || r.approvedBy) === techId
      );
      // Filter Health requests assigned to this technician
      const techHealth = healthRequests.filter(
        (r) => (r.handledBy?._id || r.handledBy || r.assignedTechnicianId?._id || r.assignedTechnicianId) === techId
      );

      const activeAi = techAi.filter((r) => ["approved", "in-progress", "scheduled"].includes(r.status));
      const activeHealth = techHealth.filter((r) => ["assigned", "scheduled", "in-progress", "in_progress"].includes(r.status));

      const completedAi = techAi.filter((r) => r.status === "done" || r.status === "completed");
      const completedHealth = techHealth.filter((r) => r.status === "resolved" || r.status === "done");

      const scheduledAi = techAi.filter((r) => r.status === "scheduled");
      const scheduledHealth = techHealth.filter((r) => r.status === "scheduled");

      // AI success rate calculation
      const diagnosedAi = completedAi.filter((r) => r.outcome === "Pregnant" || r.outcome === "Failed (Re-heat)" || r.outcome === "Failed (Negative PD)");
      const successfulAi = completedAi.filter((r) => r.outcome === "Pregnant" || r.isSuccess === true);
      const aiSuccessRate = diagnosedAi.length > 0 ? Math.round((successfulAi.length / diagnosedAi.length) * 100) : null;

      // Overdue check (scheduled date is in the past and request is not completed)
      const now = Date.now();
      const overdueAi = techAi.filter(
        (r) => ["approved", "scheduled", "in-progress"].includes(r.status) && r.scheduledDate && new Date(r.scheduledDate).getTime() < now
      ).length;
      const overdueHealth = techHealth.filter(
        (r) => ["assigned", "scheduled", "in-progress", "in_progress"].includes(r.status) && r.scheduledDate && new Date(r.scheduledDate).getTime() < now
      ).length;

      return {
        ...tech,
        activeRequests: activeAi.length + activeHealth.length,
        completedRequests: completedAi.length + completedHealth.length,
        scheduledVisits: scheduledAi.length + scheduledHealth.length,
        aiSuccessRate,
        overdueCount: overdueAi + overdueHealth,
      };
    });
  }, [technicians, aiRequests, healthRequests]);

  // Unassigned Generic / Pending requests queue
  const unassignedRequests = useMemo(() => {
    const unassignedAi = aiRequests
      .filter((r) => !r.technicianId && !r.approvedBy && r.status === "pending")
      .map((r) => ({ ...r, type: "ai" }));
    const unassignedHealth = healthRequests
      .filter((r) => !r.handledBy && !r.assignedTechnicianId && r.status === "pending")
      .map((r) => ({ ...r, type: "health" }));
    return [...unassignedAi, ...unassignedHealth].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [aiRequests, healthRequests]);

  // Leaders rankings based on completed requests and AI success rate
  const leaderboard = useMemo(() => {
    return [...technicianWorkloads].sort((a, b) => b.completedRequests - a.completedRequests);
  }, [technicianWorkloads]);

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      );
    }

    if (isError) {
      return (
        <AsyncState
          state="error"
          title="Workload unavailable"
          message="Technician and request data could not be loaded."
          actionLabel="Retry"
          onAction={handleRefresh}
        />
      );
    }

    if (activeTab === 0) {
      return (
        <FlatList
          data={technicianWorkloads}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="account-multiple-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                No technicians registered.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TechnicianWorkloadCard
              item={item}
              onPress={() => router.push({ pathname: "/(admin)/user-details" as any, params: { id: item._id } })}
            />
          )}
        />
      );
    }

    if (activeTab === 1) {
      return (
        <FlatList
          data={unassignedRequests}
          keyExtractor={(item) => `${item.type}-${item._id}`}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center" }}>
              <MaterialCommunityIcons name="check-circle-outline" size={48} color="#10b981" style={{ opacity: 0.5 }} />
              <Text style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                All requests have been claimed!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(admin)/request-details" as any,
                  params: { id: item._id, type: item.type },
                })
              }
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialCommunityIcons
                    name={item.type === "ai" ? "needle" : "medical-bag"}
                    size={16}
                    color={item.type === "ai" ? "#7c3aed" : "#ef4444"}
                  />
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {item.type === "ai" ? "Breeding Request" : "Health Request"}
                  </Text>
                </View>
                <StatusBadge label="Unassigned" variant="warning" />
              </View>
              <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
                Farmer: {item.farmerId?.name || "No Farmer Name"}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>
                Field location: {getAdminRequestLocation(item)}
              </Text>
            </TouchableOpacity>
          )}
        />
      );
    }

    if (activeTab === 2) {
      return (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          renderItem={({ item, index }) => (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                padding: 16,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: index === 0 ? "#fef08a" : index === 1 ? "#e2e8f0" : "rgba(30,58,95,0.05)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_800ExtraBold",
                    color: index === 0 ? "#a16207" : index === 1 ? "#475569" : colors.textPrimary,
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                  {item.name || "Technician"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                  Cases Resolved: {item.completedRequests} cases
                </Text>
              </View>
              {item.aiSuccessRate !== null && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>Success rate</Text>
                  <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: "#16a34a" }}>
                    {item.aiSuccessRate}%
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      );
    }
  };

  return (
    <ScreenLayout>
      {/* Custom back-header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          Technician Workload
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 12 }}>
        {/* Tab view */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 14, flexGrow: 0 }}>
          {TABS.map((tab, idx) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(idx)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                minHeight: 44,
                justifyContent: "center",
                borderRadius: 12,
                backgroundColor: activeTab === idx ? PRIMARY : colors.card,
                borderWidth: 1,
                borderColor: activeTab === idx ? PRIMARY : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Outfit_700Bold",
                  color: activeTab === idx ? "#fff" : colors.textSecondary,
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab list */}
        <View style={{ flex: 1 }}>{renderTabContent()}</View>
      </View>
    </ScreenLayout>
  );
}

function TechnicianWorkloadCard({ item, onPress }: { item: any; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const readiness = getDispatchReadinessPresentation(item);
  const receiveRequests = getReceiveRequestsPresentation(item.dispatchProfile);
  const capabilities = getCapabilityLabels(item.dispatchProfile);
  const metricBackground = isDark ? "rgba(255,255,255,0.03)" : "#f8fafc";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name || "Technician"} account details`}
      onPress={onPress}
      activeOpacity={0.75}
      style={{ backgroundColor: colors.card, borderRadius: 24, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Text style={{ flex: 1, fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>{item.name || "Technician"}</Text>
        <View style={{ backgroundColor: item.activeRequests > 3 ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
          <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: item.activeRequests > 3 ? "#ef4444" : "#10b981" }}>{item.activeRequests > 3 ? "High workload" : "Workload manageable"}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
        <Metric label="Active work" value={item.activeRequests} background={metricBackground} />
        <Metric label="Scheduled visits" value={item.scheduledVisits} background={metricBackground} />
        <Metric label="Completed work" value={item.completedRequests} background={metricBackground} />
        <Metric label="AI success rate" value={item.aiSuccessRate !== null ? `${item.aiSuccessRate}%` : "—"} background={metricBackground} accent />
      </View>

      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 7 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          {readiness.eligible ? <CircleCheck size={16} color="#16a34a" /> : <CircleAlert size={16} color="#d97706" />}
          <Text style={{ flex: 1, fontSize: 13, fontFamily: "Outfit_700Bold", color: readiness.eligible ? "#16a34a" : "#d97706" }}>{readiness.title}</Text>
        </View>
        <InfoLine icon={<MapPin size={15} color={colors.textMuted} />} text={`Field Area: ${getFieldAreaLabel(item.dispatchProfile)}`} />
        <InfoLine icon={<Inbox size={15} color={colors.textMuted} />} text={`${receiveRequests.label} · ${getAvailabilityLabel(item.dispatchProfile)}`} />
        <InfoLine icon={<BriefcaseBusiness size={15} color={colors.textMuted} />} text={capabilities.length ? capabilities.join(", ") : "No capabilities assigned"} />
      </View>

      {item.overdueCount > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "rgba(239,68,68,0.08)", padding: 10, borderRadius: 12, marginTop: 12 }}>
          <MaterialCommunityIcons name="clock-alert-outline" size={15} color="#ef4444" />
          <Text style={{ flex: 1, fontSize: 12, fontFamily: "Outfit_700Bold", color: "#ef4444" }}>{item.overdueCount} delayed or overdue service logs need follow-up.</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function Metric({ label, value, background, accent = false }: { label: string; value: string | number; background: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: "47%", backgroundColor: background, padding: 10, borderRadius: 16 }}>
      <Text style={{ fontSize: 12, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 18, fontFamily: "Outfit_800ExtraBold", color: accent ? "#2563eb" : colors.textPrimary, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>{icon}<Text style={{ flex: 1, fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>{text}</Text></View>;
}
