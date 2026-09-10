import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBadge } from "@/components/shared";
import { toast } from "sonner-native";
import { useAnimalTimeline } from "@/features/animal-records/hooks/useAnimalTimeline";
import { TimelineList } from "@/features/farmer-ui/components";

const PRIMARY = "#1e3a5f";
const TABS = ["Info", "Timeline", "Medical"];

export default function AdminAnimalDetailsScreen() {
  const { colors } = useTheme();
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState("Info");
  const [timelineFilter, setTimelineFilter] = useState("All");

  // 1. Fetch Animal Details
  const {
    data: animal,
    isLoading: isDetailsLoading,
  } = useQuery<any>({
    queryKey: ["admin-animal-details", id],
    queryFn: async () => {
      const res = await api.get(`/animals/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // 2. Fetch Medical Records
  const {
    data: medicalRecords = [],
    isLoading: isMedicalLoading,
  } = useQuery<any[]>({
    queryKey: ["admin-animal-medical", id],
    queryFn: async () => {
      const res = await api.get(`/medical/${id}`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
    enabled: !!id,
  });

  // 3. Fetch Reproductive Timeline
  const {
    data: timelineData,
    isLoading: isTimelineLoading,
  } = useAnimalTimeline({ animalId: id as string, type: timelineFilter });

  // 4. Archive Animal Mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/animals/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Animal archived successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-animals"] });
      router.back();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to archive animal.");
    },
  });

  const handleArchive = () => {
    Alert.alert(
      "Archive Animal",
      "Are you sure you want to archive this animal profile? This will soft-delete the animal from the active registry.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", style: "destructive", onPress: () => archiveMutation.mutate() },
      ]
    );
  };

  if (isDetailsLoading) {
    return (
      <ScreenLayout>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
            Animal Details
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </ScreenLayout>
    );
  }

  if (!animal) {
    return (
      <ScreenLayout>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 12,
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
            Animal Details
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
          <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textSecondary }}>
            Animal profile not found or deleted.
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      {/* Custom back-header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: "Outfit_800ExtraBold", fontSize: 18, color: colors.textPrimary, marginLeft: 8, flex: 1 }}>
          Animal details
        </Text>
        <TouchableOpacity onPress={handleArchive} style={{ padding: 8, marginRight: -8 }}>
          <MaterialCommunityIcons name="archive-arrow-down-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 10, marginHorizontal: 20, marginVertical: 14 }}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: activeTab === tab ? PRIMARY : colors.card,
              borderWidth: 1,
              borderColor: activeTab === tab ? PRIMARY : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_700Bold",
                color: activeTab === tab ? "#fff" : colors.textSecondary,
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        {activeTab === "Info" && (
          <View style={{ gap: 16 }}>
            {/* Core Info */}
            <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 12 }}>
                REGISTRY SPECIFICATIONS
              </Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Species</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{animal.species || "Cattle"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Breed</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{animal.breed || "Unknown"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Sex</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary, textTransform: "capitalize" }}>{animal.gender || "female"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Ear Tag</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{animal.earTag || "None"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Birth Date</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
                    {animal.birthDate ? new Date(animal.birthDate).toLocaleDateString() : "Unknown"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Reproductive Status</Text>
                  <StatusBadge label={animal.reproductiveStatus || "Normal"} />
                </View>
              </View>
            </View>

            {/* Owner/Farmer Info */}
            {animal.farmerId && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/(admin)/user-details" as any, params: { id: animal.farmerId._id || animal.farmerId } })}
                style={{
                  backgroundColor: colors.card,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 8 }}>
                    OWNER / FARMER
                  </Text>
                  <Text style={{ fontSize: 15, fontFamily: "Outfit_700Bold", color: colors.textPrimary, marginBottom: 4 }}>
                    {animal.farmerId.name || "Farmer"}
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                    Barangay: {animal.farmerId.address?.barangay || "Not set"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Lineage Info */}
            <View style={{ backgroundColor: colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit_800ExtraBold", color: colors.textSecondary, marginBottom: 12 }}>
                LINEAGE & PEDIGREE
              </Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Sire (Father)</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{animal.sire || "Not Recorded"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>Dam (Mother)</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>{animal.dam || "Not Recorded"}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === "Timeline" && (
          <View style={{ flex: 1 }}>
            {isTimelineLoading ? (
              <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }} />
            ) : (
              <TimelineList
                events={timelineData?.events || []}
                filter={timelineFilter}
                onFilterChange={setTimelineFilter}
              />
            )}
          </View>
        )}

        {activeTab === "Medical" && (
          <View style={{ gap: 12 }}>
            {isMedicalLoading ? (
              <ActivityIndicator color={PRIMARY} style={{ marginVertical: 20 }} />
            ) : medicalRecords.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <MaterialCommunityIcons name="stethoscope" size={48} color={colors.textSecondary} style={{ opacity: 0.5 }} />
                <Text style={{ marginTop: 12, fontSize: 13, color: colors.textSecondary, fontFamily: "Outfit_600SemiBold" }}>
                  No medical logs found for this animal.
                </Text>
              </View>
            ) : (
              medicalRecords.map((rec) => (
                <View
                  key={rec._id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary }}>
                      {rec.recordKind || rec.requestType || "Medical Treatment"}
                    </Text>
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      {new Date(rec.recordDate || rec.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {rec.diagnosis && (
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                      Diagnosis: {rec.diagnosis}
                    </Text>
                  )}
                  {rec.treatment && (
                    <Text style={{ fontSize: 13, fontFamily: "Outfit_600SemiBold", color: colors.textSecondary, marginBottom: 4 }}>
                      Treatment: {rec.treatment}
                    </Text>
                  )}
                  {rec.notes && (
                    <Text style={{ fontSize: 12, fontFamily: "Outfit_500Medium", color: colors.textSecondary }}>
                      Note: {rec.notes}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
