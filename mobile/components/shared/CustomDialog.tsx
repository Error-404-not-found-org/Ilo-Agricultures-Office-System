import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/lib/theme";

export interface DialogAction {
  text: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "cancel";
}

interface CustomDialogProps {
  visible: boolean;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions: DialogAction[];
  onClose: () => void;
}

export function CustomDialog({
  visible,
  title,
  description,
  icon,
  actions,
  onClose,
}: CustomDialogProps) {
  const { colors, isDark } = useTheme();

  const getButtonStyles = (variant: string = "primary") => {
    switch (variant) {
      case "danger":
        return {
          bg: "#ef4444",
          text: "#ffffff",
          border: "transparent",
        };
      case "secondary":
        return {
          bg: isDark ? "rgba(37,99,235,0.15)" : "#eff6ff",
          text: "#2563eb",
          border: "transparent",
        };
      case "cancel":
        return {
          bg: "transparent",
          text: colors.textSecondary,
          border: colors.border,
        };
      case "primary":
      default:
        return {
          bg: "#2563eb",
          text: "#ffffff",
          border: "transparent",
        };
    }
  };

  const isHorizontal = actions.length <= 2;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.dialogContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Icon Container */}
              {icon && (
                <View style={styles.iconWrapper}>
                  {icon}
                </View>
              )}

              {/* Title */}
              <Text
                style={[
                  styles.title,
                  { color: colors.textPrimary, marginTop: icon ? 8 : 0 },
                ]}
              >
                {title}
              </Text>

              {/* Description */}
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {description}
              </Text>

              {/* Action Buttons */}
              <View
                style={[
                  isHorizontal ? styles.rowActions : styles.colActions,
                  { gap: 10 },
                ]}
              >
                {actions.map((act, index) => {
                  const btnStyle = getButtonStyles(act.variant);
                  return (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      onPress={act.onPress}
                      style={[
                        styles.button,
                        {
                          backgroundColor: btnStyle.bg,
                          borderColor: btnStyle.border,
                          borderWidth: btnStyle.border !== "transparent" ? 1 : 0,
                          flex: isHorizontal ? 1 : undefined,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          {
                            color: btnStyle.text,
                            fontFamily: act.variant === "cancel" ? "Outfit_600SemiBold" : "Outfit_700Bold",
                          },
                        ]}
                      >
                        {act.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialogContainer: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  iconWrapper: {
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Outfit_800ExtraBold",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  rowActions: {
    flexDirection: "row",
    width: "100%",
  },
  colActions: {
    flexDirection: "column",
    width: "100%",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  buttonText: {
    fontSize: 13,
    textAlign: "center",
  },
});
