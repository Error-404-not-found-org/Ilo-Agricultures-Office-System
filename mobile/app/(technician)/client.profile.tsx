import {
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  MapPin,
  Info as InfoIcon,
  Edit2,
  Phone,
  Mail,
  ChevronRight,
  Plus,
  Calendar,
  FileText,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";

function ClientProfileSkeleton() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Banner Skeleton */}
      <View
        style={{
          paddingTop: insets.top + 16,
          backgroundColor: isDark ? "#064e3e" : "#00643B",
          paddingBottom: 40,
          paddingHorizontal: 24,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.15)",
          }}
        />
        <Skeleton
          width={100}
          height={18}
          radius={6}
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        />
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.15)",
          }}
        />
      </View>

      {/* Profile Card Skeleton */}
      <View
        style={{
          marginHorizontal: 24,
          marginTop: -20,
          padding: 16,
          borderRadius: 24,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Skeleton shape="circle" height={72} style={{ marginRight: 16 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={20} radius={6} />
            <Skeleton width="40%" height={12} radius={4} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <Skeleton height={40} radius={12} style={{ flex: 1 }} />
          <Skeleton height={40} radius={12} style={{ flex: 1 }} />
        </View>
      </View>

      {/* Overview Boxes Skeletons */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          marginVertical: 16,
          gap: 8,
        }}
      >
        <Skeleton height={50} radius={16} style={{ flex: 1 }} />
        <Skeleton height={50} radius={16} style={{ flex: 1 }} />
        <Skeleton height={50} radius={16} style={{ flex: 1 }} />
        <Skeleton height={50} radius={16} style={{ flex: 1 }} />
      </View>

      {/* Tabs Skeleton */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 24,
          marginBottom: 16,
          gap: 16,
        }}
      >
        <Skeleton height={32} radius={6} style={{ flex: 1 }} />
        <Skeleton height={32} radius={6} style={{ flex: 1 }} />
      </View>

      {/* Body Content Skeleton */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 16 }}>
          {/* Moowie Card Skeleton */}
          <View
            style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}
          >
            <Skeleton shape="circle" height={48} />
            <Skeleton height={64} radius={20} style={{ flex: 1 }} />
          </View>

          {/* Action Grid Skeletons */}
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Skeleton height={68} radius={16} style={{ flex: 1 }} />
              <Skeleton height={68} radius={16} style={{ flex: 1 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Skeleton height={68} radius={16} style={{ flex: 1 }} />
              <Skeleton height={68} radius={16} style={{ flex: 1 }} />
            </View>
          </View>

          {/* Details Card Skeletons */}
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 24,
              padding: 16,
              gap: 12,
            }}
          >
            <Skeleton
              width="40%"
              height={16}
              radius={4}
              style={{ marginBottom: 4 }}
            />
            <Skeleton height={40} radius={12} />
            <Skeleton height={40} radius={12} />
            <Skeleton height={40} radius={12} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function ClientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<"Info" | "Animals">("Info");

  const { clientDetailsQuery } = useTechnicianClients(id as string);
  const client = clientDetailsQuery.data;
  const loading = clientDetailsQuery.isLoading;

  const primaryColor = isDark ? colors.primary : "#00643B";

  useEffect(() => {
    if (clientDetailsQuery.error) {
      const error: any = clientDetailsQuery.error;
      console.error("Failed to fetch client details", error);
      if (error.response?.status === 404) {
        toast.info("This client record no longer exists.");
        router.replace("/(technician)/technician.clients" as any);
      } else {
        toast.error(
          error.response?.data?.message || "Could not load client details.",
        );
      }
    }
  }, [clientDetailsQuery.error, router]);

  if (loading) {
    return <ClientProfileSkeleton />;
  }

  if (!client) {
    return (
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: colors.background }}
      >
        <Text variant="bold" color="muted">
          Client Not Found.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: primaryColor }}
          className="mt-4 px-6 py-3 rounded-full"
        >
          <Text variant="bold" style={{ color: "#fff" }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const clientName = client.name || "Unknown Client";
  const addr = client.address;
  const clientPhone =
    addr?.phoneNumber || client.phoneNumber || "No phone attached";
  const clientAddress = addr
    ? [addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean)
        .join(", ")
    : "Location Unregistered";
  const hasRealClerkId =
    Boolean(client.clerkId) && !String(client.clerkId).startsWith("manual_");
  const isClaimed = client.profileClaimStatus === "claimed" || hasRealClerkId;
  const isClaimable =
    client.profileClaimStatus === "unclaimed" ||
    (client.registeredByTechnician && !client.email && !hasRealClerkId);
  const accountStatusLabel = isClaimed
    ? "App Account Connected"
    : isClaimable
      ? "Not Yet Claimed"
      : "Profile Only";
  const accountStatusSubtext = isClaimed
    ? client.email || "Farmer login is linked"
    : isClaimable
      ? "Farmer can verify this phone in the app"
      : "No app login linked";
  const accountStatusIcon = isClaimed
    ? "check-circle"
    : isClaimable
      ? "account-clock"
      : "account-outline";
  const accountStatusColor = isClaimed
    ? "#10b981"
    : isClaimable
      ? "#f59e0b"
      : colors.textMuted;

  const animalsList = client.stats?.animals || [];
  const pregnantCount = animalsList.filter(
    (a: any) => a.reproductiveStatus === "Pregnant",
  ).length;
  const inHeatCount = animalsList.filter(
    (a: any) => a.reproductiveStatus === "In Heat",
  ).length;

  // Calculate dynamic stats
  const pendingRequestsCount = (client.serviceHistory || []).filter(
    (h: any) => h.status === "pending",
  ).length;

  const getLastVisitDays = () => {
    const completedHistory = (client.serviceHistory || []).filter(
      (h: any) =>
        h.status === "completed" ||
        h.status === "done" ||
        h.status === "approved",
    );
    if (completedHistory.length === 0) return "N/A";
    const lastDate = new Date(
      completedHistory[0].createdAt ||
        completedHistory[0].date ||
        completedHistory[0].inseminationDate,
    );
    const diffDays = Math.floor(
      (new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays <= 0 ? "Today" : `${diffDays}d ago`;
  };

  const totalServices = client.serviceHistory?.length || 0;
  const completedServices = (client.serviceHistory || []).filter(
    (s: any) =>
      s.status === "completed" ||
      s.status === "done" ||
      s.status === "approved",
  ).length;
  const compliance =
    totalServices > 0
      ? Math.round((completedServices / totalServices) * 100)
      : 92;

  const totalCalves = animalsList.reduce(
    (sum: number, a: any) => sum + (a.totalCalves || 0),
    0,
  );
  const healthCasesCount = (client.serviceHistory || []).filter(
    (h: any) => h.type === "health",
  ).length;

  const handleCall = () => {
    if (clientPhone && clientPhone !== "No phone attached") {
      Linking.openURL(`tel:${clientPhone}`).catch(() => {
        toast.error("Could not initiate phone call.");
      });
    }
  };

  const handleEmail = () => {
    if (client.email && client.email !== "Unregistered") {
      Linking.openURL(`mailto:${client.email}`).catch(() => {
        toast.error("Could not initiate email client.");
      });
    }
  };

  const handleMapRedirect = () => {
    const farmLocation = client.farmLocation;
    const hasFarmPin =
      typeof farmLocation?.latitude === "number" &&
      typeof farmLocation?.longitude === "number";
    const query = hasFarmPin
      ? `${farmLocation.latitude},${farmLocation.longitude}`
      : clientAddress;

    if (query && query !== "Location Unregistered") {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      ).catch(() => {
        toast.error("Could not open maps.");
      });
    }
  };

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Curved Green Top Background Banner */}
      <View
        style={{
          paddingTop: insets.top + 16,
          backgroundColor: isDark ? "#064e3e" : "#00643B",
          paddingBottom: 40,
          paddingHorizontal: 24,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          className="w-10 h-10 bg-white/15 rounded-full items-center justify-center border border-white/10"
        >
          <ArrowLeft size={22} color="white" />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_900Black",
            color: "white",
            fontSize: 18,
          }}
          className="tracking-wide"
        >
          Client Profile
        </Text>
        <TouchableOpacity
          onPress={() =>
            router.push(
              `/(technician)/updateclient.profile?id=${client._id}` as any,
            )
          }
          activeOpacity={0.8}
          className="w-10 h-10 bg-white/15 rounded-full items-center justify-center border border-white/10 active:opacity-75"
        >
          <Edit2 size={18} color="white" />
        </TouchableOpacity>
      </View>

      {/* Overlapping Client Profile Card */}
      <View
        style={{
          marginHorizontal: 24,
          marginTop: -20,
          padding: 16,
          borderRadius: 24,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 12,
          elevation: 3,
          zIndex: 10,
        }}
      >
        {/* Top Info Row */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: colors.tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {client.imageUrl ? (
              <Image
                source={{ uri: client.imageUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <MaterialCommunityIcons
                name="account"
                size={38}
                color={isDark ? "#34d399" : "#00643B"}
              />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Outfit_900Black",
                color: colors.textPrimary,
                fontSize: 20,
              }}
            >
              {clientName}
            </Text>
            <View className="flex-row items-center gap-1 mt-1">
              <MapPin size={12} color={colors.textMuted} />
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: "Outfit_500Medium",
                  color: colors.textMuted,
                  fontSize: 12,
                }}
              >
                {client.address?.barangay || "Oton"},{" "}
                {client.address?.city || "Iloilo"}
              </Text>
            </View>
          </View>
        </View>

        {/* Call & Message Action Buttons Row */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <TouchableOpacity
            onPress={handleCall}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: primaryColor,
              backgroundColor: isDark ? "rgba(0,100,59,0.15)" : "#f0fdf4",
              gap: 8,
            }}
          >
            <Phone size={16} color={primaryColor} />
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: primaryColor,
                fontSize: 13,
              }}
            >
              Call
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEmail}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 8,
            }}
          >
            <Mail size={16} color={colors.textSecondary} />
            <Text
              style={{
                fontFamily: "Outfit_800ExtraBold",
                color: colors.textSecondary,
                fontSize: 13,
              }}
            >
              Message
            </Text>
          </TouchableOpacity>
        </View>

        {/* Account Claim Status & Member Since Section */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialCommunityIcons
              name={accountStatusIcon as any}
              size={16}
              color={accountStatusColor}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 11,
                  color: accountStatusColor,
                }}
                numberOfLines={1}
              >
                {accountStatusLabel}
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 9,
                  color: colors.textMuted,
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {accountStatusSubtext}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontFamily: "Outfit_500Medium",
              fontSize: 10,
              color: colors.textMuted,
              marginLeft: 12,
            }}
          >
            Member since{" "}
            {client.createdAt
              ? new Date(client.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Apr 20, 2024"}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="flex-1 pt-2 flex-col">
        {/* Overview Row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            marginVertical: 16,
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                fontSize: 16,
                color: colors.textPrimary,
              }}
            >
              {animalsList.length}
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 8,
                color: colors.textMuted,
                textTransform: "uppercase",
                marginTop: 2,
                textAlign: "center",
              }}
            >
              Animals
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                fontSize: 16,
                color: colors.textPrimary,
              }}
            >
              {pendingRequestsCount}
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 8,
                color: colors.textMuted,
                textTransform: "uppercase",
                marginTop: 2,
                textAlign: "center",
              }}
            >
              Pending
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                fontSize: 16,
                color: colors.textPrimary,
              }}
              numberOfLines={1}
            >
              {getLastVisitDays()}
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 8,
                color: colors.textMuted,
                textTransform: "uppercase",
                marginTop: 2,
                textAlign: "center",
              }}
            >
              Last Visit
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 16,
              paddingVertical: 10,
              paddingHorizontal: 6,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                fontSize: 16,
                color: colors.textPrimary,
              }}
            >
              {compliance}%
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 8,
                color: colors.textMuted,
                textTransform: "uppercase",
                marginTop: 2,
                textAlign: "center",
              }}
            >
              Compliance
            </Text>
          </View>
        </View>

        {/* Tab Selection */}
        <View className="flex-row px-6 mb-4">
          <TouchableOpacity
            onPress={() => setActiveTab("Info")}
            style={{
              borderBottomWidth: 3,
              borderBottomColor:
                activeTab === "Info" ? primaryColor : "transparent",
            }}
            className="flex-1 py-3 items-center flex-row justify-center gap-2"
          >
            <InfoIcon
              size={18}
              color={activeTab === "Info" ? primaryColor : colors.textMuted}
            />
            <Text
              style={{
                fontFamily:
                  activeTab === "Info"
                    ? "Outfit_800ExtraBold"
                    : "Outfit_600SemiBold",
                color: activeTab === "Info" ? primaryColor : colors.textMuted,
              }}
              className="text-[14px]"
            >
              Contact Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("Animals")}
            style={{
              borderBottomWidth: 3,
              borderBottomColor:
                activeTab === "Animals" ? primaryColor : "transparent",
            }}
            className="flex-1 py-3 items-center flex-row justify-center gap-2"
          >
            <MaterialCommunityIcons
              name="cow"
              size={18}
              color={activeTab === "Animals" ? primaryColor : colors.textMuted}
            />
            <Text
              style={{
                fontFamily:
                  activeTab === "Animals"
                    ? "Outfit_800ExtraBold"
                    : "Outfit_600SemiBold",
                color:
                  activeTab === "Animals" ? primaryColor : colors.textMuted,
              }}
              className="text-[14px]"
            >
              Registered Cattle
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          className="px-6"
        >
          {activeTab === "Info" ? (
            <View className="gap-y-6">
              {/* --- MOOWIE GREETING SECTION --- */}
              <View>
                <View className="flex-row items-end">
                  {/* Mascot Container */}
                  <View className="w-16 h-16 -mb-1 z-10">
                    <Image
                      source={{
                        uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
                      }}
                      className="w-full h-full"
                      resizeMode="contain"
                    />
                  </View>

                  {/* Speech Bubble */}
                  <View className="flex-1 bg-[#F0FDF4] dark:bg-emerald-900/10 rounded-[20px] rounded-bl-none p-4 ml-[-8px] border border-emerald-100 dark:border-emerald-900/20 shadow-sm">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text
                        style={{ fontFamily: "Outfit_900Black" }}
                        className="text-emerald-700 dark:text-emerald-400 text-[11px]"
                      >
                        Moowie Insight
                      </Text>
                      <View className="bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded-full">
                        <Text
                          style={{
                            fontFamily: "Outfit_900Black",
                            fontSize: 7,
                            color: isDark ? "#34d399" : "#00643B",
                          }}
                        >
                          AI
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{ fontFamily: "Outfit_500Medium" }}
                      className="text-slate-600 dark:text-slate-300 text-[11px] leading-[15px]"
                    >
                      {compliance >= 80
                        ? `${clientName} has a high visit compliance rate of ${compliance}%! Keep it up! Consider scheduling pregnancy checks for upcoming AI services.`
                        : `${clientName}'s compliance rate is currently at ${compliance}%. Make sure to schedule follow-up visits to ensure livestock safety.`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quick Actions Grid */}
              <View>
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: colors.textPrimary,
                  }}
                  className="text-base mb-3"
                >
                  Quick Actions
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(technician)/register-animal",
                        params: {
                          farmerId: client._id,
                          farmerName: clientName,
                          phoneNumber: clientPhone,
                          barangay: client.address?.barangay || "",
                          municipality:
                            client.address?.city ||
                            client.address?.municipality ||
                            "",
                          source: "client-profile",
                        },
                      } as any)
                    }
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: isDark
                          ? "rgba(16,185,129,0.15)"
                          : "#e6f4ea",
                        alignItems: "center",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={18} color={primaryColor} />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textPrimary,
                          fontSize: 13,
                        }}
                      >
                        Add Animal
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 9,
                        }}
                      >
                        Register livestock
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(technician)/create-task",
                        params: {
                          farmerId: client._id,
                          farmerName: clientName,
                          phoneNumber: clientPhone,
                          barangay: client.address?.barangay || "",
                          municipality:
                            client.address?.city ||
                            client.address?.municipality ||
                            "",
                          source: "client-profile",
                        },
                      } as any)
                    }
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: isDark
                          ? "rgba(59,130,246,0.15)"
                          : "#e8f0fe",
                        alignItems: "center",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <Calendar
                        size={18}
                        color={isDark ? "#60a5fa" : "#1a73e8"}
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textPrimary,
                          fontSize: 13,
                        }}
                      >
                        Schedule Visit
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 9,
                        }}
                      >
                        Create calendar task
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(technician)/photo-notes",
                        params: {
                          farmerId: client._id,
                          farmerName: clientName,
                          phoneNumber: clientPhone,
                          barangay: client.address?.barangay || "",
                          municipality:
                            client.address?.city ||
                            client.address?.municipality ||
                            "",
                          source: "client-profile",
                        },
                      } as any)
                    }
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: isDark
                          ? "rgba(245,158,11,0.15)"
                          : "#fef7e0",
                        alignItems: "center",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <FileText
                        size={18}
                        color={isDark ? "#fbbf24" : "#b06000"}
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textPrimary,
                          fontSize: 13,
                        }}
                      >
                        Photo Note
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 9,
                        }}
                      >
                        View notes & photos
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleMapRedirect}
                    style={{
                      flex: 1,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      padding: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: isDark
                          ? "rgba(239,68,68,0.15)"
                          : "#fce8e6",
                        alignItems: "center",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <MapPin
                        size={18}
                        color={isDark ? "#f87171" : "#d93025"}
                      />
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: "Outfit_800ExtraBold",
                          color: colors.textPrimary,
                          fontSize: 13,
                        }}
                      >
                        View Map
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 9,
                        }}
                      >
                        Open directions
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Farm Summary Card */}
              <View>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 24,
                    padding: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0 : 0.02,
                    shadowRadius: 6,
                    elevation: 1,
                  }}
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <Text
                      style={{
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textPrimary,
                        fontSize: 14,
                      }}
                    >
                      Farm Summary
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: primaryColor,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      All Time
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1, alignItems: "center" }}>
                      <MaterialCommunityIcons
                        name="needle"
                        size={20}
                        color={isDark ? "#60a5fa" : "#1a73e8"}
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textPrimary,
                          fontSize: 14,
                          marginTop: 4,
                        }}
                      >
                        {client.stats?.totalInseminations || 0}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 8,
                          marginTop: 2,
                        }}
                      >
                        AI Services
                      </Text>
                    </View>

                    <View style={{ flex: 1, alignItems: "center" }}>
                      <MaterialCommunityIcons
                        name="heart-pulse"
                        size={20}
                        color="#10b981"
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textPrimary,
                          fontSize: 14,
                          marginTop: 4,
                        }}
                      >
                        {client.stats?.successfulInseminations || 0}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 8,
                          marginTop: 2,
                        }}
                      >
                        Pregnancies
                      </Text>
                    </View>

                    <View style={{ flex: 1, alignItems: "center" }}>
                      <MaterialCommunityIcons
                        name="baby-carriage"
                        size={20}
                        color="#7c3aed"
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textPrimary,
                          fontSize: 14,
                          marginTop: 4,
                        }}
                      >
                        {totalCalves}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 8,
                          marginTop: 2,
                        }}
                      >
                        Calvings
                      </Text>
                    </View>

                    <View style={{ flex: 1, alignItems: "center" }}>
                      <MaterialCommunityIcons
                        name="stethoscope"
                        size={20}
                        color="#ef4444"
                      />
                      <Text
                        style={{
                          fontFamily: "Outfit_900Black",
                          color: colors.textPrimary,
                          fontSize: 14,
                          marginTop: 4,
                        }}
                      >
                        {healthCasesCount}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Outfit_500Medium",
                          color: colors.textMuted,
                          fontSize: 8,
                          marginTop: 2,
                        }}
                      >
                        Health Cases
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Contact Details Card */}
              <Card
                style={{
                  padding: 20,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowOpacity: 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: colors.textPrimary,
                    fontSize: 14,
                    marginBottom: 16,
                  }}
                >
                  Contact Details
                </Text>
                <View className="gap-y-5">
                  <TouchableOpacity
                    onPress={handleCall}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        style={{
                          backgroundColor: isDark
                            ? "rgba(16,185,129,0.15)"
                            : "#f0fdf4",
                        }}
                        className="w-10 h-10 rounded-full items-center justify-center"
                      >
                        <Phone size={18} color={primaryColor} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          Phone Number
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            fontSize: 15,
                            color: colors.textPrimary,
                            marginTop: 1,
                          }}
                        >
                          {clientPhone}
                        </Text>
                      </View>
                    </View>
                    {clientPhone !== "No phone attached" && (
                      <MaterialCommunityIcons
                        name="phone-outgoing"
                        size={18}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleEmail}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        style={{
                          backgroundColor: isDark
                            ? "rgba(16,185,129,0.15)"
                            : "#f0fdf4",
                        }}
                        className="w-10 h-10 rounded-full items-center justify-center"
                      >
                        <Mail size={18} color={primaryColor} />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          Email Address
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            fontSize: 15,
                            color: colors.textPrimary,
                            marginTop: 1,
                          }}
                        >
                          {client.email || "Unregistered"}
                        </Text>
                      </View>
                    </View>
                    {client.email && client.email !== "Unregistered" && (
                      <MaterialCommunityIcons
                        name="email-outline"
                        size={18}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleMapRedirect}
                    className="flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3 flex-1 pr-4">
                      <View
                        style={{
                          backgroundColor: isDark
                            ? "rgba(16,185,129,0.15)"
                            : "#f0fdf4",
                        }}
                        className="w-10 h-10 rounded-full items-center justify-center"
                      >
                        <MapPin size={18} color={primaryColor} />
                      </View>
                      <View className="flex-1">
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 11,
                            color: colors.textMuted,
                          }}
                        >
                          Primary Location
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Outfit_800ExtraBold",
                            fontSize: 14,
                            color: colors.textPrimary,
                            marginTop: 1,
                          }}
                          numberOfLines={2}
                        >
                          {clientAddress}
                        </Text>
                      </View>
                    </View>
                    {clientAddress !== "Location Unregistered" && (
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={18}
                        color={primaryColor}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Recent Activity Section */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 24,
                  padding: 16,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_800ExtraBold",
                    color: colors.textPrimary,
                  }}
                  className="text-base mb-4"
                >
                  Recent Activity
                </Text>

                {(client.serviceHistory || []).length > 0 ? (
                  <View style={{ gap: 16 }}>
                    {(client.serviceHistory || [])
                      .slice(0, 5)
                      .map((activity: any, actIdx: number) => (
                        <View key={actIdx} className="flex-row items-start">
                          {(() => {
                            const isAi = activity.type === "ai";
                            const isTask = activity.type === "task";
                            const iconName = isAi
                              ? "needle"
                              : isTask
                                ? "calendar-check"
                                : "stethoscope";
                            const iconColor = isAi
                              ? "#3b82f6"
                              : isTask
                                ? "#64748b"
                                : "#ef4444";
                            const bgColor = isAi
                              ? "rgba(59,130,246,0.1)"
                              : isTask
                                ? "rgba(100,116,139,0.12)"
                                : "rgba(239,68,68,0.1)";
                            const title = isAi
                              ? "Artificial Insemination"
                              : isTask
                                ? `${activity.details?.taskType || activity.taskType || "Visit"} Scheduled`
                                : activity.details?.diagnosis ||
                                  "Health Checkup";
                            return (
                              <>
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: bgColor,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 12,
                                  }}
                                >
                                  <MaterialCommunityIcons
                                    name={iconName as any}
                                    size={16}
                                    color={iconColor}
                                  />
                                </View>
                                <View className="flex-1">
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_800ExtraBold",
                                      color: colors.textPrimary,
                                      fontSize: 13,
                                    }}
                                  >
                                    {title}
                                  </Text>
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_500Medium",
                                      color: colors.textMuted,
                                      fontSize: 10,
                                      marginTop: 2,
                                    }}
                                  >
                                    {new Date(
                                      activity.createdAt,
                                    ).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}{" "}
                                    ·{" "}
                                    {activity.animalId?.earTag
                                      ? `Tag: #${activity.animalId.earTag}`
                                      : "Walk-in"}
                                  </Text>
                                </View>
                              </>
                            );
                          })()}
                        </View>
                      ))}
                  </View>
                ) : (
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      color: colors.textMuted,
                      fontSize: 12,
                    }}
                  >
                    No recent activity logs available.
                  </Text>
                )}
              </View>

              {/* Notes Section */}
              <Card
                style={{
                  padding: 16,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  shadowOpacity: 0,
                }}
              >
                <View className="flex-row justify-between items-center mb-4">
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textPrimary,
                      fontSize: 14,
                    }}
                  >
                    Notes
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      router.push(`/(technician)/photo-notes` as any)
                    }
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: primaryColor,
                        fontSize: 11,
                      }}
                    >
                      View All / Add
                    </Text>
                  </TouchableOpacity>
                </View>
                {client.fieldNotes && client.fieldNotes.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    {client.fieldNotes.map((note: any, index: number) => {
                      const noteDate = note.createdAt
                        ? new Date(note.createdAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "";
                      return (
                        <View
                          key={note._id || index}
                          style={{
                            backgroundColor: colors.background,
                            borderRadius: 16,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 12,
                              alignItems: "flex-start",
                            }}
                          >
                            {note.imageUrl ? (
                              <Image
                                source={{ uri: note.imageUrl }}
                                style={{
                                  width: 60,
                                  height: 60,
                                  borderRadius: 12,
                                }}
                                resizeMode="cover"
                              />
                            ) : null}
                            <View style={{ flex: 1 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: "Outfit_800ExtraBold",
                                    color: colors.textPrimary,
                                    fontSize: 13,
                                  }}
                                  numberOfLines={1}
                                >
                                  {note.title}
                                </Text>
                                {noteDate ? (
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_500Medium",
                                      color: colors.textMuted,
                                      fontSize: 10,
                                    }}
                                  >
                                    {noteDate}
                                  </Text>
                                ) : null}
                              </View>
                              <Text
                                style={{
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textSecondary,
                                  fontSize: 11,
                                  marginTop: 4,
                                }}
                                numberOfLines={2}
                              >
                                {note.description || "No observations."}
                              </Text>
                              {note.latitude && note.longitude ? (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                    marginTop: 6,
                                  }}
                                >
                                  <MapPin size={10} color={primaryColor} />
                                  <Text
                                    style={{
                                      fontFamily: "Outfit_700Bold",
                                      color: primaryColor,
                                      fontSize: 9,
                                    }}
                                  >
                                    Tagged Coordinates
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: colors.tint,
                      padding: 12,
                      borderRadius: 16,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Outfit_500Medium",
                        color: colors.textSecondary,
                        fontSize: 11,
                        fontStyle: "italic",
                        textAlign: "center",
                      }}
                    >
                      No custom client notes recorded. Tap &quot;Add Note&quot;
                      to attach photo notes or field observations.
                    </Text>
                  </View>
                )}
              </Card>
            </View>
          ) : (
            <View>
              {animalsList.length > 0 ? (
                <View className="mt-2">
                  {animalsList.map((item: any, idx: number) => (
                    <Card
                      key={idx}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 12,
                        padding: 16,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: colors.border,
                        shadowOpacity: 0,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isDark
                            ? "rgba(16,185,129,0.1)"
                            : "#f0fdf4",
                        }}
                        className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                      >
                        <MaterialCommunityIcons
                          name="cow"
                          size={26}
                          color={primaryColor}
                        />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text
                            style={{
                              fontFamily: "Outfit_800ExtraBold",
                              fontSize: 16,
                              color: colors.textPrimary,
                            }}
                          >
                            {item.earTag || item.animalId || "No ID"}
                          </Text>
                          <View
                            style={{
                              backgroundColor:
                                item.reproductiveStatus === "Pregnant"
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : item.reproductiveStatus === "In Heat"
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(148, 163, 184, 0.15)",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                fontFamily: "Outfit_700Bold",
                                color:
                                  item.reproductiveStatus === "Pregnant"
                                    ? "#10b981"
                                    : item.reproductiveStatus === "In Heat"
                                      ? "#f59e0b"
                                      : colors.textSecondary,
                              }}
                            >
                              {item.reproductiveStatus || "Normal"}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            fontFamily: "Outfit_500Medium",
                            fontSize: 13,
                            color: colors.textMuted,
                            marginTop: 2,
                          }}
                        >
                          {item.species || "Unknown"} · {item.breed || "Mixed"}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() =>
                          router.push(
                            `/(technician)/animal-details?id=${item._id}`,
                          )
                        }
                        style={{
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        }}
                        className="w-10 h-10 rounded-full items-center justify-center ml-2 border"
                      >
                        <ChevronRight size={20} color={primaryColor} />
                      </TouchableOpacity>
                    </Card>
                  ))}
                </View>
              ) : (
                <Card
                  style={{
                    padding: 32,
                    alignItems: "center",
                    marginTop: 4,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: colors.border,
                    shadowOpacity: 0,
                  }}
                >
                  <View
                    style={{ backgroundColor: colors.tint }}
                    className="w-20 h-20 rounded-full items-center justify-center mb-4"
                  >
                    <MaterialCommunityIcons
                      name="cow"
                      size={40}
                      color={colors.textMuted}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 18,
                      color: colors.textPrimary,
                    }}
                    className="mb-1"
                  >
                    No Owned Animals
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      fontSize: 14,
                      color: colors.textMuted,
                    }}
                    className="text-center px-4 leading-5"
                  >
                    This client does not have any cattle registered to their
                    name.
                  </Text>
                </Card>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
