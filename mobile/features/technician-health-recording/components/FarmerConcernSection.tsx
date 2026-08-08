import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { FileText } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { SectionCard } from "./HealthUI";

export default function FarmerConcernSection({ request }: { request: any }) {
  const { colors } = useTheme();
  
  if (!request) return null;
  const symptomsText = Array.isArray(request?.symptoms)
    ? request.symptoms.filter(Boolean).join(", ")
    : String(request?.symptoms || "").trim();

  const farmerNotesText = Array.isArray(request?.farmerNotes)
    ? request.farmerNotes.filter(Boolean).join("\n\n")
    : String(request?.farmerNotes || "").trim();

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
            Reported Symptoms
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
            {symptomsText || "No symptoms provided"}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              marginTop: 12,
            }}
          >
            Farmer notes
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
            {farmerNotesText || "No farmer note provided"}
          </Text>
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
