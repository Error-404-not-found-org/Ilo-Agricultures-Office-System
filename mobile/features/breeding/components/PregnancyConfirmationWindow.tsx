import React from "react";
import { View, StyleSheet } from "react-native";
import { CheckCircle, Clock, Info, Check } from "lucide-react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

type PregnancyConfirmationWindowProps = {
  pregnancyReadiness: any;
  aiDate?: string | Date | null;
};

const formatDisplayDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export function PregnancyConfirmationWindow({
  pregnancyReadiness,
  aiDate,
}: PregnancyConfirmationWindowProps) {
  const { colors, isDark } = useTheme();

  if (!pregnancyReadiness) return null;

  const daysPostAI = pregnancyReadiness.daysPostAI;
  const isEligible = pregnancyReadiness.isEligible;
  const methods = pregnancyReadiness.methods || [];

  const hasMethods = Array.isArray(methods) && methods.length > 0;
  const isValidLegacy = !hasMethods && pregnancyReadiness.policyMode === "legacy_day_60" && daysPostAI !== null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text textRole="title" style={{ color: colors.primary }}>
          Pregnancy Confirmation
        </Text>
      </View>

      {daysPostAI !== null && daysPostAI !== undefined && (
        <Text textRole="body" color="primary" style={{ marginBottom: 16, fontFamily: "Outfit_700Bold" }}>
          {daysPostAI} day{daysPostAI === 1 ? "" : "s"} since AI
        </Text>
      )}

      {hasMethods ? (
        <View style={styles.methodsContainer}>
          <Text textRole="label" color="secondary" style={{ marginBottom: 12 }}>
            Confirmation methods
          </Text>
          {methods.map((method: any) => {
            const methodEligible = method.isEligible;
            const availableDateStr = formatDisplayDate(method.availableDate);

            return (
              <View key={method.methodCode} style={styles.methodRow}>
                <View style={styles.methodIconContainer}>
                  {methodEligible ? (
                    <CheckCircle size={18} color={isDark ? "#10b981" : "#059669"} />
                  ) : (
                    <Clock size={18} color={colors.textMuted} />
                  )}
                </View>
                <View style={styles.methodContent}>
                  <Text textRole="body" style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold" }}>
                    {method.label ? method.label.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) : method.methodCode}
                  </Text>
                  {methodEligible ? (
                    <Text textRole="caption" style={{ color: isDark ? "#10b981" : "#059669", marginTop: 2 }}>
                      Available now
                    </Text>
                  ) : (
                    <Text textRole="caption" color="muted" style={{ marginTop: 2 }}>
                      {availableDateStr ? `Available ${availableDateStr}` : (method.reason || "Not yet available")}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : isValidLegacy ? (
        <View style={styles.methodsContainer}>
           <Text textRole="label" color="secondary" style={{ marginBottom: 12 }}>
            Confirmation status
          </Text>
          <View style={styles.methodRow}>
            <View style={styles.methodIconContainer}>
              {isEligible ? (
                <CheckCircle size={18} color={isDark ? "#10b981" : "#059669"} />
              ) : (
                <Clock size={18} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.methodContent}>
              <Text textRole="body" style={{ color: colors.textPrimary, fontFamily: "Outfit_600SemiBold" }}>
                Manual Palpation / Default
              </Text>
              {isEligible ? (
                <Text textRole="caption" style={{ color: isDark ? "#10b981" : "#059669", marginTop: 2 }}>
                  Available now
                </Text>
              ) : (
                <Text textRole="caption" color="muted" style={{ marginTop: 2 }}>
                  {pregnancyReadiness.availableDate
                    ? `Available ${formatDisplayDate(pregnancyReadiness.availableDate)}`
                    : (pregnancyReadiness.reason || "Not yet available")}
                </Text>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {!isEligible && pregnancyReadiness.reason ? (
        <View style={[styles.infoBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
          <Info size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text textRole="caption" color="secondary" style={{ flex: 1, marginLeft: 8 }}>
            {pregnancyReadiness.reason}
          </Text>
        </View>
      ) : null}
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
  methodsContainer: {
    marginTop: 4,
  },
  methodRow: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  methodIconContainer: {
    width: 24,
    alignItems: "flex-start",
    paddingTop: 2,
  },
  methodContent: {
    flex: 1,
  },
  infoBox: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
});
