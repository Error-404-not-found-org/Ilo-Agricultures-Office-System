import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { addToOfflineQueue } from "@/lib/offlineQueue";
import { CATTLE_BREEDS } from "@/lib/constants";
import { getSireCodeByBreed } from "@/lib/sireRegistry";

const PRIMARY = "#00643B";

export default function TechnicianDashboard() {
  const router = useRouter();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const queryClient = useQueryClient();

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
    }
  ];

  const { data: clientsData, isLoading: loadingClients, refetch: refetchClients } = useQuery({
    queryKey: ["technician", "assigned-farmers"],
    queryFn: async () => {
      try {
        const response = await api.get("/user?role=farmer");
        const farmers = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        
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
                pregnantCount: animals.filter((a: any) => a.reproductiveStatus === "Pregnant").length,
                insemCount: animals.filter((a: any) => a.reproductiveStatus === "Inseminated").length,
                normalCount: animals.filter((a: any) => !a.reproductiveStatus || a.reproductiveStatus === "Normal").length,
              };
            } catch (err) {
              console.warn(`Failed to fetch details for farmer ${farmer._id}:`, err);
              return {
                ...farmer,
                totalAnimals: 0,
                pregnantCount: 0,
                insemCount: 0,
                normalCount: 0,
              };
            }
          })
        );
        
        // Sort by totalAnimals descending (most animals first)
        const sortedFarmers = detailedFarmers.sort((a, b) => b.totalAnimals - a.totalAnimals);
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
      : (item.raw?.preferredDate || item.displayDate)
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
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <StatusBar barStyle="light-content" />

      {/* Persistent Status Bar Safety Zone */}
      <View style={{ height: insets.top, backgroundColor: PRIMARY }} />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[PRIMARY]}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Premium Technician Header - Now scrolls under the safety zone */}
        <View
          style={{
            backgroundColor: PRIMARY,
            paddingBottom: 80,
            borderBottomLeftRadius: 48,
            borderBottomRightRadius: 48,
            paddingHorizontal: 24,
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "Outfit_500Medium",
              fontSize: 12,
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
              onPress={() => router.push("/(technician)/profile" as any)}
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
                  style={{
                    color: "#fff",
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 13,
                    lineHeight: 14,
                  }}
                >
                  Hello, {clerkUser?.firstName || "User"}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontFamily: "Outfit_500Medium",
                    fontSize: 10,
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
                    borderColor: PRIMARY,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 8,
                      fontFamily: "Outfit_900Black",
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
                style={{
                  color: "#fff",
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 14,
                }}
              >
                Greetings
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: "Outfit_500Medium",
                  fontSize: 11,
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
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 24,
              padding: 20,
              flexDirection: "row",
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 15,
              elevation: 5,
              marginBottom: 24,
            }}
          >
            <StatBox
              label="Missions"
              value={stats.todayActivities || "0"}
              color={PRIMARY}
              icon="calendar-check"
            />
            <View
              style={{
                width: 1,
                height: "60%",
                backgroundColor: "#f1f5f9",
                alignSelf: "center",
              }}
            />
            <StatBox
              label="AI Cycle"
              value={analytics.totalAI_Week || "0"}
              color="#EAB308"
              icon="flash"
            />
            <View
              style={{
                width: 1,
                height: "60%",
                backgroundColor: "#f1f5f9",
                alignSelf: "center",
              }}
            />
            <StatBox
              label="Clinical"
              value={analytics.totalHealth_Month || "0"}
              color="#2563EB"
              icon="heart-pulse"
            />
          </View>

          {/* Premium Quick Actions Container */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 32,
              padding: 24,
              marginBottom: 24,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 15,
              elevation: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: "#1e293b",
                fontSize: 17,
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
                color="#10b981"
                bg="#f0fdf4"
                onPress={() => router.push("/(technician)/record-ai" as any)}
              />
              <ActionCard
                label="Health Log"
                icon="stethoscope"
                color="#f59e0b"
                bg="#fffbeb"
                onPress={() => router.push("/(technician)/health-log" as any)}
              />
              <ActionCard
                label="Add Client"
                icon="account-plus-outline"
                color="#3b82f6"
                bg="#eff6ff"
                onPress={() =>
                  router.push("/(technician)/register-client" as any)
                }
              />
              <ActionCard
                label="Add Animal"
                icon="cow"
                color="#8b5cf6"
                bg="#f5f3ff"
                onPress={() =>
                  router.push("/(technician)/register-animal" as any)
                }
              />
              <ActionCard
                label="Pregnancy"
                icon="heart-pulse"
                color="#ec4899"
                bg="#fdf2f8"
                onPress={() =>
                  router.push("/(technician)/pregnancy-check" as any)
                }
              />
              <ActionCard
                label="Calf Drop"
                icon="baby-carriage"
                color="#06b6d4"
                bg="#ecfeff"
                onPress={() =>
                  router.push("/(technician)/record-calf-drop" as any)
                }
              />
            </View>
          </View>

          {/* Today's Route Section */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: "#1e293b",
                fontSize: 18,
              }}
            >
              Today's Route
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
                  console.error("Failed to open maps", err)
                );
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <MaterialCommunityIcons
                name="near-me"
                size={16}
                color={PRIMARY}
              />
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: PRIMARY,
                  fontSize: 13,
                }}
              >
                Map
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
          ) : agendaItems.length === 0 ? (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 32,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#f1f5f9",
              }}
            >
              <MaterialCommunityIcons
                name="calendar-blank"
                size={48}
                color="#cbd5e1"
              />
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: "#94a3b8",
                  marginTop: 12,
                }}
              >
                No field visits today
              </Text>
            </View>
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
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: "#1e293b",
                fontSize: 18,
              }}
            >
              Farmer Requests
            </Text>
            {(data?.pendingRequests || []).filter(
              (r: any) => r.status === "pending",
            ).length > 0 && (
              <View
                style={{
                  backgroundColor: "#ffedd5",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    color: "#d97706",
                    fontSize: 10,
                    fontFamily: "Outfit_900Black",
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
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
          ) : (data?.pendingRequests || []).filter(
              (r: any) => r.status === "pending",
            ).length === 0 ? (
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 24,
                padding: 32,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#f1f5f9",
              }}
            >
              <MaterialCommunityIcons
                name="clipboard-check-outline"
                size={48}
                color="#cbd5e1"
              />
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: "#94a3b8",
                  marginTop: 12,
                }}
              >
                All requests processed! 🐮
              </Text>
            </View>
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
          <TouchableOpacity
            onPress={() => router.push("/(technician)/performance" as any)}
            activeOpacity={0.9}
            style={{
              backgroundColor: "#fff",
              borderRadius: 32,
              padding: 24,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 20,
              elevation: 6,
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
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  color: "#1e293b",
                  fontSize: 20,
                }}
              >
                This Month
              </Text>
              <TrendingUp size={20} color={PRIMARY} />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FAF7F2",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#f3f0e9",
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: "Outfit_900Black",
                    color: PRIMARY,
                  }}
                >
                  {stats.totalInsemMonth || "0"}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Outfit_700Bold",
                    color: "#475569",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  AI Sessions
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "Outfit_500Medium",
                    color: "#94a3b8",
                    marginTop: 4,
                  }}
                >
                  Target: 50 visits
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FAF7F2",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#f3f0e9",
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: "Outfit_900Black",
                    color: PRIMARY,
                  }}
                >
                  {stats.successRate || "78%"}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Outfit_700Bold",
                    color: "#475569",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Conception
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "Outfit_500Medium",
                    color: "#059669",
                    marginTop: 4,
                  }}
                >
                  High Efficiency
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FAF7F2",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#f3f0e9",
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: "Outfit_900Black",
                    color: PRIMARY,
                  }}
                >
                  34
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Outfit_700Bold",
                    color: "#475569",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  Farms Served
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "Outfit_500Medium",
                    color: "#94a3b8",
                    marginTop: 4,
                  }}
                >
                  8 Oton Barangays
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_700Bold",
                  color: "#475569",
                }}
              >
                Target Progress
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_800ExtraBold",
                  color: PRIMARY,
                }}
              >
                36 / 50 Sessions (72%)
              </Text>
            </View>

            <View
              style={{
                height: 8,
                backgroundColor: "#f1f5f9",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: "72%",
                  height: "100%",
                  backgroundColor: PRIMARY,
                  borderRadius: 4,
                }}
              />
            </View>
          </TouchableOpacity>

          {/* Assigned Farmers Section - Moved to bottom */}
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 32,
              padding: 24,
              marginBottom: 24,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 15,
              elevation: 4,
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
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  color: "#1e293b",
                  fontSize: 18,
                }}
              >
                Farmer Standings
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push("/(technician)/technician.clients" as any)
                }
              >
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: PRIMARY,
                    fontSize: 13,
                  }}
                >
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Inner Bar */}
            <View
              style={{
                backgroundColor: "#FAF7F2",
                borderRadius: 16,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
                borderWidth: 1,
                borderColor: "#f3f0e9",
              }}
            >
              <Search size={18} color="#94a3b8" />
              <TextInput
                placeholder="Search farmer or address..."
                placeholderTextColor="#94a3b8"
                value={farmerSearch}
                onChangeText={setFarmerSearch}
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 13,
                  color: "#1e293b",
                }}
              />
            </View>

            <View style={{ gap: 12 }}>
              {loadingClients ? (
                <ActivityIndicator color={PRIMARY} style={{ marginVertical: 12 }} />
              ) : (
                (clientsData?.data || [])
                  .filter((farmer: any) => {
                    if (!farmerSearch) return true;
                    const addr = typeof farmer.address === "string" ? farmer.address : (farmer.address?.barangay || "");
                    return farmer.name?.toLowerCase().includes(farmerSearch.toLowerCase()) || addr.toLowerCase().includes(farmerSearch.toLowerCase());
                  })
                  .slice(0, 3)
                  .map((farmer: any) => (
                    <FarmerCompactCard
                      key={farmer._id}
                      id={farmer._id}
                      name={farmer.name}
                      location={typeof farmer.address === "string" ? farmer.address : (farmer.address?.barangay || "Oton, Iloilo")}
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
                  <Text style={{ fontFamily: "Outfit_700Bold", color: "#94a3b8", fontSize: 13 }}>No assigned farmers yet</Text>
                </View>
              )}
            </View>
          </View>

          {/* Moowie Help Banner */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={{
              backgroundColor: "#FAF7F2",
              borderRadius: 28,
              padding: 20,
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              borderWidth: 1,
              borderColor: "#f3f0e9",
              shadowColor: "#000",
              shadowOpacity: 0.03,
              shadowRadius: 10,
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
                style={{
                  fontFamily: "Outfit_900Black",
                  color: "#1e293b",
                  fontSize: 16,
                }}
              >
                Need a second opinion?
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  color: "#64748b",
                  fontSize: 11,
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
                backgroundColor: PRIMARY,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

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
              backgroundColor: "#fff",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 20,
              paddingBottom: Math.max(insets.bottom, 20) + 12,
              maxHeight: '85%',
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
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 20,
                  color: "#1e293b",
                }}
              >
                {selectedItem?.status === 'pending' ? 'Confirm Dispatch' : 'Service Update'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              showsVerticalScrollIndicator={false} 
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 10 }}
            >
            <View
              style={{
                backgroundColor: "#f8fafc",
                borderRadius: 16,
                padding: 12,
                borderLeftWidth: 4,
                borderLeftColor: PRIMARY,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_800ExtraBold",
                  color: "#64748b",
                  fontSize: 10,
                  textTransform: "uppercase",
                }}
              >
                Target Service
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: "#1e293b",
                  fontSize: 15,
                  marginTop: 2,
                }}
              >
                {selectedItem?.task}
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  color: "#64748b",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {selectedItem?.farmer} · {selectedItem?.location}
              </Text>
            </View>

              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#f1f5f9",
                  shadowColor: "#000",
                  shadowOpacity: 0.03,
                  shadowRadius: 10,
                  elevation: 2
                }}
              >
                <View>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: "#94a3b8",
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 4
                    }}
                  >
                    Visit Schedule
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: "#1e293b",
                      fontSize: 15,
                    }}
                  >
                    {scheduledDate.toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </Text>
                </View>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#f0fdf4", alignItems: 'center', justifyContent: 'center' }}>
                  <Clock3 size={20} color={PRIMARY} />
                </View>
              </TouchableOpacity>

              {selectedItem?.status === "pending" &&
                (selectedItem?.raw?.preferredDate || selectedItem?.displayDate) && (
                  <View
                    style={{
                      backgroundColor: "#fffbeb",
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: "#fef3c7",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Clock3 size={14} color="#d97706" />
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        fontSize: 11,
                        color: "#d97706",
                        flex: 1,
                      }}
                    >
                      Farmer Request:{" "}
                      {new Date(
                        selectedItem.raw?.preferredDate || selectedItem.displayDate,
                      ).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </Text>
                  </View>
                )}

              <Text style={{ fontFamily: 'Outfit_800ExtraBold', color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
                {selectedItem?.status === 'pending' ? 'Notes' : 'Findings'}
              </Text>
              <TextInput
                placeholder={selectedItem?.status === 'pending' ? "Add field notes (optional)..." : "Enter findings / observations..."}
                placeholderTextColor="#94a3b8"
                multiline
                style={{
                  backgroundColor: "#f8fafc",
                  borderRadius: 14,
                  padding: 12,
                  height: 64,
                  textAlignVertical: "top",
                  fontFamily: "Outfit_600SemiBold",
                  color: "#1e293b",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                }}
                value={note}
                onChangeText={setNote}
              />

              {selectedItem?.type === "health" &&
                selectedItem?.status !== "pending" && (
                  <>
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: "#94a3b8",
                        fontSize: 10,
                        textTransform: "uppercase",
                        marginLeft: 4,
                      }}
                    >
                      Diagnosis
                    </Text>
                    <TextInput
                      placeholder="Enter diagnosis..."
                      placeholderTextColor="#94a3b8"
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: 14,
                        padding: 12,
                        fontFamily: "Outfit_600SemiBold",
                        color: "#1e293b",
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                      }}
                      value={diagnosis}
                      onChangeText={setDiagnosis}
                    />

                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: "#94a3b8",
                        fontSize: 10,
                        textTransform: "uppercase",
                        marginLeft: 4,
                      }}
                    >
                      Prescription / Treatment
                    </Text>
                    <TextInput
                      placeholder="Medicines or treatment given..."
                      placeholderTextColor="#94a3b8"
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: 14,
                        padding: 12,
                        fontFamily: "Outfit_600SemiBold",
                        color: "#1e293b",
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                      }}
                      value={treatment}
                      onChangeText={setTreatment}
                    />

                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: "#94a3b8",
                        fontSize: 10,
                        textTransform: "uppercase",
                        marginLeft: 4,
                      }}
                    >
                      Advice for Farmer
                    </Text>
                    <TextInput
                      placeholder="e.g. Keep isolated, provide water..."
                      placeholderTextColor="#94a3b8"
                      multiline
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: 14,
                        padding: 12,
                        height: 64,
                        textAlignVertical: "top",
                        fontFamily: "Outfit_600SemiBold",
                        color: "#1e293b",
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                      }}
                      value={advice}
                      onChangeText={setAdvice}
                    />
                  </>
                )}

              {selectedItem?.type === "insemination" &&
                selectedItem?.status !== "pending" && (
                  <>
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: "#94a3b8",
                        fontSize: 10,
                        textTransform: "uppercase",
                        marginLeft: 4,
                      }}
                    >
                      Sire Breed
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowBreedModal(true)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: "#fff",
                        borderRadius: 16,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: "#f1f5f9",
                        shadowRadius: 10,
                        elevation: 1
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                          <Syringe size={18} color={PRIMARY} />
                        </View>
                        <View>
                           <Text style={{ fontFamily: 'Outfit_500Medium', color: '#94a3b8', fontSize: 9, textTransform: 'uppercase' }}>Selected Breed</Text>
                           <Text style={{ 
                              fontFamily: "Outfit_800ExtraBold",
                              color: sireBreed ? "#1e293b" : "#cbd5e1",
                              fontSize: 14
                           }}>
                              {sireBreed || "Choose Sire Breed"}
                           </Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: "#94a3b8",
                        fontSize: 10,
                        textTransform: "uppercase",
                        marginLeft: 4,
                      }}
                    >
                      Sire Code
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: 14,
                        paddingHorizontal: 16,
                        height: 52,
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <MaterialCommunityIcons name="shield-check-outline" size={20} color={PRIMARY} style={{ opacity: 0.5 }} />
                      <View>
                        <Text style={{ fontFamily: 'Outfit_500Medium', color: '#94a3b8', fontSize: 9, textTransform: 'uppercase' }}>
                          Authorized Code
                        </Text>
                        <Text style={{ 
                          fontFamily: "Outfit_800ExtraBold",
                          color: sireCode ? "#1e293b" : "#cbd5e1",
                          fontSize: 13,
                          letterSpacing: 1
                        }}>
                          {sireCode || "--- --- ---"}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: "#94a3b8",
                        fontSize: 10,
                        textTransform: "uppercase",
                        marginLeft: 4,
                      }}
                    >
                      Estrus Type
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#f8fafc",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: "#e2e8f0",
                        overflow: 'hidden'
                      }}
                    >
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 8 }}>
                          {["Natural", "Synchronized", "Induced"].map((type) => (
                            <TouchableOpacity
                              key={type}
                              onPress={() => setEstrus(type)}
                              style={{
                                paddingHorizontal: 16,
                                paddingVertical: 8,
                                borderRadius: 12,
                                backgroundColor: estrus === type ? PRIMARY : "#fff",
                                borderWidth: 1,
                                borderColor: estrus === type ? PRIMARY : "#e2e8f0",
                              }}
                            >
                              <Text style={{ 
                                fontSize: 11, 
                                fontFamily: "Outfit_700Bold", 
                                color: estrus === type ? "#fff" : "#64748b" 
                              }}>
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
                backgroundColor: PRIMARY,
                paddingVertical: 16,
                borderRadius: 18,
                alignItems: "center",
                shadowColor: PRIMARY,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                elevation: 8,
              }}
            >
              {scheduleMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 16,
                  }}
                >
                  {selectedItem?.status === 'pending' ? 'Accept Mission' : 'Update & Complete'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate}
          mode="datetime"
          display="default"
          minimumDate={new Date()}
          onChange={(e, d) => {
            setShowDatePicker(false);
            if (d) setScheduledDate(d);
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
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 40, borderTopRightRadius: 40, maxHeight: '85%' }}>
            <View style={{ padding: 24, borderBottomWidth: 1, borderBottomColor: '#f8fafc', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
               <View>
                  <Text style={{ fontSize: 20, fontFamily: 'Outfit_900Black', color: '#1e293b' }}>Sire Registry</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Outfit_700Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Official Breed List</Text>
               </View>
              <TouchableOpacity 
                onPress={() => setShowBreedModal(false)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                {CATTLE_BREEDS.map((breed) => (
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
                      backgroundColor: sireBreed === breed ? PRIMARY : '#f8fafc',
                      borderWidth: 1,
                      borderColor: sireBreed === breed ? PRIMARY : '#f1f5f9',
                      width: '48%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: sireBreed === breed ? PRIMARY : "#000",
                      shadowOpacity: sireBreed === breed ? 0.1 : 0,
                      shadowRadius: 10,
                      elevation: sireBreed === breed ? 2 : 0
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Outfit_800ExtraBold',
                      color: sireBreed === breed ? '#fff' : '#1e293b',
                      textAlign: 'center'
                    }}>
                      {breed}
                    </Text>
                    <Text style={{
                      fontSize: 9,
                      fontFamily: 'Outfit_600SemiBold',
                      color: sireBreed === breed ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                      textTransform: 'uppercase',
                      marginTop: 2
                    }}>
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

const StatBox = ({ label, value, icon, color }: any) => (
  <View style={{ flex: 1, alignItems: "center" }}>
    <MaterialCommunityIcons name={icon} size={20} color={color} />
    <Text
      style={{
        fontSize: 18,
        fontFamily: "Outfit_900Black",
        color: "#1e293b",
        marginTop: 4,
      }}
    >
      {value}
    </Text>
    <Text
      style={{
        fontSize: 9,
        fontFamily: "Outfit_700Bold",
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      {label}
    </Text>
  </View>
);

const ActionCard = ({ label, icon, color, bg, onPress }: any) => (
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
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <MaterialCommunityIcons name={icon as any} size={28} color={color} />
    </View>
    <Text
      style={{
        fontFamily: "Outfit_700Bold",
        color: "#64748b",
        fontSize: 10,
        textAlign: "center",
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const AgendaCard = ({ item, onPress, isFirst }: any) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={{
      backgroundColor: isFirst ? "#f0fdf4" : "#fff",
      borderRadius: 24,
      padding: 16,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: isFirst ? "#bbf7d0" : "#f1f5f9",
      shadowColor: "#000",
      shadowOpacity: 0.02,
      shadowRadius: 10,
      elevation: 2,
    }}
  >
    <View
      style={{
        width: 70,
        borderRightWidth: 1,
        borderRightColor: isFirst ? "#86efac" : "#f1f5f9",
        paddingRight: 10,
        marginRight: 15,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontFamily: "Outfit_700Bold",
          color: "#94a3b8",
          textTransform: "uppercase",
        }}
      >
        Time
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: "Outfit_800ExtraBold",
          color: "#1e293b",
          marginTop: 2,
        }}
      >
        {item.time || "8:00 AM"}
      </Text>
    </View>

    <View style={{ flex: 1 }}>
      <Text
        style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: "#1e293b" }}
      >
        {item.farmer || item.location}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_500Medium",
          color: "#64748b",
          marginTop: 2,
        }}
      >
        {item.task} {item.animalName ? `— ${item.animalName}` : ""}
      </Text>
    </View>

    {isFirst ? (
      <View
        style={{
          backgroundColor: "#00643B",
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
        }}
      >
        <Text
          style={{ color: "#fff", fontSize: 10, fontFamily: "Outfit_900Black" }}
        >
          NEXT
        </Text>
      </View>
    ) : (
      <MaterialCommunityIcons name="clock-outline" size={20} color="#cbd5e1" />
    )}
  </TouchableOpacity>
);

const RequestCard = ({ item, onAccept, onDecline }: any) => (
  <View
    style={{
      backgroundColor: "#fff",
      borderRadius: 24,
      padding: 16,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#f1f5f9",
      shadowColor: "#000",
      shadowOpacity: 0.02,
      shadowRadius: 10,
      elevation: 2,
    }}
  >
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: item.type === "health" ? "#fffbeb" : "#f0fdf4",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons
        name={item.type === "health" ? "stethoscope" : "needle"}
        size={24}
        color={item.type === "health" ? "#d97706" : PRIMARY}
      />
    </View>

    <View style={{ flex: 1, marginLeft: 16 }}>
      <Text
        style={{ fontSize: 16, fontFamily: "Outfit_700Bold", color: "#1e293b" }}
      >
        {item.farmer}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Outfit_500Medium",
          color: "#64748b",
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {item.task}
      </Text>
    </View>

    <View style={{ gap: 8, alignItems: "flex-end" }}>
      <TouchableOpacity
        onPress={onAccept}
        style={{
          backgroundColor: PRIMARY,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 12,
          minWidth: 80,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 10,
            fontFamily: "Outfit_900Black",
            textTransform: 'uppercase'
          }}
        >
          Accept
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onDecline}
        style={{
          backgroundColor: "#fef2f2",
          paddingHorizontal: 16,
          paddingVertical: 6,
          borderRadius: 10,
          minWidth: 80,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#ef4444",
            fontSize: 9,
            fontFamily: "Outfit_900Black",
            textTransform: 'uppercase'
          }}
        >
          Decline
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const FarmerCompactCard = ({ id, name, location, phone, imageUrl, totalAnimals, pregnantCount, insemCount, normalCount, router }: any) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => router.push(`/(technician)/client-details?id=${id}`)}
    style={{
      backgroundColor: "#fff",
      borderRadius: 24,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#f1f5f9",
      shadowColor: "#000",
      shadowOpacity: 0.01,
      shadowRadius: 10,
      elevation: 1,
    }}
  >
    {/* Top Row: Profile, Info, and Call Button */}
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: "#FAF7F2",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text
            style={{ fontFamily: "Outfit_900Black", color: PRIMARY, fontSize: 16 }}
          >
            {name ? name.charAt(0) : "F"}
          </Text>
        )}
      </View>
      
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text
          style={{
            fontFamily: "Outfit_900Black",
            color: "#1e293b",
            fontSize: 15,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: "Outfit_600SemiBold",
            color: "#94a3b8",
            fontSize: 11,
            marginTop: 1,
          }}
        >
          {location} · <Text style={{ color: PRIMARY, fontFamily: "Outfit_800ExtraBold" }}>{totalAnimals || 0} head</Text>
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
            backgroundColor: "#f0fdf4",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#dcfce7",
          }}
        >
          <Phone size={16} color={PRIMARY} />
        </TouchableOpacity>
      )}
    </View>

    {/* Bottom Row: High-fidelity status badges */}
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
      <View style={{ backgroundColor: "#eff6ff", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 0.5, borderColor: "#dbeafe" }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#3b82f6" }} />
        <Text style={{ fontFamily: "Outfit_700Bold", color: "#1d4ed8", fontSize: 10 }}>Pregnant: {pregnantCount || 0}</Text>
      </View>
      <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 0.5, borderColor: "#dcfce7" }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" }} />
        <Text style={{ fontFamily: "Outfit_700Bold", color: "#047857", fontSize: 10 }}>Normal: {normalCount || 0}</Text>
      </View>
      <View style={{ backgroundColor: "#fffbeb", borderRadius: 10, paddingVertical: 4, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 0.5, borderColor: "#fef3c7" }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#eab308" }} />
        <Text style={{ fontFamily: "Outfit_700Bold", color: "#b45309", fontSize: 10 }}>A.I.: {insemCount || 0}</Text>
      </View>
    </View>
  </TouchableOpacity>
);
