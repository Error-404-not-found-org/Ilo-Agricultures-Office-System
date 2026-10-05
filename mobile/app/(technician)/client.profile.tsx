import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Archive,
  ChevronRight,
  ClipboardList,
  Edit2,
  EllipsisVertical,
  Mail,
  MapPin,
  Phone,
  Plus,
  MailX,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { formatAddressLabel } from "@/constants/address";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { getFarmerProfileActivity } from "@/features/technician/utils/farmerProfileActivity";
import { useTheme } from "@/lib/theme";

const formatProfileDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Farmer Profile" />
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton height={150} radius={20} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton height={140} radius={16} style={{ flex: 1 }} />
          <Skeleton height={140} radius={16} style={{ flex: 1 }} />
        </View>
        <Skeleton height={125} radius={16} />
        <Skeleton height={180} radius={16} />
      </View>
    </View>
  );
}
type AccessTone = "info" | "warning" | "success" | "danger";

const APP_ACCESS_ROW: Record<string, { label: string; tone: AccessTone; icon: string }> = {
  connected: { label: "Connected", tone: "success", icon: "check-circle-outline" },
  blocked: { label: "Blocked", tone: "danger", icon: "cancel" },
  invitation_sent: { label: "Invitation Sent", tone: "info", icon: "email-check-outline" },
  invitation_expired: { label: "Invitation Expired", tone: "warning", icon: "email-alert-outline" },
  no_app_account: { label: "No App Account", tone: "info", icon: "email-outline" },
  profile_only: { label: "No App Account", tone: "info", icon: "email-outline" },
};

export default function ClientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors, isDark } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"Overview" | "Animals">("Overview");
  const { clientDetailsQuery, archiveClientMutation, invitationMutation, cancelInvitationMutation } = useTechnicianClients(id);
  const client = clientDetailsQuery.data;
  const green = isDark ? colors.primary : "#00643B";
  const dangerColor = isDark ? "#f87171" : "#dc2626";

  useEffect(() => {
    if (!clientDetailsQuery.error) return;
    const error: any = clientDetailsQuery.error;
    if (error.response?.status === 404) {
      toast.info("This Farmer profile no longer exists.");
      router.replace("/(technician)/technician.clients" as any);
    } else {
      toast.error(error.response?.data?.message || "Could not load Farmer profile.");
    }
  }, [clientDetailsQuery.error, router]);

  if (clientDetailsQuery.isLoading) return <ProfileSkeleton />;
  if (!client) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppPageHeader title="Farmer Profile" />
        <Text style={{ margin: 24, color: colors.textMuted }}>Farmer profile unavailable.</Text>
      </View>
    );
  }

  const farmerId = String(client._id);
  const phone = client.phoneNumber || client.address?.phoneNumber || "";
  const email = client.email && client.email !== "Unregistered" ? client.email : "";
  const linkedAccount = Boolean(client.clerkId) && !String(client.clerkId).startsWith("manual_");
  const accountStatus = client.status === "suspended"
    ? "Account Suspended"
    : client.profileClaimStatus === "claimed" || linkedAccount
      ? "App Account Connected"
      : client.profileClaimStatus === "unclaimed"
        ? "Not Yet Claimed"
        : "Profile Only";
  const contactAddress = formatAddressLabel(
    client.address,
    null,
    "Contact address not provided",
  );
  const farmPin = client.farmLocation;
  const hasFarmPin =
    Number.isFinite(farmPin?.latitude) &&
    Number.isFinite(farmPin?.longitude) &&
    farmPin.latitude >= -90 && farmPin.latitude <= 90 &&
    farmPin.longitude >= -180 && farmPin.longitude <= 180;
  const farmPinLabel = hasFarmPin
    ? farmPin.detectedAddress?.trim() || farmPin.landmark?.trim() || "Farm GPS pin saved"
    : "Farm GPS pin not provided";
  const animals = Array.isArray(client.stats?.animals) ? client.stats.animals : [];
  const summary = client.profileSummary;
  const recordCounts = summary?.serviceRecords;
  const totalRecords = recordCounts
    ? (recordCounts.ai || 0) + (recordCounts.health || 0) +
      (recordCounts.pregnancy || 0) + (recordCounts.calving || 0)
    : null;
  const lastService = formatProfileDate(summary?.lastServiceDate) ||
    (summary ? "No completed service yet" : "Unavailable");
  const recentActivity = Array.isArray(client.serviceHistory)
    ? getFarmerProfileActivity(client.serviceHistory)
    : [];

  const openCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => toast.error("Could not initiate phone call."));
    }
  };
  const openEmail = () => {
    if (email) {
      Linking.openURL(`mailto:${email}`).catch(() => toast.error("Could not open email."));
    }
  };
  const openFarmPin = () => {
    if (hasFarmPin) {
      const query = `${farmPin.latitude},${farmPin.longitude}`;
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
      ).catch(() => toast.error("Could not open maps."));
    }
  };
  const confirmArchive = () => {
    setMenuVisible(false);
    Alert.alert(
      "Archive Farmer?",
      "This Farmer will leave active lists. Their profile and records will be preserved; an Admin can restore the profile later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive Farmer",
          onPress: async () => {
            try {
              await archiveClientMutation.mutateAsync(farmerId);
              toast.success("Farmer archived");
              router.replace("/(technician)/technician.clients" as any);
            } catch (error: any) {
              Alert.alert(
                "Farmer not archived",
                error?.response?.data?.message ||
                  "This Farmer could not be archived. Please refresh and try again.",
              );
            }
          },
        },
      ],
    );
  };
  const editFarmer = () => {
    setMenuVisible(false);
    router.push(`/(technician)/updateclient.profile?id=${farmerId}` as any);
  };
  const registerAnimal = () => {
    router.push({
      pathname: "/(technician)/register-animal",
      params: {
        farmerId,
        farmerName: client.name || "",
        phoneNumber: phone,
        barangay: client.address?.barangay || "",
        municipality: client.address?.city || client.address?.municipality || "",
        source: "client-profile",
      },
    } as any);
  };

  const accessStatus: string = String(client.appAccountStatus || "");
  const accessRow = APP_ACCESS_ROW[accessStatus] || null;
  const accessTones: Record<AccessTone, { bg: string; fg: string }> = isDark
    ? {
        info: { bg: "rgba(96,165,250,0.18)", fg: "#93c5fd" },
        warning: { bg: "rgba(251,191,36,0.18)", fg: "#fbbf24" },
        success: { bg: "rgba(52,211,153,0.18)", fg: "#34d399" },
        danger: { bg: "rgba(248,113,113,0.18)", fg: "#f87171" },
      }
    : {
        info: { bg: "#dbeafe", fg: "#1d4ed8" },
        warning: { bg: "#fef3c7", fg: "#b45309" },
        success: { bg: "#d1fae5", fg: "#047857" },
        danger: { bg: "#fee2e2", fg: "#b91c1c" },
      };
  const accessTone = accessRow ? accessTones[accessRow.tone] : null;
  const canInvite = ["no_app_account", "profile_only", "invitation_sent", "invitation_expired"]
    .includes(accessStatus);
  const accessAction: { label: string; kind: "send" | "resend" | "cancel" | "edit"; solid: boolean } | null =
    !canInvite
      ? null
      : !email
        ? { label: "Add Email", kind: "edit", solid: false }
        : accessStatus === "invitation_sent"
          ? { label: "Cancel Invitation", kind: "cancel", solid: false }
          : accessStatus === "invitation_expired"
            ? { label: "Resend", kind: "resend", solid: true }
            : { label: "Send Invite", kind: "send", solid: true };
  const accessDetail = email
    ? email
    : canInvite
      ? "No email on file"
      : "";
  const handleCancelInvitation = async () => {
    try {
      const result = await cancelInvitationMutation.mutateAsync(farmerId);
      toast.success(result?.message || "Invitation cancelled.");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "The invitation could not be cancelled. Please try again.",
      );
    }
  };
  const runAccessAction = async () => {
    if (!accessAction || invitationMutation.isPending || cancelInvitationMutation.isPending) return;
    if (accessAction.kind === "edit") {
      router.push(`/(technician)/updateclient.profile?id=${farmerId}` as any);
      return;
    }
    if (accessAction.kind === "cancel") {
      setCancelModalVisible(true);
      return;
    }
    const resend = accessAction.kind === "resend";
    try {
      const result = await invitationMutation.mutateAsync({ farmerId, resend });
      toast.success(result?.message || (resend ? "Invitation resent" : "Invitation sent"));
    } catch (error: any) {
      Alert.alert(
        resend ? "Invitation not resent" : "Invitation not sent",
        error?.response?.data?.message ||
          "The invitation could not be sent. Please try again.",
      );
    }
  };

  const sectionStyle = {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  } as const;
  const headingStyle = {
    fontFamily: "Outfit_800ExtraBold",
    color: colors.textPrimary,
    fontSize: 15,
  } as const;
  const mutedStyle = {
    fontFamily: "Outfit_500Medium",
    color: colors.textMuted,
    fontSize: 11,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader
        title="Farmer Profile"
        rightAction={
          <TouchableOpacity
            onPress={() => setMenuVisible((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel="Farmer options"
            style={{
              width: 40, height: 40, alignItems: "center", justifyContent: "center",
              borderRadius: 20, backgroundColor: colors.card,
            }}
          >
            <EllipsisVertical size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        }
      />
      {menuVisible && (
        <Pressable
          onPress={() => setMenuVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Close Farmer options"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 19, elevation: 7 }}
        />
      )}
      {menuVisible && (
        <View
          style={{
            position: "absolute", top: 55, right: 20, zIndex: 20,
            minWidth: 174, backgroundColor: colors.card,
            borderWidth: 1, borderColor: colors.border, borderRadius: 14,
            paddingVertical: 6, elevation: 8,
          }}
        >
          <TouchableOpacity
            onPress={editFarmer}
            accessibilityRole="button"
            accessibilityLabel="Edit Farmer"
            style={{ padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}
          >
            <Edit2 size={16} color={green} />
            <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Edit Farmer</Text>
          </TouchableOpacity>
          {client.canTechnicianArchive === true && (
            <TouchableOpacity
              onPress={confirmArchive}
              accessibilityRole="button"
              accessibilityLabel="Archive Farmer"
              style={{ padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}
            >
              <Archive size={16} color="#c2410c" />
              <Text style={{ fontFamily: "Outfit_700Bold", color: "#c2410c" }}>Archive Farmer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 64 }}
      >
        <Card style={{ ...sectionStyle, padding: 16, shadowOpacity: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {client.imageUrl ? (
              <Image
                source={{ uri: client.imageUrl }}
                style={{ width: 78, height: 78, borderRadius: 39 }}
              />
            ) : (
              <View style={{
                width: 78, height: 78, borderRadius: 39,
                backgroundColor: colors.tint, alignItems: "center", justifyContent: "center",
              }}>
                <MaterialCommunityIcons name="account" size={40} color={green} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{
                fontFamily: "Outfit_900Black", fontSize: 20, color: colors.textPrimary,
              }}>{client.name || "Farmer"}</Text>
              <Text style={{ fontFamily: "Outfit_700Bold", color: green, fontSize: 12 }}>
                Farmer
              </Text>
              <Text style={{ ...mutedStyle, marginTop: 3 }}>{accountStatus}</Text>
              <Text style={{ ...mutedStyle, marginTop: 5 }}>
                Registered {formatProfileDate(client.createdAt) || "date unavailable"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            {[
              { label: "Call", Icon: Phone, onPress: openCall, available: Boolean(phone) },
              { label: "Email", Icon: Mail, onPress: openEmail, available: Boolean(email) },
              { label: "View Location", Icon: MapPin, onPress: openFarmPin, available: hasFarmPin },
            ].map(({ label, Icon, onPress, available }) => (
              <TouchableOpacity
                key={label}
                onPress={onPress}
                disabled={!available}
                accessibilityRole="button"
                accessibilityLabel={label === "Call" ? "Call Farmer" : label === "Email" ? "Email Farmer" : label}
                accessibilityState={{ disabled: !available }}
                style={{
                  flex: 1, flexDirection: "row", gap: 5, alignItems: "center",
                  justifyContent: "center", minHeight: 42, borderRadius: 11,
                  backgroundColor: colors.tint, opacity: available ? 1 : 0.45,
                }}
              >
                <Icon size={15} color={green} />
                <Text numberOfLines={1} style={{
                  fontFamily: "Outfit_700Bold", fontSize: label === "View Location" ? 10 : 12, color: green,
                }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {accessRow && accessTone && (
            <View
              accessible
              accessibilityLabel={`App access: ${accessRow.label}${accessDetail ? `, ${accessDetail}` : ""}`}
              style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                marginTop: 14, paddingTop: 12,
                borderTopWidth: 1, borderTopColor: colors.border,
              }}
            >
              <MaterialCommunityIcons
                name={accessRow.icon as any}
                size={20}
                color={accessTone.fg}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{
                  alignSelf: "flex-start", backgroundColor: accessTone.bg,
                  borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2,
                }}>
                  <Text style={{ fontFamily: "Outfit_700Bold", fontSize: 11, color: accessTone.fg }}>
                    {accessRow.label}
                  </Text>
                </View>
                {accessDetail ? (
                  <Text numberOfLines={1} ellipsizeMode="middle" style={{ ...mutedStyle, marginTop: 3 }}>
                    {accessDetail}
                  </Text>
                ) : null}
              </View>
              {accessAction && (
                <TouchableOpacity
                  onPress={runAccessAction}
                  disabled={invitationMutation.isPending || cancelInvitationMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={
                    accessAction.kind === "edit"
                      ? "Add email to Farmer profile"
                      : accessAction.kind === "cancel"
                        ? "Cancel app invitation"
                        : accessAction.kind === "resend"
                          ? "Resend app invitation"
                          : "Send app invitation"
                  }
                  accessibilityState={{ disabled: invitationMutation.isPending || cancelInvitationMutation.isPending, busy: invitationMutation.isPending }}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  style={{
                    minHeight: 38, minWidth: 84, paddingHorizontal: 14, borderRadius: 19,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: accessAction.kind === "cancel"
                      ? "transparent"
                      : accessAction.solid ? green : "transparent",
                    borderWidth: 1.5,
                    borderColor: accessAction.kind === "cancel" ? dangerColor : green,
                    opacity: invitationMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {invitationMutation.isPending ? (
                    <ActivityIndicator size="small" color={accessAction.solid ? "#ffffff" : green} />
                  ) : (
                    <Text style={{
                      fontFamily: "Outfit_700Bold", fontSize: 12,
                      color: accessAction.kind === "cancel" ? dangerColor : accessAction.solid ? "#ffffff" : green,
                    }}>
                      {accessAction.label}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>

        <View style={{ gap: 10 }}>
          <View style={{ ...sectionStyle, gap: 9 }}>
            <Text style={headingStyle}>Contact Information</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Phone size={16} color={green} />
              <Text style={{ ...mutedStyle, flex: 1 }}>{phone || "Phone not provided"}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <Mail size={16} color={green} />
              <Text style={{ ...mutedStyle, flex: 1 }}>{email || "Email not provided"}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <MapPin size={16} color={green} />
              <Text style={{ ...mutedStyle, flex: 1 }}>{contactAddress}</Text>
            </View>
          </View>
          <View style={{ ...sectionStyle, gap: 9 }}>
            <Text style={headingStyle}>Farm Information</Text>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary, fontSize: 12 }}>Farm GPS location</Text>
                <Text style={mutedStyle}>{farmPinLabel}</Text>
              </View>
              {hasFarmPin && (
                <TouchableOpacity onPress={openFarmPin} accessibilityRole="button" accessibilityLabel="Open farm GPS pin">
                  <ChevronRight size={18} color={green} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={sectionStyle}>
          <Text style={headingStyle}>Farmer Overview</Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
            {[
              { label: "Animals", value: String(animals.length), icon: "cow", iconColor: isDark ? "#34d399" : "#047857" },
              { label: "Active Requests", value: summary ? String(summary.activeRequests) : "—", icon: "file-document-outline", iconColor: isDark ? "#fbbf24" : "#b45309" },
              { label: "Records", value: totalRecords === null ? "—" : String(totalRecords), icon: "database-outline", iconColor: isDark ? "#60a5fa" : "#1d4ed8" },
              { label: "Last Service You Recorded", value: lastService, icon: "calendar-outline", iconColor: isDark ? "#c4b5fd" : "#6d28d9" },
            ].map((item) => (
              <View key={item.label} style={{
                flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center",
                backgroundColor: colors.tint, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 3,
              }}>
                <MaterialCommunityIcons name={item.icon as any} size={19} color={item.iconColor} />
                <Text numberOfLines={2} style={{
                  fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary,
                  fontSize: item.label.startsWith("Last") ? 10 : 16, textAlign: "center", marginTop: 4,
                }}>{item.value}</Text>
                <Text style={{ ...mutedStyle, fontSize: 9, textAlign: "center", marginTop: 3 }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["Overview", "Animals"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
              style={{
                flex: 1, alignItems: "center", paddingVertical: 10,
                borderBottomWidth: 2, borderBottomColor: activeTab === tab ? green : colors.border,
              }}
            >
              <Text style={{
                fontFamily: "Outfit_700Bold",
                color: activeTab === tab ? green : colors.textMuted,
              }}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "Overview" ? (
          <>
            <View style={sectionStyle}>
              <Text style={headingStyle}>Recent Activity</Text>
              {recentActivity.length ? recentActivity.map((item, index) => {
                return (
                  <View key={item.id} style={{
                    flexDirection: "row", alignItems: "center", gap: 10,
                    paddingVertical: 10, borderBottomWidth: index === recentActivity.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={green} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{item.title}</Text>
                      <Text style={mutedStyle}>
                        {item.animalLabel}
                      </Text>
                    </View>
                    <Text style={mutedStyle}>
                      {formatProfileDate(item.addedAt) ? `Added ${formatProfileDate(item.addedAt)}` : ""}
                    </Text>
                  </View>
                );
              }) : (
                <Text style={{ ...mutedStyle, marginTop: 10 }}>No recent activity with this Farmer.</Text>
              )}
            </View>

            <View style={sectionStyle}>
              <Text style={headingStyle}>Farmer Records</Text>
              <TouchableOpacity
                onPress={() => setActiveTab("Animals")}
                accessibilityRole="button"
                accessibilityLabel="View Farmer animals"
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 10 }}
              >
                <MaterialCommunityIcons name="cow" size={18} color={green} />
                <Text style={{ flex: 1, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Animals</Text>
                <Text style={mutedStyle}>{animals.length} animals</Text>
                <ChevronRight size={17} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: "/(technician)/(tabs)/technician.records",
                  params: { farmerId },
                } as any)}
                accessibilityRole="button"
                accessibilityLabel="View records for this Farmer"
                style={{
                  flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 10,
                  borderTopWidth: 1, borderTopColor: colors.border,
                }}
              >
                <ClipboardList size={18} color={green} />
                <Text style={{ flex: 1, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>Records</Text>
                <Text style={mutedStyle}>{totalRecords === null ? "Unavailable" : `${totalRecords} records`}</Text>
                <ChevronRight size={17} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

          </>
        ) : (
          <View style={{ gap: 10 }}>
            {animals.length ? animals.map((animal: any) => (
              <TouchableOpacity
                key={String(animal._id)}
                onPress={() => router.push(`/(technician)/animal-details?id=${animal._id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View animal ${animal.earTag || animal.animalId || ""}`}
                style={{
                  ...sectionStyle, flexDirection: "row", alignItems: "center", gap: 10,
                }}
              >
                <MaterialCommunityIcons name="cow" size={25} color={green} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                    {animal.name || animal.earTag || animal.animalId || "Animal"}
                  </Text>
                  <Text style={mutedStyle}>{animal.species || "Species not recorded"} · {animal.breed || "Breed not recorded"}</Text>
                </View>
                <ChevronRight size={18} color={green} />
              </TouchableOpacity>
            )) : (
              <View style={{ ...sectionStyle, alignItems: "center", paddingVertical: 24, gap: 12 }}>
                <MaterialCommunityIcons name="cow" size={34} color={green} />
                <Text style={{ ...mutedStyle, fontSize: 13, textAlign: "center" }}>
                  No animals registered to this Farmer.
                </Text>
                <TouchableOpacity
                  onPress={registerAnimal}
                  accessibilityRole="button"
                  accessibilityLabel="Register animal for this Farmer"
                  style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                    minHeight: 46, paddingHorizontal: 20, borderRadius: 12, backgroundColor: green,
                  }}
                >
                  <Plus size={18} color="#ffffff" />
                  <Text style={{ fontFamily: "Outfit_700Bold", color: "#ffffff", fontSize: 14 }}>
                    Register Animal
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <ConfirmationModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onCancel={() => setCancelModalVisible(false)}
        onConfirm={handleCancelInvitation}
        title="Cancel Invitation?"
        message="The pending invitation will be revoked. You can send a new one at any time."
        confirmText="Cancel Invitation"
        cancelText="Keep Invitation"
        isDestructive
        icon={<MailX size={26} color={colors.errorForeground} />}
      />
    </View>
  );
}
