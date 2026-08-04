import React from "react";
import { View, ScrollView, Image, TouchableOpacity, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MapPin, Calendar, Clock, Phone, ChevronRight } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { safeBack } from "@/utils/navigation";
import { getDisplayDate } from "../utils/ledgerExport";

const PRIMARY = "#00643B";

export default function RecordDetailsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ id?: string; recordData?: string }>();

  let item: any = null;
  if (params.recordData) {
    try {
      item = JSON.parse(decodeURIComponent(params.recordData));
    } catch (e) {
      item = null;
    }
  }

  if (!item) {
    return (
      <ScreenLayout edges={[]}>
        <AppPageHeader
          title="Record Details"
          showBackButton={true}
          onBack={() => safeBack("/(technician)/(tabs)/technician.records")}
          variant="detail"
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, fontSize: 15 }}>
            Record details not available.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const farmer = item.farmerId || {};
  const animal = item.animalId || (item.animalIds && item.animalIds[0]) || {};

  const dateRaw = getDisplayDate(item);
  const date = dateRaw
    ? new Date(dateRaw).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";
  const time = dateRaw
    ? new Date(dateRaw).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  const address = farmer.address
    ? [farmer.address.street, farmer.address.barangay, farmer.address.city]
        .filter(Boolean)
        .join(", ")
    : "No address provided";

  const handleCall = () => {
    const phone = farmer.address?.phoneNumber || farmer.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const status = item.status?.toUpperCase() || "COMPLETED";
  const statusColor =
    item.status === "pending"
      ? "#f59e0b"
      : item.status === "rejected"
        ? "#ef4444"
        : "#10b981";

  const titleText =
    item.type === "insemination"
      ? "AI Insemination"
      : item.type === "health-request"
        ? item.title || "Health Record"
        : item.type === "pregnancy"
          ? "Pregnancy Check"
          : item.type === "calving"
            ? "Calving / Offspring"
            : "Medical Record";

  return (
    <ScreenLayout edges={[]}>
      <AppPageHeader
        title="Record Details"
        showBackButton={true}
        onBack={() => safeBack("/(technician)/(tabs)/technician.records")}
        variant="detail"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Record Type Header & Status Card */}
        <View
          className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Outfit_900Black",
                color: isDark ? colors.primary : PRIMARY,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              OFFICIAL SERVICE RECORD
            </Text>
            <View
              style={{
                backgroundColor: `${statusColor}20`,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_800ExtraBold",
                  color: statusColor,
                }}
              >
                {status}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 22,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
            }}
          >
            {titleText}
          </Text>
        </View>

        {/* Farmer Info & Location Card */}
        <View
          className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.card,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: isDark ? "rgba(16,185,129,0.3)" : "#a7f3d0",
                overflow: "hidden",
              }}
            >
              {farmer.imageUrl || farmer.photoUrl || farmer.image ? (
                <Image
                  source={{ uri: farmer.imageUrl || farmer.photoUrl || farmer.image }}
                  style={{ width: 56, height: 56 }}
                />
              ) : (
                <MaterialCommunityIcons
                  name="account"
                  size={30}
                  color={isDark ? colors.primary : PRIMARY}
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontFamily: "Outfit_800ExtraBold",
                  color: colors.textPrimary,
                }}
              >
                {farmer.name || "Unknown Farmer"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textSecondary,
                  marginTop: 1,
                }}
              >
                Farmer Owner
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCall}
              accessibilityRole="button"
              accessibilityLabel="Call farmer"
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: isDark ? colors.primary : PRIMARY,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Phone size={19} color="#fff" />
            </TouchableOpacity>
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: 14,
            }}
          />

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MapPin size={16} color={isDark ? colors.primary : PRIMARY} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                  flex: 1,
                }}
              >
                {address}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Calendar size={16} color={isDark ? colors.primary : PRIMARY} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                {date}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Clock size={16} color={isDark ? colors.primary : PRIMARY} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                {time}
              </Text>
            </View>
          </View>
        </View>

        {/* Technical Details Card */}
        <View
          className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_700Bold",
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Technical Specifications
          </Text>

          {item.type === "insemination" && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                  Attempt Number
                </Text>
                <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_800ExtraBold", fontSize: 13 }}>
                  #{item.attemptNumber || 1}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                  Sire Code
                </Text>
                <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_800ExtraBold", fontSize: 13 }}>
                  {item.sireCode || "N/A"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                  Pregnancy Status
                </Text>
                <Text
                  style={{
                    color: item.pregnancyStatus === "Pregnant" ? "#10b981" : colors.textSecondary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 13,
                  }}
                >
                  {item.pregnancyStatus || "Pending"}
                </Text>
              </View>
            </View>
          )}

          {item.type === "health-request" && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                  Service Type
                </Text>
                <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_800ExtraBold", fontSize: 13 }}>
                  {item.title || item.typeOfService || "Medical Check"}
                </Text>
              </View>
              {item.details?.medicineName ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.textMuted, fontFamily: "Outfit_600SemiBold", fontSize: 12 }}>
                    Medicine Administered
                  </Text>
                  <Text style={{ color: isDark ? colors.primary : "#047857", fontFamily: "Outfit_800ExtraBold", fontSize: 13 }}>
                    {item.details.medicineName}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {(item.note || item.technicianNote || item.remarks) ? (
            <View
              style={{
                marginTop: 12,
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.textMuted,
                  fontFamily: "Outfit_700Bold",
                  fontSize: 10,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Remarks / Notes
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                &quot;{item.note || item.technicianNote || item.remarks}&quot;
              </Text>
            </View>
          ) : null}
        </View>

        {/* Target Animal Card */}
        <View
          className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#eff6ff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="cow" size={24} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textPrimary,
                }}
              >
                Target: {animal.earTag || animal.animalId || "No Tag"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                {animal.breed || "Unknown Breed"} · {animal.species || "Cattle"}
              </Text>
            </View>
          </View>

          {animal._id || animal.id ? (
            <TouchableOpacity
              onPress={() =>
                router.push(`/(technician)/animal-details?id=${animal._id || animal.id}` as any)
              }
              accessibilityRole="button"
              accessibilityLabel="View animal profile"
              style={{
                marginTop: 14,
                backgroundColor: isDark ? colors.primary : PRIMARY,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Outfit_700Bold",
                  fontSize: 14,
                }}
              >
                View Animal Profile
              </Text>
              <ChevronRight size={17} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
