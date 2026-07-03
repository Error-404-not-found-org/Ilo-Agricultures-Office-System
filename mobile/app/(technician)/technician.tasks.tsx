import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Plus, CheckCircle, Search, ClipboardList } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { SearchBar } from "@/components/shared";

export default function TasksScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  // Filters State
  const [scope, setScope] = useState<"mine" | "available">("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"All" | "Urgent" | "Routine" | "Follow-up" | "Emergency">("All");

  const { tasksQuery } = useTechnicianTasks(undefined, { scope });
  const { data: tasks = [], isLoading, refetch, isRefetching } = tasksQuery;

  // Local filter logic
  const filteredTasks = (tasks || []).filter((t: any) => {
    // Category match
    const categoryMatch = activeCategory === "All" || t.category === activeCategory;

    // Search query match (farmer name or ear tag or notes)
    const text = searchQuery.toLowerCase();
    const farmerName = t.farmerId?.name?.toLowerCase() || "";
    const notes = t.notes?.toLowerCase() || "";
    const animalTags = (t.animalIds || []).map((a: any) => (a.earTag || a.animalId || "").toLowerCase());
    const searchMatch =
      !searchQuery ||
      farmerName.includes(text) ||
      notes.includes(text) ||
      animalTags.some((tag: string) => tag.includes(text));

    return categoryMatch && searchMatch;
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

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b shadow-sm z-10 w-full relative"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}>
        <Text className="text-2xl font-black" style={{ color: isDark ? "#10b981" : "#00643B" }}>My Work Queue</Text>
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
          style={{ backgroundColor: isDark ? "#10b981" : "#00643B" }}
          onPress={() => router.push('/(technician)/create-task')}
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Segmented Queue Selector */}
      <View className="flex-row p-1 mx-4 mt-4 rounded-xl"
            style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9" }}>
        <TouchableOpacity
          onPress={() => setScope("mine")}
          style={{
            flex: 1,
            paddingVertical: 10,
            alignItems: "center",
            borderRadius: 8,
            backgroundColor: scope === "mine" ? (isDark ? "#1e293b" : "#fff") : "transparent",
          }}
        >
          <Text style={{
            fontFamily: "Outfit_700Bold",
            color: scope === "mine" ? (isDark ? "#10b981" : "#00643B") : (isDark ? "#94a3b8" : "#64748b"),
            fontSize: 13,
          }}>
            My Queue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setScope("available")}
          style={{
            flex: 1,
            paddingVertical: 10,
            alignItems: "center",
            borderRadius: 8,
            backgroundColor: scope === "available" ? (isDark ? "#1e293b" : "#fff") : "transparent",
          }}
        >
          <Text style={{
            fontFamily: "Outfit_700Bold",
            color: scope === "available" ? (isDark ? "#10b981" : "#00643B") : (isDark ? "#94a3b8" : "#64748b"),
            fontSize: 13,
          }}>
            Available Tasks
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View className="px-4 mt-3">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by farmer name, ear tag or notes..."
        />
      </View>

      {/* Category Chips Scrollbar */}
      <View className="mt-2 mb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {["All", "Urgent", "Routine", "Follow-up", "Emergency"].map((cat) => {
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
              const badge = getTaskBadgeStyle(t.taskType);
              const catColor = getCategoryColor(t.category);
              return (
                <TouchableOpacity
                  key={t._id}
                  activeOpacity={0.7}
                  className="rounded-2xl p-4 mb-4 border shadow-sm"
                  style={{ backgroundColor: colors.card, borderColor: colors.border }}
                  onPress={() => router.push(`/(technician)/task-details?id=${t._id}` as any)}
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
                        {t.category}
                      </Text>
                    </View>
                  </View>

                  <Text className="font-bold text-base mt-1 flex-1" numberOfLines={2} style={{ color: colors.textPrimary }}>
                    {t.notes}
                  </Text>

                  <View className="rounded-lg p-3 mt-3" style={{ backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc" }}>
                    <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary, fontSize: 13 }}>
                      {t.farmerId?.name || "Unknown Farmer"}
                    </Text>
                    {t.dueDate && (
                      <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                        Due Date: {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    )}
                    {t.animalIds && t.animalIds.length > 0 && (
                      <Text style={{ fontFamily: "Outfit_500Medium", color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                        Animals: {t.animalIds.map((a: any) => a.earTag || a.animalId).join(', ')}
                      </Text>
                    )}
                  </View>

                  <View className="flex-row justify-end border-t pt-3 mt-3" style={{ borderColor: colors.border }}>
                    <View className="flex-row items-center border px-3 py-1.5 rounded-lg" style={{ borderColor: colors.border }}>
                      <ClipboardList size={14} color={isDark ? "#10b981" : "#00643B"} />
                      <Text style={{ fontFamily: "Outfit_700Bold", color: isDark ? "#10b981" : "#00643B", fontSize: 11, marginLeft: 6 }}>
                        View Details
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
