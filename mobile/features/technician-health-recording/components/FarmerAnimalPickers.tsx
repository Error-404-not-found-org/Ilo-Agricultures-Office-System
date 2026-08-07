import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Search,
  UserRound,
  X,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { AnimalSummaryCard } from "@/features/farmer-ui/components/AnimalSummaryCard";
import {
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "@/constants/address";
import { useTheme } from "@/lib/theme";

interface FarmerAnimalPickersProps {
  selectedFarmer: any | null;
  selectedAnimal: any | null;
  setSelectedFarmer: (farmer: any) => void;
  setSelectedAnimal: (animal: any) => void;
  farmers: any[];
  animals: any[];
  loadingAnimals: boolean;
  saving?: boolean;
  clientsLoading?: boolean;
}

const farmerAddress = (address: any) => {
  if (!address) return "No address provided";
  if (typeof address === "string") return address;
  return (
    [address.barangay, address.city, address.province]
      .filter(Boolean)
      .join(", ") || "No address provided"
  );
};

export default function FarmerAnimalPickers({
  selectedFarmer,
  selectedAnimal,
  setSelectedFarmer,
  setSelectedAnimal,
  farmers,
  animals,
  loadingAnimals,
  saving = false,
  clientsLoading = false,
}: FarmerAnimalPickersProps) {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [showAnimalModal, setShowAnimalModal] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState("");
  const [municipality, setMunicipality] = useState<string | null>(null);
  const [barangay, setBarangay] = useState<string | null>(null);
  const [filterPickerMode, setFilterPickerMode] = useState<
    "municipality" | "barangay" | null
  >(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const barangayOptions = useMemo(() => {
    if (!municipality) return [];
    return getIloiloBarangayOptions(municipality);
  }, [municipality]);

  const filteredFarmers = useMemo(() => {
    const search = farmerSearch.trim().toLowerCase();
    return farmers.filter((farmer) => {
      const city = String(
        farmer.address?.city || farmer.address?.municipality || "",
      ).toLowerCase();
      const brgy = String(farmer.address?.barangay || "").toLowerCase();
      if (municipality && city !== municipality.toLowerCase()) return false;
      if (barangay && brgy !== barangay.toLowerCase()) return false;
      if (!search) return true;
      return (
        String(farmer.name || "")
          .toLowerCase()
          .includes(search) || String(farmer.phoneNumber || "").includes(search)
      );
    });
  }, [farmerSearch, farmers, municipality, barangay]);

  const selectFarmer = (farmer: any) => {
    if (saving) return;
    setSelectedFarmer(farmer);
    setShowFarmerModal(false);
  };

  const selectAnimal = (animal: any) => {
    if (!selectedFarmer || saving) return;
    setSelectedAnimal(animal);
    setShowAnimalModal(false);
  };

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          backgroundColor: colors.card,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 15,
          }}
        >
          Farmer and Animal
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_500Medium",
            fontSize: 12,
            lineHeight: 18,
            marginTop: 3,
          }}
        >
          This form saves a completed health service. It does not schedule future
          work.
        </Text>

        <>
          <TouchableOpacity
            disabled={saving || clientsLoading}
            onPress={() => setShowFarmerModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Select farmer"
            style={{
              minHeight: 54,
              flexDirection: "row",
              alignItems: "center",
              marginTop: 14,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
              opacity: saving ? 0.55 : 1,
            }}
          >
            {selectedFarmer?.imageUrl ||
            selectedFarmer?.farmerImageUrl ||
            selectedFarmer?.photo ||
            selectedFarmer?.avatar ||
            selectedFarmer?.image ? (
              <Image
                source={{
                  uri:
                    selectedFarmer?.imageUrl ||
                    selectedFarmer?.farmerImageUrl ||
                    selectedFarmer?.photo ||
                    selectedFarmer?.avatar ||
                    selectedFarmer?.image,
                }}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: colors.border,
                }}
              />
            ) : (
              <UserRound size={19} color={colors.primary} />
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={{
                  color: selectedFarmer
                    ? colors.textPrimary
                    : colors.textMuted,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 14,
                }}
              >
                {selectedFarmer?.name || "Select farmer"}
              </Text>
              {selectedFarmer ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 10,
                    marginTop: 2,
                  }}
                >
                  {farmerAddress(selectedFarmer.address)}
                </Text>
              ) : null}
            </View>
            {clientsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ChevronDown size={19} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {selectedFarmer ? (
            <View style={{ marginTop: 12 }}>
              {loadingAnimals ? (
                <View style={{ paddingVertical: 22, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : selectedAnimal ? (
                <AnimalSummaryCard
                  animal={selectedAnimal}
                  onPress={() => setShowAnimalModal(true)}
                />
              ) : animals.length > 0 ? (
                <TouchableOpacity
                  disabled={saving}
                  onPress={() => setShowAnimalModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Select animal"
                  style={{
                    minHeight: 54,
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 14,
                    backgroundColor: colors.background,
                  }}
                >
                  <MaterialCommunityIcons
                    name="cow"
                    size={21}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: colors.textMuted,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 14,
                      marginLeft: 10,
                    }}
                  >
                    Select animal
                  </Text>
                  <ChevronDown size={19} color={colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <View
                  style={{
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.warning,
                    borderRadius: 14,
                    backgroundColor: colors.warningContainer,
                  }}
                >
                  <Text
                    style={{
                      color: colors.warningForeground,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                      lineHeight: 18,
                      textAlign: "center",
                    }}
                  >
                    This farmer has no registered animals.
                  </Text>
                  <Button
                    variant="outline"
                    label="Register Animal"
                    className="mt-3 font-bold text-primary"
                    onPress={() =>
                      router.push({
                        pathname: "/(technician)/register-animal",
                        params: {
                          farmerId: selectedFarmer._id,
                          farmerName: selectedFarmer.name,
                          phoneNumber:
                            selectedFarmer.phoneNumber || undefined,
                          barangay: selectedFarmer.address?.barangay,
                          municipality: selectedFarmer.address?.city,
                        },
                      })
                    }
                  />
                </View>
              )}
            </View>
          ) : null}
        </>
      </View>

      <Modal
        visible={showFarmerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFarmerModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: colors.modalBackdrop,
          }}
        >
          <View
            style={{
              height: "82%",
              padding: 20,
              paddingBottom: 36,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 20,
                }}
              >
                Select Farmer
              </Text>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                accessibilityLabel="Close farmer selection"
                style={{ padding: 10 }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                marginTop: 14,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.background,
              }}
            >
              <Search size={18} color={colors.textMuted} />
              <TextInput
                value={farmerSearch}
                onChangeText={setFarmerSearch}
                placeholder="Search name or phone"
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  color: colors.textPrimary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 14,
                  marginLeft: 9,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginVertical: 12,
              }}
            >
              {/* MUNICIPALITY DROPDOWN BUTTON */}
              <TouchableOpacity
                onPress={() => {
                  setPickerSearch("");
                  setFilterPickerMode("municipality");
                }}
                style={{
                  flex: 1,
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: municipality ? colors.primary : colors.border,
                  borderRadius: 12,
                  backgroundColor: municipality
                    ? colors.primary + "10"
                    : colors.card,
                }}
              >
                <View style={{ flex: 1, marginRight: 4 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Outfit_500Medium",
                      color: colors.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    Municipality
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 13,
                      fontFamily: "Outfit_600SemiBold",
                      color: municipality ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {municipality || "All Municipalities"}
                  </Text>
                </View>
                <ChevronDown
                  size={16}
                  color={municipality ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              {/* BARANGAY DROPDOWN BUTTON */}
              <TouchableOpacity
                disabled={!municipality}
                onPress={() => {
                  setPickerSearch("");
                  setFilterPickerMode("barangay");
                }}
                style={{
                  flex: 1,
                  minHeight: 46,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: barangay ? colors.primary : colors.border,
                  borderRadius: 12,
                  backgroundColor: barangay
                    ? colors.primary + "10"
                    : colors.card,
                  opacity: !municipality ? 0.5 : 1,
                }}
              >
                <View style={{ flex: 1, marginRight: 4 }}>
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Outfit_500Medium",
                      color: colors.textMuted,
                      textTransform: "uppercase",
                    }}
                  >
                    Barangay
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 13,
                      fontFamily: "Outfit_600SemiBold",
                      color: barangay ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {barangay ||
                      (municipality ? "All Barangays" : "Select Muni First")}
                  </Text>
                </View>
                <ChevronDown
                  size={16}
                  color={barangay ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {clientsLoading ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                data={filteredFarmers}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 13,
                      textAlign: "center",
                      paddingVertical: 40,
                    }}
                  >
                    No farmers match these filters.
                  </Text>
                }
                renderItem={({ item }) => {
                  const selected = selectedFarmer?._id === item._id;
                  return (
                    <TouchableOpacity
                      onPress={() => void selectFarmer(item)}
                      style={{
                        minHeight: 66,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 13,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      {item.imageUrl ||
                      item.farmerImageUrl ||
                      item.photo ||
                      item.avatar ||
                      item.image ? (
                        <Image
                          source={{
                            uri:
                              item.imageUrl ||
                              item.farmerImageUrl ||
                              item.photo ||
                              item.avatar ||
                              item.image,
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            backgroundColor: colors.border,
                          }}
                        />
                      ) : (
                        <UserRound size={20} color={colors.primary} />
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: "Outfit_700Bold",
                            fontSize: 14,
                          }}
                        >
                          {item.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.textSecondary,
                            fontFamily: "Outfit_500Medium",
                            fontSize: 10,
                            marginTop: 2,
                          }}
                        >
                          {farmerAddress(item.address)} ·{" "}
                          {item.phoneNumber || "No phone"}
                        </Text>
                      </View>
                      {selected ? (
                        <Check size={19} color={colors.primary} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAnimalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAnimalModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: colors.modalBackdrop,
          }}
        >
          <View
            style={{
              maxHeight: "78%",
              padding: 20,
              paddingBottom: 36,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 20,
                }}
              >
                Select Animal
              </Text>
              <TouchableOpacity
                onPress={() => setShowAnimalModal(false)}
                accessibilityLabel="Close animal selection"
                style={{ padding: 10 }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={animals}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <AnimalSummaryCard
                  animal={item}
                  onPress={() => void selectAnimal(item)}
                  alert={
                    selectedAnimal?._id === item._id
                      ? "Currently selected"
                      : undefined
                  }
                />
              )}
            />
          </View>
        </View>
      </Modal>

      {/* MUNICIPALITY / BARANGAY FILTER PICKER MODAL */}
      <Modal
        visible={filterPickerMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterPickerMode(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.modalBackdrop,
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              maxHeight: "80%",
              borderRadius: 20,
              backgroundColor: colors.card,
              padding: 18,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textPrimary,
                }}
              >
                {filterPickerMode === "municipality"
                  ? "Select Municipality"
                  : `Select Barangay (${municipality || ""})`}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterPickerMode(null)}
                style={{ padding: 4 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={{
                minHeight: 42,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                backgroundColor: colors.background,
                marginBottom: 10,
              }}
            >
              <Search size={16} color={colors.textMuted} />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search..."
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 13,
                  color: colors.textPrimary,
                  fontFamily: "Outfit_500Medium",
                }}
              />
            </View>

            <FlatList
              data={[
                filterPickerMode === "municipality"
                  ? "All Municipalities"
                  : "All Barangays",
                ...(filterPickerMode === "municipality"
                  ? ILOILO_MUNICIPALITY_OPTIONS.filter((item) =>
                      item.toLowerCase().includes(pickerSearch.toLowerCase()),
                    )
                  : barangayOptions.filter((item) =>
                      item.toLowerCase().includes(pickerSearch.toLowerCase()),
                    )),
              ]}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isAll =
                  item === "All Municipalities" || item === "All Barangays";
                const isSelected = isAll
                  ? filterPickerMode === "municipality"
                    ? !municipality
                    : !barangay
                  : filterPickerMode === "municipality"
                    ? municipality === item
                    : barangay === item;

                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (filterPickerMode === "municipality") {
                        if (isAll) {
                          setMunicipality(null);
                          setBarangay(null);
                        } else {
                          setMunicipality(item);
                          setBarangay(null);
                        }
                      } else {
                        if (isAll) {
                          setBarangay(null);
                        } else {
                          setBarangay(item);
                        }
                      }
                      setFilterPickerMode(null);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontFamily: isSelected
                          ? "Outfit_700Bold"
                          : "Outfit_500Medium",
                        color: isSelected ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {item}
                    </Text>
                    {isSelected ? (
                      <Check size={18} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
