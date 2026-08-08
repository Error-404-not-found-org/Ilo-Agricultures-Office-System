import React from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";

interface HealthReviewModalProps {
  visible: boolean;
  snapshot: any | null;
  saving: boolean;
  onGoBack: () => void;
  onComplete: () => void;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        selectable
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_600SemiBold",
          fontSize: 14,
          lineHeight: 20,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function HealthReviewModal({
  visible,
  snapshot,
  saving,
  onGoBack,
  onComplete,
}: HealthReviewModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!snapshot) return null;

  const animalLabel =
    snapshot.animal?.name ||
    snapshot.animal?.earTag ||
    snapshot.animal?.animalId ||
    "Animal";
  const animalReference =
    snapshot.animal?.earTag || snapshot.animal?.animalId || "No ear tag";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (!saving) onGoBack();
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 480,
            maxHeight: "90%",
            alignSelf: "center",
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: colors.card,
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  backgroundColor: colors.successContainer,
                }}
              >
                <CheckCircle2 size={24} color={colors.successForeground} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 20,
                  }}
                >
                  Review Health Record
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    lineHeight: 17,
                    marginTop: 2,
                  }}
                >
                  Confirm these are the actual service details before saving.
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <ReviewRow label="Farmer" value={snapshot.farmer?.name || "Farmer"} />
              <ReviewRow
                label="Animal"
                value={`${animalLabel} · ${animalReference}`}
              />
              <ReviewRow label="Findings/Diagnosis" value={snapshot.details.diagnosis || "None"} />
              <ReviewRow label="Treatment" value={snapshot.details.treatment || "None"} />
              <ReviewRow label="Medicine Given" value={snapshot.details.medicineGiven || "None"} />
              <ReviewRow label="Dosage" value={snapshot.details.dosage || "None"} />
              <ReviewRow
                label="Withdrawal Period"
                value={snapshot.details.withdrawalPeriodDays ? `${snapshot.details.withdrawalPeriodDays} days` : "None"}
              />
              <ReviewRow label="Advice" value={snapshot.details.advice || "None"} />
              <ReviewRow
                label="Resolution Notes"
                value={snapshot.details.resolutionNotes || "None"}
              />
            </View>
          </ScrollView>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Button
              variant="outline"
              label="Go Back"
              disabled={saving}
              onPress={onGoBack}
              className="flex-1"
            />
            <Button
              label="Complete Record"
              loading={saving}
              disabled={saving}
              onPress={onComplete}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
