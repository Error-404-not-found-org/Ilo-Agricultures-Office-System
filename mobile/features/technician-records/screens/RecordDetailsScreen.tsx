import React, { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { Activity } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AppPageHeader } from "@/components/AppPageHeader";
import { ScreenLayout } from "@/components/ScreenLayout";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { safeBack } from "@/utils/navigation";
import { useOfficialRecordDetail } from "@/features/farmer-reports/hooks/useOfficialRecordDetail";
import type { OfficialRecordKind } from "@/features/farmer-reports/types/farmerReports.types";
import { TechnicianOfficialRecordContent } from "../components/TechnicianOfficialRecordContent";

const OFFICIAL_KINDS = new Set<OfficialRecordKind>([
  "insemination",
  "pregnancy",
  "calving",
  "medical_record",
]);

const canonicalKind = (value: unknown): OfficialRecordKind | undefined => {
  const normalized = String(value || "").trim().toLowerCase();
  if (OFFICIAL_KINDS.has(normalized as OfficialRecordKind)) {
    return normalized as OfficialRecordKind;
  }
  if (["ai", "ai-request"].includes(normalized)) return "insemination";
  if (["medical", "medical-record"].includes(normalized))
    return "medical_record";
  return undefined;
};

export default function RecordDetailsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    animalId?: string;
    sourceId?: string;
    sourceKind?: string;
    recordId?: string;
    recordType?: string;
    recordData?: string;
  }>();

  const legacyRecord = useMemo(() => {
    if (!params.recordData) return null;
    try {
      return JSON.parse(decodeURIComponent(params.recordData));
    } catch {
      return null;
    }
  }, [params.recordData]);

  const animalId = useMemo(() => {
    const candidate = params.animalId || legacyRecord?.animalId;
    if (typeof candidate === "string") return candidate;
    return candidate?._id || candidate?.id || "";
  }, [legacyRecord, params.animalId]);

  const sourceId =
    params.sourceId ||
    params.recordId ||
    params.id ||
    legacyRecord?.sourceId ||
    legacyRecord?._id ||
    legacyRecord?.id ||
    "";
  const sourceKind = canonicalKind(
    params.sourceKind ||
      legacyRecord?.recordKind ||
      params.recordType ||
      legacyRecord?.type,
  );

  const recordQuery = useOfficialRecordDetail({
    animalId,
    sourceId,
    sourceKind,
  });
  const record = recordQuery.data;
  const hasCanonicalIdentity = Boolean(animalId && sourceId && sourceKind);

  const getHeaderTitle = () => {
    if (!record) return "Record Details";
    switch (record.type) {
      case "ai":
        return "Artificial Insemination";
      case "pregnancy":
        return "Pregnancy Check";
      case "calving":
        return "Calving Record";
      case "health":
        return "Health Record";
      default:
        return record.title || "Record Details";
    }
  };

  const goBack = () => safeBack("/(technician)/(tabs)/technician.records");

  return (
    <ScreenLayout edges={[]} contentStyle={{ minHeight: 0 }}>
      <AppPageHeader
        title={getHeaderTitle()}
        showBackButton
        onBack={goBack}
        variant="detail"
      />

      {recordQuery.isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            textRole="body"
            style={{ color: colors.textSecondary, marginTop: 12 }}
          >
            Loading the official record…
          </Text>
        </View>
      ) : !record ? (
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
              fontFamily: "Outfit_700Bold",
              fontSize: 18,
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            {recordQuery.isError
              ? "Official record could not be loaded"
              : "Record link is incomplete"}
          </Text>
          <Text
            textRole="body"
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 8,
              lineHeight: 21,
            }}
          >
            {recordQuery.isError
              ? "Check your connection and try loading the saved backend record again."
              : hasCanonicalIdentity
                ? "This record is no longer available."
                : "Open this item again from Technician Records so its animal and record identifiers are included."}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={recordQuery.isError ? "Try loading record again" : "Go back"}
            onPress={() => {
              if (recordQuery.isError) {
                void recordQuery.refetch();
                return;
              }
              goBack();
            }}
            style={{
              minHeight: 48,
              marginTop: 20,
              paddingHorizontal: 22,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: colors.primary,
            }}
          >
            <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
              {recordQuery.isError ? "Try Again" : "Go Back"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          overScrollMode="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 72,
          }}
        >
          <TechnicianOfficialRecordContent record={record} />

          {record.actions.pregnancyTrackerAvailable && animalId ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open pregnancy tracker"
              onPress={() =>
                router.push({
                  pathname: "/(technician)/pregnancy-tracker",
                  params: { id: animalId },
                })
              }
              style={{
                minHeight: 48,
                marginTop: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 12,
                backgroundColor: colors.primary,
              }}
            >
              <Activity size={18} color={colors.onPrimary} />
              <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
                View Pregnancy Tracker
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </ScreenLayout>
  );
}
