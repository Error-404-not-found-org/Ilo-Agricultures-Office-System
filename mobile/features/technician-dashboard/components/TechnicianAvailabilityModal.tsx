import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Briefcase } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { AVAILABILITY_HELPER_COPY } from "../utils/technicianAvailabilityHelper";

export interface TechnicianAvailabilityModalProps {
  visible: boolean;
  onStartAccepting: () => void;
  onMaybeLater: () => void;
  isPending?: boolean;
  copy?: {
    TITLE: string;
    BODY_PARAGRAPHS: readonly string[];
    PRIMARY_BUTTON: string;
    SECONDARY_BUTTON: string;
  };
}

export function TechnicianAvailabilityModal({
  visible,
  onStartAccepting,
  onMaybeLater,
  isPending = false,
  copy = AVAILABILITY_HELPER_COPY,
}: TechnicianAvailabilityModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const handleBackdropPress = () => {
    if (isPending) return;
    onMaybeLater();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleBackdropPress}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <Pressable
          accessible={false}
          disabled={isPending}
          onPress={handleBackdropPress}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 24,
            padding: 24,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Friendly Icon Header */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              marginBottom: 16,
            }}
          >
            <Briefcase
              size={26}
              color={isDark ? "#34d399" : "#059669"}
              strokeWidth={2}
            />
          </View>

          {/* Title */}
          <Text
            textRole="title"
            style={{
              textAlign: "center",
              color: colors.textPrimary,
              marginBottom: 12,
            }}
          >
            {copy.TITLE}
          </Text>

          {/* Body Paragraphs */}
          <View style={{ gap: 10, marginBottom: 24 }}>
            {copy.BODY_PARAGRAPHS.map((paragraph, index) => (
              <Text
                key={index}
                textRole="body"
                style={{
                  textAlign: "center",
                  color: colors.textSecondary,
                  lineHeight: 20,
                  fontSize: 13.5,
                }}
              >
                {paragraph}
              </Text>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 10 }}>
            <Button
              variant="default"
              label={copy.PRIMARY_BUTTON}
              loading={isPending}
              disabled={isPending}
              onPress={onStartAccepting}
              className="w-full"
            />

            <Button
              variant="ghost"
              label={copy.SECONDARY_BUTTON}
              disabled={isPending}
              onPress={onMaybeLater}
              className="w-full"
              textClassName="text-slate-500 dark:text-slate-400"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
