import React from "react";
import { Text, TouchableOpacity, View, StatusBar } from "react-native";
import { ArrowLeft, Share2 } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

function AIReportPreviewSkeleton() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <FarmerScreen scroll contentContainerStyle={{ paddingBottom: 48 }}>
      <StatusBar barStyle="light-content" />

      <View
        className="px-5 pb-5 flex-row items-center"
        style={{
          backgroundColor: colors.primary,
          paddingTop: insets.top + 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>

        <View className="flex-1 ml-3">
          <Skeleton
            width="48%"
            height={18}
            radius={4}
            style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
          />
        </View>

        <Skeleton
          width={40}
          height={40}
          radius={20}
          style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
        />
      </View>

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
    </FarmerScreen>
  );
}

export default function AIReportPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
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
        outcome: d.pregnancyStatus || d.outcome,
        technician: d.technicianId?.name || d.handledBy?.name || "N/A",
        technicianNote: d.technicianNote || d.notes || "",
      },
    };
  }, [query.data]);

  if (query.isLoading) {
    return <AIReportPreviewSkeleton />;
  }

  if (query.isError || !record) {
    return (
      <FarmerScreen style={{ justifyContent: "center", alignItems: "center" }}>
        <AsyncState state="error" onAction={() => query.refetch()} />
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

  return (
    <FarmerScreen scroll contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header */}
      <View
        className="px-5 pb-5 flex-row items-center"
        style={{
          backgroundColor: primaryColor,
          paddingTop: insets.top + 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>
        <Text
          className="flex-1 ml-3 text-white"
          style={{ fontFamily: "Outfit_700Bold", fontSize: 20 }}
        >
          AI Service Report
        </Text>
        <TouchableOpacity
          onPress={share}
          className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
        >
          <Share2 size={19} color="white" />
        </TouchableOpacity>
      </View>

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

        <View className="mt-5 flex-row justify-between">
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_700Bold",
              fontSize: 16,
            }}
          >
            Animal: {animal.earTag || animal.animalId || "N/A"}
          </Text>
          <StatusBadge label={record.details?.outcome || "Pending"} />
        </View>

        {([
          ["Sire Breed", record.details?.sireBreed],
          ["Sire Code", record.details?.sireCode],
          ["Attempt Number", record.details?.attemptNumber?.toString()],
          ["Estrus Type", record.details?.estrus],
          ["Technician", record.details?.technician],
          ["Notes / Observations", record.details?.technicianNote],
        ] as [string, string | undefined][]).map(([label, value]) => (
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
    </FarmerScreen>
  );
}
