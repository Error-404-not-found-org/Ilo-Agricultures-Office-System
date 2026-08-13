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
  Sunrise,
  Sunset,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { SearchBar, SelectDropdown } from "@/components/shared";
import { toast } from "sonner-native";
import type { TechnicianWorkItem } from "@/features/technician-requests/types/technicianRequests.types";
import {
  MY_WORK_FILTERS,
  getServicePresentation,
  getTechnicianWorkStatePresentation,
  matchesServiceFilter,
  normalizeServiceType,
  normalizeTechnicianWorkItems,
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
  const workItems = useMemo(() => normalizeTechnicianWorkItems(tasks), [tasks]);

  const workStateTasks = useMemo(() => {
    return workItems.filter((item) => {
      if (workStateFilter === "active") {
        return item.state !== "completed" && item.state !== "cancelled";
      } else {
        return item.state === "completed";
      }
    });
  }, [workItems, workStateFilter]);

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

  const filteredTasks = (workStateTasks || []).filter((item) => {
    if (!matchesServiceFilter(item, serviceFilter)) return false;
    const text = searchQuery.toLowerCase();
    const farmerName = String(item.farmerName || "").toLowerCase();
    const title = item.title.toLowerCase();
    const animalTags = [item.animalName, item.animalTag]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    const searchMatch =
      !searchQuery ||
      farmerName.includes(text) ||
      title.includes(text) ||
      animalTags.some((tag: string) => tag.includes(text));

    return searchMatch;
  });

  const openWorkItem = (item: TechnicianWorkItem) => {
    if (item.workType === "ai") {
      if (!item.workflowId && !item.id) {
        toast.error("This AI work item is missing its canonical identifier.");
        return;
      }

      router.push({
        pathname: "/(technician)/request-details",
        params: { id: item.workflowId || item.id, type: "ai", viewOnly: item.allowedAction === "VIEW_RECORD" ? "true" : undefined, taskId: item.taskId || undefined, workflowId: item.workflowId || undefined },
      });
      return;
    }

    if (item.workType === "health" && (item.id || item.workflowId)) {
      router.push({
        pathname: "/(technician)/request-details",
        params: { id: item.workflowId || item.id, type: "health", taskId: item.taskId || undefined, workflowId: item.workflowId || undefined },
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

      {/* Filters Row */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 12,
          marginBottom: 12,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <SelectDropdown
            label="Status"
            options={[
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
            ]}
            value={workStateFilter}
            onChange={(val) => setWorkStateFilter(val as any)}
            highlightSelection={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectDropdown
            label="Request Type"
            options={MY_WORK_FILTERS.map((opt) => {
              const count =
                serviceCounts?.[opt.value as keyof typeof serviceCounts];
              return {
                label:
                  count !== undefined ? `${opt.label} (${count})` : opt.label,
                value: opt.value,
              };
            })}
            value={serviceFilter}
            onChange={(val) => setServiceFilter(val as any)}
            highlightSelection={false}
          />
        </View>
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
            filteredTasks.map((t) => {
              const servicePresentation = getServicePresentation(
                normalizeServiceType(t),
              );
              const statusPresentation = getTechnicianWorkStatePresentation(
                t.state,
              );
              return (
                <TouchableOpacity
                  key={t.id}
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
                      label={t.workType === "ai" ? t.title : servicePresentation.label}
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
                    {t.title}
                  </Text>

                  {t.workType === "ai" && t.attemptNumber ? (
                    <View className="mt-2">
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: "Outfit_700Bold",
                          fontSize: 12,
                        }}
                      >
                        Attempt {t.attemptNumber}
                      </Text>
                      {t.previousAttemptVerified ? (
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontFamily: "Outfit_500Medium",
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          Previous attempt · Unsuccessful
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {t.readinessMessage ? (
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
                        {t.readinessMessage}
                      </Text>
                    </View>
                  ) : null}

                  <View
                    className="rounded-lg p-3 mt-3"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.03)"
                        : "#f8fafc",
                    }}
                  >
                    {/* OPTION A: Highlighted Schedule Pill */}
                    {t.visitPeriod ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          alignSelf: "flex-start",
                          backgroundColor:
                            t.visitPeriod === "morning"
                              ? isDark
                                ? "rgba(245, 158, 11, 0.15)" // Amber
                                : "#fffbeb"
                              : isDark
                                ? "rgba(99, 102, 241, 0.15)" // Indigo
                                : "#e0e7ff",
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                          marginBottom: 8,
                          gap: 4,
                        }}
                      >
                        {t.visitPeriod === "morning" ? (
                          <Sunrise
                            size={14}
                            color={isDark ? "#fbbf24" : "#d97706"}
                          />
                        ) : (
                          <Sunset
                            size={14}
                            color={isDark ? "#818cf8" : "#4f46e5"}
                          />
                        )}
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color:
                              t.visitPeriod === "morning"
                                ? isDark
                                  ? "#fbbf24"
                                  : "#d97706"
                                : isDark
                                  ? "#818cf8"
                                  : "#4f46e5",
                          }}
                        >
                          {t.timingLabel || (t.visitPeriod === "morning" ? "Morning" : "Afternoon")}
                        </Text>
                      </View>
                    ) : null}

                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: colors.textPrimary,
                        fontSize: 13,
                      }}
                    >
                      {t.farmerName || "Farmer"}
                    </Text>
                    {t.timingLabel && !t.visitPeriod ? (
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textSecondary,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {t.timingLabel}
                      </Text>
                    ) : t.state === "needs_scheduling" ? (
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textSecondary,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        Claimed · Needs scheduling
                      </Text>
                    ) : null}
                    {t.animalName || t.animalTag ? (
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 11,
                          marginTop: 4,
                        }}
                      >
                        Animal: {t.animalName || t.animalTag}
                        {t.animalName && t.animalTag ? ` · ${t.animalTag}` : ""}
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
                        {t.actionLabel}
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
