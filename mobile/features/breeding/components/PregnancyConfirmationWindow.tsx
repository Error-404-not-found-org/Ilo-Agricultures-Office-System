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
  embedded?: boolean;
};

export function PregnancyConfirmationWindow({
  pregnancyReadiness,
  aiDate,
  embedded = false,
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

  const readinessBlock = (
    <View
      style={
        embedded
          ? [
              styles.embeddedBox,
              {
                borderColor: isEligible
                  ? (isDark ? "rgba(16, 185, 129, 0.25)" : "#bbf7d0")
                  : (isDark ? "rgba(245, 158, 11, 0.25)" : "#fde68a"),
                backgroundColor: isEligible
                  ? (isDark ? "rgba(16, 185, 129, 0.08)" : "#f0fdf4")
                  : (isDark ? "rgba(245, 158, 11, 0.08)" : "#fffbeb"),
              },
            ]
          : { marginTop: 2 }
      }
    >
      <View style={styles.readinessHeaderRow}>
        <Text
          style={{
            fontFamily: isEligible ? "Outfit_700Bold" : "Outfit_600SemiBold",
            fontSize: 13,
            color: isEligible
              ? (isDark ? "#34d399" : "#059669")
              : (isDark ? "#fbbf24" : "#b45309"),
          }}
        >
          {title}
        </Text>
        {timingText ? (
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 12,
              color: isEligible
                ? (isDark ? "#34d399" : "#047857")
                : (isDark ? "#fbbf24" : "#b45309"),
            }}
          >
            {timingText}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: "Outfit_400Regular",
          fontSize: 12,
          color: colors.textSecondary,
          lineHeight: 17,
        }}
      >
        {description}
      </Text>
    </View>
  );

  if (embedded) {
    return readinessBlock;
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>
          {PREGNANCY_DIAGNOSIS_UI.PAGE_1.SECTION_DIAGNOSIS_WINDOW}
        </Text>
      </View>

      {timingText && (
        <Text
          style={{
            marginBottom: 6,
            fontFamily: "Outfit_700Bold",
            fontSize: 14,
            color: colors.textPrimary,
          }}
        >
          {timingText}
        </Text>
      )}

      {readinessBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  embeddedBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  readinessHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 8,
    flexWrap: "wrap",
  },
});
