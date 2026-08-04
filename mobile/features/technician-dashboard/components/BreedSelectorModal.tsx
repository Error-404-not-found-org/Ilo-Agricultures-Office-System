import React from "react";
import { View, TouchableOpacity, Modal, ScrollView } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { X } from "lucide-react-native";
import { CATTLE_BREEDS } from "@/lib/constants";
import { getSireCodeByBreed } from "@/lib/sireRegistry";

interface BreedSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  sireBreed: string;
  onSelectBreed: (breed: string, code: string) => void;
}

export function BreedSelectorModal({
  visible,
  onClose,
  sireBreed,
  onSelectBreed,
}: BreedSelectorModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 40,
            borderTopRightRadius: 40,
            maxHeight: "85%",
          }}
        >
          <View
            style={{
              padding: 24,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text variant="black" size={20}>
                Sire Registry
              </Text>
              <Text
                variant="bold"
                color="muted"
                size={10}
                style={{
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Official Breed List
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isDark ? "#1f2937" : "#f1f5f9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              {CATTLE_BREEDS.map((breed: string) => (
                <TouchableOpacity
                  key={breed}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelectBreed(breed, getSireCodeByBreed(breed));
                  }}
                  style={{
                    padding: 16,
                    borderRadius: 20,
                    backgroundColor:
                      sireBreed === breed
                        ? colors.primary
                        : isDark
                          ? "#1f2937"
                          : "#f8fafc",
                    borderWidth: 1,
                    borderColor:
                      sireBreed === breed ? colors.primary : colors.border,
                    width: "48%",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor:
                      sireBreed === breed ? colors.primary : "#000",
                    shadowOpacity: sireBreed === breed ? 0.1 : 0,
                    shadowRadius: 10,
                    elevation: sireBreed === breed ? 2 : 0,
                  }}
                >
                  <Text
                    variant="extrabold"
                    size={14}
                    style={{
                      color:
                        sireBreed === breed ? "#fff" : colors.textPrimary,
                      textAlign: "center",
                    }}
                  >
                    {breed}
                  </Text>
                  <Text
                    variant="semibold"
                    size={9}
                    style={{
                      color:
                        sireBreed === breed
                          ? "rgba(255,255,255,0.7)"
                          : colors.textMuted,
                      textTransform: "uppercase",
                      marginTop: 2,
                    }}
                  >
                    {getSireCodeByBreed(breed) || "N/A"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
