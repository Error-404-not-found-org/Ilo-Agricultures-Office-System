import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { toast } from "sonner-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/ui/Button";
import { AnimalSummaryCard } from "@/features/farmer-ui/components/AnimalSummaryCard";
import { useTechnicianClients } from "@/features/technician/hooks/useTechnicianClients";
import { getAnimalsByFarmer } from "@/features/technician/services/animalManagement.service";
import {
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "@/constants/address";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { getAIEligibility } from "@/lib/reproductionEligibility";
import { isCanonicalWorkflowId } from "@/features/technician-requests/utils/aiWorkflow";
import { AIRecordingFields } from "./AIRecordingFields";
import type {
  AIRecordingValues,
  RecordAIRouteMode,
  SelectedAnimal,
  SelectedFarmer,
} from "../types/technicianAIRecording.types";

interface DirectAIRecordFormProps {
  route: Extract<RecordAIRouteMode, { kind: "direct" }>;
  values: AIRecordingValues;
  saving: boolean;
  isHistoricalMode?: boolean;
  onValuesChange: (next: Partial<AIRecordingValues>) => void;
  onReview: (farmer: SelectedFarmer, animal: SelectedAnimal) => void;
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

const unwrapAnimals = (value: any): SelectedAnimal[] =>
  Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

export function DirectAIRecordForm({
  route,
  values,
  saving,
  isHistoricalMode,
  onValuesChange,
  onReview,
}: DirectAIRecordFormProps) {
  const api = useApi();
  const router = useRouter();
  const { colors } = useTheme();
  const { clientsQuery } = useTechnicianClients();
  const profilePrefillRef = useRef(false);
  const farmers = useMemo<SelectedFarmer[]>(
    () => (Array.isArray(clientsQuery.data) ? clientsQuery.data : []),
    [clientsQuery.data],
  );

  const [selectedFarmer, setSelectedFarmer] = useState<SelectedFarmer | null>(
    null,
  );
  const [selectedAnimal, setSelectedAnimal] = useState<SelectedAnimal | null>(
    null,
  );
  const [animals, setAnimals] = useState<SelectedAnimal[]>([]);
  const [loadingAnimals, setLoadingAnimals] = useState(false);
  const [profileContextLocked, setProfileContextLocked] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
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

  const eligibility = useMemo(
    () =>
      selectedAnimal ? getAIEligibility({ animal: selectedAnimal }) : null,
    [selectedAnimal],
  );

  useEffect(() => {
    if (route.source !== "animal-profile" || profilePrefillRef.current) return;

    if (
      !isCanonicalWorkflowId(route.farmerId) ||
      !isCanonicalWorkflowId(route.animalId)
    ) {
      profilePrefillRef.current = true;
      setProfileError(
        "The animal-profile recording link is missing a valid farmer or animal.",
      );
      return;
    }
    if (clientsQuery.isPending) return;
    if (farmers.length === 0) {
      profilePrefillRef.current = true;
      setProfileError(
        "The animal owner is not available in your assigned clients.",
      );
      return;
    }

    profilePrefillRef.current = true;
    const applyProfileContext = async () => {
      const farmer = farmers.find((item) => item._id === route.farmerId);
      if (!farmer) {
        setProfileError(
          "The animal owner is not available in your assigned clients.",
        );
        return;
      }

      setLoadingAnimals(true);
      try {
        const [farmerAnimalsResponse, animalResponse] = await Promise.all([
          getAnimalsByFarmer(api, farmer._id),
          api.get(`/animals/${route.animalId}`),
        ]);
        const farmerAnimals = unwrapAnimals(farmerAnimalsResponse);
        const animal = animalResponse.data?.data || animalResponse.data;
        const ownerId =
          typeof animal?.farmerId === "string"
            ? animal.farmerId
            : String(animal?.farmerId?._id || "");
        const belongsToFarmer = farmerAnimals.some(
          (item) => String(item._id) === route.animalId,
        );

        if (
          String(animal?._id || "") !== route.animalId ||
          ownerId !== route.farmerId ||
          !belongsToFarmer
        ) {
          throw new Error("ANIMAL_FARMER_MISMATCH");
        }

        setSelectedFarmer(farmer);
        setAnimals(farmerAnimals);
        setSelectedAnimal(animal);
        setProfileContextLocked(true);
        setProfileError(null);
      } catch (error) {
        console.error(error);
        setProfileError(
          "The selected animal does not match the farmer in this profile link. Choose a valid farmer and animal before continuing.",
        );
      } finally {
        setLoadingAnimals(false);
      }
    };

    void applyProfileContext();
  }, [api, clientsQuery.isPending, farmers, route]);

  const selectFarmer = async (farmer: SelectedFarmer) => {
    if (profileContextLocked || saving) return;
    setSelectedFarmer(farmer);
    setSelectedAnimal(null);
    setAnimals([]);
    setShowFarmerModal(false);
    setProfileError(null);
    setLoadingAnimals(true);
    try {
      const response = await getAnimalsByFarmer(api, farmer._id);
      setAnimals(unwrapAnimals(response));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load this farmer's animals.");
    } finally {
      setLoadingAnimals(false);
    }
  };

  const selectAnimal = async (animal: SelectedAnimal) => {
    if (!selectedFarmer || profileContextLocked || saving) return;
    setLoadingAnimals(true);
    try {
      const response = await api.get(`/animals/${animal._id}`);
      const detailedAnimal = response.data?.data || response.data;
      const ownerId =
        typeof detailedAnimal?.farmerId === "string"
          ? detailedAnimal.farmerId
          : String(detailedAnimal?.farmerId?._id || selectedFarmer._id);
      if (
        String(detailedAnimal?._id || "") !== String(animal._id) ||
        ownerId !== selectedFarmer._id
      ) {
        throw new Error("ANIMAL_FARMER_MISMATCH");
      }
      setSelectedAnimal(detailedAnimal);
      setShowAnimalModal(false);
      setProfileError(null);
    } catch (error) {
      console.error(error);
      toast.error("The selected animal does not belong to this farmer.");
    } finally {
      setLoadingAnimals(false);
    }
  };

  const review = () => {
    if (!selectedFarmer) {
      toast.error("Select a farmer before recording the service.");
      return;
    }
    if (!selectedAnimal) {
      toast.error("Select an animal before recording the service.");
      return;
    }
    if (eligibility && !eligibility.isEligible) {
      toast.error(
        eligibility.reason || "This animal is not eligible for AI service.",
      );
      return;
    }
    onReview(selectedFarmer, selectedAnimal);
  };

  return (
    <View style={{ padding: 16, paddingBottom: 72, gap: 14 }}>
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
          This form saves a completed AI service. It does not schedule future
          work.
        </Text>

        {profileError ? (
          <View
            style={{
              flexDirection: "row",
              padding: 12,
              marginTop: 14,
              borderRadius: 12,
              backgroundColor: colors.errorContainer,
            }}
          >
            <AlertTriangle size={18} color={colors.errorForeground} />
            <Text
              style={{
                flex: 1,
                color: colors.errorForeground,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
                lineHeight: 18,
                marginLeft: 8,
              }}
            >
              {profileError}
            </Text>
          </View>
        ) : null}

        {profileContextLocked && selectedFarmer && selectedAnimal ? (
          <View style={{ marginTop: 14 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 14,
              }}
            >
              {selectedFarmer.name}
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 2,
                marginBottom: 10,
              }}
            >
              {farmerAddress(selectedFarmer.address)}
            </Text>
            <AnimalSummaryCard
              animal={selectedAnimal}
              alert={
                eligibility && !eligibility.isEligible
                  ? eligibility.reason
                  : undefined
              }
            />
          </View>
        ) : (
          <>
            <TouchableOpacity
              disabled={saving || clientsQuery.isPending}
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
              {clientsQuery.isPending ? (
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
                    alert={
                      eligibility && !eligibility.isEligible
                        ? eligibility.reason
                        : undefined
                    }
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
        )}
      </View>

      {selectedAnimal && eligibility && !eligibility.isEligible ? (
        <View
          style={{
            flexDirection: "row",
            padding: 13,
            borderWidth: 1,
            borderColor: colors.errorForeground,
            borderRadius: 14,
            backgroundColor: colors.errorContainer,
          }}
        >
          <AlertTriangle size={18} color={colors.errorForeground} />
          <Text
            style={{
              flex: 1,
              color: colors.errorForeground,
              fontFamily: "Outfit_500Medium",
              fontSize: 12,
              lineHeight: 18,
              marginLeft: 8,
            }}
          >
            {eligibility.reason}
          </Text>
        </View>
      ) : null}

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
            marginBottom: 14,
          }}
        >
          {isHistoricalMode ? "Previous AI Service Details" : "Actual Service Details"}
        </Text>
        <AIRecordingFields
          values={values}
          disabled={saving}
          isHistoricalMode={isHistoricalMode}
          onDateChange={(inseminationDate) =>
            onValuesChange({ inseminationDate })
          }
          onTimeChange={(inseminationTime) =>
            onValuesChange({ inseminationTime })
          }
          onEstrusChange={(estrus) => onValuesChange({ estrus })}
          onSireBreedChange={(sireBreed) => onValuesChange({ sireBreed })}
          onSireCodeChange={(sireCode) => onValuesChange({ sireCode })}
          onSemenDosesChange={(semenDosesUsed) =>
            onValuesChange({ semenDosesUsed })
          }
          onTechnicianNoteChange={(technicianNote) =>
            onValuesChange({ technicianNote })
          }
        />
      </View>

      <Button
        label="Review & Complete"
        size="lg"
        style={{ marginTop: 10 }}
        loading={saving}
        disabled={saving || Boolean(eligibility && !eligibility.isEligible)}
        onPress={review}
      />

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

            {clientsQuery.isPending ? (
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
