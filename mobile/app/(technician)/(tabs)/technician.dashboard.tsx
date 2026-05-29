import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  StatusBar,
  Image,
  Linking,
} from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import {
  Syringe,
  UserPlus,
  Activity,
  Search,
  MapPin,
  ChevronRight,
  Clock,
  X,
  TrendingUp,
  ClipboardCheck,
  AlertCircle,
  CalendarDays,
  Clock3,
  User,
  Phone,
  ArrowUpRight,
  MessageSquareQuote,
} from "lucide-react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useApi } from "@/lib/api";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { toast } from "sonner-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { addToOfflineQueue } from "@/lib/offlineQueue";
import { CATTLE_BREEDS } from "@/lib/constants";
import { getSireCodeByBreed } from "@/lib/sireRegistry";

export default function TechnicianDashboard() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    refetch: fetchDashboardData,
  } = useQuery({
    queryKey: ["technician", "dashboard"],
    queryFn: async () => {
      const response = await api.get("/technician/dashboard-data");
      return response.data || {};
    },
    enabled: !!isLoaded && !!isSignedIn,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // Auto-refresh every 30 seconds
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await api.get("/notifications/unread-count");
      return response.data || { count: 0 };
    },
    enabled: !!isLoaded && !!isSignedIn,
    refetchInterval: 1000 * 60 * 2, // Check every 2 mins
  });

  const unreadCount = unreadData?.count || 0;

  const { data: analytics = {}, refetch: refetchAnalytics } = useQuery({
    queryKey: ["technician", "analytics"],
    queryFn: async () => {
      const response = await api.get("/technician/analytics");
      return response.data || {};
    },
    enabled: !!isLoaded && !!isSignedIn,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // Auto-refresh every 30 seconds
  });

  const getMockupStandings = () => [
    {
      _id: "mock-1",
      name: "Mang Juan Mendoza",
      address: { barangay: "Brgy. Tagbac" },
      phone: "+63 917 123 4567",
      totalAnimals: 12,
      pregnantCount: 4,
      insemCount: 3,
      normalCount: 5,
    },
    {
      _id: "mock-2",
      name: "Aling Nena Reyes",
      address: { barangay: "Brgy. Cabanbanan" },
      phone: "+63 918 765 4321",
      totalAnimals: 8,
      pregnantCount: 2,
      insemCount: 2,
      normalCount: 4,
    },
    {
      _id: "mock-3",
      name: "Pedro Salazar",
      address: { barangay: "Brgy. Trapiche" },
      phone: "+63 919 888 7777",
      totalAnimals: 5,
      pregnantCount: 1,
      insemCount: 1,
      normalCount: 3,
    },
  ];

  const {
    data: clientsData,
    isLoading: loadingClients,
    refetch: refetchClients,
  } = useQuery({
    queryKey: ["technician", "assigned-farmers"],
    queryFn: async () => {
      try {
        const response = await api.get("/user?role=farmer");
        const farmers = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        if (farmers.length === 0) {
          return { data: getMockupStandings() };
        }

        const detailedFarmers = await Promise.all(
          farmers.map(async (farmer: any) => {
            try {
              const detailRes = await api.get(`/user/${farmer._id}`);
              const detailData = detailRes.data || {};
              const stats = detailData.stats || {};
              const animals = stats.animals || [];

              return {
                ...farmer,
                totalAnimals: animals.length,
                pregnantCount: animals.filter(
                  (a: any) => a.reproductiveStatus === "Pregnant",
                ).length,
                insemCount: animals.filter(
                  (a: any) => a.reproductiveStatus === "Inseminated",
                ).length,
                normalCount: animals.filter(
                  (a: any) =>
                    !a.reproductiveStatus || a.reproductiveStatus === "Normal",
                ).length,
              };
            } catch (err) {
              console.warn(
                `Failed to fetch details for farmer ${farmer._id}:`,
                err,
              );
              return {
                ...farmer,
                totalAnimals: 0,
                pregnantCount: 0,
                insemCount: 0,
                normalCount: 0,
              };
            }
          }),
        );

        // Sort by totalAnimals descending (most animals first)
        const sortedFarmers = detailedFarmers.sort(
          (a: any, b: any) => b.totalAnimals - a.totalAnimals,
        );
        return { data: sortedFarmers };
      } catch (globalErr) {
        console.error("Global Assigned Farmers Query Error:", globalErr);
        return { data: getMockupStandings() };
      }
    },
    enabled: !!isLoaded && !!isSignedIn,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const [farmerSearch, setFarmerSearch] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [advice, setAdvice] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showBreedModal, setShowBreedModal] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    setModalVisible(false);
    setShowBreedModal(false);
  }, [pathname]);

  const onRefresh = () => {
    fetchDashboardData();
    refetchAnalytics();
    refetchClients();
  };

  const handleAction = (item: any) => {
    setSelectedItem(item);

    // Prioritize existing schedule, then farmer's preference, then current time
    const initialDate = item.scheduledDate
      ? new Date(item.scheduledDate)
      : item.raw?.preferredDate || item.displayDate
        ? new Date(item.raw?.preferredDate || item.displayDate)
        : new Date();

    setScheduledDate(initialDate);
    setNote("");
    setDiagnosis(item.raw?.diagnosis || "");
    setTreatment(item.raw?.treatment || "");
    setAdvice(item.raw?.advice || "");
    setSireBreed(item.raw?.sireBreed || "");
    setSireCode(item.raw?.sireCode || "");
    setEstrus(item.raw?.estrus || "Natural");
    setModalVisible(true);
  };

  const scheduleMutation = useMutation({
    mutationFn: async ({
      endpoint,
      payload,
      description,
    }: {
      endpoint: string;
      payload: any;
      description?: string;
    }) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await addToOfflineQueue({
          url: endpoint,
          method: "PATCH",
          data: payload,
          description: description || "Technician Action",
        });
        throw new Error("OFFLINE_QUEUED");
      }
      await api.patch(endpoint, payload);
    },
    onSuccess: (_, variables) => {
      toast.success("Success");
      setModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "analytics"] });
    },
    onError: (error: any) => {
      if (error.message === "OFFLINE_QUEUED") {
        toast.info("Offline: Action queued for sync");
        setModalVisible(false);
        // Optimistically update the UI if needed
        queryClient.invalidateQueries({
          queryKey: ["technician", "dashboard"],
        });
        queryClient.invalidateQueries({
          queryKey: ["technician", "analytics"],
        });
      }
    },
  });

  const confirmAction = async () => {
    if (!selectedItem) return;

    let nextStatus = "";
    const currentStatus = selectedItem.status?.toLowerCase();

    if (currentStatus === "pending" || currentStatus === "approved") {
      nextStatus = "in-progress";
    } else {
      nextStatus = selectedItem.type === "health" ? "resolved" : "done";
    }

    const endpoint =
      selectedItem.type === "health"
        ? `/health-request/${selectedItem.id}/status`
        : `/technician/inseminations/${selectedItem.id}/status`;

    scheduleMutation.mutate({
      endpoint,
      payload: {
        status: nextStatus,
        technicianNote:
          note ||
          `${currentStatus === "pending" ? "Accepted" : "Updated"} by technician.`,
        diagnosis,
        treatment,
        advice,
        sireBreed,
        sireCode,
        estrus,
        scheduledDate: scheduledDate.toISOString(),
      },
      description: `Update ${selectedItem.task} for ${selectedItem.farmer}`,
    });
  };

  const handleRejectRequest = async (item: any) => {
    const endpoint =
      item.type === "health"
        ? `/health-request/${item.id}/status`
        : `/technician/inseminations/${item.id}/status`;

    const status = item.type === "health" ? "cancelled" : "rejected";

    scheduleMutation.mutate({
      endpoint,
      payload: {
        status,
        technicianNote: "Declined by technician.",
      },
      description: `Decline ${item.task} for ${item.farmer}`,
    });
  };

  const stats = data?.stats || {};
  const agendaItems = data?.agendaItems || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle="light-content" />

      {/* Persistent Status Bar Safety Zone */}
      <View
        style={{
          height: insets.top,
          backgroundColor: isDark ? "#064e3e" : "#00643B",
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Premium Technician Header - Now scrolls under the safety zone */}
        <View
          style={{
            backgroundColor: isDark ? "#064e3e" : "#00643B",
            paddingBottom: 80,
            borderBottomLeftRadius: 48,
            borderBottomRightRadius: 48,
            paddingHorizontal: 24,
            paddingTop: 10,
          }}
        >
          <Text
            variant="medium"
            size={12}
            style={{
              color: "rgba(255,255,255,0.7)",
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>
          {/* Top Row: Profile (Left) & Notif (Right) */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            {/* Profile + Label (Left) */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/(technician)/(tabs)/profile" as any)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "rgba(255,255,255,0.1)",
                paddingRight: 16,
                paddingLeft: 4,
                paddingVertical: 4,
                borderRadius: 30,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: "rgba(255,255,255,0.3)",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                }}
              >
                <Image
                  source={{ uri: clerkUser?.imageUrl }}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
              <View>
                <Text
                  variant="extrabold"
                  size={13}
                  style={{
                    color: "#fff",
                    lineHeight: 14,
                  }}
                >
                  Hello, {clerkUser?.firstName || "User"}
                </Text>
                <Text
                  variant="medium"
                  size={10}
                  style={{
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Technician
                </Text>
              </View>
            </TouchableOpacity>

            {/* Notif Bell (Right) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/notifications" as any)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={22}
                color="#fff"
              />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    backgroundColor: "#ef4444",
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: isDark ? "#064e3b" : "#00643B",
                  }}
                >
                  <Text
                    variant="black"
                    size={8}
                    style={{
                      color: "#fff",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Moowie Technician Insight */}
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 24,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            }}
          >
            <View style={{ width: 60, height: 60 }}>
              <Image
                source={{
                  uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                variant="extrabold"
                size={14}
                style={{
                  color: "#fff",
                }}
              >
                Greetings
              </Text>
              <Text
                variant="medium"
                size={11}
                style={{
                  color: "rgba(255,255,255,0.8)",
                  lineHeight: 15,
                  marginTop: 2,
                }}
              >
                {agendaItems.length > 0
                  ? `You have ${agendaItems.length} appointments today. Better get the truck ready! 🛻`
                  : "No field visits scheduled yet. Great time to catch up on cattle registration records! 🐮"}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: -40 }}>
          {/* Operations Stats */}
          <Card
            style={{
              padding: 20,
              flexDirection: "row",
              marginBottom: 24,
            }}
          >
            <StatBox
              label="Missions"
              value={stats.todayActivities || "0"}
              color={isDark ? colors.primary : "#00643B"}
              icon="calendar-check"
            />
            <View
              style={{
                width: 1,
                height: "60%",
                backgroundColor: colors.border,
                alignSelf: "center",
              }}
            />
            <StatBox
              label="AI Cycle"
              value={analytics.totalAI_Week || "0"}
              color={isDark ? "#facc15" : "#EAB308"}
              icon="flash"
            />
            <View
              style={{
                width: 1,
                height: "60%",
                backgroundColor: colors.border,
                alignSelf: "center",
              }}
            />
            <StatBox
              label="Clinical"
              value={analytics.totalHealth_Month || "0"}
              color={isDark ? "#60a5fa" : "#2563EB"}
              icon="heart-pulse"
            />
          </Card>

          {/* Premium Quick Actions Container */}
          <Card
            style={{
              padding: 24,
              marginBottom: 24,
            }}
          >
            <Text
              variant="extrabold"
              size={17}
              style={{
                marginBottom: 20,
              }}
            >
              Quick Actions
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <ActionCard
                label="Record AI"
                icon="needle"
                color={isDark ? "#34d399" : "#10b981"}
                bg={isDark ? "#064e3b" : "#f0fdf4"}
                onPress={() => router.push("/(technician)/record-ai" as any)}
              />
              <ActionCard
                label="Health Log"
                icon="stethoscope"
                color={isDark ? "#fbbf24" : "#f59e0b"}
                bg={isDark ? "#78350f" : "#fffbeb"}
                onPress={() => router.push("/(technician)/health-log" as any)}
              />
              <ActionCard
                label="Add Client"
                icon="account-plus-outline"
                color={isDark ? "#60a5fa" : "#3b82f6"}
                bg={isDark ? "#1e3a8a" : "#eff6ff"}
                onPress={() =>
                  router.push("/(technician)/register-client" as any)
                }
              />
              <ActionCard
                label="Add Animal"
                icon="cow"
                color={isDark ? "#a78bfa" : "#8b5cf6"}
                bg={isDark ? "#4c1d95" : "#f5f3ff"}
                onPress={() =>
                  router.push("/(technician)/register-animal" as any)
                }
              />
              <ActionCard
                label="Pregnancy"
                icon="heart-pulse"
                color={isDark ? "#f472b6" : "#ec4899"}
                bg={isDark ? "#831843" : "#fdf2f8"}
                onPress={() =>
                  router.push("/(technician)/pregnancy-check" as any)
                }
              />
              <ActionCard
                label="Calf Drop"
                icon="baby-carriage"
                color={isDark ? "#22d3ee" : "#06b6d4"}
                bg={isDark ? "#164e63" : "#ecfeff"}
                onPress={() =>
                  router.push("/(technician)/record-calf-drop" as any)
                }
              />
            </View>
          </Card>

          {/* Today's Route Section */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text variant="extrabold" size={18}>
              Today&apos;s Route
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (agendaItems.length === 0)
                  return toast.info("No stops scheduled today");

                // Construct a Google Maps route with waypoints
                const destinations = agendaItems
                  .map((item: any) => item.location)
                  .filter((loc: string) => loc && loc !== "Unknown Location");

                if (destinations.length === 0)
                  return toast.info("No valid locations to map");

                const origin = "My+Location";
                const destination = encodeURIComponent(
                  destinations[destinations.length - 1],
                );
                const waypoints = destinations
                  .slice(0, -1)
                  .map(encodeURIComponent)
                  .join("|");

                const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;

                Linking.openURL(url).catch((err) =>
                  console.error("Failed to open maps", err),
                );
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <MaterialCommunityIcons
                name="near-me"
                size={16}
                color={colors.primary}
              />
              <Text variant="bold" color="brand" size={13}>
                Map
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 20 }}
            />
          ) : agendaItems.length === 0 ? (
            <Card
              style={{
                padding: 32,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name="calendar-blank"
                size={48}
                color={colors.textMuted}
              />
              <Text
                variant="bold"
                color="muted"
                style={{
                  marginTop: 12,
                }}
              >
                No field visits today
              </Text>
            </Card>
          ) : (
            agendaItems.map((item: any, idx: number) => (
              <AgendaCard
                key={`${item.type}-${item.id || idx}`}
                item={item}
                isFirst={idx === 0}
                onPress={() => handleAction(item)}
              />
            ))
          )}

          {/* Farmer Requests Section */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              marginTop: 24,
            }}
          >
            <Text variant="extrabold" size={18}>
              Farmer Requests
            </Text>
            {(data?.pendingRequests || []).filter(
              (r: any) => r.status === "pending",
            ).length > 0 && (
              <View
                style={{
                  backgroundColor: isDark ? "#7c2d12" : "#ffedd5",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text
                  variant="black"
                  size={10}
                  style={{
                    color: isDark ? "#fdba74" : "#d97706",
                  }}
                >
                  {
                    (data?.pendingRequests || []).filter(
                      (r: any) => r.status === "pending",
                    ).length
                  }{" "}
                  NEW
                </Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 20 }}
            />
          ) : (data?.pendingRequests || []).filter(
              (r: any) => r.status === "pending",
            ).length === 0 ? (
            <Card
              style={{
                padding: 32,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name="clipboard-check-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text
                variant="bold"
                color="muted"
                style={{
                  marginTop: 12,
                }}
              >
                All requests processed! 🐮
              </Text>
            </Card>
          ) : (
            (data?.pendingRequests || [])
              .filter((r: any) => r.status === "pending")
              .map((req: any, idx: number) => (
                <RequestCard
                  key={`${req.type}-${req._id || idx}`}
                  item={req}
                  onAccept={() => handleAction(req)}
                  onSchedule={() => handleAction(req)}
                  onDecline={() => handleRejectRequest(req)}
                />
              ))
          )}

          {/* Performance Hub (This Month Card) - Moved to bottom */}
          <Card
            onPress={() => router.push("/(technician)/performance" as any)}
            style={{
              padding: 24,
              marginBottom: 24,
              marginTop: 24,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Text variant="black" size={20}>
                This Month
              </Text>
              <TrendingUp size={20} color={colors.primary} />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#f3f0e9",
                }}
              >
                <Text
                  variant="black"
                  size={20}
                  style={{
                    color: colors.primary,
                  }}
                >
                  {stats.totalInsemMonth || "0"}
                </Text>
                <Text
                  variant="bold"
                  color="secondary"
                  size={10}
                  style={{
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  AI Sessions
                </Text>
                <Text
                  variant="medium"
                  color="muted"
                  size={9}
                  style={{
                    marginTop: 4,
                  }}
                >
                  Target: 50 visits
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#f3f0e9",
                }}
              >
                <Text
                  variant="black"
                  size={20}
                  style={{
                    color: colors.primary,
                  }}
                >
                  {stats.successRate || "78%"}
                </Text>
                <Text
                  variant="bold"
                  color="secondary"
                  size={10}
                  style={{
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Conception
                </Text>
                <Text
                  variant="medium"
                  size={9}
                  style={{
                    color: isDark ? "#34d399" : "#059669",
                    marginTop: 4,
                  }}
                >
                  High Efficiency
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#f3f0e9",
                }}
              >
                <Text
                  variant="black"
                  size={20}
                  style={{
                    color: colors.primary,
                  }}
                >
                  34
                </Text>
                <Text
                  variant="bold"
                  color="secondary"
                  size={10}
                  style={{
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Farms Served
                </Text>
                <Text
                  variant="medium"
                  color="muted"
                  size={9}
                  style={{
                    marginTop: 4,
                  }}
                >
                  8 Oton Barangays
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text variant="bold" color="secondary" size={11}>
                Target Progress
              </Text>
              <Text
                variant="extrabold"
                size={11}
                style={{
                  color: colors.primary,
                }}
              >
                36 / 50 Sessions (72%)
              </Text>
            </View>

            <View
              style={{
                height: 8,
                backgroundColor: isDark ? "#374151" : "#f1f5f9",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: "72%",
                  height: "100%",
                  backgroundColor: colors.primary,
                  borderRadius: 4,
                }}
              />
            </View>
          </Card>

          {/* Assigned Farmers Section - Moved to bottom */}
          <Card
            style={{
              padding: 24,
              marginBottom: 24,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text variant="black" size={18}>
                Farmer Standings
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push("/(technician)/technician.clients" as any)
                }
              >
                <Text
                  variant="extrabold"
                  size={13}
                  style={{
                    color: colors.primary,
                  }}
                >
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Inner Bar */}
            <View
              style={{
                backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
                borderWidth: 1,
                borderColor: isDark ? "#374151" : "#f3f0e9",
              }}
            >
              <Search size={18} color={colors.textMuted} />
              <TextInput
                placeholder="Search farmer or address..."
                placeholderTextColor={colors.textMuted}
                value={farmerSearch}
                onChangeText={setFarmerSearch}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
                  color: colors.textPrimary,
                }}
              />
            </View>

            <View style={{ gap: 12 }}>
              {loadingClients ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={{ marginVertical: 12 }}
                />
              ) : (
                (clientsData?.data || [])
                  .filter((farmer: any) => {
                    if (!farmerSearch) return true;
                    const addr =
                      typeof farmer.address === "string"
                        ? farmer.address
                        : farmer.address?.barangay || "";
                    return (
                      farmer.name
                        ?.toLowerCase()
                        .includes(farmerSearch.toLowerCase()) ||
                      addr.toLowerCase().includes(farmerSearch.toLowerCase())
                    );
                  })
                  .slice(0, 3)
                  .map((farmer: any) => (
                    <FarmerCompactCard
                      key={farmer._id}
                      id={farmer._id}
                      name={farmer.name}
                      location={
                        typeof farmer.address === "string"
                          ? farmer.address
                          : farmer.address?.barangay || "Oton, Iloilo"
                      }
                      phone={farmer.phone}
                      imageUrl={farmer.imageUrl}
                      totalAnimals={farmer.totalAnimals}
                      pregnantCount={farmer.pregnantCount}
                      insemCount={farmer.insemCount}
                      normalCount={farmer.normalCount}
                      router={router}
                    />
                  ))
              )}
              {!loadingClients && (clientsData?.data || []).length === 0 && (
                <View style={{ paddingVertical: 12, alignItems: "center" }}>
                  <Text variant="bold" color="muted" size={13}>
                    No assigned farmers yet
                  </Text>
                </View>
              )}
            </View>
          </Card>

          {/* Moowie Help Banner */}
          <Card
            onPress={() => {}}
            style={{
              backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
              borderRadius: 28,
              padding: 20,
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              borderWidth: 1,
              borderColor: isDark ? "#374151" : "#f3f0e9",
            }}
          >
            <View style={{ width: 60, height: 60 }}>
              <Image
                source={{
                  uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="black" size={16}>
                Need a second opinion?
              </Text>
              <Text
                variant="medium"
                color="secondary"
                size={11}
                style={{
                  lineHeight: 15,
                  marginTop: 2,
                }}
              >
                Moowie can help diagnose symptoms or suggest protocols.
              </Text>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={24} color="#fff" />
            </View>
          </Card>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal logic preserved */}
      {/* Modal logic preserved */}
      {modalVisible && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
            zIndex: 100,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 20) + 12,
              maxHeight: "85%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text variant="black" size={20}>
                {selectedItem?.status === "pending"
                  ? "Confirm Dispatch"
                  : "Service Update"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 10 }}
            >
              <View
                style={{
                  backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                  borderRadius: 16,
                  padding: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.primary,
                }}
              >
                <Text
                  variant="extrabold"
                  color="secondary"
                  size={10}
                  style={{
                    textTransform: "uppercase",
                  }}
                >
                  Target Service
                </Text>
                <Text
                  variant="bold"
                  size={15}
                  style={{
                    marginTop: 2,
                  }}
                >
                  {selectedItem?.task}
                </Text>
                <Text
                  variant="medium"
                  color="secondary"
                  size={12}
                  style={{
                    marginTop: 2,
                  }}
                >
                  {selectedItem?.farmer} · {selectedItem?.location}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: "#000",
                    shadowOpacity: isDark ? 0 : 0.03,
                    shadowRadius: 10,
                    elevation: isDark ? 0 : 2,
                  }}
                >
                  <View>
                    <Text
                      variant="extrabold"
                      color="muted"
                      size={9}
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 4,
                      }}
                    >
                      Visit Date
                    </Text>
                    <Text variant="extrabold" size={14}>
                      {scheduledDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CalendarDays size={16} color={colors.primary} />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowColor: "#000",
                    shadowOpacity: isDark ? 0 : 0.03,
                    shadowRadius: 10,
                    elevation: isDark ? 0 : 2,
                  }}
                >
                  <View>
                    <Text
                      variant="extrabold"
                      color="muted"
                      size={9}
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 4,
                      }}
                    >
                      Visit Time
                    </Text>
                    <Text variant="extrabold" size={14}>
                      {scheduledDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Clock3 size={16} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </View>

              {(selectedItem?.status === "pending" || selectedItem?.status === "approved") &&
                (selectedItem?.raw?.preferredDate ||
                  selectedItem?.displayDate) && (
                  <View
                    style={{
                      backgroundColor: isDark ? "#78350f" : "#fffbeb",
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isDark ? "#b45309" : "#fef3c7",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Clock3 size={14} color={isDark ? "#fbbf24" : "#d97706"} />
                    <Text
                      variant="bold"
                      size={11}
                      style={{
                        color: isDark ? "#fbbf24" : "#d97706",
                        flex: 1,
                      }}
                    >
                      Farmer Request:{" "}
                      {new Date(
                        selectedItem.raw?.preferredDate ||
                          selectedItem.displayDate,
                      ).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Text>
                  </View>
                )}

              <Text
                variant="extrabold"
                color="muted"
                size={10}
                style={{
                  textTransform: "uppercase",
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                {(selectedItem?.status === "pending" || selectedItem?.status === "approved") ? "Notes" : "Findings"}
              </Text>
              <TextInput
                placeholder={
                  (selectedItem?.status === "pending" || selectedItem?.status === "approved")
                    ? "Add field notes (optional)..."
                    : "Enter findings / observations..."
                }
                placeholderTextColor={colors.textMuted}
                multiline
                style={{
                  backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                  borderRadius: 14,
                  padding: 12,
                  height: 64,
                  textAlignVertical: "top",
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                value={note}
                onChangeText={setNote}
              />

              {selectedItem?.type === "health" &&
                selectedItem?.status !== "pending" &&
                selectedItem?.status !== "approved" && (
                  <>
                    <Text
                      variant="extrabold"
                      color="muted"
                      size={10}
                      style={{
                        textTransform: "uppercase",
                        marginLeft: 4,
                        marginBottom: 8,
                        marginTop: 10,
                      }}
                    >
                      Diagnosis
                    </Text>
                    <TextInput
                      placeholder="Enter diagnosis..."
                      placeholderTextColor={colors.textMuted}
                      style={{
                        backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                        borderRadius: 14,
                        padding: 12,
                        fontFamily: "Outfit_600SemiBold",
                        color: colors.textPrimary,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      value={diagnosis}
                      onChangeText={setDiagnosis}
                    />

                    <Text
                      variant="extrabold"
                      color="muted"
                      size={10}
                      style={{
                        textTransform: "uppercase",
                        marginLeft: 4,
                        marginBottom: 8,
                        marginTop: 10,
                      }}
                    >
                      Prescription / Treatment
                    </Text>
                    <TextInput
                      placeholder="Medicines or treatment given..."
                      placeholderTextColor={colors.textMuted}
                      style={{
                        backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                        borderRadius: 14,
                        padding: 12,
                        fontFamily: "Outfit_600SemiBold",
                        color: colors.textPrimary,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      value={treatment}
                      onChangeText={setTreatment}
                    />

                    <Text
                      variant="extrabold"
                      color="muted"
                      size={10}
                      style={{
                        textTransform: "uppercase",
                        marginLeft: 4,
                        marginBottom: 8,
                        marginTop: 10,
                      }}
                    >
                      Advice for Farmer
                    </Text>
                    <TextInput
                      placeholder="e.g. Keep isolated, provide water..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      style={{
                        backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                        borderRadius: 14,
                        padding: 12,
                        height: 64,
                        textAlignVertical: "top",
                        fontFamily: "Outfit_600SemiBold",
                        color: colors.textPrimary,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      value={advice}
                      onChangeText={setAdvice}
                    />
                  </>
                )}

              {selectedItem?.type === "insemination" &&
                selectedItem?.status !== "pending" &&
                selectedItem?.status !== "approved" && (
                  <>
                    <Text
                      variant="extrabold"
                      color="muted"
                      size={10}
                      style={{
                        textTransform: "uppercase",
                        marginLeft: 4,
                        marginBottom: 8,
                        marginTop: 10,
                      }}
                    >
                      Sire Breed
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowBreedModal(true)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowRadius: 10,
                        elevation: 1,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Syringe size={18} color={colors.primary} />
                        </View>
                        <View>
                          <Text
                            variant="medium"
                            color="muted"
                            size={9}
                            style={{
                              textTransform: "uppercase",
                            }}
                          >
                            Selected Breed
                          </Text>
                          <Text
                            variant="extrabold"
                            size={14}
                            style={{
                              color: sireBreed
                                ? colors.textPrimary
                                : colors.textMuted,
                            }}
                          >
                            {sireBreed || "Choose Sire Breed"}
                          </Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={20}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>

                    <Text
                      variant="extrabold"
                      color="muted"
                      size={10}
                      style={{
                        textTransform: "uppercase",
                        marginLeft: 4,
                        marginBottom: 8,
                        marginTop: 10,
                      }}
                    >
                      Sire Code
                    </Text>
                    <View
                      style={{
                        backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 52,
                        borderWidth: 1,
                        borderColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="shield-check-outline"
                        size={20}
                        color={colors.primary}
                        style={{ opacity: 0.5 }}
                      />
                      <View>
                        <Text
                          variant="medium"
                          color="muted"
                          size={9}
                          style={{
                            textTransform: "uppercase",
                          }}
                        >
                          Authorized Code
                        </Text>
                        <Text
                          variant="extrabold"
                          size={13}
                          style={{
                            color: sireCode
                              ? colors.textPrimary
                              : colors.textMuted,
                            letterSpacing: 1,
                          }}
                        >
                          {sireCode || "--- --- ---"}
                        </Text>
                      </View>
                    </View>

                    <Text
                      variant="extrabold"
                      color="muted"
                      size={10}
                      style={{
                        textTransform: "uppercase",
                        marginLeft: 4,
                        marginBottom: 8,
                        marginTop: 10,
                      }}
                    >
                      Estrus Type
                    </Text>
                    <View
                      style={{
                        backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        overflow: "hidden",
                      }}
                    >
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ padding: 8, gap: 8 }}
                      >
                        {["Natural", "Synchronized", "Induced"].map((type) => (
                          <TouchableOpacity
                            key={type}
                            onPress={() => setEstrus(type)}
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 8,
                              borderRadius: 12,
                              backgroundColor:
                                estrus === type
                                  ? colors.primary
                                  : isDark
                                    ? "#111827"
                                    : "#fff",
                              borderWidth: 1,
                              borderColor:
                                estrus === type
                                  ? colors.primary
                                  : colors.border,
                            }}
                          >
                            <Text
                              variant="bold"
                              size={11}
                              style={{
                                color:
                                  estrus === type
                                    ? "#fff"
                                    : colors.textSecondary,
                              }}
                            >
                              {type}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </>
                )}
            </ScrollView>

            <TouchableOpacity
              onPress={confirmAction}
              disabled={scheduleMutation.isPending}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 16,
                borderRadius: 18,
                alignItems: "center",
                shadowColor: colors.primary,
                shadowOpacity: isDark ? 0 : 0.3,
                shadowRadius: 10,
                elevation: isDark ? 0 : 8,
              }}
            >
              {scheduleMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  variant="extrabold"
                  size={16}
                  style={{
                    color: "#fff",
                  }}
                >
                  {(selectedItem?.status === "pending" || selectedItem?.status === "approved")
                    ? "Accept Mission"
                    : "Update & Complete"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            if (event.type === "dismissed") {
              setShowDatePicker(false);
              return;
            }
            if (date) {
              const newDate = new Date(scheduledDate);
              newDate.setFullYear(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
              );
              setScheduledDate(newDate);
            }
            setShowDatePicker(false);
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="time"
          display="default"
          onChange={(event: DateTimePickerEvent, time?: Date) => {
            if (event.type === "dismissed") {
              setShowTimePicker(false);
              return;
            }
            if (time) {
              const newDate = new Date(scheduledDate);
              newDate.setHours(time.getHours(), time.getMinutes());
              setScheduledDate(newDate);
            }
            setShowTimePicker(false);
          }}
        />
      )}
      {/* Breed Selection Modal */}
      <Modal
        visible={showBreedModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBreedModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 40,
              borderTopRightRadius: 40,
              maxHeight: "85%",
            }}
          >
            <View
              style={{
                padding: 24,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text variant="black" size={20}>
                  Sire Registry
                </Text>
                <Text
                  variant="bold"
                  color="muted"
                  size={10}
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Official Breed List
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowBreedModal(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                {CATTLE_BREEDS.map((breed: string) => (
                  <TouchableOpacity
                    key={breed}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSireBreed(breed);
                      setSireCode(getSireCodeByBreed(breed));
                      setShowBreedModal(false);
                    }}
                    style={{
                      padding: 16,
                      borderRadius: 20,
                      backgroundColor:
                        sireBreed === breed
                          ? colors.primary
                          : isDark
                            ? "#1f2937"
                            : "#f8fafc",
                      borderWidth: 1,
                      borderColor:
                        sireBreed === breed ? colors.primary : colors.border,
                      width: "48%",
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor:
                        sireBreed === breed ? colors.primary : "#000",
                      shadowOpacity: sireBreed === breed ? 0.1 : 0,
                      shadowRadius: 10,
                      elevation: sireBreed === breed ? 2 : 0,
                    }}
                  >
                    <Text
                      variant="extrabold"
                      size={14}
                      style={{
                        color:
                          sireBreed === breed ? "#fff" : colors.textPrimary,
                        textAlign: "center",
                      }}
                    >
                      {breed}
                    </Text>
                    <Text
                      variant="semibold"
                      size={9}
                      style={{
                        color:
                          sireBreed === breed
                            ? "rgba(255,255,255,0.7)"
                            : colors.textMuted,
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                    >
                      {getSireCodeByBreed(breed) || "N/A"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: 60 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const StatBox = ({ label, value, icon, color }: any) => {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text variant="black" size={18} style={{ marginTop: 4 }}>
        {value}
      </Text>
      <Text
        variant="bold"
        color="muted"
        size={9}
        style={{ textTransform: "uppercase" }}
      >
        {label}
      </Text>
    </View>
  );
};

const ActionCard = ({ label, icon, color, bg, onPress }: any) => {
  const { isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ alignItems: "center", width: "30%", marginBottom: 8 }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
          shadowColor: color,
          shadowOpacity: isDark ? 0 : 0.1,
          shadowRadius: 8,
          elevation: isDark ? 0 : 2,
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={28} color={color} />
      </View>
      <Text
        variant="bold"
        color="secondary"
        size={10}
        style={{ textAlign: "center" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const AgendaCard = ({ item, onPress, isFirst }: any) => {
  const { colors, isDark } = useTheme();
  const isOverdue = item.overdue === true;

  const getCardBg = () => {
    if (isOverdue) return isDark ? "#450a0a" : "#fff5f5";
    if (isFirst) return colors.tint;
    return colors.card;
  };

  const getCardBorder = () => {
    if (isOverdue) return isDark ? "#7f1d1d" : "#fee2e2";
    if (isFirst) return isDark ? "#064e3b" : "#bbf7d0";
    return colors.border;
  };

  const getDividerColor = () => {
    if (isOverdue) return isDark ? "#991b1b" : "#fca5a5";
    if (isFirst) return isDark ? "#059669" : "#86efac";
    return colors.border;
  };

  return (
    <Card
      onPress={onPress}
      style={{
        backgroundColor: getCardBg(),
        borderColor: getCardBorder(),
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        padding: 16,
      }}
    >
      <View
        style={{
          width: 75,
          borderRightWidth: 1,
          borderRightColor: getDividerColor(),
          paddingRight: 10,
          marginRight: 15,
        }}
      >
        <Text
          variant="bold"
          size={10}
          style={{
            color: isOverdue ? colors.error : colors.textMuted,
            textTransform: "uppercase",
          }}
        >
          {isOverdue ? "Missed" : "Time"}
        </Text>
        <Text
          variant="extrabold"
          size={isOverdue ? 11 : 13}
          style={{
            color: isOverdue ? colors.error : colors.textPrimary,
            marginTop: 2,
          }}
        >
          {isOverdue
            ? new Date(item.displayDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : item.time || "8:00 AM"}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text variant="bold" size={16} style={{ color: colors.textPrimary }}>
          {item.farmer || item.location}
        </Text>
        <Text
          variant="medium"
          size={12}
          style={{ color: colors.textSecondary, marginTop: 2 }}
        >
          {item.task} {item.animalName ? `— ${item.animalName}` : ""}
        </Text>
      </View>

      {isOverdue ? (
        <View
          style={{
            backgroundColor: colors.error,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text variant="black" size={10} style={{ color: "#fff" }}>
            OVERDUE
          </Text>
        </View>
      ) : isFirst ? (
        <View
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text variant="black" size={10} style={{ color: "#fff" }}>
            NEXT
          </Text>
        </View>
      ) : (
        <MaterialCommunityIcons
          name="clock-outline"
          size={20}
          color={colors.textMuted}
        />
      )}
    </Card>
  );
};

const RequestCard = ({ item, onAccept, onDecline }: any) => {
  const { colors, isDark } = useTheme();

  const isHealth = item.type === "health";
  const iconBg = isHealth
    ? isDark
      ? "#78350f"
      : "#fffbeb"
    : isDark
      ? "#064e3b"
      : "#f0fdf4";
  const iconColor = isHealth
    ? isDark
      ? "#fbbf24"
      : "#d97706"
    : isDark
      ? "#34d399"
      : colors.primary;

  return (
    <Card
      style={{
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons
          name={isHealth ? "stethoscope" : "needle"}
          size={24}
          color={iconColor}
        />
      </View>

      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text variant="bold" size={16}>
          {item.farmer}
        </Text>
        <Text
          variant="medium"
          color="secondary"
          size={12}
          style={{ marginTop: 2 }}
          numberOfLines={1}
        >
          {item.task}
        </Text>
      </View>

      <View style={{ gap: 8, alignItems: "flex-end" }}>
        <TouchableOpacity
          onPress={onAccept}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 12,
            minWidth: 80,
            alignItems: "center",
          }}
        >
          <Text
            variant="black"
            size={10}
            style={{
              color: "#fff",
              textTransform: "uppercase",
            }}
          >
            Accept
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDecline}
          style={{
            backgroundColor: isDark ? "#450a0a" : "#fef2f2",
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 10,
            minWidth: 80,
            alignItems: "center",
          }}
        >
          <Text
            variant="black"
            size={9}
            style={{
              color: isDark ? "#f87171" : "#ef4444",
              textTransform: "uppercase",
            }}
          >
            Decline
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const FarmerCompactCard = ({
  id,
  name,
  location,
  phone,
  imageUrl,
  totalAnimals,
  pregnantCount,
  insemCount,
  normalCount,
  router,
}: any) => {
  const { colors, isDark } = useTheme();
  return (
    <Card
      onPress={() => router.push(`/(technician)/client.profile?id=${id}`)}
      style={{ marginBottom: 12 }}
    >
      {/* Top Row: Profile, Info, and Call Button */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDark ? "#1f2937" : "#FAF7F2",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Text variant="black" size={16} style={{ color: colors.primary }}>
              {name ? name.charAt(0) : "F"}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text variant="black" size={15}>
            {name}
          </Text>
          <Text
            variant="semibold"
            color="muted"
            size={11}
            style={{ marginTop: 1 }}
          >
            {location} ·{" "}
            <Text
              variant="extrabold"
              size={11}
              style={{ color: colors.primary }}
            >
              {totalAnimals || 0} head
            </Text>
          </Text>
        </View>

        {phone && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(`tel:${phone}`);
            }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: isDark ? "#047857" : "#dcfce7",
            }}
          >
            <Phone size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Row: High-fidelity status badges */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          flexWrap: "wrap",
          paddingTop: 4,
        }}
      >
        <View
          style={{
            backgroundColor: isDark ? "#1e3a8a" : "#eff6ff",
            borderRadius: 10,
            paddingVertical: 4,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 0.5,
            borderColor: isDark ? "#1d4ed8" : "#dbeafe",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? "#60a5fa" : "#3b82f6",
            }}
          />
          <Text
            variant="bold"
            size={10}
            style={{
              color: isDark ? "#60a5fa" : "#1d4ed8",
            }}
          >
            Pregnant: {pregnantCount || 0}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: isDark ? "#064e3b" : "#f0fdf4",
            borderRadius: 10,
            paddingVertical: 4,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 0.5,
            borderColor: isDark ? "#047857" : "#dcfce7",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? "#34d399" : "#10b981",
            }}
          />
          <Text
            variant="bold"
            size={10}
            style={{
              color: isDark ? "#34d399" : "#047857",
            }}
          >
            Normal: {normalCount || 0}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: isDark ? "#78350f" : "#fffbeb",
            borderRadius: 10,
            paddingVertical: 4,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderWidth: 0.5,
            borderColor: isDark ? "#b45309" : "#fef3c7",
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isDark ? "#fbbf24" : "#eab308",
            }}
          />
          <Text
            variant="bold"
            size={10}
            style={{
              color: isDark ? "#fbbf24" : "#b45309",
            }}
          >
            A.I.: {insemCount || 0}
          </Text>
        </View>
      </View>
    </Card>
  );
};
