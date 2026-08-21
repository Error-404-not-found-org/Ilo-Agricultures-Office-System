import React from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useTheme } from "@/lib/theme";
import { FarmerBreedingObservationCard } from "@/features/breeding/components/FarmerBreedingObservationCard";

export function ReturnToHeatReviewForm({
  insem,
  verificationResult,
  setVerificationResult,
  notes,
  setNotes,
}: {
  insem: any;
  verificationResult: string | null;
  setVerificationResult: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const animal = insem.animalId || {};
  const aiDate = insem.inseminationDate || insem.scheduledDate;
  const formattedAiDate = aiDate
    ? new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(aiDate))
    : "Date not recorded";

  return (
    <View style={{ padding: 16 }}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
          {animal.earTag || animal.animalId || "Animal"} · Attempt {insem.attemptNumber || 1}
        </Text>
        <Text style={[styles.reviewContext, { color: colors.textSecondary }]}>
          AI service {formattedAiDate}
        </Text>
      </View>

      <FarmerBreedingObservationCard observation={insem} />

      <Text style={[styles.sectionTitle, { color: colors.primary }]}>Review Decision</Text>
      <Text style={[styles.reviewPrompt, { color: colors.textSecondary }]}>
        Record what you verified during the visit. A confirmed return to heat closes
        this AI attempt as unsuccessful and makes the animal eligible for a new AI
        attempt.
      </Text>

      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ selected: verificationResult === "return_to_heat" }}
        onPress={() => setVerificationResult("return_to_heat")}
        style={[
          styles.decisionCard,
          {
            borderColor:
              verificationResult === "return_to_heat"
                ? colors.primary
                : colors.border,
            backgroundColor:
              verificationResult === "return_to_heat"
                ? isDark
                  ? "rgba(16,185,129,0.12)"
                  : "#ecfdf5"
                : colors.card,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.decisionTitle, { color: colors.textPrimary }]}>
            Confirm Return to Heat
          </Text>
          <Text style={[styles.decisionDescription, { color: colors.textSecondary }]}>
            I verified the reported heat signs. Mark this AI attempt as failed.
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            {
              borderColor:
                verificationResult === "return_to_heat"
                  ? colors.primary
                  : colors.border,
            },
          ]}
        >
          {verificationResult === "return_to_heat" ? (
            <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="radio"
        accessibilityState={{ selected: verificationResult === "cannot_confirm" }}
        onPress={() => setVerificationResult("cannot_confirm")}
        style={[
          styles.decisionCard,
          {
            borderColor:
              verificationResult === "cannot_confirm"
                ? colors.primary
                : colors.border,
            backgroundColor:
              verificationResult === "cannot_confirm"
                ? colors.surfaceSubtle
                : colors.card,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.decisionTitle, { color: colors.textPrimary }]}>
            Cannot Confirm
          </Text>
          <Text style={[styles.decisionDescription, { color: colors.textSecondary }]}>
            The available signs do not confirm return to heat. Keep the AI outcome
            unchanged.
          </Text>
        </View>
        <View
          style={[
            styles.radio,
            {
              borderColor:
                verificationResult === "cannot_confirm"
                  ? colors.primary
                  : colors.border,
            },
          ]}
        >
          {verificationResult === "cannot_confirm" ? (
            <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
          ) : null}
        </View>
      </TouchableOpacity>

      <Text style={[styles.formLabel, { color: colors.textPrimary, marginTop: 8 }]}>
        Technician notes (optional)
      </Text>
      <TextInput
        multiline
        numberOfLines={4}
        placeholder="Add what you observed or why the update could not be confirmed."
        placeholderTextColor={colors.textMuted}
        style={[
          styles.notesInput,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
        value={notes}
        onChangeText={setNotes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  reviewContext: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 5,
  },
  sectionTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  reviewPrompt: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  decisionCard: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  decisionTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    marginBottom: 4,
  },
  decisionDescription: {
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  formLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    textAlignVertical: "top",
  },
});
