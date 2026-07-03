import React from "react";
import { View } from "react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
import StatItem from "./StatItem";

interface ProfileStatsCardProps {
  dbUser: any;
}

const ProfileStatsCard = ({ dbUser }: ProfileStatsCardProps) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <View className="px-6 -mt-10">
      <View
        className="rounded-[28px] p-5 flex-row justify-between border shadow-xl dark:shadow-none"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <StatItem
          label={t("totalCows")}
          value={dbUser?.stats?.totalAnimals || "0"}
          icon="cow"
          color={isDark ? colors.primary : "#00643B"}
        />
        <View
          className="w-[1px] my-1"
          style={{ backgroundColor: colors.border }}
        />
        <StatItem
          label={t("activeCases")}
          value={dbUser?.stats?.activeCases || "0"}
          icon="medical-bag"
          color="#eab308"
        />
        <View
          className="w-[1px] my-1"
          style={{ backgroundColor: colors.border }}
        />
        <StatItem
          label={t("pregnant")}
          value={dbUser?.stats?.activePregnancies || "0"}
          icon="heart-pulse"
          color="#0891b2"
        />
      </View>
    </View>
  );
};

export default ProfileStatsCard;
