import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { FileText } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { SectionCard } from "./HealthUI";
import {
  getHealthRequestFarmerNote,
  getStructuredHealthRequestPresentation,
} from "@/features/farmer-requests/utils/healthRequestInput";

export default function FarmerConcernSection({ request }: { request: any }) {
  const { colors } = useTheme();
  
  if (!request) return null;
  const legacySymptomsText = Array.isArray(request?.symptoms)
    ? request.symptoms.filter(Boolean).join(", ")
    : String(request?.symptoms || "").trim();
  const structured = getStructuredHealthRequestPresentation(request);
  const farmerNotesText = getHealthRequestFarmerNote(request);

  const photos = Array.isArray(request?.photos)
    ? request.photos.filter(Boolean)
    : [];

  const attachmentUrls = [
    ...new Set([
      ...photos,
      request?.imageUrl || null,
    ].filter(Boolean)),
  ];

  return (
    <SectionCard title="Farmer-submitted Observations">
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <FileText size={18} color={colors.textMuted} />
        <View style={{ flex: 1, marginLeft: 9 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
            }}
          >
            {structured ? "Assistance Requested" : "Symptoms / Description"}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_500Medium",
              fontSize: 12,
              lineHeight: 18,
              marginTop: 3,
            }}
          >
            {structured?.assistanceLabel || legacySymptomsText || "Not provided"}
          </Text>
          {structured?.observedSigns.length ? (
            <>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                Observed Signs
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 3,
                }}
              >
                {structured.observedSigns.join(", ")}
              </Text>
            </>
          ) : null}
          {farmerNotesText ? (
            <>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                Farmer Note
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 3,
                }}
              >
                {farmerNotesText}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {attachmentUrls.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            Attachments ({attachmentUrls.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {attachmentUrls.map((url: string) => (
              <Image
                key={url}
                source={{ uri: url }}
                accessibilityLabel="Farmer-submitted health request attachment"
                style={{
                  width: 104,
                  height: 82,
                  borderRadius: 10,
                  marginRight: 8,
                  backgroundColor: colors.tint,
                }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </SectionCard>
  );
}
