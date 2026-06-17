import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../lib/theme";
import { AlertTriangle, Trash2, X } from "lucide-react-native";

interface ConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
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
  title,
  message,
  confirmText = "Yes, Cancel",
  cancelText = "No, Keep it",
  isDestructive = true,
  icon,
}: ConfirmationModalProps) {
  const { colors, isDark } = useTheme();
  const [confirming, setConfirming] = React.useState(false);

  const handleConfirm = async () => {
    if (confirming) return;
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

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity
            disabled={confirming}
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <X size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Icon Header */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: isDestructive
                  ? isDark
                    ? "rgba(239, 68, 68, 0.15)"
                    : "#FEF2F2"
                  : isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#FFFBEB",
              },
            ]}
          >
            {icon ? (
              icon
            ) : isDestructive ? (
              <Trash2 size={26} color={colors.error} />
            ) : (
              <AlertTriangle size={26} color={colors.warning} />
            )}
          </View>

          {/* Text Content */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* Buttons Row */}
          <View style={styles.buttonRow}>
            {showCancel && (
              <TouchableOpacity
                disabled={confirming}
                onPress={onClose}
                style={[
                  styles.button,
                  styles.cancelButton,
                  {
                    backgroundColor: isDark ? colors.background : "#f1f5f9",
                    opacity: confirming ? 0.6 : 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.buttonText, { color: colors.textSecondary }]}
                >
                  {cancelText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              disabled={confirming}
              onPress={handleConfirm}
              style={[
                styles.button,
                {
                  backgroundColor: isDestructive
                    ? colors.error
                    : colors.primary,
                  opacity: confirming ? 0.6 : 1,
                },
              ]}
              activeOpacity={0.8}
            >
              {confirming ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={[styles.buttonText, styles.confirmButtonText]}>
                  {confirmText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: width > 400 ? 360 : "100%",
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "Outfit_700Bold",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
    fontFamily: "Outfit_500Medium",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "Outfit_700Bold",
  },
  confirmButtonText: {
    color: "#ffffff",
  },
});
