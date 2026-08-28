import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { TriangleAlert } from "lucide-react-native";

import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CancellationReviewPanelProps = {
  reason?: string | null;
  requestedAt?: string | Date | null;
  busy?: boolean;
  onRespond: (approved: boolean, reason: string) => Promise<void>;
};

const formatRequestedAt = (value: CancellationReviewPanelProps["requestedAt"]) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
};

export function CancellationReviewPanel({
  reason,
  requestedAt,
  busy = false,
  onRespond,
}: CancellationReviewPanelProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [approveVisible, setApproveVisible] = useState(false);
  const [declineVisible, setDeclineVisible] = useState(false);
  const [responseReason, setResponseReason] = useState("");
  const requestedAtLabel = formatRequestedAt(requestedAt);

  const declineCancellation = async () => {
    try {
      await onRespond(false, responseReason.trim());
      setDeclineVisible(false);
      setResponseReason("");
    } catch {
      // The owning details screen presents the canonical API error and keeps
      // this response form open so the Technician can retry safely.
    }
  };

  return (
    <>
      <View
        accessibilityRole="summary"
        style={{
          padding: 16,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.warningForeground,
          backgroundColor: colors.warningContainer,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <TriangleAlert size={21} color={colors.warningForeground} />
          <View style={{ flex: 1 }}>
            <Text textRole="title" style={{ color: colors.textPrimary }}>
              Farmer requested cancellation
            </Text>
            <Text
              textRole="body"
              style={{ color: colors.textSecondary, marginTop: 6 }}
            >
              Review this request before the scheduled visit. The visit remains
              active until cancellation is approved.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 16, gap: 4 }}>
          <Text textRole="label" style={{ color: colors.textMuted }}>
            Farmer’s reason
          </Text>
          <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
            {reason?.trim() || "No reason provided."}
          </Text>
          {requestedAtLabel ? (
            <Text
              textRole="caption"
              style={{ color: colors.textSecondary, marginTop: 4 }}
            >
              Requested {requestedAtLabel}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 20, gap: 8 }}>
          <Button
            label="Approve cancellation"
            disabled={busy}
            onPress={() => setApproveVisible(true)}
          />
          <Button
            variant="outline"
            label="Decline cancellation request"
            disabled={busy}
            onPress={() => setDeclineVisible(true)}
          />
        </View>
      </View>

      <ConfirmationModal
        visible={approveVisible}
        title="Approve cancellation?"
        message="The scheduled visit will be cancelled and removed from active work."
        confirmText="Approve cancellation"
        cancelText="Keep reviewing"
        isDestructive
        onClose={() => setApproveVisible(false)}
        onCancel={() => setApproveVisible(false)}
        onConfirm={() => onRespond(true, "")}
      />

      <Modal
        visible={declineVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => {
          if (!busy) setDeclineVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: colors.modalBackdrop,
            }}
          >
            <Pressable
              accessible={false}
              disabled={busy}
              onPress={() => setDeclineVisible(false)}
              style={StyleSheet.absoluteFill}
            />
            <View
              accessibilityViewIsModal
              style={{
                width: "100%",
                maxWidth: 420,
                padding: 20,
                borderRadius: 16,
                backgroundColor: colors.card,
              }}
            >
              <Text textRole="title" style={{ color: colors.textPrimary }}>
                Decline cancellation request
              </Text>
              <Text
                textRole="body"
                style={{ color: colors.textSecondary, marginTop: 6 }}
              >
                The request will remain scheduled. You may add a short reason
                for the Farmer.
              </Text>
              <TextInput
                accessibilityLabel="Reason for declining cancellation"
                placeholder="Response reason (optional)"
                placeholderTextColor={colors.textMuted}
                value={responseReason}
                onChangeText={setResponseReason}
                multiline
                style={{
                  minHeight: 96,
                  marginTop: 16,
                  padding: 12,
                  textAlignVertical: "top",
                  borderRadius: 12,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  color: colors.textPrimary,
                  fontFamily: "Outfit_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                }}
              />
              <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                <Button
                  className="flex-1"
                  variant="outline"
                  label="Keep reviewing"
                  disabled={busy}
                  onPress={() => setDeclineVisible(false)}
                />
                <Button
                  className="flex-1"
                  variant="default"
                  label="Decline cancellation request"
                  loading={busy}
                  onPress={declineCancellation}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
