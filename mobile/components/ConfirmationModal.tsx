import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { AlertTriangle, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string | null;
  isDestructive?: boolean;
  icon?: React.ReactNode;
}

export function ConfirmationModal({
  visible,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = "Yes, Cancel",
  cancelText = "No, Keep it",
  isDestructive = true,
  icon,
}: ConfirmationModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = React.useState(false);
  const confirmLockRef = React.useRef(false);

  React.useEffect(() => {
    if (!visible) {
      confirmLockRef.current = false;
      setConfirming(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (confirmLockRef.current) return;
    confirmLockRef.current = true;
    setConfirming(true);
    try {
      await onConfirm();
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming(false);
      onClose();
    }
  };

  const showCancel = cancelText !== null && cancelText !== "";
  const handleCancel = () => {
    if (confirmLockRef.current) return;
    if (onCancel) {
      onCancel();
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleCancel}
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
          disabled={confirming}
          onPress={handleCancel}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 420,
            alignItems: "center",
            padding: 24,
            borderRadius: 16,
            backgroundColor: colors.card,
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              backgroundColor: isDestructive
                ? colors.errorContainer
                : colors.warningContainer,
            }}
          >
            {icon ? (
              icon
            ) : isDestructive ? (
              <Trash2 size={26} color={colors.errorForeground} />
            ) : (
              <AlertTriangle size={26} color={colors.warningForeground} />
            )}
          </View>

          <Text
            textRole="title"
            style={{ color: colors.textPrimary, textAlign: "center" }}
          >
            {title}
          </Text>
          <Text
            textRole="body"
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 8,
              paddingHorizontal: 8,
            }}
          >
            {message}
          </Text>

          <View
            style={{
              width: "100%",
              flexDirection: "row",
              gap: 12,
              marginTop: 24,
            }}
          >
            {showCancel && (
              <Button
                variant="outline"
                label={cancelText || "Cancel"}
                disabled={confirming}
                onPress={handleCancel}
                className="flex-1"
              />
            )}
            <Button
              variant={isDestructive ? "destructive" : "default"}
              label={confirmText}
              loading={confirming}
              disabled={confirming}
              onPress={handleConfirm}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
