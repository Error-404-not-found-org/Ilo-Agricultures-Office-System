import React from "react";
import { View, TouchableOpacity, Modal, Image, Linking } from "react-native";
import { X, MapPin, Calendar, Clock, Phone, ChevronRight, Trash2 } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { ActivityIndicator } from "react-native";
import { getDisplayDate } from "../utils/ledgerExport";

const PRIMARY = "#00643B";

interface LedgerDetailModalProps {
  visible: boolean;
  item: any;
  onClose: () => void;
  onDelete: (item: any) => void;
  isDeleting: boolean;
  router: any;
}

export function LedgerDetailModal({
  visible,
  item,
  onClose,
  onDelete,
  isDeleting,
  router,
}: LedgerDetailModalProps) {
  const { colors, isDark } = useTheme();

  if (!item) return null;

  const farmer = item.farmerId || {};
  const animal = item.animalId || (item.animalIds && item.animalIds[0]) || {};

  const dateRaw = getDisplayDate(item);
  const date = dateRaw
    ? new Date(dateRaw).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";
  const time = dateRaw
    ? new Date(dateRaw).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  const address = farmer.address
    ? [farmer.address.street, farmer.address.barangay, farmer.address.city]
        .filter(Boolean)
        .join(", ")
    : "No address provided";

  const handleCall = () => {
    const phone = farmer.address?.phoneNumber || farmer.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const status = item.status?.toUpperCase() || "COMPLETED";
  const statusColor =
    item.status === "pending"
      ? "#f59e0b"
      : item.status === "rejected"
        ? "#ef4444"
        : "#10b981";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View
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
              width: 40,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Outfit_900Black",
                    color: isDark ? colors.primary : PRIMARY,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  RECORD DETAILS
                </Text>
                <View
                  style={{
                    backgroundColor: `${statusColor}20`,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontFamily: "Outfit_800ExtraBold",
                      color: statusColor,
                    }}
                  >
                    {status}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 24,
                  fontFamily: "Outfit_900Black",
                  color: colors.textPrimary,
                }}
              >
                {item.type === "insemination"
                  ? "AI Insemination"
                  : item.type === "health-request"
                    ? "Health Assistance / Visit"
                    : item.type === "pregnancy"
                      ? "Pregnancy Check"
                      : item.type === "calving"
                        ? "Calving / Offspring"
                        : "Medical Record"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 24,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 3,
                  borderColor: isDark ? "rgba(16,185,129,0.2)" : "#ecfdf5",
                  overflow: "hidden",
                }}
              >
                {farmer.imageUrl || farmer.photoUrl || farmer.image ? (
                  <Image
                    source={{
                      uri: farmer.imageUrl || farmer.photoUrl || farmer.image,
                    }}
                    style={{ width: 60, height: 60 }}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="account"
                    size={32}
                    color={isDark ? colors.primary : PRIMARY}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Outfit_800ExtraBold",
                    color: colors.textPrimary,
                  }}
                >
                  {farmer.name || "Unknown Farmer"}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Outfit_600SemiBold",
                    color: colors.textSecondary,
                  }}
                >
                  Farmer Owner
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleCall}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isDark ? colors.primary : PRIMARY,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Phone size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: colors.border,
                marginVertical: 16,
              }}
            />

            <View style={{ gap: 12 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <MapPin size={16} color={isDark ? colors.primary : PRIMARY} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_500Medium",
                    color: colors.textSecondary,
                    flex: 1,
                  }}
                >
                  {address}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Calendar size={16} color={isDark ? colors.primary : PRIMARY} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_500Medium",
                    color: colors.textSecondary,
                  }}
                >
                  {date}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Clock size={16} color={isDark ? colors.primary : PRIMARY} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_500Medium",
                    color: colors.textSecondary,
                  }}
                >
                  {time}
                </Text>
              </View>

              {/* Specific Record Technical Details */}
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 4,
                }}
              />

              {item.type === "insemination" && (
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Attempt No.
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_900Black",
                        fontSize: 12,
                      }}
                    >
                      #{item.attemptNumber || 1}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Sire Code
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_900Black",
                        fontSize: 12,
                      }}
                    >
                      {item.sireCode || "N/A"}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Pregnancy Status
                    </Text>
                    <Text
                      style={{
                        color:
                          item.pregnancyStatus === "Pregnant"
                            ? "#10b981"
                            : colors.textSecondary,
                        fontFamily: "Outfit_900Black",
                        fontSize: 12,
                      }}
                    >
                      {item.pregnancyStatus || "Pending"}
                    </Text>
                  </View>
                </View>
              )}

              {item.type === "health-request" && (
                <View style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Type of Service
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: "Outfit_900Black",
                        fontSize: 12,
                      }}
                    >
                      {item.typeOfService || "Medical Check"}
                    </Text>
                  </View>
                  {item.details?.medicineName && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontFamily: "Outfit_700Bold",
                          fontSize: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        Medicine
                      </Text>
                      <Text
                        style={{
                          color: isDark ? colors.primary : "#047857",
                          fontFamily: "Outfit_900Black",
                          fontSize: 12,
                        }}
                      >
                        {item.details.medicineName}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {(item.note || item.technicianNote || item.remarks) && (
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(226, 232, 240, 0.5)",
                    padding: 12,
                    borderRadius: 12,
                    borderStyle: "solid",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_900Black",
                      fontSize: 8,
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Remarks / Notes
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      fontStyle: "italic",
                    }}
                  >
                    &quot;{item.note || item.technicianNote || item.remarks}
                    &quot;
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingHorizontal: 4,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.15)"
                  : "#eff6ff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name="cow" size={24} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textPrimary,
                }}
              >
                Target: {animal.earTag || animal.animalId || "No Tag"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textSecondary,
                }}
              >
                {animal.breed || "Unknown"} · {animal.species || "Unknown"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                router.push(
                  `/(technician)/animal-details?id=${animal._id || animal.id}`
                );
              }}
              style={{
                flex: 3,
                backgroundColor: isDark ? colors.primary : PRIMARY,
                paddingVertical: 16,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 15,
                }}
              >
                View Profile
              </Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onDelete(item)}
              disabled={isDeleting}
              style={{
                width: 56,
                height: 56,
                borderRadius: 20,
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fee2e2",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#fecaca",
              }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Trash2 size={22} color="#ef4444" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
