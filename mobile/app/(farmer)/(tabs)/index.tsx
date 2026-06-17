import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  Activity,
  Search,
  Bell,
  MapPin,
  Plus,
  Syringe,
  Stethoscope,
  MessageSquare,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { useApi } from "@/lib/api";
import { format } from "date-fns";
import { useTheme } from "@/lib/theme";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useTranslation } from "../../../contexts/TranslationContext";

const PRIMARY = "#00643B";

export default function FarmerHome() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useUser();
  const api = useApi();
  const queryClient = useQueryClient();
  const [showRequestHub, setShowRequestHub] = React.useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [cancelInfo, setCancelInfo] = React.useState<{
    id: string;
    type: string;
    animalTag: string;
  } | null>(null);
  const [submittingOutcome, setSubmittingOutcome] = React.useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const res = await api.get("/user/me");
      return res.data;
    },
  });

  const { data: unreadCountData } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const res = await api.get("/notifications/unread-count");
      return res.data;
    },
    refetchInterval: 60000,
  });

  const unreadCount = unreadCountData?.count || 0;
  const stats = profile?.stats || {
    totalAnimals: 0,
    activePregnancies: 0,
    upcomingCalvings: 0,
    pendingResults: 0,
  };
  const currentDate = format(new Date(), "EEEE, d MMM yyyy");

  const { data: upcomingVisits, isLoading: loadingVisits } = useQuery({
    queryKey: ["visits", "upcoming"],
    queryFn: async () => {
      const [aiRes, healthRes] = await Promise.all([
        api.get("/ai-request/my?limit=100"),
        api.get("/health-request/my?limit=100"),
      ]);

      const aiData = Array.isArray(aiRes.data?.data)
        ? aiRes.data.data
        : Array.isArray(aiRes.data)
          ? aiRes.data
          : [];
      const healthData = Array.isArray(healthRes.data?.data)
        ? healthRes.data.data
        : Array.isArray(healthRes.data)
          ? healthRes.data
          : [];

      const upcomingAI = aiData
        .filter((r: any) =>
          ["approved", "in-progress"].includes(r.status?.toLowerCase()),
        )
        .map((r: any) => ({
          ...r,
          serviceType: "ai",
          technician: r.approvedBy?.name || r.technicianId?.name || null,
        }));

      const upcomingHealth = healthData
        .filter((r: any) =>
          ["approved", "in-progress"].includes(r.status?.toLowerCase()),
        )
        .map((r: any) => ({
          ...r,
          serviceType: "health",
          technician: r.handledBy?.name || null,
        }));

      return [...upcomingAI, ...upcomingHealth].sort((a, b) => {
        const dateA = new Date(
          a.scheduledDate || a.preferredDate || a.createdAt || 0,
        ).getTime();
        const dateB = new Date(
          b.scheduledDate || b.preferredDate || b.createdAt || 0,
        ).getTime();
        return dateA - dateB;
      });
    },
    refetchInterval: 30000,
  });

  useFocusEffect(
    React.useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      queryClient.invalidateQueries({ queryKey: ["visits", "upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["user", "activity"] });
      queryClient.invalidateQueries({ queryKey: ["animals", "my"] });
    }, []),
  );

  const { data: pendingOutcomes } = useQuery({
    queryKey: ["ai-requests", "pending-outcome"],
    queryFn: async () => {
      const res = await api.get("/ai-request/my");
      const requests = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];
      // Filter for 'done' requests where isSuccess is null and elapsed days >= 18
      return requests.filter((r: any) => {
        if (r.status !== "done" || r.isSuccess !== null) return false;
        const aiDate = new Date(r.inseminationDate || r.createdAt);
        const today = new Date();
        const diffDays = Math.floor(
          Math.abs(today.getTime() - aiDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return diffDays >= 18;
      });
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["user", "milestones"],
    queryFn: async () => {
      const res = await api.get("/user/milestones");
      const body = res.data;
      return Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];
    },
  });

  const { data: myAnimals } = useQuery({
    queryKey: ["animals", "my"],
    queryFn: async () => {
      const res = await api.get("/animals/my");
      const body = res.data;
      return Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];
    },
  });

  const { data: activityFeed } = useQuery({
    queryKey: ["user", "activity"],
    queryFn: async () => {
      const res = await api.get("/user/activity");
      const body = res.data;
      return Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];
    },
  });

  const handleOutcome = async (
    requestId: string,
    isSuccess: boolean,
    animalName: string,
    animalId: string,
  ) => {
    if (submittingOutcome) return;
    setSubmittingOutcome(true);
    try {
      await api.patch(`/ai-request/${requestId}/outcome`, { isSuccess });

      if (!isSuccess) {
        Alert.alert(
          "Outcome Recorded",
          `Did ${animalName} show signs of heat again? Would you like to request a 2nd attempt for re-insemination?`,
          [
            { text: "Not Now", style: "cancel" },
            {
              text: "Yes, Request AI",
              onPress: () =>
                router.push({
                  pathname: "/(farmer)/request-ai",
                  params: {
                    requestId,
                    mode: "re-inseminate",
                    animalId,
                    earTag: animalName,
                  },
                }),
            },
          ],
        );
      } else {
        Alert.alert(
          "Success!",
          "Congratulations! Pregnancy has been recorded for your animal.",
        );
      }

      router.replace("/(farmer)/(tabs)");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const handleCancelRequest = (id: string, type: string, animalTag: string) => {
    setCancelInfo({ id, type, animalTag });
    setModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelInfo) return;
    const { id, type } = cancelInfo;
    const endpoint =
      type === "ai" ? `/ai-request/${id}` : `/health-request/${id}`;
    try {
      await api.delete(endpoint);
      toast.success("Request cancelled");
      queryClient.invalidateQueries({
        queryKey: ["visits", "upcoming"],
      });
      queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      queryClient.invalidateQueries({ queryKey: ["health-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    } catch (err: any) {
      toast.error("Failed to cancel");
    }
  };

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        {/* --- HERO HEADER --- */}
        <View
          className="pt-16 pb-28 px-6 shadow-md z-0"
          style={{
            backgroundColor: PRIMARY,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          {/* Top Row: Avatar + Greeting & Bell */}
          <View className="flex-row justify-between items-center mb-6 mt-4">
            {/* Left side: Avatar + Greeting & Date */}
            <View className="flex-1 flex-row items-center gap-3 pr-4">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push("/(farmer)/(tabs)/profile")}
              >
                <View
                  className="w-12 h-12 rounded-full border-[2px] items-center justify-center overflow-hidden"
                  style={{
                    borderColor: "rgba(255,255,255,0.2)",
                    backgroundColor: "#005230",
                  }}
                >
                  {user?.imageUrl || profile?.imageUrl ? (
                    <Image
                      source={{ uri: user?.imageUrl || profile?.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-white font-outfit-black text-lg">
                      {user?.firstName?.charAt(0) || user?.username?.charAt(0) || "F"}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <View className="flex-1">
                <Text
                  className="text-white text-[20px] font-outfit-bold tracking-tight"
                  numberOfLines={1}
                >
                  {t('welcomeBack')} {user?.firstName || user?.username || "Farmer"}
                </Text>
                <Text className="text-emerald-100 text-[12px] mt-0.5 font-outfit-medium">
                  {currentDate}
                </Text>
              </View>
            </View>

            {/* Right side: Bell */}
            <TouchableOpacity
              className="w-10 h-10 bg-white/10 rounded-full items-center justify-center relative"
              activeOpacity={0.7}
              onPress={() => router.push("/notifications")}
            >
              <Bell size={20} color="white" />
              {unreadCount > 0 && (
                <View
                  className="absolute -top-1 -right-1 bg-red-500 w-5 h-5 rounded-full items-center justify-center border-2"
                  style={{ borderColor: PRIMARY }}
                >
                  <Text className="text-white text-[10px] font-bold">
                    {unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* --- OVERVIEW CARD (overlaps header) --- */}
        <View className="px-6 -mt-16 z-10 w-full mb-8">
          <View
            className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Card Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <MapPin size={18} color={isDark ? colors.primary : PRIMARY} />
                <Text className="text-slate-800 dark:text-white font-outfit-bold ml-1.5 text-base">
                  {t('myFarmStatus')}
                </Text>
              </View>
              <View className="bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/20">
                <Text
                  style={{ color: isDark ? colors.primary : PRIMARY }}
                  className="text-xs font-outfit-bold tracking-wide"
                >
                  Active
                </Text>
              </View>
            </View>

            {/* Main Stat */}
            <View className="flex-row items-baseline justify-center mb-8">
              <Text
                style={{ color: isDark ? colors.primary : PRIMARY }}
                className="text-7xl font-outfit-black tracking-tighter leading-none"
              >
                {isLoading ? "..." : stats.totalAnimals}
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 font-outfit-bold ml-2 mb-1 text-xl">
                {t('animals')}
              </Text>
            </View>

            {/* Sub Stats Row */}
            <View
              className="flex-row justify-between border-t border-slate-50 dark:border-slate-800/80 pt-5"
              style={{ borderTopColor: colors.border }}
            >
               <View className="items-center flex-1">
                <Text className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-outfit-bold mb-1">
                  {t('waitingResult')}
                </Text>
                <Text className="text-slate-800 dark:text-white font-outfit-black text-xl">
                  {isLoading ? "-" : stats.pendingResults}
                </Text>
              </View>
              <View
                className="w-[1px] bg-slate-100 dark:bg-slate-800"
                style={{ backgroundColor: colors.border }}
              />
              <View className="items-center flex-1">
                <Text className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-outfit-bold mb-1">
                  {t('pregnant')}
                </Text>
                <Text className="text-slate-800 dark:text-white font-outfit-black text-xl">
                  {isLoading ? "-" : stats.activePregnancies}
                </Text>
              </View>
              <View
                className="w-[1px] bg-slate-100 dark:bg-slate-800"
                style={{ backgroundColor: colors.border }}
              />
              <View className="items-center flex-1">
                <Text className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-outfit-bold mb-1">
                  {t('calving')}
                </Text>
                <Text className="text-slate-800 dark:text-white font-outfit-black text-xl">
                  {isLoading ? "-" : stats.upcomingCalvings}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* --- QUICK ACTIONS --- */}
        <View className="px-6 mb-8">
          <View
            className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px] mb-6 ml-1">
              {t('quickActions')}
            </Text>
            <View className="flex-row justify-between">
              <QuickActionItem
                title={t('requestAi')}
                icon={
                  <Syringe
                    size={24}
                    color={isDark ? colors.primary : "#166534"}
                  />
                }
                iconBg={isDark ? "rgba(16,185,129,0.15)" : "#F0FDF4"}
                onPress={() => router.push("/(farmer)/request-ai")}
              />
              <QuickActionItem
                title={t('requestVet')}
                icon={
                  <Stethoscope
                    size={24}
                    color={isDark ? "#f87171" : "#9A3412"}
                  />
                }
                iconBg={isDark ? "rgba(248,113,113,0.15)" : "#FFF7ED"}
                onPress={() => router.push("/(farmer)/report-sickness")}
              />
              <QuickActionItem
                title={t('addCow')}
                icon={<Plus size={24} color={isDark ? "#fbbf24" : "#713F12"} />}
                iconBg={isDark ? "rgba(251,191,36,0.15)" : "#FEF9C3"}
                onPress={() => router.push("/(farmer)/(tabs)/add-animal")}
              />
              <QuickActionItem
                title={t('askMoowie')}
                icon={
                  <MessageSquare
                    size={24}
                    color={isDark ? colors.primary : "#166534"}
                  />
                }
                iconBg={isDark ? "rgba(16,185,129,0.15)" : "#F0FDF4"}
                onPress={() => router.push("/ask-moowie")}
              />
            </View>
          </View>
        </View>

        {/* --- MOOWIE ASSISTANT CTA --- */}
        <View className="px-6 mb-8">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push("/ask-moowie")}
            className="bg-[#FDF2E9] dark:bg-orange-950/20 rounded-[32px] p-5 flex-row items-center border border-orange-100/50 dark:border-orange-950/10 shadow-sm"
            style={{
              borderColor: isDark ? colors.border : "rgba(253,242,233,0.5)",
            }}
          >
            <View className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-2xl items-center justify-center overflow-hidden">
              <Image
                source={{
                  uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                }}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>

            <View className="flex-1 ml-4">
              <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px]">
                {t('moowieGreeting')}
              </Text>
              <Text className="text-slate-500 dark:text-slate-400 text-[12px] font-outfit-medium leading-4 mt-0.5">
                {t('moowieHelperText')}
              </Text>
            </View>

            <View
              className="w-10 h-10 rounded-full items-center justify-center shadow-md"
              style={{ backgroundColor: isDark ? colors.primary : "#00643B" }}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color="white"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* --- PENDING OUTCOME CARD (Dynamic) --- */}
        {pendingOutcomes && pendingOutcomes.length > 0 && (
          <View className="px-6 mb-8">
            <View className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/20 rounded-[32px] p-5">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="baby-face-outline"
                    size={20}
                    color={isDark ? colors.primary : PRIMARY}
                  />
                  <Text className="text-slate-800 dark:text-white font-outfit-bold ml-2 text-base">
                    AI Outcome Check
                  </Text>
                </View>
                {pendingOutcomes.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setShowAllOutcomes(!showAllOutcomes)}
                  >
                    <Text className="text-emerald-700 dark:text-emerald-400 font-outfit-bold text-[12px]">
                      {showAllOutcomes
                        ? "Show Less"
                        : `+${pendingOutcomes.length - 1} more`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {(showAllOutcomes
                ? pendingOutcomes
                : pendingOutcomes.slice(0, 1)
              ).map((req: any, idx: number) => (
                <View
                  key={req._id}
                  className={`bg-white/60 dark:bg-slate-900/60 p-4 rounded-2xl ${idx > 0 ? "mt-3" : ""}`}
                >
                  <Text className="font-outfit-bold text-slate-800 dark:text-white text-[14px]">
                    Did {req.animalId?.earTag || req.animalId?.animalId}{" "}
                    conceive?
                  </Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 font-outfit-medium">
                    Inseminated:{" "}
                    {format(new Date(req.inseminationDate || req.createdAt), "MMM d, yyyy")}
                  </Text>

                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() =>
                        handleOutcome(
                          req._id,
                          true,
                          req.animalId?.earTag || req.animalId?.animalId,
                          req.animalId?._id,
                        )
                      }
                      disabled={submittingOutcome}
                      className="bg-[#00643B] dark:bg-emerald-600 flex-1 py-2 rounded-xl items-center shadow-sm justify-center flex-row gap-1.5"
                      style={{ opacity: submittingOutcome ? 0.7 : 1 }}
                    >
                      {submittingOutcome ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text className="text-white font-outfit-bold text-xs">
                          Yes, Pregnant!
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleOutcome(
                          req._id,
                          false,
                          req.animalId?.earTag || req.animalId?.animalId,
                          req.animalId?._id,
                        )
                      }
                      disabled={submittingOutcome}
                      className="bg-white dark:bg-slate-800 flex-1 py-2 rounded-xl items-center border border-red-100 dark:border-slate-700 shadow-sm justify-center flex-row gap-1.5"
                      style={{
                        borderColor: isDark ? colors.border : "#fee2e2",
                        opacity: submittingOutcome ? 0.7 : 1,
                      }}
                    >
                      {submittingOutcome ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                      ) : (
                        <Text className="text-red-600 dark:text-red-400 font-outfit-bold text-xs">
                          No, Re-heat
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- UPCOMING VISITS --- */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px]">
              {t('upcomingVisits')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(farmer)/my-requests")}
            >
              <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-[13px]">
                {t('viewAll')}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            className="bg-white dark:bg-slate-900 rounded-[32px] p-4 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {upcomingVisits && upcomingVisits.length > 0 ? (
              upcomingVisits.map((visit: any, idx: number) => (
                <View key={visit._id}>
                  <VisitItem
                    title={`${visit.serviceType === "health" ? "Health Check" : "AI Service"} — ${visit.animalId?.earTag || visit.animalId?.animalId || "Animal"}`}
                    time={
                      visit.scheduledDate || visit.preferredDate
                        ? `${visit.status?.toLowerCase() === "pending" ? "Preferred: " : "Scheduled: "}${format(
                            new Date(
                              visit.scheduledDate || visit.preferredDate,
                            ),
                            "MMM d • h:mm a",
                          )}`
                        : "TBA"
                    }
                    technician={visit.technician || "Pending Assignment"}
                    status={visit.status.toUpperCase()}
                    icon={
                      visit.serviceType === "health" ? (
                        <Stethoscope
                          size={20}
                          color={isDark ? "#f97316" : "#92400E"}
                        />
                      ) : (
                        <Syringe
                          size={20}
                          color={isDark ? colors.primary : "#166534"}
                        />
                      )
                    }
                    iconBg={
                      visit.serviceType === "health"
                        ? isDark
                          ? "rgba(249,115,22,0.15)"
                          : "#FFFBEB"
                        : isDark
                          ? "rgba(16,185,129,0.15)"
                          : "#F0FDF4"
                    }
                    onCancel={() =>
                      handleCancelRequest(
                        visit._id,
                        visit.serviceType,
                        visit.animalId?.earTag || "Animal",
                      )
                    }
                  />
                  {idx < upcomingVisits.length - 1 && (
                    <View
                      className="h-[1px] bg-slate-50 dark:bg-slate-800 my-2 mx-4"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                </View>
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium">
                  {t('noScheduledVisits')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- HEAT & BREEDING ALERTS --- */}
        {Array.isArray(milestones) && milestones.length > 0 && (
          <View className="px-6 mb-8">
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px] mb-4 px-1">
              {t('heatBreedingAlerts')}
            </Text>
            <View
              className="bg-white dark:bg-slate-900 rounded-[32px] p-4 shadow-sm border border-gray-100 dark:border-slate-800"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              {milestones.map((m: any, idx: number) => (
                <View key={`${m.type}-${m.animal?._id}-${idx}`}>
                  <AlertItem
                    title={`${m.animal?.earTag || "Animal"} — ${m.title}`}
                    subtitle={`${m.daysLeft > 0 ? `Due in ${m.daysLeft} days` : "Due today"} • ${format(new Date(m.date), "MMM d")}`}
                    icon={
                      m.type === "calving" ? (
                        <MaterialCommunityIcons
                          name="baby-face-outline"
                          size={20}
                          color={isDark ? "#34d399" : "#166534"}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="alert-circle-outline"
                          size={20}
                          color={isDark ? "#f97316" : "#9A3412"}
                        />
                      )
                    }
                    bgColor={
                      m.type === "calving"
                        ? isDark
                          ? "rgba(52,211,153,0.12)"
                          : "#F0FDF4"
                        : isDark
                          ? "rgba(249,115,22,0.12)"
                          : "#FDF2E9"
                    }
                    textColor={
                      m.type === "calving"
                        ? isDark
                          ? "#34d399"
                          : "#166534"
                        : isDark
                          ? "#f97316"
                          : "#9A3412"
                    }
                  />
                  {idx < milestones.length - 1 && <View className="h-3" />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- REQUEST HUB MODAL (omitted for brevity - same as original) --- */}

        {/* --- MY CATTLE --- */}
        <View className="px-6 mb-8">
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px]">
              {t('myCattle')}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(farmer)/(tabs)/add-animal")}
            >
              <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-[13px]">
                + Add
              </Text>
            </TouchableOpacity>
          </View>

          <View
            className="bg-white dark:bg-slate-900 rounded-[32px] p-4 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {myAnimals && myAnimals.length > 0 ? (
              myAnimals.slice(0, 5).map((animal: any) => (
                <CattleItem
                  key={animal._id}
                  name={`${animal.earTag || "Cow"} #${animal.animalId.split("-").pop()}`}
                  breed={animal.breed}
                  status={animal.reproductiveStatus || "Healthy"}
                  statusColor={
                    animal.reproductiveStatus === "Pregnant"
                      ? "purple"
                      : animal.reproductiveStatus === "Inseminated"
                        ? "orange"
                        : "emerald"
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/(farmer)/animal-details",
                      params: { id: animal._id },
                    })
                  }
                />
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium">
                  {t('noCows')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- RECENT RECORDS --- */}
        <View className="px-6 mb-12">
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px]">
              Recent Activity
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(farmer)/(tabs)/farmer.records")}
            >
              <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-[13px]">
                View all
              </Text>
            </TouchableOpacity>
          </View>
          <View
            className="bg-white dark:bg-slate-900 rounded-[32px] p-4 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {Array.isArray(activityFeed) && activityFeed.length > 0 ? (
              activityFeed.slice(0, 5).map((item: any, idx: number) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: "/(farmer)/(tabs)/farmer.records",
                      params: { tab: "records", selectId: item.id },
                    })
                  }
                >
                  <RecordItem
                    title={item.title}
                    date={format(new Date(item.date), "MMM d, yyyy • h:mm a")}
                    icon={
                      item.type === "ai" ? (
                        <Syringe
                          size={18}
                          color={isDark ? "#60a5fa" : "#2563eb"}
                        />
                      ) : item.type === "health" ? (
                        <Stethoscope
                          size={18}
                          color={isDark ? "#f87171" : "#dc2626"}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="cow"
                          size={18}
                          color={isDark ? "#fbbf24" : "#b45309"}
                        />
                      )
                    }
                    iconBg={
                      item.type === "ai"
                        ? isDark
                          ? "rgba(96,165,250,0.15)"
                          : "#eff6ff"
                        : item.type === "health"
                          ? isDark
                            ? "rgba(248,113,113,0.15)"
                            : "#fef2f2"
                          : isDark
                            ? "rgba(251,191,36,0.15)"
                            : "#fef3c7"
                    }
                  />
                  {idx < Math.min(activityFeed.length, 5) - 1 && (
                    <View
                      className="h-[1px] bg-slate-50 dark:bg-slate-800 my-1 mx-4"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View className="py-8 items-center">
                <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium">
                  No recent activity
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- LEARN WITH MOOWIE (Keep static for now or expand later) --- */}
        <View className="px-6 mb-16">
          <View
            className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px] mb-4 ml-1">
              Learn with Moowie
            </Text>
            <View className="flex-row gap-3">
              <LearnItem
                title="Detecting heat signs"
                icon={
                  <MaterialCommunityIcons
                    name="book-open-variant"
                    size={20}
                    color="#166534"
                  />
                }
                bgColor="#FEF3C7"
              />
              <LearnItem
                title="Calf nutrition basics"
                icon={
                  <MaterialCommunityIcons
                    name="heart-outline"
                    size={20}
                    color="#166534"
                  />
                }
                bgColor="#FEF3C7"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* --- REQUEST HUB MODAL (Re-inserting omitted part) --- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showRequestHub}
        onRequestClose={() => setShowRequestHub(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-[32px] p-8 pb-12 shadow-2xl"
            style={{ backgroundColor: colors.card }}
          >
            <View
              className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full self-center mb-6"
              style={{ backgroundColor: colors.border }}
            />

            <Text className="text-2xl font-outfit-black text-slate-800 dark:text-white mb-2">
              Request Service
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 mb-8 font-outfit-medium">
              What service do you need for your animal today?
            </Text>

            <View className="gap-y-4">
              <HubOption
                title="Register New Animal"
                subtitle="Add a new cattle or carabao to your registry"
                icon={
                  <Plus size={24} color={isDark ? colors.primary : "#00643B"} />
                }
                color="#ECFDF5"
                onPress={() => {
                  setShowRequestHub(false);
                  router.push("/(farmer)/(tabs)/add-animal");
                }}
              />
              <HubOption
                title="Insemination (AI)"
                subtitle="Schedule a technician for artificial breeding"
                icon={
                  <MaterialCommunityIcons
                    name="needle"
                    size={24}
                    color={isDark ? "#60a5fa" : "#3B82F6"}
                  />
                }
                color="#EFF6FF"
                onPress={() => {
                  setShowRequestHub(false);
                  router.push("/(farmer)/request-ai");
                }}
              />
              <HubOption
                title="Health Checkup"
                subtitle="Report a sick animal or request a checkup"
                icon={
                  <MaterialCommunityIcons
                    name="medical-bag"
                    size={24}
                    color={isDark ? "#f87171" : "#EF4444"}
                  />
                }
                color="#FEF2F2"
                onPress={() => {
                  setShowRequestHub(false);
                  router.push("/(farmer)/report-sickness");
                }}
              />
              <HubOption
                title="Pregnancy Diagnosis"
                subtitle="Confirm if your animal is pregnant"
                icon={
                  <MaterialCommunityIcons
                    name="baby-carriage"
                    size={24}
                    color={isDark ? "#fbbf24" : "#D97706"}
                  />
                }
                color="#FFFBEB"
                onPress={() => {
                  setShowRequestHub(false);
                  router.push("/(farmer)/request-ai");
                }}
              />
            </View>

            <TouchableOpacity
              onPress={() => setShowRequestHub(false)}
              className="mt-8 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl items-center"
              style={{ backgroundColor: colors.background }}
            >
              <Text className="text-slate-600 dark:text-slate-400 font-outfit-bold">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {cancelInfo && (
        <ConfirmationModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onConfirm={handleConfirmCancel}
          title="Cancel Request?"
          message={`Are you sure you want to cancel this request for ${cancelInfo.animalTag}?`}
          confirmText="Yes, Cancel"
          cancelText="No, Keep it"
          isDestructive={true}
        />
      )}
    </View>
  );
}

// --- SUB COMPONENTS ---

const HubOption = ({
  title,
  subtitle,
  icon,
  color,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center p-4 rounded-3xl border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
      style={{
        elevation: 2,
        shadowColor: "#94a3b8",
        shadowOpacity: 0.05,
        shadowRadius: 5,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: isDark ? "rgba(255,255,255,0.05)" : color }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-base font-outfit-bold text-slate-800 dark:text-white">
          {title}
        </Text>
        <Text className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 font-outfit-medium">
          {subtitle}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={isDark ? colors.textMuted : "#CBD5E1"}
      />
    </TouchableOpacity>
  );
};

const QuickActionItem = ({
  title,
  icon,
  iconBg,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.7}
    className="items-center flex-1"
    onPress={onPress}
  >
    <View
      className="w-14 h-14 rounded-full items-center justify-center mb-2"
      style={{ backgroundColor: iconBg }}
    >
      {icon}
    </View>
    <Text className="text-slate-700 dark:text-slate-200 text-[11px] font-outfit-bold text-center">
      {title}
    </Text>
  </TouchableOpacity>
);

const VisitItem = ({
  title,
  time,
  technician,
  status,
  icon,
  iconBg,
  onCancel,
}: any) => {
  const { colors, isDark } = useTheme();
  return (
    <View className="flex-row items-center p-2">
      <View
        className="w-12 h-12 rounded-full items-center justify-center"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </View>
      <View className="flex-1 ml-4">
        <Text className="text-slate-800 dark:text-white font-outfit-bold text-[15px]">
          {title}
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 font-outfit-medium text-[12px]">
          {time}
        </Text>
        <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium text-[11px]">
          {technician && technician !== "Pending Assignment"
            ? `Technician: ${technician}`
            : "Pending Assignment"}
        </Text>
      </View>
      <View className="items-end gap-2">
        <View
          className={`px-2.5 py-1 rounded-full ${
            status === "APPROVED"
              ? isDark
                ? "bg-emerald-950/40"
                : "bg-emerald-50"
              : status === "IN-PROGRESS"
                ? isDark
                  ? "bg-blue-950/40"
                  : "bg-blue-50"
                : isDark
                  ? "bg-orange-950/40"
                  : "bg-orange-50"
          }`}
        >
          <Text
            className={`font-outfit-bold text-[9px] ${
              status === "APPROVED"
                ? isDark
                  ? "text-emerald-400"
                  : "text-emerald-700"
                : status === "IN-PROGRESS"
                  ? isDark
                    ? "text-blue-400"
                    : "text-blue-700"
                  : isDark
                    ? "text-orange-400"
                    : "text-orange-700"
            }`}
          >
            {status}
          </Text>
        </View>
        {onCancel &&
          ["PENDING", "APPROVED", "IN-PROGRESS"].includes(status) && (
            <TouchableOpacity onPress={onCancel}>
              <Text className="text-red-500 font-outfit-bold text-[10px]">
                Cancel
              </Text>
            </TouchableOpacity>
          )}
      </View>
    </View>
  );
};

const AlertItem = ({ title, subtitle, icon, bgColor, textColor }: any) => (
  <View
    className="flex-row items-center p-4 rounded-3xl"
    style={{ backgroundColor: bgColor }}
  >
    <View className="mr-3">{icon}</View>
    <View className="flex-1">
      <Text
        className="font-outfit-bold text-[15px]"
        style={{ color: textColor }}
      >
        {title}
      </Text>
      <Text
        className="font-outfit-medium text-[12px] opacity-70"
        style={{ color: textColor }}
      >
        {subtitle}
      </Text>
    </View>
  </View>
);

const CattleItem = ({ name, breed, status, statusColor, onPress }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      className="flex-row items-center p-3 mb-2 rounded-2xl border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <View className="w-12 h-12 bg-orange-50 dark:bg-orange-950/20 rounded-full items-center justify-center">
        <MaterialCommunityIcons
          name="cow"
          size={24}
          color={isDark ? "#f59e0b" : "#92400E"}
        />
      </View>
      <View className="flex-1 ml-4">
        <Text className="text-slate-800 dark:text-white font-outfit-bold text-[15px]">
          {name}
        </Text>
        <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium text-[12px]">
          {breed}
        </Text>
      </View>
      <View
        className={`px-3 py-1 rounded-full ${statusColor === "purple" ? "bg-purple-50 dark:bg-purple-950/30" : statusColor === "orange" ? "bg-orange-50 dark:bg-orange-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"}`}
      >
        <Text
          className={`font-outfit-bold text-[10px] ${statusColor === "purple" ? "text-purple-700 dark:text-purple-400" : statusColor === "orange" ? "text-orange-700 dark:text-orange-400" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {status}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const RecordItem = ({ title, date, icon, iconBg }: any) => (
  <View className="flex-row items-center p-3">
    <View
      className="w-10 h-10 rounded-full items-center justify-center"
      style={{ backgroundColor: iconBg }}
    >
      {icon}
    </View>
    <View className="flex-1 ml-4">
      <Text className="text-slate-800 dark:text-white font-outfit-bold text-[14px]">
        {title}
      </Text>
      <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium text-[11px]">
        {date}
      </Text>
    </View>
  </View>
);

const LearnItem = ({ title, icon, bgColor }: any) => {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      className="flex-1 p-4 rounded-3xl border"
      style={{
        backgroundColor: isDark ? colors.card : bgColor,
        borderColor: isDark ? colors.border : "transparent",
      }}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 bg-white/50 dark:bg-slate-800/50 rounded-full items-center justify-center mb-3">
        {icon}
      </View>
      <Text className="text-slate-800 dark:text-white font-outfit-bold text-[13px] leading-4">
        {title}
      </Text>
    </TouchableOpacity>
  );
};
