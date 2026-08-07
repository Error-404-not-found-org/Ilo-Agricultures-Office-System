import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { FileText } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { SectionCard } from "./HealthUI";

export default function FarmerConcernSection({ request }: { request: any }) {
  const { colors } = useTheme();
  
  if (!request) return null;
  
  const attachmentUrls: string[] = request.attachments || request.photos || [];
  if (request.imageUrl && !attachmentUrls.includes(request.imageUrl)) {
    attachmentUrls.push(request.imageUrl);
  }

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
            {request.symptoms && request.symptoms.length > 0
              ? request.symptoms.join(", ")
              : "No symptoms provided"}
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
            {request.farmerNotes && request.farmerNotes.length > 0
              ? request.farmerNotes
              : "No farmer note provided"}
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
            {/* Compatibility with request.imageUrl and request.photos.map */}
            {(request.photos ? request.photos : attachmentUrls).map((url: string) => (
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
