import React from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";
import type { ReviewSnapshot } from "../types/technicianAIRecording.types";

interface InseminationReviewModalProps {
  visible: boolean;
  snapshot: ReviewSnapshot | null;
  saving: boolean;
  isHistoricalMode?: boolean;
  onGoBack: () => void;
  onComplete: () => void;
}

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  const parsed = new Date();
  parsed.setHours(hours, minutes, 0, 0);
  return parsed.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });
};

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

export function InseminationReviewModal({
  visible,
  snapshot,
  saving,
  isHistoricalMode,
  onGoBack,
  onComplete,
}: InseminationReviewModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!snapshot) return null;

  const animalLabel = snapshot.animal.earTag || "Animal";

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
                  {isHistoricalMode
                    ? "Review Previous AI"
                    : "Review Insemination"}
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
                  {isHistoricalMode
                    ? "Confirm these previous service details before saving."
                    : "Confirm these are the actual service details before saving."}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <ReviewRow label="Farmer" value={snapshot.farmer.name} />
              <ReviewRow label="Animal Ear Tag" value={animalLabel} />
              <ReviewRow
                label={isHistoricalMode ? "Service Date" : "Actual Date"}
                value={formatDate(snapshot.details.inseminationDate)}
              />
              <ReviewRow
                label={isHistoricalMode ? "Service Time" : "Actual Time"}
                value={formatTime(snapshot.details.time)}
              />
              <ReviewRow label="Estrus Type" value={snapshot.details.estrus} />
              <ReviewRow
                label="Sire Breed"
                value={snapshot.details.sireBreed}
              />
              <ReviewRow label="Sire Code" value={snapshot.details.sireCode} />
              <ReviewRow
                label="Semen Doses Used"
                value={String(snapshot.details.semenDosesUsed)}
              />
              <ReviewRow
                label="Technician Note"
                value={snapshot.details.technicianNote || "No note"}
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
