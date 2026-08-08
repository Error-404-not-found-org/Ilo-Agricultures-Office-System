import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "./HealthUI";
import { HealthRecordingFields } from "./HealthRecordingFields";

interface Props {
  onSubmit: (data: any) => void;
  saving?: boolean;
}

const SERVICE_TYPES = [
  { value: "disease", label: "Disease Control" },
  { value: "medicine", label: "Medicine/Supplies" },
  { value: "checkup", label: "Routine Checkup" },
  { value: "injury", label: "Injury Treatment" },
  { value: "vaccination", label: "Vaccination" },
  { value: "deworming", label: "Deworming" },
  { value: "other", label: "Other Veterinary" },
];

export default function DirectHealthForm({ onSubmit, saving }: Props) {
  const { colors } = useTheme();

  const [requestType, setRequestType] = useState("disease");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [medicineGiven, setMedicineGiven] = useState("");
  const [dosage, setDosage] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [withdrawalPeriodDays, setWithdrawalPeriodDays] = useState("");
  const [advice, setAdvice] = useState("");

  const handleReview = () => {
    onSubmit({
      requestType,
      diagnosis,
      findings: diagnosis,
      treatment,
      medicineGiven,
      dosage,
      resolutionNotes,
      withdrawalPeriodDays: withdrawalPeriodDays ? Number(withdrawalPeriodDays) : undefined,
      advice,
    });
  };

  return (
    <>
      <SectionCard title="Actual Service Details">
        <View style={{ marginBottom: 18 }}>
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
            Service Type
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SERVICE_TYPES.map((type) => {
              const selected = requestType === type.value;
              return (
                <TouchableOpacity
                  key={type.value}
                  disabled={saving}
                  onPress={() => setRequestType(type.value)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.card,
                    opacity: saving ? 0.55 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.onPrimary : colors.textSecondary,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                    }}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <HealthRecordingFields
          values={{
            diagnosis,
            treatment,
            medicineGiven,
            dosage,
            withdrawalPeriodDays,
            advice,
            followUpDate: null,
            resolutionNotes,
          }}
          onDiagnosisChange={setDiagnosis}
          onTreatmentChange={setTreatment}
          onMedicineGivenChange={setMedicineGiven}
          onDosageChange={setDosage}
          onWithdrawalPeriodDaysChange={setWithdrawalPeriodDays}
          onAdviceChange={setAdvice}
          onResolutionNotesChange={setResolutionNotes}
          disabled={saving}
        />
      </SectionCard>

      <Button
        label="Review & Complete"
        size="lg"
        style={{ marginTop: 10 }}
        loading={saving}
        disabled={saving}
        onPress={handleReview}
      />
    </>
  );
}
