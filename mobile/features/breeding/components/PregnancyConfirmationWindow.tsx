import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import {
  PREGNANCY_DIAGNOSIS_UI,
  formatDaysSinceInsemination,
  getDiagnosisWindowCopy,
} from "@/features/breeding/utils/pregnancyDiagnosisPresentation";

type PregnancyConfirmationWindowProps = {
  pregnancyReadiness: any;
  aiDate?: string | Date | null;
};

export function PregnancyConfirmationWindow({
  pregnancyReadiness,
  aiDate,
}: PregnancyConfirmationWindowProps) {
  const { colors, isDark } = useTheme();

  if (!pregnancyReadiness) return null;

  const daysPostAI = pregnancyReadiness.daysPostAI;
  const isEligible = Boolean(pregnancyReadiness.isEligible);
  const timingText = formatDaysSinceInsemination(daysPostAI);
  const { title, description } = getDiagnosisWindowCopy(
    isEligible,
    pregnancyReadiness.reason,
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text textRole="title" style={[styles.sectionTitle, { color: colors.primary }]}>
          {PREGNANCY_DIAGNOSIS_UI.PAGE_1.SECTION_DIAGNOSIS_WINDOW}
        </Text>
      </View>

      {timingText && (
        <Text
          textRole="body"
          color="primary"
          style={{ marginBottom: 8, fontFamily: "Outfit_700Bold", fontSize: 16 }}
        >
          {timingText}
        </Text>
      )}

      <View style={{ marginTop: 2 }}>
        <Text
          style={{
            fontFamily: isEligible ? "Outfit_700Bold" : "Outfit_600SemiBold",
            fontSize: 14,
            color: isEligible
              ? (isDark ? "#34d399" : "#059669")
              : (isDark ? "#fbbf24" : "#b45309"),
            marginBottom: 4,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "Outfit_400Regular",
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 18,
          }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 15,
    letterSpacing: 0.8,
  },
});
