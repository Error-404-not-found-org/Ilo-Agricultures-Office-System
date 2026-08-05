import React, { useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import {
  Plus,
  CheckCircle,
  ClipboardList,
  ArrowLeft,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { SearchBar } from "@/components/shared";
import { toast } from "sonner-native";
import type { WorkQueueItem } from "@/features/technician-requests/types/technicianRequests.types";
import { isCanonicalWorkflowId } from "@/features/technician-requests/utils/aiWorkflow";
import {
  MY_WORK_FILTERS,
  getServicePresentation,
  getWorkflowStatusPresentation,
  matchesServiceFilter,
  normalizeServiceType,
  normalizeWorkflowStatus,
} from "../utils/requestWorkPresentation";
import { RequestWorkBadge, RequestWorkFilterChips } from "./RequestWorkBadge";
import type { RequestWorkFilterOption } from "../utils/requestWorkPresentation";

interface TechnicianMyWorkPanelProps {
  standalone?: boolean;
}

export default function TechnicianMyWorkPanel({
  standalone = false,
}: TechnicianMyWorkPanelProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] =
    useState<RequestWorkFilterOption["value"]>("all");
  const [workStateFilter, setWorkStateFilter] = useState<
    "active" | "completed"
  >("active");

  const { tasksQuery } = useTechnicianTasks(undefined, { scope: "mine" });
  const { data: tasks = [], isLoading, refetch, isRefetching } = tasksQuery;

  const workStateTasks = useMemo(() => {
    return (tasks || []).filter((t: any) => {
      const status = normalizeWorkflowStatus(t);
      if (workStateFilter === "active") {
        return status !== "completed" && status !== "cancelled";
      } else {
        return status === "completed";
      }
    });
  }, [tasks, workStateFilter]);

  const serviceCounts = useMemo(() => {
    const source = workStateTasks || [];
    return {
      all: source.length,
      ai: source.filter((item: any) => normalizeServiceType(item) === "ai")
        .length,
      health: source.filter(
        (item: any) => normalizeServiceType(item) === "health",
      ).length,
      pregnancy: source.filter(
        (item: any) => normalizeServiceType(item) === "pregnancy",
      ).length,
      calving: source.filter(
        (item: any) => normalizeServiceType(item) === "calving",
      ).length,
    };
  }, [workStateTasks]);

  const filteredTasks = (workStateTasks || []).filter((t: any) => {
    if (!matchesServiceFilter(t, serviceFilter)) return false;
    const text = searchQuery.toLowerCase();
    const farmerName = String(
      t.farmer?.name || t.farmerId?.name || "",
    ).toLowerCase();
    const notes = String(
      t.notes || t.task || t.serviceType || "",
    ).toLowerCase();
    const animalTags = t.animal
      ? [String(t.animal.earTag || t.animal.name || "").toLowerCase()]
      : (t.animalIds || []).map((a: any) =>
          (a.earTag || a.animalId || "").toLowerCase(),
        );
    const searchMatch =
      !searchQuery ||
      farmerName.includes(text) ||
      notes.includes(text) ||
      animalTags.some((tag: string) => tag.includes(text));

    return searchMatch;
  });

  const openWorkItem = (item: WorkQueueItem | any) => {
    const isAIShapedItem =
      item.workflowType === "AI" ||
      String(item.taskType || "").toUpperCase() === "AI" ||
      item.type === "insemination";
    if (isAIShapedItem && item.workflowType !== "AI") {
      toast.error(
        "This AI work item is missing its canonical workflow contract.",
      );
      return;
    }

    if (isAIShapedItem) {
      if (!item.id && !item.workflowId) {
        toast.error("This AI work item is missing its canonical identifier.");
        return;
      }

      router.push({
        pathname: "/(technician)/request-details",
        params: { id: item.id || item.workflowId, type: "ai", viewOnly: item.allowedAction === "VIEW_RECORD" ? "true" : undefined, taskId: item.taskId || undefined, workflowId: item.workflowId || undefined },
      });
      return;
    }

    if (item.workflowType === "Health" && (item.id || item.workflowId)) {
      router.push({
        pathname: "/(technician)/request-details",
        params: { id: item.id || item.workflowId, type: "health", taskId: item.taskId || undefined, workflowId: item.workflowId || undefined },
      });
      return;
    }

    if (item.taskId) {
      router.push(`/(technician)/task-details?id=${item.taskId}` as any);
      return;
    }
    toast.error("This work item is missing its task identifier.");
  };

  const content = (
    <>
      {/* Search Input */}
      <View className="px-4 mt-3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by farmer name, ear tag or notes..."
          variant="directory"
        />
      </View>

      {/* Work-state filters */}
      <View className="mt-2">
        <RequestWorkFilterChips
          options={
            [
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
            ] as any
          }
          value={workStateFilter as any}
          onChange={(val: any) => setWorkStateFilter(val)}
        />
      </View>

      {/* Canonical service filters */}
      <View className="mt-2 mb-3">
        <RequestWorkFilterChips
          options={MY_WORK_FILTERS}
          value={serviceFilter}
          onChange={setServiceFilter}
          counts={serviceCounts}
          countsLoading={isLoading}
        />
      </View>

      {/* Task List Feed */}
      {isLoading && !isRefetching ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={isDark ? "#10b981" : "#00643B"}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              colors={[isDark ? "#10b981" : "#00643B"]}
            />
          }
        >
          {filteredTasks.length === 0 ? (
            <View className="items-center justify-center py-16 opacity-70">
              <CheckCircle
                size={48}
                color={isDark ? "#10b981" : "#0d9488"}
                className="mb-4"
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_600SemiBold",
                  textAlign: "center",
                }}
              >
                {tasks.length === 0
                  ? "No assigned work."
                  : "No work items match this filter."}
              </Text>
            </View>
          ) : (
            filteredTasks.map((t: any) => {
              const servicePresentation = getServicePresentation(
                normalizeServiceType(t),
              );
              const statusPresentation = getWorkflowStatusPresentation(
                normalizeWorkflowStatus(t),
              );
              const pregnancyReadiness =
                t.taskType === "PD"
                  ? t.pregnancyReadiness || t.raw?.pregnancyReadiness
                  : null;
              return (
                <TouchableOpacity
                  key={t.id || t._id}
                  activeOpacity={0.7}
                  className="rounded-2xl p-4 mb-4 border shadow-sm"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  }}
                  onPress={() => openWorkItem(t)}
                >
                  {/* Badge Row */}
                  <View className="flex-row justify-between items-center mb-2">
                    <RequestWorkBadge
                      label={servicePresentation.label}
                      tone={servicePresentation.tone}
                      accessibilityPrefix="Service"
                    />
                    <RequestWorkBadge
                      label={statusPresentation.label}
                      tone={statusPresentation.tone}
                      accessibilityPrefix="Status"
                    />
                  </View>

                  <Text
                    className="font-bold text-base mt-1 flex-1"
                    numberOfLines={2}
                    style={{ color: colors.textPrimary }}
                  >
                    {t.task || t.notes || t.serviceType}
                  </Text>

                  {pregnancyReadiness && !pregnancyReadiness.isEligible && (
                    <View
                      className="rounded-xl p-3 mt-3 border"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(245,158,11,0.10)"
                          : "#fffbeb",
                        borderColor: isDark
                          ? "rgba(245,158,11,0.30)"
                          : "#fde68a",
                      }}
                    >
                      <Text
                        style={{
                          color: isDark ? "#fbbf24" : "#92400e",
                          fontFamily: "Outfit_700Bold",
                          fontSize: 12,
                        }}
                      >
                        Pregnancy check not yet available
                      </Text>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 11,
                          marginTop: 3,
                          lineHeight: 16,
                        }}
                      >
                        {pregnancyReadiness.reason}
                      </Text>
                    </View>
                  )}

                  <View
                    className="rounded-lg p-3 mt-3"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.03)"
                        : "#f8fafc",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: colors.textPrimary,
                        fontSize: 13,
                      }}
                    >
                      {t.farmer?.name || t.farmerId?.name || "Unknown Farmer"}
                    </Text>
                    {(t.schedule?.date || t.dueDate) && (
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textSecondary,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {t.workflowType === "AI" ? "Scheduled" : "Due Date"}:{" "}
                        {new Date(
                          t.schedule?.date || t.dueDate,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {t.schedule?.visitPeriod
                          ? ` · ${String(t.schedule.visitPeriod).replace(/^./, (value: string) => value.toUpperCase())}`
                          : ""}
                      </Text>
                    )}
                    {t.animal ? (
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        Animal: {t.animal.name}
                        {t.animal.earTag ? ` · ${t.animal.earTag}` : ""}
                      </Text>
                    ) : t.animalIds && t.animalIds.length > 0 ? (
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        Animals:{" "}
                        {t.animalIds
                          .map((a: any) => a.earTag || a.animalId)
                          .join(", ")}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    className="flex-row justify-end border-t pt-3 mt-3"
                    style={{ borderColor: colors.border }}
                  >
                    <View
                      className="flex-row items-center border px-3 py-1.5 rounded-lg"
                      style={{ borderColor: colors.border }}
                    >
                      <ClipboardList
                        size={14}
                        color={isDark ? "#10b981" : "#00643B"}
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_700Bold",
                          color: isDark ? "#10b981" : "#00643B",
                          fontSize: 11,
                          marginLeft: 6,
                        }}
                      >
                        {t.actionLabel || "View Details"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </>
  );

  if (!standalone) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        {content}
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        className="px-6 py-4 flex-row justify-between items-center border-b shadow-sm z-10 w-full relative"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              padding: 8,
              backgroundColor: isDark ? "#1e293b" : "#f8fafc",
              borderRadius: 999,
            }}
          >
            <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "Outfit_900Black",
              fontSize: 20,
              color: colors.textPrimary,
            }}
          >
            My Work Queue
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
          style={{ backgroundColor: isDark ? "#10b981" : "#00643B" }}
          onPress={() => router.push("/(technician)/create-task")}
          accessibilityLabel="Add field work"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>
      {content}
    </SafeAreaView>
  );
}
