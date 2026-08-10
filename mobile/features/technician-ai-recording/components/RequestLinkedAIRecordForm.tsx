import React, { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  View,
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import {
  AlertTriangle,
  CalendarDays,
  FileText,
  UserRound,
} from "lucide-react-native";
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
  historicalTimeConfirmationRequired: boolean;
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

const formatFarmLocation = (value?: string | null) => {
  if (!value) return "Location not provided";

  return (
    value
      // Remove Google Plus Code at the beginning: PHF6+QQ
      .replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}\s*,?\s*/i, "")
      // Split address parts
      .split(",")
      .map((part) => part.trim())
      // Remove unnecessary regional/country labels
      .filter(
        (part) => !/^(Western Visayas|Region VI|Philippines)$/i.test(part),
      )
      .filter(Boolean)
      .join(", ")
  );
};

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
  historicalTimeConfirmationRequired,
  onValuesChange,
  onReview,
}: RequestLinkedAIRecordFormProps) {
  const { colors } = useTheme();
  const [selectedAttachment, setSelectedAttachment] = useState<string | null>(
    null,
  );
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
  const earTag =
    context.animal.earTag || context.animal.animalId || "Not provided";
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
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
            <Image
              source={{
                uri: context.farmer.imageUrl,
              }}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 100,
              }}
            />
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
        <SummaryLine
          label="Animal Species"
          value={
            context.animal.species ||
            context.animal.animalSpecies ||
            "Not provided"
          }
        />
        <SummaryLine label="Ear tag" value={earTag} />
        <SummaryLine
          label="Breed"
          value={context.animal.breed || "Not provided"}
        />
        <SummaryLine
          label="Location"
          value={formatAddress(context.farmer.address || "No location")}
        />
        <SummaryLine
          label="Farm Location"
          value={formatFarmLocation(
            context.farmer.farmLocation?.detectedAddress?.trim() ||
            context.raw?.farmLocation?.detectedAddress?.trim() ||
              "Not provided",
          )}
        />

        <SummaryLine
          label="Attempt"
          value={
            context.attemptNumber
              ? `Attempt ${context.attemptNumber}`
              : "Not recorded"
          }
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

        <SummaryLine
          label="Scheduled Vist"
          value={`${scheduledDate} ${period}`}
        />
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
                <TouchableOpacity
                  key={url}
                  onPress={() => setSelectedAttachment(url)}
                >
                  <Image
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
                </TouchableOpacity>
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
            {eligibilityWarning} The scheduled request may still be completed;
            the server will perform final validation.
          </Text>
        </View>
      ) : null}

      {historicalTimeConfirmationRequired ? (
        <View
          accessibilityRole="alert"
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
            The historical date was initialized from the scheduled visit. Select
            the actual service time to confirm it; Morning/Afternoon is not an
            exact procedure time.
          </Text>
        </View>
      ) : null}

      <SectionCard title="Actual Service Details">
        <AIRecordingFields
          values={values}
          disabled={saving}
          onDateChange={(inseminationDate) =>
            onValuesChange({ inseminationDate })
          }
          onTimeChange={(inseminationTime) =>
            onValuesChange({ inseminationTime })
          }
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

      <Modal
        visible={!!selectedAttachment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAttachment(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 16,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View>
                <Text
                  style={{
                    color: "#111827",
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 17,
                  }}
                >
                  Attachment
                </Text>

                <Text
                  style={{
                    color: "#6B7280",
                    fontFamily: "Outfit_400Regular",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  Farmer submitted photo
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedAttachment(null)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={19} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Image */}
            {selectedAttachment ? (
              <View
                style={{
                  width: "100%",
                  height: 300,
                  backgroundColor: "#F3F4F6",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <Image
                  source={{ uri: selectedAttachment }}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="contain"
                />
              </View>
            ) : null}

            {/* Close */}
            <TouchableOpacity
              onPress={() => setSelectedAttachment(null)}
              style={{
                marginTop: 16,
                minHeight: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#374151",
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 14,
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
