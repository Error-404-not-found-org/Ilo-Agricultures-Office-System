import React from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@/lib/theme";

interface MoowieAnalysisCardProps {
  activeBento: "all" | "history" | "breeding" | "pregnancy" | "calving";
  milestonesCount: number;
  totalRecordsCount: number;
}

const MoowieAnalysisCard = ({
  activeBento,
  milestonesCount,
  totalRecordsCount,
}: MoowieAnalysisCardProps) => {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}
    >
      <View style={{ width: 60, height: 60 }}>
        <Image
          source={{
            uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
          }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "#fff",
            fontFamily: "Outfit_800ExtraBold",
            fontSize: 14,
          }}
        >
          Moowie Analysis
        </Text>
        <Text
          style={{
            color: isDark ? colors.textSecondary : "rgba(255,255,255,0.8)",
            fontFamily: "Outfit_500Medium",
            fontSize: 11,
            lineHeight: 15,
            marginTop: 2,
          }}
        >
          {activeBento === "pregnancy"
            ? `Tracking cycles... You have ${milestonesCount} active breeding milestones. Keep an eye on upcoming calving dates!`
            : `Analyzing history... ${totalRecordsCount} total attempts found. Your success rate is looking promising!`}
        </Text>
      </View>
    </View>
  );
};

export default MoowieAnalysisCard;
