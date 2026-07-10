import React from "react";
import { Modal, View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { Info, X, Syringe, Stethoscope } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "@/lib/theme";
import type { ActivityFeedItem } from "../types/farmerReports.types";
import DetailRow from "./DetailRow";

import { RecordDetailContent } from "./RecordDetailContent";

interface RecordDetailModalProps {
  visible: boolean;
  onClose: () => void;
  selectedActivity: ActivityFeedItem | null;
  onViewAnimal: (animalId: string) => void;
}

const RecordDetailModal = ({
  visible,
  onClose,
  selectedActivity,
  onViewAnimal,
}: RecordDetailModalProps) => {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 28,
            width: "100%",
            maxHeight: "80%",
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 8,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 24,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Info size={18} color={isDark ? colors.primary : "#00643B"} />
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textPrimary,
                }}
              >
                Record Details
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: 4 }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            {selectedActivity && (
              <RecordDetailContent selectedActivity={selectedActivity} />
            )}
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingVertical: 18,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: "row",
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textSecondary,
                }}
              >
                Close
              </Text>
            </TouchableOpacity>

            {selectedActivity?.animalId?._id && (
              <TouchableOpacity
                onPress={() => onViewAnimal(selectedActivity.animalId?._id!)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: isDark ? colors.primary : "#00643B",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Outfit_700Bold",
                    color: "#fff",
                  }}
                >
                  View Animal
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RecordDetailModal;
