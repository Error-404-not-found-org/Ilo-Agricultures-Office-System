import React from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

interface BarangaySelectModalProps {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (val: string) => void;
  onClose: () => void;
}

const BarangaySelectModal = ({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: BarangaySelectModalProps) => {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
          zIndex: 200,
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
            paddingBottom: 40,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_900Black",
                fontSize: 18,
                color: colors.textPrimary,
              }}
            >
              {title}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 300 }}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              {options.map((opt: string) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => {
                    onSelect(opt);
                    onClose();
                  }}
                  style={{
                    width: "48%",
                    paddingVertical: 14,
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      fontSize: 12,
                      color: colors.textPrimary,
                      textAlign: "center",
                    }}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default BarangaySelectModal;
