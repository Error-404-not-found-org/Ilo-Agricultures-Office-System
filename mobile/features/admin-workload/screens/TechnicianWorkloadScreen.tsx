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
import type { UserItem } from "@/features/admin-users/types/adminUsers.types";
import { getAdminTechnicianWorkloadSummary } from "../services/adminWorkload.service";
import {
  mergeTechniciansWithWorkload,
  type TechnicianWorkloadViewRow,
} from "../utils/adminWorkloadPresentation";

const PRIMARY = "#1e3a5f";
const TABS = ["Workload Overview", "Unassigned Requests"];

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
  } = useQuery<UserItem[]>({
    queryKey: ["admin-technicians-list"],
    queryFn: async () => {
      const res = await api.get("/admin/list-users?role=technician");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: workloadSummary = [],
    isLoading: isWorkloadLoading,
    refetch: refetchWorkload,
    isRefetching: isRefetchingWorkload,
    isError: isWorkloadError,
  } = useQuery({
    queryKey: ["admin-technician-workload-summary"],
    queryFn: () => getAdminTechnicianWorkloadSummary(api),
    staleTime: 1000 * 60 * 2,
  });

  // The capped request lists remain only for the separate unassigned queue.
  const {
    data: aiRequests = [],
    isLoading: isAiLoading,
    refetch: refetchAi,
    isRefetching: isRefetchingAi,
    isError: isAiError,
  } = useQuery<any[]>({
    queryKey: ["admin-ai-requests"],
    enabled: activeTab === 1,
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
    enabled: activeTab === 1,
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

  const isLoading =
    isTechsLoading ||
    (activeTab === 0 ? isWorkloadLoading : isAiLoading || isHealthLoading);
  const isError =
    isTechsError ||
    (activeTab === 0 ? isWorkloadError : isAiError || isHealthError);
  const isRefreshing =
    isRefetchingTechs ||
    (activeTab === 0
      ? isRefetchingWorkload
      : isRefetchingAi || isRefetchingHealth);

  const handleRefresh = async () => {
    if (activeTab === 0) {
      await Promise.all([refetchTechs(), refetchWorkload()]);
      return;
    }

    await Promise.all([refetchTechs(), refetchAi(), refetchHealth()]);
  };

  const technicianWorkloads = useMemo(() => {
    return mergeTechniciansWithWorkload({
      technicians,
      workload: workloadSummary,
    });
  }, [technicians, workloadSummary]);

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
          keyExtractor={(item) => item.technicianId}
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
              onPress={() =>
                router.push({
                  pathname: "/(admin)/user-details" as any,
                  params: { id: item.technicianId },
                })
              }
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

function TechnicianWorkloadCard({
  item,
  onPress,
}: {
  item: TechnicianWorkloadViewRow;
  onPress: () => void;
}) {
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
        <View style={{ backgroundColor: "rgba(30,58,95,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
          <Text style={{ fontSize: 12, fontFamily: "Outfit_700Bold", color: PRIMARY }}>
            {item.activeWorkloadTotal} active
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }}>
        <Metric label="AI requests" value={item.counts.ai} background={metricBackground} />
        <Metric label="Health requests" value={item.counts.health} background={metricBackground} />
        <Metric label="Pregnancy tasks" value={item.counts.pregnancy} background={metricBackground} />
        <Metric label="Calving tasks" value={item.counts.calving} background={metricBackground} />
        <Metric label="Other tasks" value={item.counts.tasks} background={metricBackground} />
        <Metric label="Total active" value={item.activeWorkloadTotal} background={metricBackground} accent />
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
