import React, { useState } from "react";
import { Platform, View, Text, TouchableOpacity } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "./HealthUI";
import { HealthRecordingFields } from "./HealthRecordingFields";
import {
  DIRECT_HEALTH_SERVICE_TYPES,
  formatDirectHealthDateKey,
} from "../utils/directHealthRecord";
import { SelectDropdown } from "@/components/shared/SelectDropdown";

interface Props {
  onSubmit: (data: any) => void;
  saving?: boolean;
}

export default function DirectHealthForm({ onSubmit, saving }: Props) {
  const { colors } = useTheme();

  const [requestType, setRequestType] = useState("disease");
  const [serviceDate, setServiceDate] = useState(new Date());
  const [showServiceDatePicker, setShowServiceDatePicker] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [medicineGiven, setMedicineGiven] = useState("");
  const [dosage, setDosage] = useState("");
  const [withdrawalPeriodDays, setWithdrawalPeriodDays] = useState("");
  const [advice, setAdvice] = useState("");

  const handleReview = () => {
    onSubmit({
      requestType,
      serviceDate: formatDirectHealthDateKey(serviceDate),
      diagnosis,
      findings: diagnosis,
      treatment,
      medicineGiven,
      dosage,
      withdrawalPeriodDays: withdrawalPeriodDays ? Number(withdrawalPeriodDays) : undefined,
      advice,
      followUpDate: followUpDate
        ? formatDirectHealthDateKey(followUpDate)
        : undefined,
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
            Service Date
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Choose service date"
            disabled={saving}
            onPress={() => setShowServiceDatePicker(true)}
            style={{
              minHeight: 50,
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              backgroundColor: colors.card,
              opacity: saving ? 0.55 : 1,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 14,
              }}
            >
              {serviceDate.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          {showServiceDatePicker ? (
            <DateTimePicker
              value={serviceDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (Platform.OS !== "ios" || event.type === "dismissed") {
                  setShowServiceDatePicker(false);
                }
                if (selectedDate) setServiceDate(selectedDate);
              }}
            />
          ) : null}
        </View>
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
          <SelectDropdown
            label=""
            options={
              DIRECT_HEALTH_SERVICE_TYPES as unknown as {
                value: string;
                label: string;
              }[]
            }
            value={requestType}
            onChange={(val) => setRequestType(val)}
            disabled={saving}
            placeholder="Select service type"
            highlightSelection={false}
          />
        </View>

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
            Follow-up Date (Optional)
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Choose follow-up date"
              disabled={saving}
              onPress={() => setShowFollowUpDatePicker(true)}
              style={{
                minHeight: 50,
                flex: 1,
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                paddingHorizontal: 14,
                backgroundColor: colors.card,
                opacity: saving ? 0.55 : 1,
              }}
            >
              <Text
                style={{
                  color: followUpDate
                    ? colors.textPrimary
                    : colors.textSecondary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 14,
                }}
              >
                {followUpDate
                  ? followUpDate.toLocaleDateString()
                  : "No follow-up date"}
              </Text>
            </TouchableOpacity>
            {followUpDate ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear follow-up date"
                disabled={saving}
                onPress={() => setFollowUpDate(null)}
                style={{ minHeight: 50, justifyContent: "center", paddingHorizontal: 8 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {showFollowUpDatePicker ? (
            <DateTimePicker
              value={followUpDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (Platform.OS !== "ios" || event.type === "dismissed") {
                  setShowFollowUpDatePicker(false);
                }
                if (selectedDate) setFollowUpDate(selectedDate);
              }}
            />
          ) : null}
        </View>

        <HealthRecordingFields
          values={{
            diagnosis,
            treatment,
            medicineGiven,
            dosage,
            withdrawalPeriodDays,
            advice,
            followUpDate,
          }}
          onDiagnosisChange={setDiagnosis}
          onTreatmentChange={setTreatment}
          onMedicineGivenChange={setMedicineGiven}
          onDosageChange={setDosage}
          onWithdrawalPeriodDaysChange={setWithdrawalPeriodDays}
          onAdviceChange={setAdvice}
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
