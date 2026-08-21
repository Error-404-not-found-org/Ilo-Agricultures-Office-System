import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import {
  Bell,
  MapPin,
  Plus,
  Syringe,
  Stethoscope,
  MessageSquare,
  X,
  Info,
  Sparkles,
  CalendarDays,
  Calendar,
  Clock,
  User,
  ChevronRight,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/clerk-expo";
import { useFarmerDashboardQueries } from "../hooks/useFarmerDashboard";
import { useFarmerDashboardMutations } from "../hooks/useFarmerDashboardMutations";
import { toast } from "sonner-native";
import { format } from "date-fns";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
import { AnimalSummaryCard } from "@/features/farmer-ui/components";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatAnimalReference,
  getFarmerDashboardLayout,
  getFullAnimalReference,
  selectNeedsAttention,
  selectRecentActivities,
  selectUpcomingVisits,
} from "../utils/farmerDashboard.transforms";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  formatVisitPeriod,
  formatVisitSchedule,
} from "@/features/farmer-requests/utils/requestDetailPresentation";

const PRIMARY = "#00643B";

export function FarmerHomeScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useUser();
  const {
    queryClient,
    profileQuery,
    unreadCountQuery,
    upcomingVisitsQuery,
    pendingOutcomesQuery,
    milestonesQuery,
    myAnimalsQuery,
    activityFeedQuery,
  } = useFarmerDashboardQueries();

  const { outcomeMutation, cancelMutation } = useFarmerDashboardMutations();

  const [showRequestHub, setShowRequestHub] = React.useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [cancelInfo, setCancelInfo] = React.useState<{
    id: string;
    type: string;
    animalTag: string;
  } | null>(null);
  const [cancellationReason, setCancellationReason] = React.useState("");
  const [selectedActivity, setSelectedActivity] = React.useState<any | null>(
    null,
  );
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [statusBarOnHero, setStatusBarOnHero] = React.useState(true);
  const [heroHeaderHeight, setHeroHeaderHeight] = React.useState(260);

  const [congratsModalVisible, setCongratsModalVisible] = React.useState(false);
  const [congratsInfo, setCongratsInfo] = React.useState<{
    animalName: string;
    expectedCalvingDate: string;
  } | null>(null);
  const [reInseminateModalVisible, setReInseminateModalVisible] =
    React.useState(false);
  const [reInseminateInfo, setReInseminateInfo] = React.useState<{
    requestId: string;
    animalId: string;
    animalName: string;
  } | null>(null);

  const [showWelcomeModal, setShowWelcomeModal] = React.useState(false);
  const [hasPromptedWelcome, setHasPromptedWelcome] = React.useState(false);

  const { data: profile, isLoading } = profileQuery;
  const { data: unreadCountData } = unreadCountQuery;

  const unreadCount = unreadCountData?.count || 0;
  const stats = profile?.stats || {
    totalAnimals: 0,
    activePregnancies: 0,
    upcomingCalvings: 0,
    pendingResults: 0,
  };
  const hasFarmPin = Boolean(
    profile?.farmLocation?.latitude && profile?.farmLocation?.longitude,
  );
  const hasPhone = Boolean(profile?.phoneNumber);

  React.useEffect(() => {
    if (
      !isLoading &&
      profile &&
      (!hasFarmPin || !hasPhone) &&
      !hasPromptedWelcome
    ) {
      setShowWelcomeModal(true);
      setHasPromptedWelcome(true);
    }
  }, [isLoading, profile, hasFarmPin, hasPhone, hasPromptedWelcome]);

  const getWelcomeModalContent = () => {
    if (!hasFarmPin && !hasPhone) {
      return {
        title: "Welcome to BreedSmart! 👋",
        description:
          "We're excited to have you! To help our technicians find your farm easily and contact you for visits, please take a quick moment to set your farm location and phone number.",
        buttonText: "Complete Profile",
      };
    } else if (!hasFarmPin) {
      return {
        title: "Set Farm Location 📍",
        description:
          "To help our technicians find your farm easily and assist your cattle faster during visits, please take a quick moment to pin your location.",
        buttonText: "Set Farm Location",
      };
    } else {
      return {
        title: "Add Phone Number 📞",
        description:
          "To help our technicians get in touch with you and coordinate visits, please take a quick moment to add your phone number.",
        buttonText: "Add Phone Number",
      };
    }
  };

  const modalContent = getWelcomeModalContent();
  const currentDate = format(new Date(), "EEEE, d MMM yyyy");

  const { data: upcomingVisits } = upcomingVisitsQuery;

  const { data: pendingOutcomes } = pendingOutcomesQuery;
  const { data: milestones } = milestonesQuery;
  const { data: myAnimals } = myAnimalsQuery;
  const { data: activityFeed } = activityFeedQuery;
  const dashboardLayout = React.useMemo(
    () => getFarmerDashboardLayout(screenWidth),
    [screenWidth],
  );
  const visibleVisits = React.useMemo(
    () => selectUpcomingVisits(upcomingVisits || []),
    [upcomingVisits],
  );
  const attentionItems = React.useMemo(
    () => selectNeedsAttention(Array.isArray(milestones) ? milestones : []),
    [milestones],
  );
  const handleAttentionPress = (item: (typeof attentionItems)[number]) => {
    const animalId = item.animal?._id;
    if (!animalId) {
      toast.error("This breeding milestone is missing its animal record.");
      return;
    }

    if (item.actionKind === "report_signs") {
      router.push({
        pathname: "/(farmer)/report-breeding-observation",
        params: {
          animalId,
          requestId: item.relatedId,
          defaultReport: item.farmerObservation?.reportType || "unsure",
        },
      } as never);
      return;
    }

    if (item.actionKind === "request_pregnancy_check") {
      router.push({
        pathname: "/(farmer)/report-breeding-observation",
        params: {
          animalId,
          requestId: item.relatedId,
          defaultReport: item.farmerObservation?.reportType || "unsure",
        },
      } as never);
      return;
    }

    if (item.actionKind === "record_calving" && item.relatedId) {
      router.push({
        pathname: "/(farmer)/record-calving",
        params: {
          pregnancyId: item.relatedId,
          animalId,
          earTag: item.animal?.earTag || item.animal?.animalId,
          taskId: item.taskId || undefined,
        },
      } as never);
      return;
    }

    router.push(`/(farmer)/animal-details?id=${animalId}`);
  };
  const recentActivities = React.useMemo(
    () =>
      selectRecentActivities(Array.isArray(activityFeed) ? activityFeed : []),
    [activityFeed],
  );

  const handleConfirmCancel = async () => {
    if (!cancelInfo) return;
    if (!cancellationReason.trim()) {
      toast.error("Please provide a cancellation reason.");
      return;
    }
    const { id, type } = cancelInfo;
    try {
      const result = await cancelMutation.mutateAsync({
        id,
        type,
        reason: cancellationReason.trim(),
      });
      toast.success(
        result?.cancellationStatus === "requested"
          ? "Cancellation request submitted for review"
          : "Request cancelled",
      );
      setModalVisible(false);
      setCancelInfo(null);
      setCancellationReason("");
    } catch (err: any) {
      toast.error("Failed to cancel");
    }
  };

  return (
    <View
      className="flex-1 bg-[#F9FAFB] dark:bg-slate-950"
      style={{ backgroundColor: colors.background }}
    >
      <StatusBar
        barStyle={statusBarOnHero || isDark ? "light-content" : "dark-content"}
        backgroundColor={statusBarOnHero ? PRIMARY : colors.card}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: statusBarOnHero ? PRIMARY : colors.card,
          zIndex: 999,
          elevation: 999,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 150,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const nextOnHero =
            event.nativeEvent.contentOffset.y < heroHeaderHeight - insets.top;
          if (nextOnHero !== statusBarOnHero) setStatusBarOnHero(nextOnHero);
        }}
        scrollEventThrottle={32}
      >
        {/* --- HERO HEADER --- */}
        <View
          className="pt-16 px-6 shadow-md z-0"
          onLayout={(event) =>
            setHeroHeaderHeight(event.nativeEvent.layout.height)
          }
          style={{
            backgroundColor: PRIMARY,
            paddingBottom: 144,
            borderBottomLeftRadius: 30,
            borderBottomRightRadius: 30,
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
                      {user?.firstName?.charAt(0) ||
                        user?.username?.charAt(0) ||
                        "F"}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              <View className="flex-1">
                <Text
                  className="text-white text-[20px] font-outfit-bold tracking-tight"
                  numberOfLines={1}
                >
                  {t("welcomeBack")}{" "}
                  {user?.firstName || user?.username || "Farmer"}
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
        <View className="px-6 z-10 w-full mb-8" style={{ marginTop: -110 }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 22,
              padding: 18,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.18 : 0.08,
              shadowRadius: 18,
              elevation: 4,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "rgba(16,185,129,0.14)" : "#ecfdf5",
                }}
              >
                <MaterialCommunityIcons
                  name="barn"
                  size={20}
                  color={isDark ? colors.primary : PRIMARY}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0, marginLeft: 11 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 16,
                  }}
                >
                  {t("myFarmStatus")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                    marginTop: 1,
                  }}
                >
                  {t("farmOverview")}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#f0fdf4",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginRight: 5,
                    backgroundColor: isDark ? "#34d399" : "#059669",
                  }}
                />
                <Text
                  style={{
                    color: isDark ? "#6ee7b7" : "#047857",
                    fontFamily: "Outfit_700Bold",
                    fontSize: 10,
                  }}
                >
                  {t("active")}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 16,
                padding: 14,
                marginBottom: 16,
                backgroundColor: isDark ? "rgba(16,185,129,0.10)" : "#f0fdf4",
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 11,
                  }}
                >
                  {t("registeredLivestock")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_900Black",
                      fontSize: 36,
                      lineHeight: 42,
                    }}
                  >
                    {isLoading
                      ? "-"
                      : stats.totalAnimals <= 0
                        ? "0"
                        : stats.totalAnimals}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                      marginLeft: 7,
                    }}
                  >
                    {t("animals")}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isDark ? "rgba(16,185,129,0.16)" : "#dcfce7",
                }}
              >
                <MaterialCommunityIcons
                  name="cow"
                  size={25}
                  color={isDark ? "#34d399" : PRIMARY}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "stretch" }}>
              <FarmStatusMetric
                label={t("waitingResult")}
                value={isLoading ? "-" : stats.pendingResults}
                icon="clipboard-clock-outline"
                color={isDark ? "#fbbf24" : "#b45309"}
                tint={isDark ? "rgba(245,158,11,0.14)" : "#fffbeb"}
              />
              <View
                style={{
                  width: 1,
                  marginHorizontal: 10,
                  backgroundColor: colors.border,
                }}
              />
              <FarmStatusMetric
                label={t("pregnant")}
                value={isLoading ? "-" : stats.activePregnancies}
                icon="heart-pulse"
                color={isDark ? "#f9a8d4" : "#be185d"}
                tint={isDark ? "rgba(236,72,153,0.14)" : "#fdf2f8"}
              />
              <View
                style={{
                  width: 1,
                  marginHorizontal: 10,
                  backgroundColor: colors.border,
                }}
              />
              <FarmStatusMetric
                label={t("calving")}
                value={isLoading ? "-" : stats.upcomingCalvings}
                icon="calendar-heart"
                color={isDark ? "#67e8f9" : "#0e7490"}
                tint={isDark ? "rgba(6,182,212,0.14)" : "#ecfeff"}
              />
            </View>
          </View>
        </View>

        {/* --- QUICK ACTIONS --- */}
        <View
          className="mb-8"
          style={{ paddingHorizontal: dashboardLayout.horizontalPadding }}
        >
          <View
            className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px] mb-6 ml-1">
              {t("quickActions")}
            </Text>
            <View className="flex-row justify-between">
              <QuickActionItem
                title={t("requestAi")}
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
                title={t("requestVet")}
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
                title={t("addCow")}
                icon={<Plus size={24} color={isDark ? "#fbbf24" : "#713F12"} />}
                iconBg={isDark ? "rgba(251,191,36,0.15)" : "#FEF9C3"}
                onPress={() => router.push("/(farmer)/register-animal" as any)}
              />
            </View>
          </View>
        </View>

        {/* --- UPCOMING VISITS --- */}
        <View
          className="mb-8"
          style={{ paddingHorizontal: dashboardLayout.horizontalPadding }}
        >
          {/* Section Header */}
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="flex-1 font-outfit-bold text-[18px] text-slate-800 dark:text-white">
              {t("upcomingVisits")}
            </Text>

            <TouchableOpacity
              onPress={() => router.push("/(farmer)/(tabs)/service-requests")}
              accessibilityRole="button"
              accessibilityLabel={t("viewAll")}
              hitSlop={8}
              className="ml-4 min-h-12 items-center justify-center"
            >
              <Text className="font-outfit-bold text-[13px] text-emerald-600 dark:text-emerald-400">
                {t("viewAll")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Visits Card */}
          <View
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            {visibleVisits.length > 0 ? (
              visibleVisits.map((visit: any, idx: number) => {
                const isHealthVisit = visit.serviceType === "health";
                const isAIVisit = visit.serviceType === "ai";
                const normalizedStatus = visit.status?.toLowerCase();

                const statusLabel =
                  visit.cancellationStatus === "requested"
                    ? "CANCEL REQUESTED"
                    : visit.status?.toUpperCase() || "UNKNOWN STATUS";

                const reproductiveOutcome =
                  isAIVisit &&
                  visit.outcome &&
                  String(visit.outcome).toLowerCase() !== "pending"
                    ? visit.outcome
                    : undefined;

                const canCancel =
                  normalizedStatus === "scheduled" &&
                  visit.cancellationStatus !== "requested";
                const visitPeriod = formatVisitPeriod(visit.visitPeriod);
                const visitSchedule = formatVisitSchedule(
                  visit.scheduledDate,
                  visit.visitPeriod,
                );

                return (
                  <View key={visit._id}>
                    <VisitItem
                      title={`${
                        isHealthVisit ? "Health Check" : "AI Service"
                      } · ${formatAnimalReference(visit.animalId)}`}
                      dateStr={format(
                        new Date(visit.scheduledDate),
                        "EEE, MMM d, yyyy",
                      )}
                      timeStr={visitPeriod || undefined}
                      technician={visit.technician || "Pending Assignment"}
                      serviceStatus={statusLabel}
                      reproductiveOutcome={reproductiveOutcome}
                      accessibilityLabel={`${
                        isHealthVisit ? "Health check" : "AI service"
                      } for ${getFullAnimalReference(visit.animalId)}.${
                        visitSchedule ? ` Scheduled ${visitSchedule}.` : ""
                      } Service status ${visit.status}.`}
                      icon={
                        isHealthVisit ? (
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
                        isHealthVisit
                          ? isDark
                            ? "rgba(249,115,22,0.15)"
                            : "#FFFBEB"
                          : isDark
                            ? "rgba(16,185,129,0.15)"
                            : "#F0FDF4"
                      }
                      onPress={() => {
                        router.push({
                          pathname: isHealthVisit
                            ? "/(farmer)/health-request-detail"
                            : "/(farmer)/ai-request-detail",
                          params: { id: visit._id },
                        });
                      }}
                    />

                    {idx < visibleVisits.length - 1 && (
                      <View
                        className="mx-4 h-px"
                        style={{ backgroundColor: colors.border }}
                      />
                    )}
                  </View>
                );
              })
            ) : (
              <View className="items-center justify-center px-5 py-8">
                <View
                  className="mb-3 h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.tint }}
                >
                  <CalendarDays size={21} color={colors.primary} />
                </View>

                <Text className="text-center font-outfit-medium text-[14px] text-slate-400 dark:text-slate-500">
                  {t("noScheduledVisits")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- NEEDS ATTENTION --- */}
        {attentionItems.length > 0 && (
          <View
            className="mb-8"
            style={{ paddingHorizontal: dashboardLayout.horizontalPadding }}
          >
            <Text className="mb-3 font-outfit-bold text-[18px] text-slate-800 dark:text-white">
              Needs Attention
            </Text>
            <View>
              {attentionItems.map((m, idx) => (
                <View key={`${m.type}-${m.animal?._id || m.relatedId}-${idx}`}>
                  <AlertItem
                    title={m.displayTitle}
                    subtitle={`${m.displaySubtitle}\n${m.guidance}`}
                    actionLabel={m.actionLabel}
                    accessibilityLabel={`${m.displayTitle} for ${getFullAnimalReference(m.animal)}. ${m.displaySubtitle}. ${m.guidance}. ${m.actionLabel}`}
                    icon={
                      m.urgency === "awaiting" ? (
                        <MaterialCommunityIcons
                          name="clock-time-four-outline"
                          size={21}
                          color={colors.textMuted}
                        />
                      ) : m.type === "calving" ? (
                        <MaterialCommunityIcons
                          name="cow"
                          size={21}
                          color={isDark ? "#34d399" : "#166534"}
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="heart-pulse"
                          size={21}
                          color={isDark ? "#f97316" : "#9A3412"}
                        />
                      )
                    }
                    bgColor={
                      m.urgency === "awaiting"
                        ? isDark
                          ? "rgba(148,163,184,0.10)"
                          : "#F8FAFC"
                        : m.type === "calving"
                          ? isDark
                            ? "rgba(52,211,153,0.12)"
                            : "#F0FDF4"
                          : isDark
                            ? "rgba(249,115,22,0.12)"
                            : "#FDF2E9"
                    }
                    textColor={
                      m.urgency === "awaiting"
                        ? colors.textSecondary
                        : m.type === "calving"
                          ? isDark
                            ? "#34d399"
                            : "#166534"
                          : isDark
                            ? "#f97316"
                            : "#9A3412"
                    }
                    onPress={() => handleAttentionPress(m)}
                  />
                  {idx < attentionItems.length - 1 && <View className="h-2" />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- MY CATTLE --- */}
        <View
          className="mb-8"
          style={{ paddingHorizontal: dashboardLayout.horizontalPadding }}
        >
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px]">
              {t("myCattle")}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(farmer)/(tabs)/add-animal")}
              accessibilityRole="button"
              className="justify-center"
              style={{ minHeight: 35 }}
            >
              <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-[13px]">
                View all
              </Text>
            </TouchableOpacity>
          </View>

          {myAnimals && myAnimals.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingRight: dashboardLayout.nextCardPreview,
              }}
              snapToInterval={
                dashboardLayout.animalCardWidth + dashboardLayout.cardGap
              }
              decelerationRate="fast"
            >
              {myAnimals.slice(0, 5).map((animal: any) => (
                <AnimalSummaryCard
                  key={animal._id}
                  animal={animal}
                  variant="preview"
                  cardWidth={dashboardLayout.animalCardWidth}
                  nextAction={
                    animal.reproductiveStatus === "Pregnant" &&
                    animal.expectedCalvingDate
                      ? `Calving ${format(new Date(animal.expectedCalvingDate), "MMM d")}`
                      : undefined
                  }
                  onPress={() =>
                    router.push({
                      pathname: "/(farmer)/animal-details",
                      params: { id: animal._id },
                    })
                  }
                />
              ))}
            </ScrollView>
          ) : (
            <View
              className="py-8 items-center border rounded-lg"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text className="text-slate-400 dark:text-slate-500 font-outfit-medium">
                {t("noCows")}
              </Text>
            </View>
          )}
        </View>

        {/* --- RECENT RECORDS --- */}
        <View
          className="mb-12"
          style={{ paddingHorizontal: dashboardLayout.horizontalPadding }}
        >
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-slate-800 dark:text-white font-outfit-bold text-[18px]">
              Recent Activity
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(farmer)/(tabs)/farmer.records")}
              accessibilityRole="button"
              className="justify-center"
              style={{ minHeight: 44 }}
            >
              <Text className="text-emerald-600 dark:text-emerald-400 font-outfit-bold text-[13px]">
                View all
              </Text>
            </TouchableOpacity>
          </View>
          <View
            className="bg-white dark:bg-slate-900 rounded-lg px-3 border border-gray-100 dark:border-slate-800"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {recentActivities.length > 0 ? (
              recentActivities.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.outcome}. Full animal identifier ${item.fullAnimalReference}.`}
                  onPress={() => {
                    router.push({
                      pathname: "/(farmer)/animal-record-detail",
                      params: {
                        animalId:
                          typeof item.animalId === "string"
                            ? item.animalId
                            : item.animalId?._id || "",
                        recordId: item.id,
                        recordType: item.type,
                      },
                    });
                  }}
                >
                  <RecordItem
                    title={item.title}
                    outcome={item.outcome}
                    date={
                      item.date
                        ? format(new Date(item.date), "MMM d, h:mm a")
                        : "Date unavailable"
                    }
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
                  {idx < recentActivities.length - 1 && (
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
      </ScrollView>

      {/* --- REQUEST HUB MODAL --- */}
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
                  router.push("/(farmer)/register-animal");
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
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-center px-5">
            <View
              className="rounded-3xl p-5 border"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
              }}
            >
              <Text
                className="text-lg font-outfit-bold"
                style={{ color: colors.textPrimary }}
              >
                Request Cancellation
              </Text>
              <Text
                className="text-sm mt-2 font-outfit-medium"
                style={{ color: colors.textSecondary }}
              >
                Tell the technician why you need to cancel the scheduled visit
                for {cancelInfo.animalTag}.
              </Text>
              <TextInput
                value={cancellationReason}
                onChangeText={setCancellationReason}
                placeholder="Enter cancellation reason"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={300}
                className="mt-4 rounded-2xl p-4 min-h-[110px] font-outfit-medium"
                style={{
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  textAlignVertical: "top",
                }}
              />
              <Text
                className="text-right text-[11px] mt-1"
                style={{ color: colors.textMuted }}
              >
                {cancellationReason.length}/300
              </Text>
              <View className="flex-row gap-3 mt-5">
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    setCancelInfo(null);
                    setCancellationReason("");
                  }}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-3 rounded-2xl items-center"
                  style={{ backgroundColor: colors.background }}
                >
                  <Text
                    className="font-outfit-bold"
                    style={{ color: colors.textSecondary }}
                  >
                    Keep Visit
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConfirmCancel}
                  disabled={
                    cancelMutation.isPending || !cancellationReason.trim()
                  }
                  className="flex-1 py-3 rounded-2xl items-center"
                  style={{
                    backgroundColor: colors.error,
                    opacity:
                      cancelMutation.isPending || !cancellationReason.trim()
                        ? 0.55
                        : 1,
                  }}
                >
                  {cancelMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white font-outfit-bold">
                      Submit Request
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View
            className="rounded-[28px] w-full max-h-[80%] border overflow-hidden shadow-2xl"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Header */}
            <View
              className="flex-row justify-between items-center px-6 py-4 border-b"
              style={{
                borderBottomColor: colors.border,
              }}
            >
              <View className="flex-row items-center gap-2">
                <Info size={18} color={isDark ? colors.primary : PRIMARY} />
                <Text
                  className="text-base font-outfit-bold"
                  style={{ color: colors.textPrimary }}
                >
                  Record Details
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                className="p-1"
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              {selectedActivity && (
                <View className="gap-y-5">
                  {/* Category Header Card */}
                  <View
                    className="items-center gap-y-2 pb-4 border-b"
                    style={{ borderBottomColor: colors.border }}
                  >
                    <View
                      className="rounded-2xl items-center justify-center"
                      style={{
                        width: 56,
                        height: 56,
                        backgroundColor:
                          selectedActivity.type === "health"
                            ? isDark
                              ? "rgba(239, 68, 68, 0.15)"
                              : "#fef2f2"
                            : selectedActivity.type === "ai"
                              ? isDark
                                ? "rgba(59, 130, 246, 0.15)"
                                : "#eff6ff"
                              : isDark
                                ? "rgba(16, 185, 129, 0.15)"
                                : "#f0fdf4",
                      }}
                    >
                      {selectedActivity.type === "ai" ? (
                        <Syringe size={26} color="#2563eb" />
                      ) : selectedActivity.type === "health" ? (
                        <Stethoscope size={26} color="#dc2626" />
                      ) : (
                        <MaterialCommunityIcons
                          name="cow"
                          size={30}
                          color="#b45309"
                        />
                      )}
                    </View>
                    <Text
                      className="text-lg font-outfit-black text-center"
                      style={{ color: colors.textPrimary }}
                    >
                      {selectedActivity.title}
                    </Text>
                    <Text
                      className="text-[11px] font-outfit-bold uppercase tracking-wider"
                      style={{ color: colors.textMuted }}
                    >
                      {selectedActivity.date
                        ? format(
                            new Date(selectedActivity.date),
                            "MMMM dd, yyyy • h:mm a",
                          )
                        : "No Date"}
                    </Text>
                  </View>

                  {/* Animal Info */}
                  {selectedActivity.animalId && (
                    <View
                      className="rounded-2xl p-3 border"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.03)"
                          : "#f8fafc",
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        className="text-[10px] font-outfit-bold uppercase mb-1"
                        style={{ color: colors.textMuted }}
                      >
                        Subject Animal
                      </Text>
                      <Text
                        className="text-sm font-outfit-bold"
                        style={{ color: colors.textPrimary }}
                      >
                        Tag: #{selectedActivity.animalId.earTag || "No Tag"}
                      </Text>
                      <Text
                        className="text-xs font-outfit-medium mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {selectedActivity.animalId.breed || "Unknown Breed"} •{" "}
                        {selectedActivity.animalId.species || "Unknown Species"}
                      </Text>
                    </View>
                  )}

                  {/* Detailed Information */}
                  <View className="gap-y-3.5">
                    <Text
                      className="text-[11px] font-outfit-bold uppercase pb-1 border-b"
                      style={{
                        color: colors.textMuted,
                        borderBottomColor: colors.border,
                      }}
                    >
                      Details
                    </Text>

                    {!selectedActivity.details ? (
                      <View className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/20">
                        <Text className="text-xs font-outfit-medium text-red-600 dark:text-red-400 leading-5">
                          ⚠️ Detailed data is missing from the server.
                        </Text>
                      </View>
                    ) : (
                      <>
                        {selectedActivity.type === "ai" && (
                          <View className="gap-y-2.5">
                            <DetailRow
                              label="Status"
                              value={
                                selectedActivity.details.status === "rejected"
                                  ? "Declined"
                                  : selectedActivity.details.status ===
                                      "cancelled"
                                    ? "Cancelled"
                                    : selectedActivity.details.status ===
                                        "approved"
                                      ? "Accepted"
                                      : selectedActivity.details.status ===
                                          "done"
                                        ? "Completed"
                                        : selectedActivity.details.status
                              }
                              highlightColor={
                                selectedActivity.details.status ===
                                  "rejected" ||
                                selectedActivity.details.status === "cancelled"
                                  ? "#dc2626"
                                  : selectedActivity.details.status ===
                                        "approved" ||
                                      selectedActivity.details.status === "done"
                                    ? "#00643B"
                                    : "#d97706"
                              }
                            />
                            <DetailRow
                              label="Sire Breed"
                              value={selectedActivity.details.sireBreed}
                            />
                            <DetailRow
                              label="Sire Code"
                              value={selectedActivity.details.sireCode}
                            />
                            <DetailRow
                              label="Attempt Number"
                              value={selectedActivity.details.attemptNumber?.toString()}
                            />
                            <DetailRow
                              label="Estrus Type"
                              value={selectedActivity.details.estrus}
                            />
                            <DetailRow
                              label="Outcome"
                              value={selectedActivity.details.outcome}
                              highlightColor={
                                selectedActivity.details.outcome?.toLowerCase() ===
                                "success"
                                  ? "#059669"
                                  : selectedActivity.details.outcome?.toLowerCase() ===
                                      "failed"
                                    ? "#dc2626"
                                    : undefined
                              }
                            />
                            <DetailRow
                              label="Technician"
                              value={selectedActivity.details.technician}
                            />
                          </View>
                        )}

                        {selectedActivity.type === "health" && (
                          <View className="gap-y-2.5">
                            <DetailRow
                              label="Status"
                              value={
                                selectedActivity.details.status === "rejected"
                                  ? "Declined"
                                  : selectedActivity.details.status ===
                                      "cancelled"
                                    ? "Cancelled"
                                    : selectedActivity.details.status ===
                                        "approved"
                                      ? "Accepted"
                                      : selectedActivity.details.status ===
                                          "resolved"
                                        ? "Completed"
                                        : selectedActivity.details.status
                              }
                              highlightColor={
                                selectedActivity.details.status ===
                                  "rejected" ||
                                selectedActivity.details.status === "cancelled"
                                  ? "#dc2626"
                                  : selectedActivity.details.status ===
                                        "approved" ||
                                      selectedActivity.details.status ===
                                        "resolved"
                                    ? "#00643B"
                                    : "#d97706"
                              }
                            />
                            <DetailRow
                              label="Request Type"
                              value={selectedActivity.details.requestType}
                            />
                            <DetailRow
                              label="Symptoms"
                              value={selectedActivity.details.symptoms}
                            />
                            <DetailRow
                              label="Urgency"
                              value={selectedActivity.details.urgency}
                              highlightColor={
                                selectedActivity.details.urgency?.toLowerCase() ===
                                "high"
                                  ? "#dc2626"
                                  : selectedActivity.details.urgency?.toLowerCase() ===
                                      "medium"
                                    ? "#d97706"
                                    : "#059669"
                              }
                            />
                            <DetailRow
                              label="Diagnosis"
                              value={selectedActivity.details.diagnosis}
                            />
                            <DetailRow
                              label="Treatment"
                              value={selectedActivity.details.treatment}
                            />
                            <DetailRow
                              label="Medicine / Advice"
                              value={selectedActivity.details.advice}
                            />
                            <DetailRow
                              label="Technician / Vet"
                              value={selectedActivity.details.technician}
                            />
                          </View>
                        )}

                        {selectedActivity.type === "calving" && (
                          <View className="gap-y-2.5">
                            <DetailRow
                              label="Calving Ease"
                              value={selectedActivity.details.calvingEase}
                            />
                            <DetailRow
                              label="Number of Calves"
                              value={selectedActivity.details.numberOfCalves?.toString()}
                            />
                            <DetailRow
                              label="Technician"
                              value={selectedActivity.details.technician}
                            />

                            {selectedActivity.details.calves &&
                              selectedActivity.details.calves.length > 0 && (
                                <View className="mt-2 gap-y-1.5">
                                  <Text
                                    className="text-xs font-outfit-bold"
                                    style={{ color: colors.textSecondary }}
                                  >
                                    Calves Registered:
                                  </Text>
                                  {selectedActivity.details.calves.map(
                                    (calf: any, index: number) => (
                                      <View
                                        key={index}
                                        className="p-2.5 rounded-xl border"
                                        style={{
                                          backgroundColor: isDark
                                            ? "rgba(255,255,255,0.02)"
                                            : "#f8fafc",
                                          borderColor: colors.border,
                                        }}
                                      >
                                        <Text
                                          className="text-xs font-outfit-bold"
                                          style={{ color: colors.textPrimary }}
                                        >
                                          Calf #{index + 1}: {calf.sex}
                                        </Text>
                                        {calf.earTag && (
                                          <Text
                                            className="text-[11px] font-outfit-medium mt-0.5"
                                            style={{
                                              color: colors.textSecondary,
                                            }}
                                          >
                                            Tag: #{calf.earTag}
                                          </Text>
                                        )}
                                        {calf.weight && (
                                          <Text
                                            className="text-[11px] font-outfit-medium"
                                            style={{
                                              color: colors.textSecondary,
                                            }}
                                          >
                                            Weight: {calf.weight} kg
                                          </Text>
                                        )}
                                        {calf.imageUrl ? (
                                          <View
                                            className="mt-2 rounded-lg overflow-hidden border"
                                            style={{
                                              borderColor: colors.border,
                                            }}
                                          >
                                            <Image
                                              source={{ uri: calf.imageUrl }}
                                              style={{
                                                width: "100%",
                                                height: 150,
                                              }}
                                              resizeMode="cover"
                                            />
                                          </View>
                                        ) : null}
                                      </View>
                                    ),
                                  )}
                                </View>
                              )}
                          </View>
                        )}
                      </>
                    )}
                  </View>

                  {/* Technician Notes */}
                  {selectedActivity.details?.technicianNote && (
                    <View
                      className="gap-y-1.5 p-4 rounded-2xl border"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(0, 100, 59, 0.05)"
                          : "#f0fdf4",
                        borderColor: isDark
                          ? "rgba(0, 100, 59, 0.2)"
                          : "#d1fae5",
                      }}
                    >
                      <Text
                        className="text-[11px] font-outfit-black uppercase"
                        style={{ color: isDark ? "#34d399" : "#00643B" }}
                      >
                        Observations / Notes
                      </Text>
                      <Text
                        className="text-xs font-outfit-medium italic leading-5"
                        style={{ color: colors.textPrimary }}
                      >
                        &quot;{selectedActivity.details.technicianNote}&quot;
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View
              className="px-6 py-4 border-t flex-row gap-3"
              style={{ borderTopColor: colors.border }}
            >
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                className="flex-1 py-3 rounded-2xl border items-center justify-center"
                style={{ borderColor: colors.border }}
              >
                <Text
                  className="text-xs font-outfit-bold"
                  style={{ color: colors.textSecondary }}
                >
                  Close
                </Text>
              </TouchableOpacity>

              {selectedActivity?.animalId?._id && (
                <TouchableOpacity
                  onPress={() => {
                    setIsModalVisible(false);
                    router.push(
                      `/(farmer)/animal-details?id=${selectedActivity.animalId?._id}`,
                    );
                  }}
                  className="flex-1 py-3 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: isDark ? colors.primary : PRIMARY }}
                >
                  <Text className="text-xs font-outfit-bold text-white">
                    View Animal
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Congrats Pregnancy Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={congratsModalVisible}
        onRequestClose={() => setCongratsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View
            className="rounded-[30px] w-full p-6 items-center border shadow-2xl relative overflow-hidden"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Ambient Background Glow decoration */}
            <View className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full" />
            <View className="absolute -bottom-12 -left-12 w-28 h-28 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full" />

            {/* Floating Sparks */}
            <View className="absolute top-6 left-8 opacity-25">
              <Sparkles size={20} color="#fbbf24" />
            </View>
            <View className="absolute top-16 right-6 opacity-25">
              <Sparkles size={24} color="#34d399" />
            </View>
            <View className="absolute bottom-28 left-6 opacity-25">
              <Sparkles size={16} color="#fbbf24" />
            </View>

            {/* Double-Ringed Sparkling Icon Container */}
            <View className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/30 items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-900/30">
              <View className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 items-center justify-center">
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={30}
                  color="#10b981"
                />
              </View>
            </View>

            <Text
              className="text-xl font-outfit-black text-center"
              style={{ color: colors.textPrimary }}
            >
              Pregnancy Confirmed! 🎉
            </Text>

            <View className="mt-3 px-1 items-center flex-row flex-wrap justify-center gap-1.5">
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                Wonderful news!
              </Text>
              <View className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/50 dark:border-emerald-900/30 px-2.5 py-0.5 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_800ExtraBold" }}
                  className="text-emerald-700 dark:text-emerald-400 text-xs"
                >
                  #{congratsInfo?.animalName}
                </Text>
              </View>
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                is officially pregnant.
              </Text>
            </View>

            {/* Expected Calving Date Card */}
            {congratsInfo?.expectedCalvingDate && (
              <View
                className="w-full rounded-2xl p-4 mt-6 border items-center flex-row gap-4"
                style={{
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.05)"
                    : "#f0fdf4",
                  borderColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#dcfce7",
                }}
              >
                <View className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 items-center justify-center">
                  <MaterialCommunityIcons
                    name="calendar-heart"
                    size={26}
                    color={isDark ? "#34d399" : "#047857"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[10px] font-outfit-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Estimated Calving Date
                  </Text>
                  <Text className="text-[16px] font-outfit-black text-slate-800 dark:text-white mt-0.5">
                    {congratsInfo.expectedCalvingDate}
                  </Text>
                  <Text className="text-[10px] font-outfit-medium text-slate-400 dark:text-slate-500 mt-0.5">
                    Based on gestation milestones
                  </Text>
                </View>
              </View>
            )}

            {/* Confirm Button */}
            <TouchableOpacity
              onPress={() => {
                setCongratsModalVisible(false);
                queryClient.invalidateQueries({ queryKey: ["user", "me"] });
                queryClient.invalidateQueries({
                  queryKey: ["visits", "upcoming"],
                });
                queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
                queryClient.invalidateQueries({
                  queryKey: ["user", "activity"],
                });
              }}
              style={{ backgroundColor: isDark ? colors.primary : PRIMARY }}
              className="w-full py-4 rounded-2xl items-center mt-6 shadow-md active:opacity-90"
            >
              <Text
                style={{ fontFamily: "Outfit_800ExtraBold" }}
                className="text-white text-sm tracking-wide uppercase"
              >
                Great, Thank You!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reheat Re-Insemination Choice Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={reInseminateModalVisible}
        onRequestClose={() => setReInseminateModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View
            className="rounded-[30px] w-full p-6 items-center border shadow-2xl relative overflow-hidden"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Ambient Background Glow decoration */}
            <View className="absolute -top-12 -right-12 w-28 h-28 bg-orange-500/5 dark:bg-orange-500/10 rounded-full" />
            <View className="absolute -bottom-12 -left-12 w-28 h-28 bg-orange-500/5 dark:bg-orange-500/10 rounded-full" />

            {/* Double-Ringed Warning Icon Container */}
            <View className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-950/30 items-center justify-center mb-4 border border-orange-100 dark:border-orange-900/30">
              <View className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/40 items-center justify-center">
                <MaterialCommunityIcons name="fire" size={28} color="#f97316" />
              </View>
            </View>

            <Text
              className="text-xl font-outfit-black text-center"
              style={{ color: colors.textPrimary }}
            >
              Outcome Recorded
            </Text>

            <View className="mt-3 px-1 items-center flex-row flex-wrap justify-center gap-1.5">
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                Reheat observed for
              </Text>
              <View className="bg-orange-50 dark:bg-orange-950/40 border border-orange-100/50 dark:border-orange-900/30 px-2.5 py-0.5 rounded-full">
                <Text
                  style={{ fontFamily: "Outfit_800ExtraBold" }}
                  className="text-orange-700 dark:text-orange-400 text-xs"
                >
                  #{reInseminateInfo?.animalName}
                </Text>
              </View>
              <Text
                className="text-sm font-outfit-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                .
              </Text>
            </View>
            <Text
              className="text-sm font-outfit-medium text-center mt-1 px-2"
              style={{ color: colors.textSecondary }}
            >
              Would you like to request another A.I. attempt for this animal?
            </Text>

            {/* Buttons Row */}
            <View className="flex-row gap-3 w-full mt-6">
              <TouchableOpacity
                onPress={() => {
                  setReInseminateModalVisible(false);
                  queryClient.invalidateQueries({ queryKey: ["user", "me"] });
                  queryClient.invalidateQueries({
                    queryKey: ["visits", "upcoming"],
                  });
                  queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
                  queryClient.invalidateQueries({
                    queryKey: ["user", "activity"],
                  });
                }}
                className="flex-1 py-3.5 border rounded-2xl items-center justify-center"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <Text
                  className="font-outfit-bold text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  NOT NOW
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setReInseminateModalVisible(false);
                  queryClient.invalidateQueries({ queryKey: ["user", "me"] });
                  queryClient.invalidateQueries({
                    queryKey: ["visits", "upcoming"],
                  });
                  queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
                  queryClient.invalidateQueries({
                    queryKey: ["user", "activity"],
                  });
                  if (reInseminateInfo) {
                    router.push({
                      pathname: "/(farmer)/request-ai",
                      params: {
                        requestId: reInseminateInfo.requestId,
                        mode: "re-inseminate",
                        animalId: reInseminateInfo.animalId,
                        earTag: reInseminateInfo.animalName,
                      },
                    });
                  }
                }}
                style={{ backgroundColor: colors.primary }}
                className="flex-1 py-3.5 rounded-2xl items-center justify-center shadow-md active:opacity-90"
              >
                <Text className="text-white font-outfit-bold text-xs">
                  YES, REQUEST AI
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Missing Profile Details Welcome Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showWelcomeModal}
        onRequestClose={() => setShowWelcomeModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View
            className="rounded-[30px] w-full p-6 items-center border shadow-2xl relative overflow-hidden"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            {/* Ambient Background Glow decoration */}
            <View className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/5 dark:bg-amber-500/10 rounded-full" />

            {/* Warning Icon Container */}
            <View className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/30 items-center justify-center mb-4 border border-amber-100 dark:border-amber-900/30">
              <View className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 items-center justify-center">
                <MapPin size={30} color="#d97706" />
              </View>
            </View>

            <Text
              className="text-xl font-outfit-black text-center"
              style={{ color: colors.textPrimary }}
            >
              {modalContent.title}
            </Text>

            <Text
              className="text-sm font-outfit-medium text-center mt-3 leading-5"
              style={{ color: colors.textSecondary }}
            >
              {modalContent.description}
            </Text>

            {/* Action Buttons */}
            <View className="w-full gap-y-3 mt-6">
              <TouchableOpacity
                onPress={() => {
                  setShowWelcomeModal(false);
                  router.push("/(farmer)/(tabs)/profile");
                }}
                className="w-full py-4 rounded-2xl items-center"
                style={{ backgroundColor: isDark ? colors.primary : PRIMARY }}
              >
                <Text className="text-white font-outfit-bold text-sm">
                  {modalContent.buttonText}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowWelcomeModal(false)}
                className="w-full py-4 rounded-2xl items-center"
                style={{
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "#f1f5f9",
                }}
              >
                <Text
                  className="font-outfit-bold text-sm"
                  style={{ color: colors.textSecondary }}
                >
                  Explore First
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- SUB COMPONENTS ---

const FarmStatusMetric = ({
  label,
  value,
  icon,
  color,
  tint,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  tint: string;
}) => {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tint,
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={17} color={color} />
      </View>
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_900Black",
          fontSize: 20,
          lineHeight: 24,
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          color: colors.textSecondary,
          fontFamily: "Outfit_500Medium",
          fontSize: 10,
          lineHeight: 13,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

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

const DetailRow = ({
  label,
  value,
  highlightColor,
}: {
  label: string;
  value?: string;
  highlightColor?: string;
}) => {
  const { colors } = useTheme();
  return (
    <View className="flex-row justify-between items-center py-1">
      <Text
        className="text-xs font-outfit-medium"
        style={{ color: colors.textSecondary }}
      >
        {label}
      </Text>
      <Text
        className="text-[13px] font-outfit-bold capitalize text-right flex-1 ml-4"
        style={{ color: highlightColor || colors.textPrimary }}
      >
        {value || "N/A"}
      </Text>
    </View>
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
  dateStr,
  timeStr,
  technician,
  serviceStatus,
  reproductiveOutcome,
  accessibilityLabel,
  icon,
  iconBg,
  onPress,
}: any) => {
  return (
    <View>
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={accessibilityLabel}
        className="flex-row items-center px-4 py-3"
        style={{ minHeight: 80 }}
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-full mr-4"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </View>

        <View className="ml-2.5 mr-2 min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className="w-full font-outfit-bold text-[14px] leading-5 text-slate-800 dark:text-white"
          >
            {title}
          </Text>

          {/* Date & Time Row with Icons */}
          <View className="flex-row items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {dateStr ? (
              <View className="flex-row items-center">
                <Calendar size={12} color="#94a3b8" />
                <Text className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400">
                  {dateStr}
                </Text>
              </View>
            ) : null}

            {timeStr ? (
              <View className="flex-row items-center">
                <Clock size={12} color="#94a3b8" />
                <Text className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400">
                  {timeStr}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Technician Row */}
          <View className="flex-row items-center mt-1">
            <User size={12} color="#94a3b8" />
            <Text
              numberOfLines={1}
              className="ml-1 font-outfit-medium text-[11px] text-slate-500 dark:text-slate-400"
            >
              {technician || "Pending Assignment"}
              {reproductiveOutcome ? ` · Outcome: ${reproductiveOutcome}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ maxWidth: 96, alignItems: "flex-end" }}>
          <StatusBadge
            label={serviceStatus}
            domain="service"
            size={9}
            compact
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const AlertItem = ({
  title,
  subtitle,
  icon,
  bgColor,
  textColor,
  onPress,
  accessibilityLabel,
  actionLabel,
}: any) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={0.75}
    accessibilityRole={onPress ? "button" : undefined}
    accessibilityLabel={accessibilityLabel}
    className="flex-row items-center rounded-xl p-3"
    style={{ backgroundColor: bgColor, minHeight: 80 }}
  >
    <View
      className="w-10 h-10 rounded-xl items-center justify-center mr-3"
      style={{ backgroundColor: `${textColor}14` }}
    >
      {icon}
    </View>
    <View className="flex-1 min-w-0">
      <Text
        numberOfLines={2}
        className="font-outfit-bold text-[14px] leading-5"
        style={{ color: textColor }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={3}
        className="mt-1 font-outfit-medium text-[12px]"
        style={{ color: textColor, opacity: 0.82 }}
      >
        {subtitle}
      </Text>
    </View>
    {onPress ? (
      <View style={{ alignItems: "flex-end", marginLeft: 8, maxWidth: 92 }}>
        {actionLabel ? (
          <Text
            numberOfLines={2}
            className="font-outfit-bold text-[11px] text-right"
            style={{ color: textColor }}
          >
            {actionLabel}
          </Text>
        ) : null}
        <ChevronRight size={18} color={textColor} style={{ marginTop: 4 }} />
      </View>
    ) : null}
  </TouchableOpacity>
);

const RecordItem = ({ title, outcome, date, icon, iconBg }: any) => (
  <View className="flex-row items-center px-3 py-2" style={{ minHeight: 68 }}>
    <View
      className="w-10 h-10 rounded-full items-center justify-center"
      style={{ backgroundColor: iconBg }}
    >
      {icon}
    </View>
    <View className="flex-1 min-w-0 ml-3">
      <Text
        numberOfLines={2}
        className="text-slate-800 dark:text-white font-outfit-bold text-[14px]"
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        className="text-slate-500 dark:text-slate-400 font-outfit-medium text-[11px]"
      >
        {outcome} · {date}
      </Text>
    </View>
  </View>
);
