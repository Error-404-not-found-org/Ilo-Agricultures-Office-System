import React, { useState } from "react";
import {
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "@/lib/theme";

interface HealthRecordingFieldsProps {
  values: {
    diagnosis: string;
    treatment: string;
    medicineGiven: string;
    dosage: string;
    withdrawalPeriodDays: string;
    advice: string;
    followUpDate: Date | null;
    resolutionNotes?: string;
  };
  onDiagnosisChange: (value: string) => void;
  onTreatmentChange: (value: string) => void;
  onMedicineGivenChange: (value: string) => void;
  onDosageChange: (value: string) => void;
  onWithdrawalPeriodDaysChange: (value: string) => void;
  onAdviceChange: (value: string) => void;
  onResolutionNotesChange?: (value: string) => void;
  disabled?: boolean;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.textSecondary,
        fontFamily: "Outfit_700Bold",
        fontSize: 11,
        letterSpacing: 0.6,
        marginBottom: 7,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

export function HealthRecordingFields({
  values,
  onDiagnosisChange,
  onTreatmentChange,
  onMedicineGivenChange,
  onDosageChange,
  onWithdrawalPeriodDaysChange,
  onAdviceChange,
  onResolutionNotesChange,
  disabled = false,
}: HealthRecordingFieldsProps) {
  const { colors } = useTheme();

  const inputStyle = {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
  } as const;

  return (
    <View style={{ gap: 18 }}>
      <View>
        <FieldLabel>Findings & Diagnosis</FieldLabel>
        <TextInput
          editable={!disabled}
          value={values.diagnosis}
          onChangeText={onDiagnosisChange}
          placeholder="Describe clinical findings and diagnosis"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
      </View>

      <View>
        <FieldLabel>Treatment Provided</FieldLabel>
        <TextInput
          editable={!disabled}
          value={values.treatment}
          onChangeText={onTreatmentChange}
          placeholder="e.g. Wound cleaning, Injection"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 2 }}>
          <FieldLabel>Medication Given</FieldLabel>
          <TextInput
            editable={!disabled}
            value={values.medicineGiven}
            onChangeText={onMedicineGivenChange}
            placeholder="e.g. Penicillin"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel>Dosage</FieldLabel>
          <TextInput
            editable={!disabled}
            value={values.dosage}
            onChangeText={onDosageChange}
            placeholder="e.g. 10ml"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>
      </View>

      <View>
        <FieldLabel>Withdrawal Period (Days, Optional)</FieldLabel>
        <TextInput
          editable={!disabled}
          value={values.withdrawalPeriodDays}
          onChangeText={(v) => onWithdrawalPeriodDaysChange(v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          placeholder="e.g. 7"
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
      </View>

      <View>
        <FieldLabel>Care Advice (Optional)</FieldLabel>
        <TextInput
          editable={!disabled}
          value={values.advice}
          onChangeText={onAdviceChange}
          maxLength={150}
          multiline
          textAlignVertical="top"
          placeholder="Advice for the farmer"
          placeholderTextColor={colors.textMuted}
          style={[inputStyle, { minHeight: 90, paddingTop: 14 }]}
        />
      </View>
    </View>
  );
}
