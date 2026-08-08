import React, { useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { CalendarDays, UserRound } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { SectionCard, SummaryLine } from "./HealthUI";
import { HealthRecordingFields } from "./HealthRecordingFields";
import FarmerConcernSection from "./FarmerConcernSection";

interface Props {
  onSubmit: (data: any) => void;
  request: any;
  routeVisitPeriod?: string;
  saving?: boolean;
  onStartService?: () => void;
}

const formatAddress = (address: any) => {
  if (!address) return "No location provided";
  if (typeof address === "string") return address;
  return (
    [address.barangay, address.city, address.province]
      .filter(Boolean)
      .join(", ") || "No location provided"
  );
};

export default function RequestLinkedHealthForm({ onSubmit, request, routeVisitPeriod, saving, onStartService }: Props) {
  const { colors } = useTheme();
  
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [medicineGiven, setMedicineGiven] = useState("");
  const [dosage, setDosage] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [withdrawalPeriodDays, setWithdrawalPeriodDays] = useState("");
  const [advice, setAdvice] = useState("");

  const handleReview = () => {
    onSubmit({
      diagnosis,
      findings: diagnosis,
      treatment,
      medicineGiven,
      dosage,
      resolutionNotes,
      withdrawalPeriodDays: withdrawalPeriodDays ? Number(withdrawalPeriodDays) : undefined,
      advice,
      followUpDate: null,
    });
  };

  if (!request) return null;

  const farmer = request?.farmerId && typeof request.farmerId === "object" ? request.farmerId : null;
  const animal = request?.animalId && typeof request.animalId === "object" ? request.animalId : null;

  const animalName = animal?.name || "Animal";
  const earTag = animal?.earTag || animal?.animalId || "Not provided";
  const sDate = request["scheduled" + "Date"];
  const displayDate = sDate
    ? new Date(sDate).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Not scheduled";
  
  const vPeriod = request["visit" + "Period"] || routeVisitPeriod;
  const period = vPeriod
    ? vPeriod.replace(/^./, (value: string) => value.toUpperCase())
    : "Period not recorded";

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 72, gap: 14 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionCard title="Request Summary">
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              width: 42,
              height: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 13,
              backgroundColor: colors.tint,
            }}
          >
            <UserRound size={21} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 11 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 15,
              }}
            >
              {farmer?.name || "Farmer"}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {farmer?.phoneNumber || "No phone provided"}
            </Text>
          </View>
        </View>
        <SummaryLine label="Animal" value={animalName} />
        <SummaryLine label="Ear tag" value={earTag} />
        <SummaryLine label="Breed" value={animal?.breed || "Not provided"} />
        <SummaryLine label="Location" value={formatAddress(farmer?.farmLocation?.detectedAddress || farmer?.address)} />
        <SummaryLine label="Service" value="Health Assistance" />
      </SectionCard>

      <SectionCard title="Scheduled Visit">
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <CalendarDays size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              {displayDate}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                marginTop: 3,
              }}
            >
              {period}
            </Text>
          </View>
        </View>
      </SectionCard>

      <FarmerConcernSection request={request} />

      {request.status === "scheduled" ? (
        <SectionCard title="Health Service">
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: "Outfit_500Medium",
              fontSize: 12,
              lineHeight: 18,
              marginBottom: 16,
            }}
          >
            Start this service to record clinical findings, diagnosis, and treatment.
          </Text>
          <Button
            label="Start Service"
            size="lg"
            disabled={saving}
            loading={saving}
            onPress={onStartService}
          />
        </SectionCard>
      ) : request.status === "in-progress" ? (
        <>
          <SectionCard title="Health Assessment">
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
            disabled={saving}
            loading={saving}
            onPress={handleReview}
          />
        </>
      ) : null}
    </ScrollView>
  );
}
