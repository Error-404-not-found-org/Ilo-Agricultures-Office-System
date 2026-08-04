import React, { useMemo } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { AlertTriangle, CalendarDays, FileText, UserRound } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";
import { getAIEligibility } from "@/lib/reproductionEligibility";
import { AIRecordingFields } from "./AIRecordingFields";
import type {
  AIRecordingValues,
  RequestLinkedContext,
} from "../types/technicianAIRecording.types";

interface RequestLinkedAIRecordFormProps {
  context: RequestLinkedContext;
  values: AIRecordingValues;
  saving: boolean;
  onValuesChange: (next: Partial<AIRecordingValues>) => void;
  onReview: () => void;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 16,
        backgroundColor: colors.card,
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_700Bold",
          fontSize: 15,
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: "Outfit_500Medium",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 12,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
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

export function RequestLinkedAIRecordForm({
  context,
  values,
  saving,
  onValuesChange,
  onReview,
}: RequestLinkedAIRecordFormProps) {
  const { colors } = useTheme();
  const eligibilityWarning = useMemo(() => {
    const hasRequiredIdentity = Boolean(
      context.animal.gender || context.animal.sex,
    );
    if (!hasRequiredIdentity) return null;
    const result = getAIEligibility({ animal: context.animal });
    return result.isEligible ? null : result.reason;
  }, [context.animal]);

  const animalName =
    context.animal.name ||
    context.animal.earTag ||
    context.animal.animalId ||
    "Animal";
  const earTag = context.animal.earTag || context.animal.animalId || "Not provided";
  const scheduledDate = context.scheduledDate
    ? new Date(context.scheduledDate).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Not scheduled";
  const period = context.visitPeriod
    ? context.visitPeriod.replace(/^./, (value) => value.toUpperCase())
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
              {context.farmer.name}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {context.farmer.phoneNumber || "No phone provided"}
            </Text>
          </View>
        </View>
        <SummaryLine label="Animal" value={animalName} />
        <SummaryLine label="Ear tag" value={earTag} />
        <SummaryLine label="Breed" value={context.animal.breed || "Not provided"} />
        <SummaryLine label="Location" value={formatAddress(context.farmer.address)} />
        <SummaryLine
          label="Attempt"
          value={context.attemptNumber ? `Attempt ${context.attemptNumber}` : "Not recorded"}
        />
        {context.previousAttempt ? (
          <SummaryLine
            label="Previous attempt"
            value={
              context.previousAttempt.attemptNumber
                ? `Attempt ${context.previousAttempt.attemptNumber}${context.previousAttempt.outcome ? ` · ${context.previousAttempt.outcome}` : ""}`
                : context.previousAttempt.outcome || "Linked"
            }
          />
        ) : null}
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
              {scheduledDate}
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

      <SectionCard title="Farmer-submitted Observations">
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <FileText size={18} color={colors.textMuted} />
          <View style={{ flex: 1, marginLeft: 9 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 12,
              }}
            >
              Heat signs
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                lineHeight: 18,
                marginTop: 3,
              }}
            >
              {context.heatSigns.length > 0
                ? context.heatSigns.join(", ")
                : "No heat signs provided"}
            </Text>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 12,
                marginTop: 12,
              }}
            >
              Farmer notes
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                lineHeight: 18,
                marginTop: 3,
              }}
            >
              {context.farmerNotes.length > 0
                ? context.farmerNotes.join("\n\n")
                : "No farmer note provided"}
            </Text>
          </View>
        </View>

        {context.attachmentUrls.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 11,
                marginBottom: 8,
              }}
            >
              Attachments ({context.attachmentUrls.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {context.attachmentUrls.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  accessibilityLabel="Farmer-submitted AI request attachment"
                  style={{
                    width: 104,
                    height: 82,
                    borderRadius: 10,
                    marginRight: 8,
                    backgroundColor: colors.tint,
                  }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </SectionCard>

      {eligibilityWarning ? (
        <View
          style={{
            flexDirection: "row",
            padding: 13,
            borderWidth: 1,
            borderColor: colors.warning,
            borderRadius: 14,
            backgroundColor: colors.warningContainer,
          }}
        >
          <AlertTriangle size={18} color={colors.warningForeground} />
          <Text
            style={{
              flex: 1,
              color: colors.warningForeground,
              fontFamily: "Outfit_500Medium",
              fontSize: 12,
              lineHeight: 18,
              marginLeft: 8,
            }}
          >
            {eligibilityWarning} The scheduled request may still be completed; the server will perform final validation.
          </Text>
        </View>
      ) : null}

      <SectionCard title="Actual Service Details">
        <AIRecordingFields
          values={values}
          disabled={saving}
          onDateChange={(inseminationDate) => onValuesChange({ inseminationDate })}
          onTimeChange={(inseminationTime) => onValuesChange({ inseminationTime })}
          onEstrusChange={(estrus) => onValuesChange({ estrus })}
          onSireBreedChange={(sireBreed) => onValuesChange({ sireBreed })}
          onSireCodeChange={(sireCode) => onValuesChange({ sireCode })}
          onSemenDosesChange={(semenDosesUsed) =>
            onValuesChange({ semenDosesUsed })
          }
          onTechnicianNoteChange={(technicianNote) =>
            onValuesChange({ technicianNote })
          }
        />
      </SectionCard>

      <Button
        label="Review & Complete"
        size="lg"
        disabled={saving}
        loading={saving}
        onPress={onReview}
      />
    </ScrollView>
  );
}
