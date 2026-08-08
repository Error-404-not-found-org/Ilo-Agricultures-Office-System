import React, { useCallback, useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { FileText, Activity } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useAnimalDetailsQuery } from "@/features/animals/hooks/useAnimalDetails";
import { getAnimalMedicalRecords } from "@/features/animals/services/animals.service";
import {
  getFarmerActivity,
  mapHealthMedicalRecordDetails,
} from "@/features/farmer-reports/services/farmerReports.service";
import { getAnimalRecords } from "@/features/animal-records/services/animalRecords.service";
import { RecordDetailContent } from "@/features/farmer-reports/components/RecordDetailContent";
import type { ActivityFeedItem } from "@/features/farmer-reports/types/farmerReports.types";
import { FarmerScreen } from "@/features/farmer-ui/components";
import { AppPageHeader } from "@/components/AppPageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatAnimalRecord } from "@/features/animal-records/utils/recordPresentation";

type RecordActivity = ActivityFeedItem & {
  sourceKind?: string;
  sourceId?: string;
  reportId?: string;
};

export default function AnimalRecordDetailScreen() {
  const { animalId, recordId, recordType } = useLocalSearchParams<{
    animalId: string;
    recordId: string;
    recordType?: string;
  }>();

  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  const primaryColor = isDark ? colors.primary : "#00643B";

  // Query 1: Animal details
  const animalQuery = useAnimalDetailsQuery(animalId || "");

  // Query 2: Same source used by Animal Details Records tab.
  const recordsQuery = useQuery({
    queryKey: ["animal-records", "records-detail", animalId],
    queryFn: () =>
      getAnimalRecords(api, animalId || "", {
        page: 1,
        limit: 100,
      }),
    enabled: !!animalId,
  });

  // Query 3: Medical records list for fallback compatibility.
  const medicalRecordsQuery = useQuery({
    queryKey: ["animal-records", "medical", animalId],
    queryFn: () => getAnimalMedicalRecords(api, animalId || ""),
    enabled: !!animalId,
  });

  // Query 4: Activity feed as final backup.
  const activityQuery = useQuery({
    queryKey: ["user", "activity"],
    queryFn: () => getFarmerActivity(api),
  });

  const isLoading =
    animalQuery.isLoading ||
    recordsQuery.isLoading ||
    medicalRecordsQuery.isLoading ||
    activityQuery.isLoading;

  const mapRecordToActivity = useCallback((
    record: any,
    sourceHint = "",
  ): RecordActivity => {
    const sourceKind = record.recordKind || sourceHint || recordType || record.type;
    const isMedicalRecord = sourceKind === "medical_record";
    const isAiRecord =
      sourceKind === "insemination" ||
      record.type === "insemination" ||
      record.type === "ai";
    const isPregnancyRecord =
      sourceKind === "pregnancy" ||
      record.type === "pregnancy" ||
      record.type === "Pregnancy";
    const isCalvingRecord =
      sourceKind === "calving" ||
      record.type === "calving" ||
      record.type === "Calving";
    const presentation = formatAnimalRecord(record, animalQuery.data);

    const type: ActivityFeedItem["type"] = isAiRecord
      ? "ai"
      : isPregnancyRecord
        ? "pregnancy"
      : isCalvingRecord
        ? "calving"
        : "health";

    return {
      id: record._id || record.id,
      sourceId: record.sourceId || record._id || record.id,
      reportId: record.sourceId || record._id || record.id,
      sourceKind,
      type,
      title: presentation.pageTitle,
      description:
        presentation.details.join(" · ") ||
        record.description ||
        record.comment ||
        record.summary ||
        "",
      date: record.recordDate || record.date || record.createdAt,
      animalId: {
        ...(animalQuery.data || {}),
        ...(record.animalId && typeof record.animalId === "object"
          ? record.animalId
          : {}),
        _id:
          (record.animalId && typeof record.animalId === "object"
            ? record.animalId._id
            : record.animalId) ||
          animalQuery.data?._id ||
          animalId,
      },
      details: isMedicalRecord
        ? mapHealthMedicalRecordDetails(record, {
            recordDate: record.recordDate || record.date,
            enteredAt: record.createdAt,
            technicianId: record.technicianId,
          })
        : record.details || {
            status: record.status,
            requestType: record.requestType,
            symptoms: record.symptoms,
            urgency: record.urgency,
            diagnosis: record.diagnosis,
            treatment: record.treatment,
            advice:
              record.advice ||
              record.comment ||
              record.note ||
              record.technicianNote ||
              "",
            serviceDate: record.recordDate || record.date
              ? new Date(record.recordDate || record.date).toLocaleDateString()
              : undefined,
            entryDate: record.createdAt
              ? new Date(record.createdAt).toLocaleDateString()
              : undefined,
            sireBreed: record.sireBreed,
            sireCode: record.sireCode,
            attemptNumber: record.attemptNumber,
            previousAttempt: record.previousAttemptReference,
            nextAttempt: record.nextAttemptReference,
            failureReason: record.failureReason,
            estrus: record.estrus || record.estrusType,
            outcome:
              record.pregnancyDiagnosis?.result ||
              record.pregnancyStatus ||
              record.outcome,
            targetCalvingDate: record.targetCalvingDate,
            diagnosticMethod: record.confirmation?.methodCode,
            confirmationStage: record.confirmation?.stage,
            recheckStatus: record.recheckStatus,
            relatedAttempt: record.inseminationId?.attemptNumber,
            technician:
              record.technicianId?.name || record.handledBy?.name || "",
            technicianNote:
              record.technicianNote || record.note || record.notes,
            calvingEase: record.calvingEase,
            numberOfCalves: record.numberOfCalves,
            calvingOutcome: record.outcome,
            livingCalfCount: record.livingCalfCount,
            stillbornCount: record.stillbornCount,
            calves: record.calves,
          },
    };
  }, [animalId, animalQuery.data, recordType]);

  const foundRecord: RecordActivity | null = useMemo(() => {
    if (!recordId) return null;

    // Search the same source used by the Animal Details Records tab first.
    const historyRec = (recordsQuery.data?.data || []).find(
      (r: any) => r._id === recordId || r.id === recordId || r.sourceId === recordId,
    );
    if (historyRec) return mapRecordToActivity(historyRec, historyRec.recordKind);

    // Search in medical records as fallback.
    const medRec = (medicalRecordsQuery.data || []).find(
      (r: any) => r._id === recordId || r.id === recordId
    );
    if (medRec) return mapRecordToActivity(medRec, recordType || "medical_record");

    // Search in activity feed
    const actRec = (activityQuery.data || []).find(
      (r: any) => r.id === recordId || r._id === recordId
    );
    if (actRec) return mapRecordToActivity(actRec, actRec.type);

    return null;
  }, [
    recordId,
    recordType,
    recordsQuery.data,
    medicalRecordsQuery.data,
    activityQuery.data,
    mapRecordToActivity,
  ]);

  if (isLoading) {
    return (
      <FarmerScreen scroll={false}>
        <AppPageHeader
          title="Record Detail"
        />
        <View style={{ margin: 20, padding: 20, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton width="46%" height={20} radius={6} />
            <Skeleton width={82} height={24} radius={12} />
          </View>
          <Skeleton width="62%" height={12} radius={5} style={{ marginTop: 12 }} />
          {[1, 2, 3, 4, 5].map((row) => (
            <View key={row} style={{ marginTop: 20 }}>
              <Skeleton width={row % 2 ? "32%" : "24%"} height={9} radius={4} />
              <Skeleton width={row === 5 ? "88%" : "58%"} height={14} radius={5} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      </FarmerScreen>
    );
  }

  if (!foundRecord) {
    return (
      <FarmerScreen scroll={false}>
        <AppPageHeader title="Record Detail" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              color: colors.textPrimary,
              fontSize: 18,
              textAlign: "center",
            }}
          >
            Record Not Found
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: "Outfit_500Medium",
              color: colors.textSecondary,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            We could not retrieve details for this record. It might have been deleted or no longer exists.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 24,
              paddingVertical: 12,
              paddingHorizontal: 24,
              backgroundColor: primaryColor,
              borderRadius: 16,
            }}
          >
            <Text style={{ fontFamily: "Outfit_700Bold", color: "#fff", fontSize: 13 }}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </FarmerScreen>
    );
  }

  const isPregnancyCheck =
    foundRecord.type === "health" &&
    (foundRecord.details?.requestType === "pregnancy_check" ||
      foundRecord.title?.toLowerCase().includes("pregnancy") ||
      foundRecord.details?.diagnosis?.toLowerCase().includes("pregnant"));

  const isPregnant =
    animalQuery.data?.reproductiveStatus === "Pregnant" ||
    foundRecord.details?.outcome === "Pregnant" ||
    foundRecord.details?.status === "Pregnant";
  const canPreviewHealthReport = foundRecord.sourceKind === "health_request";
  const canPreviewAiReport = foundRecord.type === "ai" && Boolean(foundRecord.reportId);

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader
        title={foundRecord.title || "Record Detail"}
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >

      {/* Card Content */}
      <View
        className="m-5 p-6 border"
        style={{
          borderRadius: 24,
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0 : 0.05,
          shadowRadius: 10,
          elevation: isDark ? 0 : 2,
        }}
      >
        <RecordDetailContent selectedActivity={foundRecord} />
      </View>

      {/* Actions */}
      <View className="px-5 gap-3">
        {canPreviewHealthReport && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(farmer)/health-report-preview",
                params: { id: foundRecord.reportId || foundRecord.id },
              })
            }
            className="py-3.5 flex-row items-center justify-center border"
            style={{
              borderRadius: 16,
              borderColor: primaryColor,
              backgroundColor: "transparent",
            }}
          >
            <FileText size={17} color={primaryColor} />
            <Text
              className="ml-2"
              style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: primaryColor }}
            >
              Preview Health Report
            </Text>
          </TouchableOpacity>
        )}

        {canPreviewAiReport && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(farmer)/ai-report-preview",
                params: { id: foundRecord.reportId || foundRecord.id },
              })
            }
            className="py-3.5 flex-row items-center justify-center border"
            style={{
              borderRadius: 16,
              borderColor: primaryColor,
              backgroundColor: "transparent",
            }}
          >
            <FileText size={17} color={primaryColor} />
            <Text
              className="ml-2"
              style={{ fontFamily: "Outfit_700Bold", fontSize: 13, color: primaryColor }}
            >
              Preview AI Report
            </Text>
          </TouchableOpacity>
        )}

        {(isPregnancyCheck || isPregnant) && animalId && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(farmer)/pregnancy-tracker",
                params: { id: animalId },
              })
            }
            className="py-3.5 flex-row items-center justify-center"
            style={{
              borderRadius: 16,
              backgroundColor: primaryColor,
            }}
          >
            <Activity size={17} color="white" />
            <Text
              className="text-white ml-2"
              style={{ fontFamily: "Outfit_700Bold", fontSize: 13 }}
            >
              View Pregnancy Tracker
            </Text>
          </TouchableOpacity>
        )}
      </View>
      </ScrollView>
    </FarmerScreen>
  );
}
