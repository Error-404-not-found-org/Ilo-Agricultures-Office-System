import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Plus, CheckCircle, ClipboardList, ArrowLeft } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { SearchBar } from "@/components/shared";
import { toast } from "sonner-native";
import type { WorkQueueItem } from "@/features/technician-requests/types/technicianRequests.types";
import { isCanonicalWorkflowId } from "@/features/technician-requests/utils/aiWorkflow";

interface TechnicianMyWorkPanelProps {
  standalone?: boolean;
}

export default function TechnicianMyWorkPanel({ standalone = false }: TechnicianMyWorkPanelProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"All" | "Urgent" | "Routine" | "Follow-up" | "Completed" | "Morning" | "Afternoon">("All");

  const { tasksQuery } = useTechnicianTasks(undefined, { scope: "mine" });
  const { data: tasks = [], isLoading, refetch, isRefetching } = tasksQuery;

  // Local filter logic
  const filteredTasks = (tasks || []).filter((t: any) => {
    const statusStr = String(t.status || "pending").toLowerCase().trim();
    const isTerminal = ["completed", "done", "cancelled"].includes(statusStr);

    // If 'Completed' is selected, only show terminal tasks
    if (activeCategory === "Completed") {
      if (!isTerminal) return false;
    } else {
      // For any other category (All, Urgent, etc.), hide terminal tasks
      if (isTerminal) return false;
      
      if (activeCategory === "Morning" || activeCategory === "Afternoon") {
        const visitPeriod = String(t.schedule?.visitPeriod || t.visitPeriod || "").toLowerCase();
        if (visitPeriod !== activeCategory.toLowerCase()) return false;
      } else if (
        activeCategory !== "All" &&
        (t.category || t.raw?.category) !== activeCategory
      ) {
        return false;
      }
    }

    // Search query match (farmer name or ear tag or notes)
    const text = searchQuery.toLowerCase();
    const farmerName = String(t.farmer?.name || t.farmerId?.name || "").toLowerCase();
    const notes = String(t.notes || t.task || t.serviceType || "").toLowerCase();
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

  const getTaskBadgeStyle = (taskType: string) => {
    const type = String(taskType).toUpperCase();
    if (type === "AI") {
      return { bg: isDark ? "bg-purple-950/40" : "bg-purple-50", text: "text-purple-600", label: "Official AI Service" };
    }
    if (type === "HEALTH") {
      return { bg: isDark ? "bg-red-950/40" : "bg-red-50", text: "text-red-600", label: "Official Health Assistance" };
    }
    if (type === "PD") {
      return { bg: isDark ? "bg-cyan-950/40" : "bg-cyan-50", text: "text-cyan-600", label: "Pregnancy Verification" };
    }
    if (type === "CD" || type === "CALVING") {
      return { bg: isDark ? "bg-orange-950/40" : "bg-orange-50", text: "text-orange-600", label: "Calving / Offspring" };
    }
    if (type === "FOLLOWUP") {
      return { bg: isDark ? "bg-blue-950/40" : "bg-blue-50", text: "text-blue-600", label: "Follow-up Visit" };
    }
    if (type === "FARMINSPECTION") {
      return { bg: isDark ? "bg-amber-950/40" : "bg-amber-50", text: "text-amber-600", label: "Farm Inspection" };
    }
    return { bg: isDark ? "bg-slate-800" : "bg-slate-100", text: isDark ? "text-slate-300" : "text-slate-600", label: "General Visit" };
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Urgent":
      case "Emergency":
        return { bg: isDark ? "bg-rose-950/40" : "bg-rose-50", text: "text-rose-600" };
      case "Routine":
        return { bg: isDark ? "bg-blue-950/40" : "bg-blue-50", text: "text-blue-500" };
      case "Follow-up":
        return { bg: isDark ? "bg-emerald-950/40" : "bg-emerald-50", text: "text-emerald-600" };
      default:
        return { bg: isDark ? "bg-slate-800" : "bg-slate-100", text: "text-slate-600" };
    }
  };

  const openWorkItem = (item: WorkQueueItem | any) => {

    const isAIShapedItem =
      item.workflowType === "AI" ||
      String(item.taskType || "").toUpperCase() === "AI" ||
      item.type === "insemination";
    if (isAIShapedItem && item.workflowType !== "AI") {
      toast.error("This AI work item is missing its canonical workflow contract.");
      return;
    }

    if (isAIShapedItem) {
      if (!isCanonicalWorkflowId(item.workflowId)) {
        toast.error("This AI work item is missing its workflow identifier.");
        return;
      }
      if (item.allowedAction === "RECORD_SERVICE") {
        router.push({
          pathname: "/(technician)/record-ai",
          params: {
            mode: "request-linked",
            workflowId: item.workflowId,
            taskId: item.taskId || undefined,
            farmerId: item.farmer?.id || undefined,
            farmerName: item.farmer?.name || undefined,
            animalId: item.animal?.id || undefined,
            animalName: item.animal?.name || undefined,
            earTag: item.animal?.earTag || undefined,
            scheduleDate: item.schedule?.date || undefined,
            visitPeriod: item.schedule?.visitPeriod || undefined,
          },
        });
        return;
      }
      if (item.allowedAction === "VIEW_RECORD") {
        router.push({
          pathname: "/(technician)/request-details",
          params: { id: item.workflowId, type: "ai", viewOnly: "true" },
        });
        return;
      }
      toast.error("This AI work item has no supported action.");
      return;
    }

    if (item.workflowType === "Health" && item.workflowId) {
      router.push({
        pathname: "/(technician)/request-details",
        params: { id: item.workflowId, type: "health" },
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

      {/* Category Chips Scrollbar */}
      <View className="mt-2 mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {["All", "Morning", "Afternoon", "Urgent", "Routine", "Follow-up", "Completed"].map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat as any)}
                className="px-4 py-2 rounded-full border"
                style={{
                  backgroundColor: isActive ? (isDark ? "#10b981" : "#00643B") : (isDark ? "#1e293b" : "#fff"),
                  borderColor: isActive ? "transparent" : colors.border,
                }}
              >
                <Text style={{
                  fontFamily: "Outfit_700Bold",
                  color: isActive ? "#fff" : colors.textSecondary,
                  fontSize: 12,
                }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Task List Feed */}
      {isLoading && !isRefetching ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={isDark ? "#10b981" : "#00643B"} />
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
              <CheckCircle size={48} color={isDark ? "#10b981" : "#0d9488"} className="mb-4" />
              <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_600SemiBold", textAlign: "center" }}>
                All caught up! No {activeCategory.toLowerCase() !== "all" ? activeCategory.toLowerCase() : ""} tasks found.
              </Text>
            </View>
          ) : (
            filteredTasks.map((t: any) => {
              const badge = getTaskBadgeStyle(t.workflowType || t.taskType);
              const itemCategory = t.category || t.raw?.category || "Routine";
              const catColor = getCategoryColor(itemCategory);
              const pregnancyReadiness =
                t.taskType === "PD"
                  ? t.pregnancyReadiness || t.raw?.pregnancyReadiness
                  : null;
              return (
                <TouchableOpacity
                  key={t.id || t._id}
                  activeOpacity={0.7}
                  className="rounded-2xl p-4 mb-4 border shadow-sm"
                  style={{ backgroundColor: colors.card, borderColor: colors.border }}
                  onPress={() => openWorkItem(t)}
                >
                  {/* Badge Row */}
                  <View className="flex-row justify-between items-center mb-2">
                    <View className={`px-2 py-1 rounded-md ${badge.bg}`}>
                      <Text className={`text-[10px] font-bold uppercase ${badge.text}`}>
                        {badge.label}
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-md ${catColor.bg}`}>
                      <Text className={`text-[9px] font-bold uppercase ${catColor.text}`}>
                        {itemCategory || t.status}
                      </Text>
                    </View>
                  </View>

                  <Text className="font-bold text-base mt-1 flex-1" numberOfLines={2} style={{ color: colors.textPrimary }}>
                    {t.task || t.notes || t.serviceType}
                  </Text>

                  {pregnancyReadiness && !pregnancyReadiness.isEligible && (
                    <View
                      className="rounded-xl p-3 mt-3 border"
                      style={{
                        backgroundColor: isDark ? "rgba(245,158,11,0.10)" : "#fffbeb",
                        borderColor: isDark ? "rgba(245,158,11,0.30)" : "#fde68a",
                      }}
                    >
                      <Text style={{ color: isDark ? "#fbbf24" : "#92400e", fontFamily: "Outfit_700Bold", fontSize: 12 }}>
                        Pregnancy check not yet available
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 11, marginTop: 3, lineHeight: 16 }}>
                        {pregnancyReadiness.reason}
                      </Text>
                    </View>
                  )}

                  <View className="rounded-lg p-3 mt-3" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" }}>
                    <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary, fontSize: 13 }}>
                      {t.farmer?.name || t.farmerId?.name || "Unknown Farmer"}
                    </Text>
                    {(t.schedule?.date || t.dueDate) && (
                      <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                        {t.workflowType === "AI" ? "Scheduled" : "Due Date"}: {new Date(t.schedule?.date || t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        {t.schedule?.visitPeriod ? ` · ${String(t.schedule.visitPeriod).replace(/^./, (value: string) => value.toUpperCase())}` : ""}
                      </Text>
                    )}
                    {t.animal ? (
                      <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                        Animal: {t.animal.name}{t.animal.earTag ? ` · ${t.animal.earTag}` : ""}
                      </Text>
                    ) : t.animalIds && t.animalIds.length > 0 ? (
                      <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                        Animals: {t.animalIds.map((a: any) => a.earTag || a.animalId).join(', ')}
                      </Text>
                    ) : null}
                  </View>

                  <View className="flex-row justify-end border-t pt-3 mt-3" style={{ borderColor: colors.border }}>
                    <View className="flex-row items-center border px-3 py-1.5 rounded-lg" style={{ borderColor: colors.border }}>
                      <ClipboardList size={14} color={isDark ? "#10b981" : "#00643B"} />
                      <Text style={{ fontFamily: "Outfit_700Bold", color: isDark ? "#10b981" : "#00643B", fontSize: 11, marginLeft: 6 }}>
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
    return <View className="flex-1" style={{ backgroundColor: colors.background }}>{content}</View>;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b shadow-sm z-10 w-full relative"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}>
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
          onPress={() => router.push('/(technician)/create-task')}
          accessibilityLabel="Add field work"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>
      {content}
    </SafeAreaView>
  );
}
