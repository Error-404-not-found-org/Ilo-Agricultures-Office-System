import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Share2 } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Skeleton } from "@/components/ui/Skeleton";
import { getHealthRequestDetail } from "@/features/health-requests/services/healthRequests.service";
import {
  FarmerScreen,
  AsyncState,
  StatusBadge,
} from "@/features/farmer-ui/components";
import { AppPageHeader, AppHeaderIconButton } from "@/components/AppPageHeader";

const clean = (value: unknown) =>
  String(value || "N/A").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
      char
    ] || char,
  );

function HealthReportPreviewSkeleton() {
  const { colors } = useTheme();

  return (
    <FarmerScreen scroll contentContainerStyle={{ paddingBottom: 48 }}>
      <AppPageHeader
        title="Health Report"
        rightAction={
          <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <Skeleton width={36} height={36} radius={12} />
          </View>
        }
      />

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

        {[1, 2, 3, 4, 5, 6, 7].map((row) => (
          <View
            key={row}
            className="py-3 border-b"
            style={{ borderBottomColor: colors.border }}
          >
            <Skeleton width={row % 2 === 0 ? "24%" : "32%"} height={9} radius={2} />
            <Skeleton width="92%" height={12} radius={3} style={{ marginTop: 8 }} />
            {row === 3 || row === 6 ? (
              <Skeleton width="64%" height={12} radius={3} style={{ marginTop: 6 }} />
            ) : null}
          </View>
        ))}
      </View>

      <Skeleton
        width="90%"
        height={46}
        radius={8}
        style={{ alignSelf: "center" }}
      />
    </FarmerScreen>
  );
}

export default function HealthReportPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { colors } = useTheme();

  const query = useQuery({
    queryKey: ["health-request", id, "report"],
    enabled: Boolean(id),
    queryFn: () => getHealthRequestDetail(api, id),
  });

  if (query.isLoading) {
    return <HealthReportPreviewSkeleton />;
  }

  if (query.isError || !query.data) {
    return (
      <FarmerScreen style={{ justifyContent: "center", alignItems: "center" }}>
        <AsyncState state="error" onAction={() => query.refetch()} />
      </FarmerScreen>
    );
  }

  const request: any = query.data;
  const animal: any = request.animalId || {};
  const farmer: any = request.farmerId || {};

  const share = async () => {
    const rows = [
      ["Animal", animal.earTag || animal.animalId],
      ["Farmer", farmer.name],
      ["Concern", request.requestType],
      ["Urgency", request.urgency],
      ["Symptoms", request.symptoms],
      ["Findings", request.findings],
      ["Diagnosis", request.diagnosis],
      ["Treatment", request.treatment],
      ["Medicine", request.medicineGiven],
      ["Dosage", request.dosage],
      ["Follow-up", request.followUpDate],
      ["Resolution", request.resolutionNotes],
    ];

    const html = `<html><body style="font-family:Arial;padding:32px;color:#17201a"><h1 style="color:#00643B">BreedSmart Health Report</h1><p>Iloilo Livestock Health Record</p>${rows
      .map(
        ([label, value]) =>
          `<div style="border-bottom:1px solid #ddd;padding:10px 0"><b>${clean(label)}</b><br/>${clean(value)}</div>`,
      )
      .join(
        "",
      )}<p style="margin-top:28px;font-size:11px;color:#667069">Generated from BreedSmart. This report documents recorded assistance and does not replace veterinary certification.</p></body></html>`;

    const result = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share health report",
      });
    }
  };

  return (
    <FarmerScreen scroll contentContainerStyle={{ paddingBottom: 48 }}>
      <AppPageHeader
        title="Health Report"
        rightAction={
          <AppHeaderIconButton onPress={share} accessibilityLabel="Share Report">
            <Share2 size={20} color={colors.textPrimary} />
          </AppHeaderIconButton>
        }
      />

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
            color: colors.primary,
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
          Animal Health Assistance Report
        </Text>

        <View className="mt-5 flex-row justify-between">
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_700Bold",
              fontSize: 16,
            }}
          >
            {animal.earTag || animal.animalId}
          </Text>
          <StatusBadge label={request.status} />
        </View>

        {[
          ["Farmer", farmer.name],
          ["Concern", request.requestType?.replaceAll("_", " ")],
          ["Symptoms", request.symptoms],
          ["Findings", request.findings],
          ["Diagnosis", request.diagnosis],
          ["Treatment", request.treatment],
          ["Medicine", request.medicineGiven],
          ["Dosage", request.dosage],
          ["Follow-up", request.followUpDate],
          ["Resolution", request.resolutionNotes],
        ].map(([label, value]) => (
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
              {value || "N/A"}
            </Text>
          </View>
        ))}
      </View>

      {/* Share Button */}
      <TouchableOpacity
        onPress={share}
        className="mx-5 py-3.5 flex-row items-center justify-center"
        style={{ borderRadius: 8, backgroundColor: colors.primary }}
      >
        <Share2 size={17} color="white" />
        <Text
          className="text-white ml-2"
          style={{ fontFamily: "Outfit_700Bold", fontSize: 12 }}
        >
          Generate and share PDF
        </Text>
      </TouchableOpacity>
    </FarmerScreen>
  );
}
