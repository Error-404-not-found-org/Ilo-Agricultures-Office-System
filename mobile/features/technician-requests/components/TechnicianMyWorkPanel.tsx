import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Plus, CheckCircle, ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Pagination, SearchBar, SelectDropdown } from "@/components/shared";
import { toast } from "sonner-native";
import type {
  TechnicianWorkItem,
  WorkQueueFilters,
} from "@/features/technician-requests/types/technicianRequests.types";
import {
  MY_WORK_FILTERS,
  normalizeTechnicianWorkItems,
} from "../utils/requestWorkPresentation";
import { RequestListCard } from "./RequestListCard";

interface TechnicianMyWorkPanelProps {
  standalone?: boolean;
  initialWorkState?: "active" | "completed";
}

// ─── Main Panel Component ─────────────────────────────────────────────────────

export default function TechnicianMyWorkPanel({
  standalone = false,
  initialWorkState = "active",
}: TechnicianMyWorkPanelProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [serviceFilter, setServiceFilter] =
    useState<WorkQueueFilters["type"]>("all");
  const [workStateFilter, setWorkStateFilter] = useState<
    "active" | "completed"
  >(initialWorkState);

  useEffect(() => {
    setWorkStateFilter(initialWorkState);
    setPage(1);
  }, [initialWorkState]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { tasksQuery } = useTechnicianTasks(undefined, {
    scope: "mine",
    workState: workStateFilter,
    type: serviceFilter,
    search: debouncedSearch,
    page,
    limit: 20,
  });
  const { data, isLoading, refetch, isRefetching } = tasksQuery;
  const workItems = useMemo(
    () => normalizeTechnicianWorkItems(data?.data),
    [data?.data],
  );
  const serviceCounts = data?.counts || {};
  const pagination = data?.pagination || {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  };
  const filteredTasks = workItems;

  const openWorkItem = (item: TechnicianWorkItem) => {
    if (item.workType === "ai") {
      if (!item.workflowId && !item.id) {
        toast.error("This AI work item is missing its canonical identifier.");
        return;
      }

      router.push({
        pathname: "/(technician)/request-details",
        params: {
          id: item.workflowId || item.id,
          type: "ai",
          viewOnly: item.allowedAction === "VIEW_RECORD" ? "true" : undefined,
          taskId: item.taskId || undefined,
          workflowId: item.workflowId || undefined,
        },
      });
      return;
    }

    if (item.workType === "health" && (item.id || item.workflowId)) {
      router.push({
        pathname: "/(technician)/request-details",
        params: {
          id: item.workflowId || item.id,
          type: "health",
          taskId: item.taskId || undefined,
          workflowId: item.workflowId || undefined,
        },
      });
      return;
    }

    if (item.workType === "breeding_follow_up") {
      const taskId = item.taskId ?? item.id;
      if (!taskId) {
        toast.error("This Breeding Follow-up is missing its task identifier.");
        return;
      }
      router.push(`/(technician)/task-details?id=${taskId}` as any);
      return;
    }

    const fallbackTaskId = item.taskId ?? item.id;
    if (fallbackTaskId) {
      router.push(`/(technician)/task-details?id=${fallbackTaskId}` as any);
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
          placeholder="Search by farmer, ear tag, or service..."
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
            onChange={(val) => {
              setWorkStateFilter(val as any);
              setPage(1);
            }}
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
            onChange={(val) => {
              setServiceFilter(val as any);
              setPage(1);
            }}
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
                {workItems.length === 0
                  ? "No assigned work."
                  : "No work items match this filter."}
              </Text>
            </View>
          ) : (
            <>
              {filteredTasks.map((t) => (
                <RequestListCard
                  key={t.id}
                  item={t}
                  onPress={() => openWorkItem(t)}
                />
              ))}
              {pagination.totalPages > 1 ? (
                <Pagination
                  page={page}
                  totalPages={pagination.totalPages}
                  onPrevious={() => setPage((current) => current - 1)}
                  onNext={() => setPage((current) => current + 1)}
                />
              ) : null}
            </>
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
