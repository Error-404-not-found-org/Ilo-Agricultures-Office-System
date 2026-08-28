import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Share2 } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  FarmerScreen,
  AsyncState,
  StatusBadge,
} from "@/features/farmer-ui/components";
import { generateSingleRecordPdfHtml } from "@/features/farmer-reports/utils/reportPdfGenerator";
import type { ActivityFeedItem } from "@/features/farmer-reports/types/farmerReports.types";
import { AppPageHeader } from "@/components/AppPageHeader";
import { formatVisitSchedule } from "@/features/farmer-requests/utils/requestDetailPresentation";

function AIReportPreviewSkeleton() {
  const { colors } = useTheme();

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader title="AI Service Report" />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >

      <View
        className="m-5 p-5 border"
        style={{
          borderRadius: 8,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <Skeleton width="38%" height={22} radius={4} />
        <Skeleton width="54%" height={11} radius={3} style={{ marginTop: 8 }} />

        <View className="mt-5 flex-row justify-between items-center">
          <Skeleton width="36%" height={16} radius={4} />
          <Skeleton width={82} height={24} radius={12} />
        </View>

        {[1, 2, 3, 4, 5, 6].map((row) => (
          <View
            key={row}
            className="py-3 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Skeleton width={row % 2 === 0 ? "24%" : "32%"} height={9} radius={2} />
            <Skeleton width="92%" height={12} radius={3} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
      </ScrollView>
    </FarmerScreen>
  );
}

export default function AIReportPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { colors, isDark } = useTheme();
  const primaryColor = isDark ? colors.primary : "#00643B";

  const query = useQuery({
    queryKey: ["ai-request", id, "report"],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get(`/ai-request/${id}`);
      return res.data.data;
    },
  });

  const record: ActivityFeedItem | null = React.useMemo(() => {
    if (!query.data) return null;
    const d = query.data;
    return {
      id: d._id,
      type: "ai",
      title: "A.I. Insemination",
      description: "Artificial Insemination service record",
      date: d.inseminationDate || d.createdAt,
      animalId: d.animalId,
      details: {
        attemptNumber: d.attemptNumber,
        sireBreed: d.sireBreed,
        sireCode: d.sireCode,
        estrus: d.estrus || d.estrusType,
        outcome: d.pregnancyStatus || d.outcome || d.status,
        status: d.status,
        technician: d.technicianDisplayName || "",
        technicianPhone: d.technicianId?.phoneNumber || d.approvedBy?.phoneNumber || "",
        technicianNote: d.technicianNote || d.notes || "",
        serviceDate: d.inseminationDate,
        scheduledDate: d.scheduledDate,
        visitPeriod: d.visitPeriod,
        preferredDate: d.preferredDate,
        requestedAt: d.createdAt,
        outcomeVerificationStatus: d.outcomeVerificationStatus,
        outcomeConfirmationSource: d.outcomeConfirmationSource,
        outcomeConfirmedAt: d.outcomeConfirmedAt,
        previousAttemptNumber: d.previousAttemptId?.attemptNumber,
        previousAttemptDate: d.previousAttemptId?.inseminationDate,
      },
    };
  }, [query.data]);

  if (query.isLoading) {
    return <AIReportPreviewSkeleton />;
  }

  if (query.isError || !record) {
    return (
      <FarmerScreen>
        <AppPageHeader title="AI Service Report" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <AsyncState state="error" onAction={() => query.refetch()} />
        </View>
      </FarmerScreen>
    );
  }

  const share = async () => {
    try {
      const html = generateSingleRecordPdfHtml(record);
      const result = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share AI report",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const animal: any = record.animalId || {};
  const details: any = record.details || {};
  const formatDateTime = (value?: string) =>
    value
      ? new Date(value).toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Not recorded";
  const reportRows: [string, string][] = [
    ["Animal", animal.earTag || animal.animalId || "Not recorded"],
    ["Breed / Species", [animal.breed, animal.species].filter(Boolean).join(" / ") || "Not recorded"],
    ["Request status", details.status || "Not recorded"],
    ["Requested", formatDateTime(details.requestedAt)],
    [
      "Legacy preferred date",
      formatVisitSchedule(details.preferredDate, null) || "Not recorded",
    ],
    [
      "Scheduled visit",
      formatVisitSchedule(details.scheduledDate, details.visitPeriod) ||
        "Not recorded",
    ],
    ["AI performed", formatDateTime(details.serviceDate)],
    ["Attempt number", details.attemptNumber ? `Attempt ${details.attemptNumber}` : "Not recorded"],
    ["Sire breed", details.sireBreed || "Not recorded"],
    ["Sire code", details.sireCode || "Not recorded"],
    ["Estrus type", details.estrus || "Not recorded"],
    ["Technician", details.technician || "Not assigned"],
    ["Technician contact", details.technicianPhone || "Not provided"],
    ["Outcome", details.outcome || "Pending"],
    ["Outcome verification", details.outcomeVerificationStatus || "Pending"],
    ["Outcome confirmed", formatDateTime(details.outcomeConfirmedAt)],
    ["Notes / observations", details.technicianNote || "No notes recorded"],
  ];
  if (details.previousAttemptNumber) {
    reportRows.splice(9, 0, [
      "Previous attempt",
      `Attempt ${details.previousAttemptNumber} on ${formatDateTime(details.previousAttemptDate)}`,
    ]);
  }

  return (
    <FarmerScreen scroll={false}>
      <AppPageHeader
        title="AI Service Report"
        rightAction={
          <TouchableOpacity
            onPress={share}
            accessibilityRole="button"
            accessibilityLabel="Share AI report"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? colors.background : "#f0fdf4",
            }}
          >
            <Share2 size={18} color={primaryColor} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >

      {/* Report Card */}
      <View
        className="m-5 p-5 border"
        style={{
          borderRadius: 8,
          backgroundColor: colors.card,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            color: primaryColor,
            fontFamily: "Outfit_700Bold",
            fontSize: 21,
          }}
        >
          BreedSmart
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 11,
          }}
        >
          Iloilo Livestock Breeding Record
        </Text>

        <View className="mt-5 flex-row justify-between items-center">
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_700Bold",
              fontSize: 16,
            }}
          >
            {animal.earTag || animal.animalId || "Animal record"}
          </Text>
          <StatusBadge label={record.details?.outcome || "Pending"} />
        </View>

        {reportRows.map(([label, value]) => (
          <View
            key={label}
            className="py-3 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_700Bold",
                fontSize: 9,
              }}
            >
              {label.toUpperCase()}
            </Text>
            <Text
              className="mt-1"
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>

      {/* Share Button */}
      <TouchableOpacity
        onPress={share}
        className="mx-5 py-3.5 flex-row items-center justify-center"
        style={{ borderRadius: 8, backgroundColor: primaryColor }}
      >
        <Share2 size={17} color="white" />
        <Text
          className="text-white ml-2"
          style={{ fontFamily: "Outfit_700Bold", fontSize: 12 }}
        >
          Generate and share PDF
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </FarmerScreen>
  );
}
