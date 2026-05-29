import React, { useState, useMemo, useEffect, useRef } from "react";
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
import MapView, { UrlTile, Marker, Circle } from "@/components/MapShim";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  X,
  Compass,
  Layers,
  AlertTriangle,
  ChevronDown,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-expo";

// Must be declared AFTER all imports — Hermes (production APK engine) does not
// allow any executable code between static import statements.
const CustomUrlTile = UrlTile as any;

const OTON_CENTER = {
  latitude: 10.6942,
  longitude: 122.4833, // Default fallback longitude
};

export default function HeatMapScreen() {
  const router = useRouter();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAuth();
  const mapRef = useRef<MapView>(null);

  // Layer Visibility
  const [layers, setLayers] = useState({
    health: true,
    breeding: true,
    dispatches: true,
    demographics: false,
  });
  const [showOfflineOSM, setShowOfflineOSM] = useState(false);

  // Filter & UI States
  const [activeTab, setActiveTab] = useState<"health" | "breeding" | "dispatches" | "demographics">("health");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");
  
  // Selection & Telemetry list visibility
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [tileTemplate, setTileTemplate] = useState("https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png");

  // Dropdown Pickers Visibility
  const [isBrgyPickerOpen, setIsBrgyPickerOpen] = useState(false);
  const [isSeverityPickerOpen, setIsSeverityPickerOpen] = useState(false);
  const [isLayersPickerOpen, setIsLayersPickerOpen] = useState(false);
  const [searchBrgyQuery, setSearchBrgyQuery] = useState("");

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

  // Fetch real-time GIS hub data (contains health, breeding, tasks, census demographics)
  const {
    data: response = { health: [], breeding: [], dispatches: [], demographics: [] },
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["mobile-gis-hub-data"],
    queryFn: async () => {
      const res = await api.get("/gis/hub-data");
      return res.data || { health: [], breeding: [], dispatches: [], demographics: [] };
    },
    enabled: !!isLoaded && !!isSignedIn,
  });

  // Get unique list of Barangays from all records
  const barangays = useMemo<string[]>(() => {
    const list = new Set<string>();
    response.health?.forEach((p: any) => p.barangay && list.add(p.barangay));
    response.breeding?.forEach((p: any) => p.barangay && list.add(p.barangay));
    response.dispatches?.forEach((p: any) => p.barangay && list.add(p.barangay));
    response.demographics?.forEach((p: any) => p.barangay && list.add(p.barangay));
    return ["All", ...Array.from(list).sort()];
  }, [response]);

  // Compiled Barangay list based on search term in Barangay dropdown
  const filteredBarangayList = useMemo(() => {
    return barangays.filter((b) =>
      b.toLowerCase().includes(searchBrgyQuery.toLowerCase())
    );
  }, [barangays, searchBrgyQuery]);

  // Combined Filters for Health
  const filteredHealth = useMemo(() => {
    let list = response.health || [];
    if (selectedBarangay !== "All") {
      list = list.filter((h: any) => h.barangay?.toLowerCase() === selectedBarangay.toLowerCase());
    }
    if (selectedSeverity !== "All") {
      list = list.filter((h: any) => h.severity?.toLowerCase() === selectedSeverity.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (h: any) =>
          h.farmer?.toLowerCase().includes(q) ||
          h.animal?.toLowerCase().includes(q) ||
          h.tag?.toLowerCase().includes(q) ||
          h.symptoms?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [response.health, selectedBarangay, selectedSeverity, searchQuery]);

  // Combined Filters for Breeding
  const filteredBreeding = useMemo(() => {
    let list = response.breeding || [];
    if (selectedBarangay !== "All") {
      list = list.filter((b: any) => b.barangay?.toLowerCase() === selectedBarangay.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b: any) =>
          b.farmer?.toLowerCase().includes(q) ||
          b.breed?.toLowerCase().includes(q) ||
          b.tag?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [response.breeding, selectedBarangay, searchQuery]);

  // Combined Filters for Dispatches (Tasks)
  const filteredDispatches = useMemo(() => {
    let list = response.dispatches || [];
    if (selectedBarangay !== "All") {
      list = list.filter((d: any) => d.barangay?.toLowerCase() === selectedBarangay.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d: any) =>
          d.farmer?.toLowerCase().includes(q) ||
          d.task?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [response.dispatches, selectedBarangay, searchQuery]);

  // Combined Filters for Demographics
  const filteredDemographics = useMemo(() => {
    let list = response.demographics || [];
    if (selectedBarangay !== "All") {
      list = list.filter((d: any) => d.barangay?.toLowerCase() === selectedBarangay.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d: any) => d.barangay?.toLowerCase().includes(q));
    }
    return list;
  }, [response.demographics, selectedBarangay, searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = filteredHealth.length;
    const critical = filteredHealth.filter((p: any) => p.severity?.toLowerCase() === "high").length;
    const warning = filteredHealth.filter((p: any) => p.severity?.toLowerCase() === "medium").length;
    const routine = filteredHealth.filter((p: any) => p.severity?.toLowerCase() === "low").length;
    return { total, critical, warning, routine };
  }, [filteredHealth]);

  const breedingStats = useMemo(() => {
    const total = filteredBreeding.length;
    const pregnant = filteredBreeding.filter((b: any) => b.status === "Confirmed Pregnant").length;
    const inseminated = total - pregnant;
    return { total, pregnant, inseminated };
  }, [filteredBreeding]);

  const dispatchStats = useMemo(() => {
    const total = filteredDispatches.length;
    const urgent = filteredDispatches.filter((d: any) => d.urgency?.toLowerCase() === "high").length;
    const standard = total - urgent;
    return { total, urgent, standard };
  }, [filteredDispatches]);

  const demographicsStats = useMemo(() => {
    let cattle = 0;
    let carabao = 0;
    let swine = 0;
    filteredDemographics.forEach((d: any) => {
      cattle += d.cattle || 0;
      carabao += d.carabao || 0;
      swine += d.swine || 0;
    });
    return { cattle, carabao, swine };
  }, [filteredDemographics]);

  const activeCount = useMemo(() => {
    switch (activeTab) {
      case "health": return filteredHealth.length;
      case "breeding": return filteredBreeding.length;
      case "dispatches": return filteredDispatches.length;
      case "demographics": return filteredDemographics.length;
      default: return 0;
    }
  }, [activeTab, filteredHealth, filteredBreeding, filteredDispatches, filteredDemographics]);

  // Zoom and Recenter helper
  const handleSelect = (item: any, type: string) => {
    setSelectedItem({ ...item, type });
    if (item.coords && item.coords[0] && item.coords[1]) {
      mapRef.current?.animateCamera({
        center: {
          latitude: item.coords[0],
          longitude: item.coords[1],
        },
        zoom: 15,
      }, { duration: 800 });
    }
  };

  const handleRecenter = () => {
    mapRef.current?.animateToRegion({
      latitude: OTON_CENTER.latitude,
      longitude: OTON_CENTER.longitude,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }, 800);
  };

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
            <Text style={styles.headerSubtitle}>Oton, Iloilo · Operator Operations</Text>
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

      {/* Search & Barangay Selector Ribbon (Mirroring Web GIS Layout) */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBar}>
          <Search size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            placeholder="Search tag, owner, symptoms..."
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

        <TouchableOpacity
          onPress={() => setIsBrgyPickerOpen(true)}
          style={styles.brgyDropdownButton}
        >
          <Text numberOfLines={1} style={styles.brgyDropdownButtonText}>
            {selectedBarangay === "All" ? "All Barangays" : selectedBarangay}
          </Text>
          <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {/* Horizontally Scrollable Quick Controls: Category Tabs, Recenter, Layers, Severity */}
      <View style={styles.quickControlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickControlsScrollContent}>
          {/* Category Tabs */}
          <CategoryTab
            label="Health Risks"
            active={activeTab === "health"}
            onPress={() => { setActiveTab("health"); setSelectedItem(null); }}
          />
          <CategoryTab
            label="Breeding"
            active={activeTab === "breeding"}
            onPress={() => { setActiveTab("breeding"); setSelectedItem(null); }}
          />
          <CategoryTab
            label="Tasks"
            active={activeTab === "dispatches"}
            onPress={() => { setActiveTab("dispatches"); setSelectedItem(null); }}
          />
          <CategoryTab
            label="Census"
            active={activeTab === "demographics"}
            onPress={() => { setActiveTab("demographics"); setSelectedItem(null); }}
          />

          <View style={styles.ribbonDivider} />

          {/* Recenter */}
          <TouchableOpacity onPress={handleRecenter} style={styles.controlButton}>
            <Compass size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.controlButtonText}>Recenter</Text>
          </TouchableOpacity>

          {/* Layers */}
          <TouchableOpacity onPress={() => setIsLayersPickerOpen(true)} style={styles.controlButton}>
            <Layers size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.controlButtonText}>Layers</Text>
          </TouchableOpacity>

          {/* Severity (Only when health tab is active) */}
          {activeTab === "health" && (
            <TouchableOpacity onPress={() => setIsSeverityPickerOpen(true)} style={styles.controlButton}>
              <AlertTriangle size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.controlButtonText}>
                Severity: {selectedSeverity}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Map View */}
      <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Syncing GIS Layers...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: OTON_CENTER.latitude,
              longitude: OTON_CENTER.longitude,
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
            }}
          >
            {/* Tile Layer (Optional CartoDB Voyager Layer) */}
            {showOfflineOSM && (
              <CustomUrlTile
                urlTemplate={tileTemplate}
                maximumZ={19}
                tileSize={256}
                shouldReplaceMapContent={false}
                tileHeaders={{
                  "User-Agent": "IloiloAgricultureMobileApp/1.0",
                }}
              />
            )}

            {/* Outbreak warning circles (Health Risks Layer) */}
            {layers.health &&
              filteredHealth.map((h: any) => {
                if (!h.coords || typeof h.coords[0] !== "number" || typeof h.coords[1] !== "number") return null;
                const color =
                  h.severity?.toLowerCase() === "high"
                    ? "rgba(244, 63, 94, 0.35)"
                    : h.severity?.toLowerCase() === "medium"
                    ? "rgba(249, 115, 22, 0.35)"
                    : "rgba(251, 191, 36, 0.35)";
                return (
                  <Circle
                    key={`health-circle-${h.id || h._id}`}
                    center={{ latitude: h.coords[0], longitude: h.coords[1] }}
                    radius={h.severity?.toLowerCase() === "high" ? 400 : 250}
                    fillColor={color}
                    strokeColor={color.replace("0.35", "0.7")}
                    strokeWidth={1.5}
                  />
                );
              })}

            {/* Health Pins */}
            {layers.health &&
              filteredHealth.map((h: any) => {
                if (!h.coords || typeof h.coords[0] !== "number" || typeof h.coords[1] !== "number") return null;
                const color = h.severity?.toLowerCase() === "high" ? "#ef4444" : h.severity?.toLowerCase() === "medium" ? "#f97316" : "#eab308";
                return (
                  <Marker
                    key={`health-marker-${h.id || h._id}`}
                    coordinate={{ latitude: h.coords[0], longitude: h.coords[1] }}
                    onPress={() => handleSelect(h, "health")}
                  >
                    <View style={[styles.customPin, { backgroundColor: color }]}>
                      <Text style={styles.customPinText}>{h.severity?.toLowerCase() === "high" ? "🚨" : "🩺"}</Text>
                    </View>
                  </Marker>
                );
              })}

            {/* Breeding Pins */}
            {layers.breeding &&
              filteredBreeding.map((b: any) => {
                if (!b.coords || typeof b.coords[0] !== "number" || typeof b.coords[1] !== "number") return null;
                const isPregnant = b.status === "Confirmed Pregnant";
                return (
                  <Marker
                    key={`breed-marker-${b.id || b._id}`}
                    coordinate={{ latitude: b.coords[0], longitude: b.coords[1] }}
                    onPress={() => handleSelect(b, "breeding")}
                  >
                    <View style={[styles.customPin, { backgroundColor: isPregnant ? "#10b981" : "#3b82f6" }]}>
                      <Text style={styles.customPinText}>{isPregnant ? "🐄" : "💉"}</Text>
                    </View>
                  </Marker>
                );
              })}

            {/* Dispatch Pins */}
            {layers.dispatches &&
              filteredDispatches.map((d: any) => {
                if (!d.coords || typeof d.coords[0] !== "number" || typeof d.coords[1] !== "number") return null;
                const color = d.urgency?.toLowerCase() === "high" ? "#a855f7" : "#6366f1";
                return (
                  <Marker
                    key={`dispatch-marker-${d.id || d._id}`}
                    coordinate={{ latitude: d.coords[0], longitude: d.coords[1] }}
                    onPress={() => handleSelect(d, "dispatch")}
                  >
                    <View style={[styles.customPin, { backgroundColor: color }]}>
                      <Text style={styles.customPinText}>{d.urgency?.toLowerCase() === "high" ? "📋" : "🛠️"}</Text>
                    </View>
                  </Marker>
                );
              })}

            {/* Demographics Area Circles */}
            {layers.demographics &&
              filteredDemographics.map((dem: any) => {
                if (!dem.coords || typeof dem.coords[0] !== "number" || typeof dem.coords[1] !== "number") return null;
                const total = (dem.cattle || 0) + (dem.carabao || 0) + (dem.swine || 0);
                if (total === 0) return null;
                const radius = Math.max(120, Math.min(500, total * 6));
                return (
                  <Circle
                    key={`dem-circle-${dem.id || dem._id}`}
                    center={{ latitude: dem.coords[0], longitude: dem.coords[1] }}
                    radius={radius}
                    fillColor="rgba(16, 185, 129, 0.18)"
                    strokeColor="rgba(16, 185, 129, 0.5)"
                    strokeWidth={1.5}
                  />
                );
              })}

            {/* Demographics Pin anchors */}
            {layers.demographics &&
              filteredDemographics.map((dem: any) => {
                if (!dem.coords || typeof dem.coords[0] !== "number" || typeof dem.coords[1] !== "number") return null;
                const total = (dem.cattle || 0) + (dem.carabao || 0) + (dem.swine || 0);
                if (total === 0) return null;
                return (
                  <Marker
                    key={`dem-marker-${dem.id || dem._id}`}
                    coordinate={{ latitude: dem.coords[0], longitude: dem.coords[1] }}
                    onPress={() => handleSelect(dem, "demographics")}
                  >
                    <View style={[styles.customPin, { backgroundColor: "#10b981" }]}>
                      <Text style={styles.customPinText}>📊</Text>
                    </View>
                  </Marker>
                );
              })}
          </MapView>
        )}

        {/* Attribution */}
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>

        {/* HUD Telemetry Panel */}
        <View style={styles.hudContainer}>
          {selectedItem ? (
            <View style={styles.hudCard}>
              <View style={styles.hudHeader}>
                <View>
                  <Text style={styles.hudTypeBadge}>
                    {selectedItem.type.toUpperCase()} TELEMETRY
                  </Text>
                  <Text style={styles.hudTitle}>
                    {selectedItem.animal || selectedItem.task || selectedItem.barangay || "Breeding Details"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.closeHudButton}>
                  <X size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.hudGrid}>
                {selectedItem.type === "health" && (
                  <>
                    <DetailRow label="Farmer" value={selectedItem.farmer} />
                    <DetailRow label="Sector" value={selectedItem.barangay} />
                    <DetailRow label="Symptom" value={selectedItem.symptoms} isDanger />
                    <DetailRow label="Severity" value={selectedItem.severity} />
                  </>
                )}
                {selectedItem.type === "breeding" && (
                  <>
                    <DetailRow label="Farmer" value={selectedItem.farmer} />
                    <DetailRow label="Sector" value={selectedItem.barangay} />
                    <DetailRow label="Sire" value={selectedItem.breed} isPrimary />
                    <DetailRow label="Status" value={selectedItem.status} />
                  </>
                )}
                {selectedItem.type === "dispatch" && (
                  <>
                    <DetailRow label="Client" value={selectedItem.farmer} />
                    <DetailRow label="Sector" value={selectedItem.barangay} />
                    <DetailRow label="Priority" value={selectedItem.urgency} />
                    <DetailRow label="Status" value={selectedItem.status} isPrimary />
                  </>
                )}
                {selectedItem.type === "demographics" && (
                  <>
                    <DetailRow label="Barangay" value={selectedItem.barangay} />
                    <DetailRow label="Cattle" value={String(selectedItem.cattle || 0)} />
                    <DetailRow label="Carabao" value={String(selectedItem.carabao || 0)} />
                    <DetailRow label="Swine" value={String(selectedItem.swine || 0)} />
                  </>
                )}
              </View>

              <TouchableOpacity
                onPress={() => handleSelect(selectedItem, selectedItem.type)}
                style={styles.focusButton}
              >
                <Text style={styles.focusButtonText}>RE-PAN TO COORDINATE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.hudCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={styles.hudTitle}>Telemetry HUD</Text>
                <TouchableOpacity
                  onPress={() => setIsListOpen(true)}
                  style={styles.viewListButton}
                >
                  <Text style={styles.viewListButtonText}>View Stream ({activeCount})</Text>
                </TouchableOpacity>
              </View>

              {activeTab === "health" && (
                <View style={styles.legendGrid}>
                  <LegendItem color="#ef4444" label="🚨 Critical" count={stats.critical} />
                  <View style={styles.divider} />
                  <LegendItem color="#ea580c" label="🩺 Warning" count={stats.warning} />
                  <View style={styles.divider} />
                  <LegendItem color="#eab308" label="📋 Routine" count={stats.routine} />
                </View>
              )}
              {activeTab === "breeding" && (
                <View style={styles.legendGrid}>
                  <LegendItem color="#10b981" label="🐄 Pregnant" count={breedingStats.pregnant} />
                  <View style={styles.divider} />
                  <LegendItem color="#3b82f6" label="💉 Inseminated" count={breedingStats.inseminated} />
                </View>
              )}
              {activeTab === "dispatches" && (
                <View style={styles.legendGrid}>
                  <LegendItem color="#a855f7" label="📋 Urgent" count={dispatchStats.urgent} />
                  <View style={styles.divider} />
                  <LegendItem color="#6366f1" label="🛠️ Standard" count={dispatchStats.standard} />
                </View>
              )}
              {activeTab === "demographics" && (
                <View style={styles.legendGrid}>
                  <LegendItem color="#10b981" label="🐄 Cattle" count={demographicsStats.cattle} />
                  <View style={styles.divider} />
                  <LegendItem color="#3b82f6" label="🐃 Carabao" count={demographicsStats.carabao} />
                  <View style={styles.divider} />
                  <LegendItem color="#eab308" label="🐖 Swine" count={demographicsStats.swine} />
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Registry Stream Drawer (Slide-up modal list) */}
      <Modal
        visible={isListOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsListOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsListOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalSubTitle}>Telemetry Stream</Text>
                  <Text style={styles.modalTitle}>
                    {activeTab === "health" ? "Active Health Incidents" : activeTab === "breeding" ? "Breeding Log" : activeTab === "dispatches" ? "Active Dispatches" : "Livestock Census"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsListOpen(false)}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                {activeTab === "health" && (
                  filteredHealth.length === 0 ? (
                    <Text style={styles.emptyListText}>No health alerts match filter</Text>
                  ) : (
                    filteredHealth.map((item: any) => (
                      <TouchableOpacity
                        key={`list-health-${item.id}`}
                        onPress={() => { setIsListOpen(false); handleSelect(item, "health"); }}
                        style={styles.listItem}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.listItemTitle}>{item.animal}</Text>
                          <Text style={[styles.severityBadge, item.severity === "High" ? styles.sevHigh : item.severity === "Medium" ? styles.sevMedium : styles.sevLow]}>
                            {item.severity}
                          </Text>
                        </View>
                        <Text style={styles.listItemSub}>Tag: #{item.tag} · Farmer: {item.farmer}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                          <Text style={styles.listItemHighlightDanger}>{item.symptoms}</Text>
                          <Text style={styles.listItemBrgy}>📍 {item.barangay}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )
                )}

                {activeTab === "breeding" && (
                  filteredBreeding.length === 0 ? (
                    <Text style={styles.emptyListText}>No breeding alerts match filter</Text>
                  ) : (
                    filteredBreeding.map((item: any) => (
                      <TouchableOpacity
                        key={`list-breed-${item.id}`}
                        onPress={() => { setIsListOpen(false); handleSelect(item, "breeding"); }}
                        style={styles.listItem}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.listItemTitle}>Sire: {item.breed}</Text>
                          <Text style={[styles.severityBadge, item.status === "Confirmed Pregnant" ? styles.sevHigh : styles.sevLow]}>
                            {item.status}
                          </Text>
                        </View>
                        <Text style={styles.listItemSub}>Tag: #{item.tag} · Owner: {item.farmer}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                          <Text style={styles.listItemHighlightPrimary}>Date: {item.date}</Text>
                          <Text style={styles.listItemBrgy}>📍 {item.barangay}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )
                )}

                {activeTab === "dispatches" && (
                  filteredDispatches.length === 0 ? (
                    <Text style={styles.emptyListText}>No dispatches match filter</Text>
                  ) : (
                    filteredDispatches.map((item: any) => (
                      <TouchableOpacity
                        key={`list-dispatch-${item.id}`}
                        onPress={() => { setIsListOpen(false); handleSelect(item, "dispatch"); }}
                        style={styles.listItem}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={styles.listItemTitle}>{item.task}</Text>
                          <Text style={[styles.severityBadge, item.urgency === "High" ? styles.sevHigh : styles.sevLow]}>
                            {item.urgency} Urgency
                          </Text>
                        </View>
                        <Text style={styles.listItemSub}>Client: {item.farmer} · Dispatch: {item.time}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                          <Text style={styles.listItemHighlightPrimary}>{item.status}</Text>
                          <Text style={styles.listItemBrgy}>📍 {item.barangay}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )
                )}

                {activeTab === "demographics" && (
                  filteredDemographics.length === 0 ? (
                    <Text style={styles.emptyListText}>No demographic data</Text>
                  ) : (
                    filteredDemographics.map((item: any) => {
                      const total = (item.cattle || 0) + (item.carabao || 0) + (item.swine || 0);
                      return (
                        <TouchableOpacity
                          key={`list-dem-${item.id}`}
                          onPress={() => { setIsListOpen(false); handleSelect(item, "demographics"); }}
                          style={styles.listItem}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={styles.listItemTitle}>{item.barangay}</Text>
                            <Text style={styles.censusBadge}>{total} Heads</Text>
                          </View>
                          <View style={styles.censusGrid}>
                            <View style={styles.censusGridCol}>
                              <Text style={styles.censusGridLabel}>Cattle</Text>
                              <Text style={styles.censusGridVal}>{item.cattle || 0}</Text>
                            </View>
                            <View style={styles.censusGridCol}>
                              <Text style={styles.censusGridLabel}>Carabao</Text>
                              <Text style={styles.censusGridVal}>{item.carabao || 0}</Text>
                            </View>
                            <View style={styles.censusGridCol}>
                              <Text style={styles.censusGridLabel}>Swine</Text>
                              <Text style={styles.censusGridVal}>{item.swine || 0}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Barangay Picker Modal (Drop-down substitute) */}
      <Modal
        visible={isBrgyPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsBrgyPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsBrgyPickerOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalSubTitle}>Filter Sector</Text>
                  <Text style={styles.modalTitle}>Select Barangay</Text>
                </View>
                <TouchableOpacity onPress={() => setIsBrgyPickerOpen(false)}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearchBox}>
                <Search size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  placeholder="Search Barangay..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.modalSearchInput}
                  value={searchBrgyQuery}
                  onChangeText={setSearchBrgyQuery}
                />
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.pickerContainer}>
                  {filteredBarangayList.map((b) => (
                    <TouchableOpacity
                      key={b}
                      onPress={() => {
                        setSelectedBarangay(b);
                        setIsBrgyPickerOpen(false);
                        setSearchBrgyQuery("");
                      }}
                      style={[
                        styles.filterOption,
                        selectedBarangay === b && styles.filterOptionActive,
                      ]}
                    >
                      <Text style={[styles.filterOptionText, selectedBarangay === b && styles.filterOptionTextActive]}>
                        {b === "All" ? "All Barangays" : b}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Severity Picker Modal */}
      <Modal
        visible={isSeverityPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSeverityPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsSeverityPickerOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalSubTitle}>Filter Category</Text>
                  <Text style={styles.modalTitle}>Select Severity</Text>
                </View>
                <TouchableOpacity onPress={() => setIsSeverityPickerOpen(false)}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.pickerContainer}>
                  {["All", "High", "Medium", "Low"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setSelectedSeverity(s);
                        setIsSeverityPickerOpen(false);
                      }}
                      style={[
                        styles.filterOption,
                        selectedSeverity === s && styles.filterOptionActive,
                      ]}
                    >
                      <Text style={[styles.filterOptionText, selectedSeverity === s && styles.filterOptionTextActive]}>
                        {s === "All" ? "All Severities" : `${s} Severity`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Layers Picker Modal */}
      <Modal
        visible={isLayersPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLayersPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsLayersPickerOpen(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalSubTitle}>Map Settings</Text>
                  <Text style={styles.modalTitle}>Layer Visibility</Text>
                </View>
                <TouchableOpacity onPress={() => setIsLayersPickerOpen(false)}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.layersListContainer}>
                  <LayerCheckboxRow
                    label="Offline Tile Layer"
                    description="Load custom cached map tiles (for offline work)"
                    checked={showOfflineOSM}
                    onChange={(val: boolean) => setShowOfflineOSM(val)}
                  />
                  <LayerCheckboxRow
                    label="Health Risks"
                    description="Disease logs and active outbreak warnings"
                    checked={layers.health}
                    onChange={(val: boolean) => setLayers({ ...layers, health: val })}
                  />
                  <LayerCheckboxRow
                    label="Breeding Records"
                    description="Artificial insemination statuses"
                    checked={layers.breeding}
                    onChange={(val: boolean) => setLayers({ ...layers, breeding: val })}
                  />
                  <LayerCheckboxRow
                    label="Field Dispatches"
                    description="Assigned veterinary dispatches and schedules"
                    checked={layers.dispatches}
                    onChange={(val: boolean) => setLayers({ ...layers, dispatches: val })}
                  />
                  <LayerCheckboxRow
                    label="Census Demographics"
                    description="Livestock count overlays per Barangay"
                    checked={layers.demographics}
                    onChange={(val: boolean) => setLayers({ ...layers, demographics: val })}
                  />
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// Subcomponents
const CategoryTab = ({ label, active, onPress }: any) => (
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

const DetailRow = ({ label, value, isDanger, isPrimary }: any) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}:</Text>
    <Text
      numberOfLines={1}
      style={[
        styles.detailValue,
        isDanger && styles.detailValueDanger,
        isPrimary && styles.detailValuePrimary,
      ]}
    >
      {value || "N/A"}
    </Text>
  </View>
);

const LayerCheckboxRow = ({ label, description, checked, onChange }: any) => (
  <TouchableOpacity
    onPress={() => onChange(!checked)}
    style={[styles.layerRowBtn, checked && styles.layerRowBtnActive]}
  >
    <View style={{ flex: 1 }}>
      <Text style={[styles.layerRowLabel, checked && styles.layerRowLabelActive]}>
        {label}
      </Text>
      <Text style={styles.layerRowDesc}>{description}</Text>
    </View>
    <View style={[styles.checkboxIndicator, checked && styles.checkboxIndicatorActive]}>
      {checked && <Text style={styles.checkboxCheck}>✓</Text>}
    </View>
  </TouchableOpacity>
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
  searchFilterRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    alignItems: "center",
  },
  searchBar: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
  },
  brgyDropdownButton: {
    flex: 0.7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  brgyDropdownButtonText: {
    color: "#fff",
    fontFamily: "Outfit_700Bold",
    fontSize: 11,
    flex: 1,
    marginRight: 4,
  },
  quickControlsRow: {
    backgroundColor: "#0f172a",
    paddingBottom: 10,
  },
  quickControlsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    height: 34,
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
  ribbonDivider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 4,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    height: 34,
    gap: 6,
  },
  controlButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  attributionText: {
    position: "absolute",
    right: 16,
    bottom: 175,
    fontSize: 9,
    fontFamily: "Outfit_500Medium",
    color: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(15,23,42,0.8)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 10,
  },
  hudContainer: {
    position: "absolute",
    left: 16,
    bottom: 24,
    right: 16,
    zIndex: 100,
  },
  hudCard: {
    backgroundColor: "rgba(15,23,42,0.92)",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 8,
  },
  hudHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  hudTypeBadge: {
    fontSize: 8,
    fontFamily: "Outfit_800ExtraBold",
    color: "#10b981",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  hudTitle: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 14,
    marginTop: 2,
  },
  closeHudButton: {
    padding: 4,
  },
  hudGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  detailLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 8,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
  },
  detailValue: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
    marginTop: 2,
  },
  detailValueDanger: {
    color: "#ef4444",
  },
  detailValuePrimary: {
    color: "#3b82f6",
  },
  focusButton: {
    backgroundColor: "#00643B",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  focusButtonText: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1,
  },
  viewListButton: {
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewListButtonText: {
    color: "#10b981",
    fontSize: 10,
    fontFamily: "Outfit_700Bold",
  },
  legendGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  legendCount: {
    fontFamily: "Outfit_900Black",
    fontSize: 18,
  },
  legendLabel: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 9,
    marginTop: 1,
  },
  divider: {
    width: 1,
    height: "60%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  customPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  customPinText: {
    fontSize: 14,
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
    maxHeight: "75%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalSubTitle: {
    fontSize: 9,
    fontFamily: "Outfit_700Bold",
    color: "#10b981",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Outfit_800ExtraBold",
    color: "#fff",
    marginTop: 2,
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
    marginBottom: 14,
  },
  modalSearchInput: {
    flex: 1,
    color: "#fff",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 12,
    padding: 0,
  },
  modalScroll: {
    marginBottom: 16,
  },
  emptyListText: {
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 24,
  },
  listItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  listItemTitle: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 13,
  },
  listItemSub: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Outfit_500Medium",
    fontSize: 10,
    marginTop: 2,
  },
  listItemHighlightDanger: {
    color: "#ef4444",
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
  },
  listItemHighlightPrimary: {
    color: "#3b82f6",
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
  },
  listItemBrgy: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Outfit_700Bold",
    fontSize: 9,
    textTransform: "uppercase",
  },
  severityBadge: {
    fontSize: 8,
    fontFamily: "Outfit_800ExtraBold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    textTransform: "uppercase",
  },
  sevHigh: {
    color: "#ef4444",
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  sevMedium: {
    color: "#f97316",
    backgroundColor: "rgba(249,115,22,0.12)",
  },
  sevLow: {
    color: "#eab308",
    backgroundColor: "rgba(234,179,8,0.12)",
  },
  censusBadge: {
    fontSize: 9,
    fontFamily: "Outfit_800ExtraBold",
    color: "#10b981",
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  censusGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  censusGridCol: {
    alignItems: "center",
    flex: 1,
  },
  censusGridLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 8,
    fontFamily: "Outfit_600SemiBold",
    textTransform: "uppercase",
  },
  censusGridVal: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Outfit_700Bold",
    marginTop: 2,
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  filterOptionActive: {
    backgroundColor: "#00643B",
    borderColor: "transparent",
  },
  filterOptionText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Outfit_700Bold",
  },
  filterOptionTextActive: {
    color: "#fff",
  },
  layersListContainer: {
    gap: 10,
  },
  layerRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  layerRowBtnActive: {
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.05)",
  },
  layerRowLabel: {
    color: "#fff",
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  layerRowLabelActive: {
    color: "#10b981",
  },
  layerRowDesc: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Outfit_500Medium",
    fontSize: 9,
    marginTop: 2,
  },
  checkboxIndicator: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxIndicatorActive: {
    borderColor: "#10b981",
    backgroundColor: "#10b981",
  },
  checkboxCheck: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
});
