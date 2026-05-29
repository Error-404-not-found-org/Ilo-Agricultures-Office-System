import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Syringe,
  Stethoscope,
  Clock,
  Trash2,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
} from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

export default function MyRequests() {
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : "#00643B";

  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("all");
  const [allRequests, setAllRequests] = React.useState<any[]>([]);

  const {
    data: aiData,
    isLoading: loadingAi,
    isRefetching: refetchingAi,
    refetch: refetchAi,
  } = useQuery({
    queryKey: ["farmer", "ai-requests", page, status],
    queryFn: async () => {
      let aiStatus = status;
      const res = await api.get(
        `/ai-request/my?page=${page}&limit=10&status=${aiStatus}`,
      );
      return res.data;
    },
  });

  const {
    data: healthData,
    isLoading: loadingHealth,
    isRefetching: refetchingHealth,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["farmer", "health-requests", page, status],
    queryFn: async () => {
      let healthStatus = status;
      if (status === "done") healthStatus = "resolved";
      if (status === "rejected") healthStatus = "cancelled";

      const res = await api.get(
        `/health-request/my?page=${page}&limit=10&status=${healthStatus}`,
      );
      return res.data;
    },
  });

  React.useEffect(() => {
    if (aiData?.data || healthData?.data) {
      const aiItems = (aiData?.data || []).map((r: any) => ({
        ...r,
        type: "ai",
      }));
      const healthItems = (healthData?.data || []).map((r: any) => ({
        ...r,
        type: "health",
      }));

      const combined = [...aiItems, ...healthItems].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      if (page === 1) {
        setAllRequests(combined);
      } else {
        setAllRequests((prev) => {
          const existingIds = new Set(prev.map((p) => `${p.type}-${p._id}`));
          const uniqueNew = combined.filter(
            (c) => !existingIds.has(`${c.type}-${c._id}`),
          );
          return [...prev, ...uniqueNew].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
      }
    }
  }, [aiData, healthData, page, status]);

  const isLoading = (loadingAi && page === 1) || (loadingHealth && page === 1);
  const isRefetching = refetchingAi || refetchingHealth;

  const hasMore =
    aiData?.page < aiData?.pages || healthData?.page < healthData?.pages;

  const onRefresh = () => {
    setPage(1);
    refetchAi();
    refetchHealth();
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
    setAllRequests([]);
  };

  const loadMore = () => {
    if (hasMore && !isLoading && !isRefetching) {
      setPage((prev) => prev + 1);
    }
  };

  const STATUS_FILTERS = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "In-Progress", value: "in-progress" },
    { label: "Resolved", value: "done" },
  ];

  const handleDelete = (id: string, type: string, animalTag: string) => {
    const endpoint =
      type === "ai" ? `/ai-request/${id}` : `/health-request/${id}`;

    Alert.alert(
      "Cancel Request?",
      `Are you sure you want to cancel this request for ${animalTag}? This action cannot be undone.`,
      [
        { text: "No, Keep it", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(endpoint);
              toast.success("Request cancelled successfully");
              queryClient.invalidateQueries({
                queryKey: ["farmer", "ai-requests"],
              });
              queryClient.invalidateQueries({
                queryKey: ["farmer", "health-requests"],
              });
            } catch (err: any) {
              toast.error(
                err.response?.data?.message || "Failed to cancel request",
              );
            }
          },
        },
      ],
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7",
          text: isDark ? "#fbbf24" : "#92400E",
        };
      case "approved":
        return {
          bg: isDark ? "rgba(16, 185, 129, 0.15)" : "#ECFDF5",
          text: isDark ? "#34d399" : "#065F46",
        };
      case "in-progress":
        return {
          bg: isDark ? "rgba(59, 130, 246, 0.15)" : "#EFF6FF",
          text: isDark ? "#60a5fa" : "#1E40AF",
        };
      case "done":
      case "resolved":
        return {
          bg: isDark ? "rgba(107, 114, 128, 0.15)" : "#F1F5F9",
          text: isDark ? "#9ca3af" : "#475569",
        };
      case "rejected":
      case "cancelled":
        return {
          bg: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
          text: isDark ? "#f87171" : "#991B1B",
        };
      default:
        return {
          bg: isDark ? "rgba(107, 114, 128, 0.15)" : "#F1F5F9",
          text: isDark ? "#9ca3af" : "#475569",
        };
    }
  };

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        }}
        className="px-6 pb-4 border-b flex-row items-center justify-between"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? colors.background : "#f8fafc" }}
        >
          <ArrowLeft size={20} color={primaryColor} />
        </TouchableOpacity>
        <Text
          className="text-lg font-black"
          style={{ color: colors.textPrimary }}
        >
          Service Hub
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 150,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={primaryColor}
          />
        }
      >
        <Text
          className="text-[10px] font-bold uppercase tracking-widest mb-6"
          style={{ color: colors.textMuted }}
        >
          Track and manage your requests
        </Text>

        {/* Status Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-8 -mx-1"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => handleStatusChange(f.value)}
              className="px-6 py-2.5 rounded-full mr-3 border"
              style={{
                backgroundColor:
                  status === f.value
                    ? isDark
                      ? colors.primary
                      : "#00643B"
                    : colors.card,
                borderColor:
                  status === f.value
                    ? isDark
                      ? colors.primary
                      : "#00643B"
                    : colors.border,
              }}
            >
              <Text
                className="text-[12px] font-black uppercase tracking-widest"
                style={{
                  color: status === f.value ? "#fff" : colors.textMuted,
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Request Hub */}
        <View className="mb-10 flex-row gap-4">
          <TouchableOpacity
            onPress={() => router.push("/(farmer)/request-ai")}
            className="flex-1 p-5 rounded-[28px] border items-center shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <View className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl items-center justify-center mb-3">
              <Syringe size={24} color={isDark ? colors.primary : "#00643B"} />
            </View>
            <Text
              className="text-[13px] font-black"
              style={{ color: colors.textPrimary }}
            >
              Request AI
            </Text>
            <Text
              className="text-[9px] font-bold mt-1 text-center"
              style={{ color: colors.textMuted }}
            >
              Artificial Breeding
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(farmer)/report-sickness")}
            className="flex-1 p-5 rounded-[28px] border items-center shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <View className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-2xl items-center justify-center mb-3">
              <Stethoscope size={24} color={isDark ? "#f97316" : "#9A3412"} />
            </View>
            <Text
              className="text-[13px] font-black"
              style={{ color: colors.textPrimary }}
            >
              Request Vet
            </Text>
            <Text
              className="text-[9px] font-bold mt-1 text-center"
              style={{ color: colors.textMuted }}
            >
              Health Checkup
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          className="text-sm font-black uppercase tracking-widest mb-4"
          style={{ color: colors.textPrimary }}
        >
          Request Activity
        </Text>

        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : allRequests.length > 0 ? (
          allRequests.map((req: any) => {
            const statusStyle = getStatusColor(req.status);
            const isHealth = req.type === "health";
            const canDelete =
              req.status === "pending" ||
              req.status === "rejected" ||
              req.status === "approved" ||
              req.status === "cancelled" ||
              req.status === "done" ||
              req.status === "resolved";

            return (
              <View
                key={`${req.type}-${req._id}`}
                className="rounded-[32px] p-5 mb-5 border shadow-sm"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`w-10 h-10 rounded-2xl items-center justify-center ${isHealth ? "bg-orange-50 dark:bg-orange-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}
                    >
                      {isHealth ? (
                        <Stethoscope
                          size={20}
                          color={isDark ? "#f97316" : "#9A3412"}
                        />
                      ) : (
                        <Syringe
                          size={20}
                          color={isDark ? colors.primary : "#00643B"}
                        />
                      )}
                    </View>
                    <View>
                      <Text
                        className="text-[15px] font-black"
                        style={{ color: colors.textPrimary }}
                      >
                        {isHealth ? "Health Checkup" : "AI Insemination"}
                      </Text>
                      <Text
                        className="text-[11px] font-bold"
                        style={{ color: colors.textMuted }}
                      >
                        {format(new Date(req.createdAt), "MMM d, yyyy")}
                      </Text>
                    </View>
                  </View>

                  <View
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: statusStyle.bg }}
                  >
                    <Text
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: statusStyle.text }}
                    >
                      {req.status}
                    </Text>
                  </View>
                </View>

                {/* Animal Info */}
                <View
                  className="p-4 rounded-2xl flex-row items-center justify-between mb-4"
                  style={{
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                  }}
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center border"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      <Image
                        source={{
                          uri:
                            req.animalId?.imageUrl ||
                            "https://via.placeholder.com/100",
                        }}
                        className="w-8 h-8 rounded-lg"
                      />
                    </View>
                    <View>
                      <Text
                        className="text-[13px] font-bold"
                        style={{ color: colors.textPrimary }}
                      >
                        {req.animalId?.earTag ||
                          req.animalId?.animalId ||
                          "N/A"}
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: colors.textMuted }}
                      >
                        {req.animalId?.breed || "Unknown"}
                      </Text>
                    </View>
                  </View>
                  {!isHealth && (
                    <View className="items-end">
                      <Text
                        className="text-[10px] font-bold uppercase"
                        style={{ color: colors.textMuted }}
                      >
                        Attempt
                      </Text>
                      <Text
                        className="text-[12px] font-black"
                        style={{ color: colors.textPrimary }}
                      >
                        #{req.attemptNumber || 1}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Comment / Reason */}
                {req.comment || req.reason ? (
                  <View className="mb-4">
                    <Text
                      className="text-[10px] font-bold uppercase mb-1"
                      style={{ color: colors.textMuted }}
                    >
                      {isHealth ? "Symptoms" : "Notes"}
                    </Text>
                    <Text
                      className="text-[12px] italic"
                      style={{ color: colors.textSecondary }}
                    >
                      &quot;{req.comment || req.reason}&quot;
                    </Text>
                  </View>
                ) : null}

                {/* Scheduled Info if approved/in-progress */}
                {["approved", "in-progress"].includes(req.status) &&
                  req.scheduledDate && (
                    <View
                      className="flex-row items-center gap-2 mb-4 p-3 rounded-xl border"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(16, 185, 129, 0.1)"
                          : "#f0fdf4",
                        borderColor: isDark ? "transparent" : "#d1fae5",
                      }}
                    >
                      <Clock size={14} color={primaryColor} />
                      <Text
                        className="text-[12px] font-bold"
                        style={{ color: isDark ? "#a7f3d0" : "#065f46" }}
                      >
                        Scheduled for{" "}
                        {format(new Date(req.scheduledDate), "MMM d, h:mm a")}
                      </Text>
                    </View>
                  )}

                {/* Preferred Date Info if pending */}
                {req.status === "pending" && req.preferredDate && (
                  <View
                    className="flex-row items-center gap-2 mb-4 p-3 rounded-xl border"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(245, 158, 11, 0.1)"
                        : "#FFFBEB",
                      borderColor: isDark ? "transparent" : "#FEF3C7",
                    }}
                  >
                    <Clock size={14} color={isDark ? "#fbbf24" : "#d97706"} />
                    <Text
                      className="text-[12px] font-bold"
                      style={{ color: isDark ? "#fde68a" : "#b45309" }}
                    >
                      Preferred:{" "}
                      {format(new Date(req.preferredDate), "MMM d, h:mm a")}
                    </Text>
                  </View>
                )}

                {/* Technician Info */}
                {(req.approvedBy || req.handledBy || req.technicianId) && (
                  <View className="flex-row items-center gap-2 mb-4">
                    <CheckCircle2 size={14} color={primaryColor} />
                    <Text
                      className="text-[11px] font-medium"
                      style={{ color: colors.textSecondary }}
                    >
                      Assigned to:{" "}
                      {req.approvedBy?.name ||
                        req.handledBy?.name ||
                        req.technicianId?.name ||
                        "Technician"}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View
                  className="flex-row gap-3 pt-2 border-t"
                  style={{ borderTopColor: colors.border }}
                >
                  {req.animalId?._id && (
                    <TouchableOpacity
                      onPress={() =>
                        router.push(
                          `/(farmer)/animal-details?id=${req.animalId?._id}`,
                        )
                      }
                      className="flex-row items-center gap-2"
                    >
                      <Text
                        className="text-[11px] font-black uppercase tracking-widest"
                        style={{ color: colors.textMuted }}
                      >
                        Animal Details
                      </Text>
                      <ChevronRight size={12} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}

                  <View className="flex-1" />

                  {canDelete && (
                    <TouchableOpacity
                      onPress={() =>
                        handleDelete(
                          req._id,
                          req.type,
                          req.animalId?.earTag ||
                            req.animalId?.animalId ||
                            "this animal",
                        )
                      }
                      className="px-4 py-2 rounded-xl flex-row items-center gap-2"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#fef2f2",
                      }}
                    >
                      <Trash2 size={14} color={colors.error} />
                      <Text
                        className="text-[11px] font-black"
                        style={{ color: colors.error }}
                      >
                        {req.status === "pending" ? "Cancel" : "Remove"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View className="py-20 items-center">
            <AlertCircle size={48} color={colors.textMuted} />
            <Text
              className="mt-4 font-bold"
              style={{ color: colors.textPrimary }}
            >
              No Active Requests
            </Text>
            <Text
              className="mt-2 text-center text-sm"
              style={{ color: colors.textSecondary }}
            >
              Your service requests will appear here once you submit them.
            </Text>
          </View>
        )}

        {hasMore && (
          <TouchableOpacity
            onPress={loadMore}
            disabled={isRefetching}
            className="py-4 items-center rounded-[20px] border mt-2 mb-10"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Text
                className="text-[12px] font-black uppercase tracking-widest"
                style={{ color: primaryColor }}
              >
                Load Older Requests
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
