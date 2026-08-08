import React, { useMemo } from "react";
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  MapPin,
  Calendar,
  Clock,
  Phone,
  Stethoscope,
  Syringe,
  FileText,
  User,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { safeBack } from "@/utils/navigation";
import { formatAnimalRecord } from "@/features/animal-records/utils/recordPresentation";
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { getAnimalRecords } from "@/features/animal-records/services/animalRecords.service";
import { getAnimalMedicalRecords } from "@/features/animals/services/animals.service";
import { getFarmerActivity } from "@/features/farmer-reports/services/farmerReports.service";
import { useAnimalDetailsQuery } from "@/features/animals/hooks/useAnimalDetails";

const PRIMARY = "#00643B";

export default function RecordDetailsScreen() {
  const api = useApi();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    animalId?: string;
    recordId?: string;
    recordType?: string;
    recordData?: string;
  }>();

  // Parse the record data from URL params
  const parsedRecord = useMemo(() => {
    if (!params.recordData) return null;
    try {
      const parsed = JSON.parse(decodeURIComponent(params.recordData));
      return parsed;
    } catch (e) {
      console.error("Failed to parse record data:", e);
      return null;
    }
  }, [params.recordData]);

  // Canonical identifier params are preferred. recordData remains readable
  // only for older callers such as the existing Technician Records list.
  const recordId = useMemo(() => {
    return (
      params.recordId ||
      params.id ||
      parsedRecord?.sourceId ||
      parsedRecord?._id ||
      parsedRecord?.id ||
      null
    );
  }, [params.recordId, params.id, parsedRecord]);

  const animalId = useMemo(() => {
    if (params.animalId) return params.animalId;
    if (!parsedRecord) return null;
    if (typeof parsedRecord.animalId === "string") return parsedRecord.animalId;
    if (
      typeof parsedRecord.animalId === "object" &&
      parsedRecord.animalId?._id
    ) {
      return parsedRecord.animalId._id;
    }
    return parsedRecord.animalId || null;
  }, [params.animalId, parsedRecord]);

  const animalQuery = useAnimalDetailsQuery(animalId || "");

  // Query 1: Fetch animal records to find the full record data
  const recordsQuery = useQuery({
    queryKey: ["animal-records", "technician-detail", animalId],
    queryFn: () =>
      getAnimalRecords(api, animalId || "", {
        page: 1,
        limit: 100,
      }),
    enabled: !!animalId && !!recordId,
  });

  // Query 2: Fetch medical records as fallback
  const medicalRecordsQuery = useQuery({
    queryKey: ["animal-records", "medical", "technician", animalId],
    queryFn: () => getAnimalMedicalRecords(api, animalId || ""),
    enabled: !!animalId && !!recordId,
  });

  // Query 3: Fetch activity feed as final backup
  const activityQuery = useQuery({
    queryKey: ["user", "activity", "technician"],
    queryFn: () => getFarmerActivity(api),
    enabled: !!recordId,
  });

  // Find the full record from the fetched data
  const fullRecord = useMemo(() => {
    if (!recordId) return parsedRecord;

    // Search in animal records first
    const historyRec = (recordsQuery.data?.data || []).find(
      (r: any) =>
        String(r.sourceId || "") === String(recordId) ||
        String(r._id || "") === String(recordId) ||
        String(r.id || "") === String(recordId),
    );
    if (historyRec) return historyRec;

    // Search in medical records as fallback
    const medRec = (medicalRecordsQuery.data || []).find(
      (r: any) =>
        String(r.sourceId || "") === String(recordId) ||
        String(r._id || "") === String(recordId) ||
        String(r.id || "") === String(recordId),
    );
    if (medRec) return medRec;

    // Search in activity feed
    const actRec = (activityQuery.data || []).find(
      (r: any) =>
        String(r.sourceId || "") === String(recordId) ||
        String(r.id || "") === String(recordId) ||
        String(r._id || "") === String(recordId),
    );
    if (actRec) return actRec;

    // Compatibility fallback for callers still sending recordData.
    return parsedRecord;
  }, [
    recordId,
    parsedRecord,
    recordsQuery.data,
    medicalRecordsQuery.data,
    activityQuery.data,
  ]);

  const isLoading =
    animalQuery.isLoading ||
    recordsQuery.isLoading ||
    medicalRecordsQuery.isLoading ||
    activityQuery.isLoading;

  const item = fullRecord || parsedRecord;

  if (isLoading) {
    return (
      <ScreenLayout edges={[]}>
        <AppPageHeader
          title="Record Details"
          showBackButton={true}
          onBack={() => safeBack("/(technician)/(tabs)/technician.records")}
          variant="detail"
        />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenLayout>
    );
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
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              color: colors.textSecondary,
              fontSize: 15,
            }}
          >
            Record details not available.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  // The animal endpoint supplies canonical owner/animal context because
  // individual record rows intentionally carry identifiers in many cases.
  const farmer = (() => {
    if (typeof item.farmerId === "object" && item.farmerId) {
      return item.farmerId;
    }
    // If farmerId is a string, try to find it in the record data
    if (typeof item.farmerId === "string" && item.farmerDetails) {
      return item.farmerDetails;
    }
    // Check if farmer data is nested
    if (item.farmer) {
      return item.farmer;
    }
    if (
      animalQuery.data?.farmerId &&
      typeof animalQuery.data.farmerId === "object"
    ) {
      return animalQuery.data.farmerId;
    }
    return {};
  })();

  const animal = (() => {
    if (typeof item.animalId === "object" && item.animalId) {
      return item.animalId;
    }
    if (item.animal) {
      return item.animal;
    }
    return animalQuery.data || {};
  })();

  // Get presentation data
  const presentation = formatAnimalRecord(item, animal);

  // Determine record type
  const recordKind = item.recordKind || item.type || params.recordType || "";
  const isAI =
    recordKind === "insemination" ||
    recordKind === "ai" ||
    item.inseminationDate ||
    item.sireCode;
  const isHealth =
    presentation.category === "Health" ||
    recordKind === "health_request" ||
    recordKind === "medical_record" ||
    recordKind === "health" ||
    item.requestType ||
    item.symptoms;
  const isPregnancy =
    recordKind === "pregnancy" ||
    item.pregnancyDiagnosis ||
    item.pregnancyStatus;
  const isCalving =
    recordKind === "calving" ||
    item.outcome === "live_birth" ||
    item.outcome === "stillbirth" ||
    item.calvingEase;

  // Get the date
  const dateRaw =
    item.recordDate ||
    item.date ||
    item.createdAt ||
    item.inseminationDate ||
    item.scheduledDate ||
    item.activityDate;
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

  // Get farmer info
  const farmerName = farmer?.name || farmer?.fullName || "Unknown Farmer";
  const farmerPhone =
    farmer?.phoneNumber ||
    farmer?.contact ||
    farmer?.phone ||
    farmer?.address?.phoneNumber ||
    null;

  // Get farmer address
  const farmerAddress = (() => {
    if (!farmer) return "No address provided";
    const address = farmer.address;
    if (address) {
      const parts = [address.street, address.barangay, address.city].filter(
        Boolean,
      );
      if (parts.length > 0) return parts.join(", ");
    }
    const farmLocation = farmer.farmLocation;
    if (farmLocation) {
      const parts = [farmLocation.barangay, farmLocation.city].filter(Boolean);
      if (parts.length > 0) return `Brgy. ${parts.join(", ")}`;
    }
    return "No address provided";
  })();

  const handleCall = () => {
    if (farmerPhone) Linking.openURL(`tel:${farmerPhone}`);
  };

  // Status
  const status = item.status || item.outcomeVerificationStatus || "COMPLETED";
  const statusColor =
    status === "pending" || status === "Pending"
      ? "#f59e0b"
      : status === "in-progress" || status === "In Progress"
        ? "#3b82f6"
        : status === "rejected" || status === "Rejected"
          ? "#ef4444"
          : status === "resolved" || status === "Resolved"
            ? "#10b981"
            : status === "done" ||
                status === "completed" ||
                status === "Completed"
              ? "#10b981"
              : "#10b981";

  // Title
  const titleText =
    presentation?.pageTitle ||
    item.title ||
    (isAI
      ? "AI Insemination"
      : isHealth
        ? "Health Record"
        : isPregnancy
          ? "Pregnancy Check"
          : isCalving
            ? "Calving Record"
            : "Record");

  // Get icon
  const getIcon = () => {
    if (isHealth) return <Stethoscope size={20} color={PRIMARY} />;
    if (isPregnancy || isCalving)
      return <MaterialCommunityIcons name="cow" size={20} color={PRIMARY} />;
    if (isAI) return <Syringe size={20} color={PRIMARY} />;
    return <FileText size={20} color={PRIMARY} />;
  };

  // Get record type label
  const getRecordTypeLabel = () => {
    if (isAI) return "AI SERVICE";
    if (isHealth) return "HEALTH RECORD";
    if (isPregnancy) return "PREGNANCY CHECK";
    if (isCalving) return "CALVING RECORD";
    return "RECORD";
  };

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
          style={{
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {getIcon()}
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_900Black",
                  color: isDark ? colors.primary : PRIMARY,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {getRecordTypeLabel()}
              </Text>
            </View>
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
                {typeof status === "string"
                  ? status.toUpperCase()
                  : "COMPLETED"}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 20,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
            }}
          >
            {titleText}
          </Text>
        </View>

        {/* Farmer Info & Location Card */}
        <View
          style={{
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
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
              {farmer?.imageUrl || farmer?.photoUrl || farmer?.image ? (
                <Image
                  source={{
                    uri: farmer.imageUrl || farmer.photoUrl || farmer.image,
                  }}
                  style={{ width: 56, height: 56 }}
                />
              ) : (
                <User size={30} color={isDark ? colors.primary : PRIMARY} />
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
                {farmerName}
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
            {farmerPhone && (
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
            )}
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginVertical: 14,
            }}
          />

          <View style={{ gap: 10 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <MapPin size={16} color={isDark ? colors.primary : PRIMARY} />
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                  flex: 1,
                }}
              >
                {farmerAddress}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
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
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
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

        {/* Details Card */}
        <View
          style={{
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_700Bold",
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Record Details
          </Text>

          {presentation?.details && presentation.details.length > 0 && (
            <View style={{ gap: 8 }}>
              {presentation.details.map((detail: string, index: number) => (
                <View
                  key={index}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    •
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 13,
                      flex: 1,
                    }}
                  >
                    {detail}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* AI specific details */}
          {isAI && (
            <View style={{ marginTop: 12, gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 12,
                  }}
                >
                  Attempt Number
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 13,
                  }}
                >
                  #{item.attemptNumber || 1}
                </Text>
              </View>
              {item.sireCode && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    Sire Code
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 13,
                    }}
                  >
                    {item.sireCode}
                  </Text>
                </View>
              )}
              {item.outcome && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    Outcome
                  </Text>
                  <Text
                    style={{
                      color:
                        item.outcome === "Pregnant" ||
                        item.outcome === "pregnant"
                          ? "#10b981"
                          : colors.textSecondary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 13,
                    }}
                  >
                    {item.outcome}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Health specific details */}
          {isHealth && (
            <View style={{ marginTop: 12, gap: 10 }}>
              {item.requestType && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    Request Type
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 13,
                    }}
                  >
                    {item.requestType}
                  </Text>
                </View>
              )}
              {item.symptoms && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    Symptoms
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 13,
                      flex: 1,
                      textAlign: "right",
                    }}
                  >
                    {item.symptoms}
                  </Text>
                </View>
              )}
              {item.details?.diagnosis && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    Diagnosis
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 13,
                    }}
                  >
                    {item.details.diagnosis}
                  </Text>
                </View>
              )}
              {item.details?.treatment && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    Treatment
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_800ExtraBold",
                      fontSize: 13,
                    }}
                  >
                    {item.details.treatment}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {(item.note ||
            item.technicianNote ||
            item.notes ||
            item.details?.advice) && (
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
                Notes
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                }}
              >
                {item.note ||
                  item.technicianNote ||
                  item.notes ||
                  item.details?.advice}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
