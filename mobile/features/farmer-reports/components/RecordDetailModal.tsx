import React from "react";
import { Modal, View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { Info, X, Syringe, Stethoscope } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { useTheme } from "@/lib/theme";
import type { ActivityFeedItem } from "../types/farmerReports.types";
import DetailRow from "./DetailRow";

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
              <View style={{ gap: 20 }}>
                {/* Category Header Card */}
                <View
                  style={{
                    alignItems: "center",
                    gap: 8,
                    paddingBottom: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 18,
                      backgroundColor:
                        selectedActivity.type === "health"
                          ? isDark
                            ? "rgba(239, 68, 68, 0.15)"
                            : "#fef2f2"
                          : selectedActivity.type === "ai"
                            ? isDark
                              ? "rgba(59, 130, 246, 0.15)"
                              : "#eff6ff"
                            : isDark
                              ? "rgba(16, 185, 129, 0.15)"
                              : "#f0fdf4",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selectedActivity.type === "ai" ? (
                      <Syringe size={26} color="#2563eb" />
                    ) : selectedActivity.type === "health" ? (
                      <Stethoscope size={26} color="#dc2626" />
                    ) : (
                      <MaterialCommunityIcons
                        name="cow"
                        size={30}
                        color="#b45309"
                      />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textPrimary,
                      textAlign: "center",
                    }}
                  >
                    {selectedActivity.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Outfit_700Bold",
                      color: colors.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {selectedActivity.date
                      ? format(
                          new Date(selectedActivity.date),
                          "MMMM dd, yyyy • h:mm a",
                        )
                      : "No Date"}
                  </Text>
                </View>

                {/* Animal Info */}
                {selectedActivity.animalId && (
                  <View
                    style={{
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.03)"
                        : "#f8fafc",
                      borderRadius: 16,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Outfit_800ExtraBold",
                        color: colors.textMuted,
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Subject Animal
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: "Outfit_700Bold",
                        color: colors.textPrimary,
                      }}
                    >
                      Tag: #{selectedActivity.animalId.earTag || "No Tag"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Outfit_500Medium",
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {selectedActivity.animalId.breed || "Unknown Breed"} •{" "}
                      {selectedActivity.animalId.species || "Unknown Species"}
                    </Text>
                  </View>
                )}

                {/* Detailed Information */}
                <View style={{ gap: 14 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Outfit_800ExtraBold",
                      color: colors.textMuted,
                      textTransform: "uppercase",
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      paddingBottom: 4,
                    }}
                  >
                    Details
                  </Text>

                  {!selectedActivity.details ? (
                    <View
                      style={{
                        padding: 12,
                        backgroundColor: isDark
                          ? "rgba(239, 68, 68, 0.1)"
                          : "#fef2f2",
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isDark
                          ? "rgba(239, 68, 68, 0.2)"
                          : "#fee2e2",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Outfit_500Medium",
                          color: isDark ? "#f87171" : "#dc2626",
                          lineHeight: 18,
                        }}
                      >
                        ⚠️ Detailed data is missing from the server response.
                        If running locally, please restart your backend server
                        (`npm run dev`) and reload the mobile app to apply the
                        updates.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {selectedActivity.type === "ai" && (
                        <View style={{ gap: 10 }}>
                          <DetailRow
                            label="Status"
                            value={
                              selectedActivity.details.status === "rejected"
                                ? "Declined"
                                : selectedActivity.details.status ===
                                    "cancelled"
                                  ? "Cancelled"
                                  : selectedActivity.details.status ===
                                      "approved"
                                    ? "Accepted"
                                    : selectedActivity.details.status ===
                                        "done"
                                      ? "Completed"
                                      : selectedActivity.details.status
                            }
                            highlightColor={
                              selectedActivity.details.status ===
                                "rejected" ||
                              selectedActivity.details.status === "cancelled"
                                ? "#dc2626"
                                : selectedActivity.details.status ===
                                      "approved" ||
                                    selectedActivity.details.status === "done"
                                  ? "#00643B"
                                  : "#d97706"
                            }
                          />
                          <DetailRow
                            label="Sire Breed"
                            value={selectedActivity.details.sireBreed}
                          />
                          <DetailRow
                            label="Sire Code"
                            value={selectedActivity.details.sireCode}
                          />
                          <DetailRow
                            label="Attempt Number"
                            value={selectedActivity.details.attemptNumber?.toString()}
                          />
                          <DetailRow
                            label="Estrus Type"
                            value={selectedActivity.details.estrus}
                          />
                          <DetailRow
                            label="Outcome"
                            value={selectedActivity.details.outcome}
                            highlightColor={
                              selectedActivity.details.outcome?.toLowerCase() ===
                              "success"
                                ? "#059669"
                                : selectedActivity.details.outcome?.toLowerCase() ===
                                    "failed"
                                  ? "#dc2626"
                                  : undefined
                            }
                          />
                          <DetailRow
                            label="Technician"
                            value={selectedActivity.details.technician}
                          />
                        </View>
                      )}

                      {selectedActivity.type === "health" && (
                        <View style={{ gap: 10 }}>
                          <DetailRow
                            label="Status"
                            value={
                              selectedActivity.details.status === "rejected"
                                ? "Declined"
                                : selectedActivity.details.status ===
                                    "cancelled"
                                  ? "Cancelled"
                                  : selectedActivity.details.status ===
                                      "approved"
                                    ? "Accepted"
                                    : selectedActivity.details.status ===
                                        "resolved"
                                      ? "Completed"
                                      : selectedActivity.details.status
                            }
                            highlightColor={
                              selectedActivity.details.status ===
                                "rejected" ||
                              selectedActivity.details.status === "cancelled"
                                ? "#dc2626"
                                : selectedActivity.details.status ===
                                      "approved" ||
                                    selectedActivity.details.status ===
                                      "resolved"
                                  ? "#00643B"
                                  : "#d97706"
                            }
                          />
                          <DetailRow
                            label="Request Type"
                            value={selectedActivity.details.requestType}
                          />
                          <DetailRow
                            label="Symptoms"
                            value={selectedActivity.details.symptoms}
                          />
                          <DetailRow
                            label="Urgency"
                            value={selectedActivity.details.urgency}
                            highlightColor={
                              selectedActivity.details.urgency?.toLowerCase() ===
                              "high"
                                ? "#dc2626"
                                : selectedActivity.details.urgency?.toLowerCase() ===
                                    "medium"
                                  ? "#d97706"
                                  : "#059669"
                            }
                          />
                          <DetailRow
                            label="Diagnosis"
                            value={selectedActivity.details.diagnosis}
                          />
                          <DetailRow
                            label="Treatment"
                            value={selectedActivity.details.treatment}
                          />
                          <DetailRow
                            label="Medicine / Advice"
                            value={selectedActivity.details.advice}
                          />
                          <DetailRow
                            label="Technician / Vet"
                            value={selectedActivity.details.technician}
                          />
                        </View>
                      )}

                      {selectedActivity.type === "calving" && (
                        <View style={{ gap: 10 }}>
                          <DetailRow
                            label="Calving Ease"
                            value={selectedActivity.details.calvingEase}
                          />
                          <DetailRow
                            label="Number of Calves"
                            value={selectedActivity.details.numberOfCalves?.toString()}
                          />
                          <DetailRow
                            label="Technician"
                            value={selectedActivity.details.technician}
                          />

                          {selectedActivity.details.calves &&
                            selectedActivity.details.calves.length > 0 && (
                              <View style={{ marginTop: 8, gap: 6 }}>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "Outfit_700Bold",
                                    color: colors.textSecondary,
                                  }}
                                >
                                  Calves Registered:
                                </Text>
                                {selectedActivity.details.calves.map(
                                  (calf, index) => (
                                    <View
                                      key={index}
                                      style={{
                                        backgroundColor: isDark
                                          ? "rgba(255,255,255,0.02)"
                                          : "#f8fafc",
                                        padding: 8,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 12,
                                          fontFamily: "Outfit_700Bold",
                                          color: colors.textPrimary,
                                        }}
                                      >
                                        Calf #{index + 1}: {calf.sex}
                                      </Text>
                                      {calf.earTag && (
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontFamily: "Outfit_500Medium",
                                            color: colors.textSecondary,
                                          }}
                                        >
                                          Tag: #{calf.earTag}
                                        </Text>
                                      )}
                                      {calf.weight && (
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontFamily: "Outfit_500Medium",
                                            color: colors.textSecondary,
                                          }}
                                        >
                                          Weight: {calf.weight} kg
                                        </Text>
                                      )}
                                      {calf.imageUrl ? (
                                        <View
                                          style={{
                                            marginTop: 8,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                          }}
                                        >
                                          <Image
                                            source={{ uri: calf.imageUrl }}
                                            style={{
                                              width: "100%",
                                              height: 150,
                                            }}
                                            resizeMode="cover"
                                          />
                                        </View>
                                      ) : null}
                                    </View>
                                  ),
                                )}
                              </View>
                            )}
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* Technician Notes */}
                {selectedActivity.details?.technicianNote && (
                  <View
                    style={{
                      gap: 6,
                      backgroundColor: isDark
                        ? "rgba(0, 100, 59, 0.05)"
                        : "#f0fdf4",
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(0, 100, 59, 0.2)"
                        : "#d1fae5",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Outfit_800ExtraBold",
                        color: isDark ? "#34d399" : "#00643B",
                        textTransform: "uppercase",
                      }}
                    >
                      Observations / Notes
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Outfit_500Medium",
                        color: colors.textPrimary,
                        fontStyle: "italic",
                        lineHeight: 18,
                      }}
                    >
                      &quot;{selectedActivity.details.technicianNote}&quot;
                    </Text>
                  </View>
                )}
              </View>
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
