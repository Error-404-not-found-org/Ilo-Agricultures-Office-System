import React from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface PhotoSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
  insets: { bottom: number };
}

const PhotoSelectionModal = ({
  visible,
  onClose,
  onTakePhoto,
  onChooseFromGallery,
  insets,
}: PhotoSelectionModalProps) => {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            paddingBottom: Math.max(insets.bottom, 40),
          }}
        >
          {/* Sheet Handle */}
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.1)",
              marginBottom: 24,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <View>
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 20,
                  color: colors.textPrimary,
                }}
              >
                Change Profile Photo
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 12,
                  color: colors.textMuted,
                  marginTop: 2,
                }}
              >
                Choose how you want to upload your picture
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Action Options */}
          <View style={{ gap: 12, marginBottom: 16 }}>
            {/* Option 1: Take Photo */}
            <TouchableOpacity
              onPress={onTakePhoto}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 20,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.02)"
                  : "#f8fafc",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark
                    ? "rgba(16,185,129,0.1)"
                    : "rgba(0, 100, 59, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Camera
                  size={20}
                  color={isDark ? colors.primary : "#00643B"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 15,
                    color: colors.textPrimary,
                  }}
                >
                  Take Photo
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 1,
                  }}
                >
                  Use your camera to capture a new picture
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Option 2: Choose from Gallery */}
            <TouchableOpacity
              onPress={onChooseFromGallery}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 20,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.02)"
                  : "#f8fafc",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark
                    ? "rgba(29,78,216,0.1)"
                    : "rgba(29, 78, 216, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <MaterialCommunityIcons
                  name="image-multiple"
                  size={20}
                  color={isDark ? "#3b82f6" : "#1d4ed8"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 15,
                    color: colors.textPrimary,
                  }}
                >
                  Choose from Gallery
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 1,
                  }}
                >
                  Select an existing photo from your library
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#e2e8f0",
              marginTop: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default PhotoSelectionModal;
