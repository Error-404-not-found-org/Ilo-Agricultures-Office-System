import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { UrlTile, Marker, Circle } from "react-native-maps";
import { ArrowLeft, RefreshCw, Search, X } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

const PRIMARY = "#00643B";

export default function FarmerHeatMapScreen() {
  const router = useRouter();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();

  const [activeSpecies, setActiveSpecies] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");
  const [activePicker, setActivePicker] = useState<"barangay" | "severity" | null>(null);
  const [tileTemplate, setTileTemplate] = useState("https://tile.openstreetmap.org/{z}/{x}/{y}.png");

  useEffect(() => {
    const checkOfflineCache = async () => {
      const tileRoot = `${FileSystem.documentDirectory}tiles/`;
      const info = await FileSystem.getInfoAsync(tileRoot);
      if (info.exists) {
        setTileTemplate(`${tileRoot}{z}/{x}/{y}.png`);
      }
    };
    checkOfflineCache();
  }, []);

  // Fetch real-time health heatmap data
  const {
    data: response = {},
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["mobile-health-heatmap"],
    queryFn: async () => {
      const res = await api.get("/gis/health-heatmap");
      return res.data || { data: [] };
    },
    enabled: !!isLoaded && !!isSignedIn,
  });

  const allPoints = response.data || [];

  // Get unique list of Barangays from points
  const barangays = useMemo<string[]>(() => {
    const list = new Set<string>(allPoints.map((p: any) => String(p.barangay || "")).filter(Boolean));
    return ["All", ...Array.from(list).sort()];
  }, [allPoints]);

  // Filter points dynamically
  const filteredPoints = useMemo(() => {
    return allPoints.filter((p: any) => {
      // Species filter
      const matchSpecies = activeSpecies === "all" || p.animal?.toLowerCase().includes(activeSpecies.toLowerCase());
      
      // Severity filter
      const matchSeverity = selectedSeverity === "All" || p.severity?.toLowerCase() === selectedSeverity.toLowerCase();
      
      // Barangay filter
      const matchBarangay = selectedBarangay === "All" || p.barangay?.toLowerCase() === selectedBarangay.toLowerCase();
      
      // Search query filter (matches farmer name, symptoms, barangay, or tag)
      const query = searchQuery.trim().toLowerCase();
      const matchQuery = !query || 
        p.farmer?.toLowerCase().includes(query) ||
        p.symptoms?.toLowerCase().includes(query) ||
        p.barangay?.toLowerCase().includes(query) ||
        p.tag?.toLowerCase().includes(query);

      return matchSpecies && matchSeverity && matchBarangay && matchQuery;
    });
  }, [allPoints, activeSpecies, selectedSeverity, selectedBarangay, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredPoints.length;
    const critical = filteredPoints.filter(
      (p: any) => p.severity?.toLowerCase() === "high"
    ).length;
    const warning = filteredPoints.filter(
      (p: any) => p.severity?.toLowerCase() === "medium"
    ).length;
    const routine = filteredPoints.filter(
      (p: any) => p.severity?.toLowerCase() === "low"
    ).length;

    return { total, critical, warning, routine };
  }, [filteredPoints]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>GIS Field Hub</Text>
            <Text style={styles.headerSubtitle}>Oton, Iloilo · Real-Time Operations</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => refetch()}
          disabled={isLoading || isRefetching}
          style={styles.backButton}
        >
          {isRefetching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <RefreshCw size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Species Filter Tabs */}
      <View style={styles.filterBar}>
        <FilterTab
          label="All Herd"
          active={activeSpecies === "all"}
          onPress={() => setActiveSpecies("all")}
        />
        <FilterTab
          label="Cattle"
          active={activeSpecies === "cattle"}
          onPress={() => setActiveSpecies("cattle")}
        />
        <FilterTab
          label="Carabao"
          active={activeSpecies === "carabao"}
          onPress={() => setActiveSpecies("carabao")}
        />
        <FilterTab
          label="Swine"
          active={activeSpecies === "swine"}
          onPress={() => setActiveSpecies("swine")}
        />
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            placeholder="Search symptoms, farmer, tag, or brgy..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <X size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Advanced Selector Filters (Barangay & Severity) */}
      <View style={styles.advancedFilters}>
        <TouchableOpacity
          onPress={() => setActivePicker("barangay")}
          style={styles.pickerButton}
        >
          <Text numberOfLines={1} style={styles.pickerText}>
            📍 {selectedBarangay === "All" ? "All Barangays" : selectedBarangay}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActivePicker("severity")}
          style={styles.pickerButton}
        >
          <Text numberOfLines={1} style={styles.pickerText}>
            ⚠️ {selectedSeverity === "All" ? "All Severities" : `${selectedSeverity} Severity`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map View Area */}
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Syncing disease data...</Text>
          </View>
        ) : (
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: 10.6942,
              longitude: 122.4833,
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
            }}
          >
            {/* Tile Layer (OSM Tiles / Cached Tiles) */}
            <UrlTile
              urlTemplate={tileTemplate}
              maximumZ={19}
              tileSize={256}
              shouldReplaceMapContent={true}
            />

            {/* Outbreak Heatspots */}
            {filteredPoints.map((point: any) => {
              const color =
                point.severity.toLowerCase() === "high"
                  ? "rgba(244, 63, 94, 0.4)"
                  : point.severity.toLowerCase() === "medium"
                  ? "rgba(249, 115, 22, 0.4)"
                  : "rgba(251, 191, 36, 0.4)";

              return (
                <Circle
                  key={`circle-${point.id || point._id}`}
                  center={{
                    latitude: point.coords[0],
                    longitude: point.coords[1],
                  }}
                  radius={point.severity.toLowerCase() === "high" ? 400 : 250}
                  fillColor={color}
                  strokeColor={color.replace("0.4", "0.8")}
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Pins */}
            {filteredPoints.map((point: any) => {
              const pinColor =
                point.severity.toLowerCase() === "high"
                  ? "#ef4444"
                  : point.severity.toLowerCase() === "medium"
                  ? "#ea580c"
                  : "#eab308";

              return (
                <Marker
                  key={`marker-${point.id || point._id}`}
                  coordinate={{
                    latitude: point.coords[0],
                    longitude: point.coords[1],
                  }}
                  pinColor={pinColor}
                  title={`${point.symptoms} (${point.barangay})`}
                  description={`Farmer: ${point.farmer} · Tag: #${point.tag}`}
                />
              );
            })}
          </MapView>
        )}

        {/* OSM Attribution */}
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>

        {/* Custom Status Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.legendTitle}>Oton District Status</Text>
              <Text style={styles.totalBadge}>{stats.total} Incidents</Text>
            </View>

            <View style={styles.legendGrid}>
              <LegendItem color="#ef4444" label="🚨 Critical" count={stats.critical} />
              <View style={styles.divider} />
              <LegendItem color="#ea580c" label="🩺 Warning" count={stats.warning} />
              <View style={styles.divider} />
              <LegendItem color="#eab308" label="📋 Routine" count={stats.routine} />
            </View>
          </View>
        </View>
      </View>

      {/* Reusable Picker Modal */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePicker(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {activePicker === "barangay" ? "Select Barangay" : "Select Severity"}
                </Text>
                <TouchableOpacity onPress={() => setActivePicker(null)}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                {activePicker === "barangay" ? (
                  barangays.map((b: string) => (
                    <TouchableOpacity
                      key={b}
                      onPress={() => {
                        setSelectedBarangay(b);
                        setActivePicker(null);
                      }}
                      style={[
                        styles.modalItem,
                        selectedBarangay === b && styles.modalItemActive,
                      ]}
                    >
                      <Text style={[styles.modalItemText, selectedBarangay === b && styles.modalItemTextActive]}>
                        {b}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  ["All", "High", "Medium", "Low"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setSelectedSeverity(s);
                        setActivePicker(null);
                      }}
                      style={[
                        styles.modalItem,
                        selectedSeverity === s && styles.modalItemActive,
                      ]}
                    >
                      <Text style={[styles.modalItemText, selectedSeverity === s && styles.modalItemTextActive]}>
                        {s === "All" ? "All Severities" : `${s} Severity`}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const FilterTab = ({ label, active, onPress }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.tab, active && styles.activeTab]}
  >
    <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
  </TouchableOpacity>
);

const LegendItem = ({ color, label, count }: any) => (
  <View style={{ alignItems: "center", flex: 1 }}>
    <Text style={[styles.legendCount, { color }]}>{count}</Text>
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#0f172a",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 17,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Outfit_500Medium",
    fontSize: 10,
    marginTop: 1,
  },
  filterBar: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  activeTab: {
    backgroundColor: "#00643B",
    borderColor: "transparent",
  },
  tabText: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
  },
  activeTabText: {
    color: "#fff",
  },
  searchContainer: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
  },
  advancedFilters: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    height: 42,
  },
  pickerText: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    gap: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  legendContainer: {
    position: "absolute",
    left: 16,
    bottom: 24,
    right: 16,
    zIndex: 100,
  },
  legendCard: {
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 8,
  },
  legendTitle: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 13,
  },
  totalBadge: {
    color: "#10b981",
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 10,
    textTransform: "uppercase",
  },
  legendGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  legendCount: {
    fontFamily: "Outfit_900Black",
    fontSize: 20,
  },
  legendLabel: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 10,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: "70%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: "50%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
  },
  modalScroll: {
    marginBottom: 16,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  modalItemActive: {
    backgroundColor: "#00643B",
  },
  modalItemText: {
    fontSize: 14,
    fontFamily: "Outfit_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
  modalItemTextActive: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
  },
  attributionText: {
    position: "absolute",
    right: 16,
    bottom: 200, // Positioned above the status legend card
    fontSize: 9,
    fontFamily: "Outfit_500Medium",
    color: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 101,
  },
});
