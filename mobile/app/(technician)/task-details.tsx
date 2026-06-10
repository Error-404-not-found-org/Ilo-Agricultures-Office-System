import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Phone,
  User,
  Info,
  Navigation,
} from "lucide-react-native";
import MapView, {
  Marker,
  UrlTile,
  PROVIDER_GOOGLE,
} from "@/components/MapShim";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import * as FileSystem from "expo-file-system/legacy";
import { getLocalTilePath, OTON_BBOX } from "@/lib/mapCache";
import { useTheme } from "@/lib/theme";

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const api = useApi();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Oton Center as fallback
  const INITIAL_REGION = {
    latitude: 10.693,
    longitude: 122.474,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const { colors, isDark } = useTheme();

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await api.get(`/tasks/${id}`);
        setTask(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load task details");
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [id, api]);

  const handleComplete = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await api.put(`/tasks/${id}/complete`);
      toast.success("Task completed!");
      router.back();
    } catch (err) {
      toast.error("Update failed");
    } finally {
      setCompleting(false);
    }
  };

  if (loading)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator
          size="large"
          color={isDark ? "#10b981" : "#00643B"}
        />
      </View>
    );

  if (!task)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.textPrimary }}>Task not found</Text>
      </View>
    );

  const farmerCoords = task.farmerId?.address?.coordinates || {
    lat: 10.693,
    lng: 122.474,
  };
  const tileUrlTemplate = `${(FileSystem as any).documentDirectory}tiles/{z}/{x}/{y}.png`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? colors.card : "#f8fafc" },
          ]}
        >
          <ArrowLeft size={24} color={isDark ? "white" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Task Details
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Map View Section */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: farmerCoords.lat,
              longitude: farmerCoords.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            // If offline tiles exist, this will overlay them
            mapType={Platform.OS === "android" ? "none" : "standard"}
          >
            <UrlTile
              urlTemplate={tileUrlTemplate}
              zIndex={1}
              maximumZ={15}
              minimumZ={12}
              offlineMode={true}
            />
            <Marker
              coordinate={{
                latitude: farmerCoords.lat,
                longitude: farmerCoords.lng,
              }}
              title={task.farmerId?.name}
              description={task.notes}
            >
              <View style={styles.customMarker}>
                <MapPin size={24} color="#fff" />
              </View>
            </Marker>
          </MapView>

          <Text style={styles.attributionText}>
            © OpenStreetMap contributors
          </Text>

          <TouchableOpacity
            style={[
              styles.floatingNav,
              {
                backgroundColor: isDark ? "#10b981" : "#00643B",
                shadowColor: isDark ? "transparent" : "#000",
              },
            ]}
            onPress={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${farmerCoords.lat},${farmerCoords.lng}`;
              Linking.openURL(url).catch((err) =>
                console.error("Failed to open maps", err),
              );
            }}
          >
            <Navigation size={20} color="#fff" />
            <Text style={styles.navText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Task Info */}
        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User size={18} color={isDark ? "#34d399" : "#00643B"} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B" },
                ]}
              >
                Farmer Info
              </Text>
            </View>
            <Text style={[styles.farmerName, { color: colors.textPrimary }]}>
              {task.farmerId?.name}
            </Text>
            <View style={styles.row}>
              <Phone size={14} color={colors.textSecondary} />
              <Text style={[styles.farmerSub, { color: colors.textSecondary }]}>
                {task.farmerId?.phoneNumber || "No contact"}
              </Text>
            </View>
            <View style={styles.row}>
              <MapPin size={14} color={colors.textSecondary} />
              <Text style={[styles.farmerSub, { color: colors.textSecondary }]}>
                {task.farmerId?.address?.barangay},{" "}
                {task.farmerId?.address?.city}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Info size={18} color={isDark ? "#34d399" : "#00643B"} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B" },
                ]}
              >
                Task Description
              </Text>
            </View>
            <View
              className={`inline-block self-start px-2 py-1 rounded-lg mb-3 ${
                task.category === "Urgent"
                  ? isDark
                    ? "bg-red-950/40"
                    : "bg-red-50"
                  : isDark
                    ? "bg-blue-950/40"
                    : "bg-blue-50"
              }`}
            >
              <Text
                className={`text-[10px] font-black uppercase ${
                  task.category === "Urgent" ? "text-red-500" : "text-blue-500"
                }`}
              >
                {task.category}
              </Text>
            </View>
            <Text style={[styles.notesText, { color: colors.textPrimary }]}>
              {task.notes}
            </Text>
          </View>

          {task.animalIds && task.animalIds.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B", marginBottom: 12 },
                ]}
              >
                Associated Animals
              </Text>
              {task.animalIds.map((anim: any) => (
                <TouchableOpacity
                  key={anim._id}
                  style={[
                    styles.animalCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    router.push(
                      `/(technician)/animal-details?id=${anim._id}` as any,
                    )
                  }
                >
                  <View style={styles.animalInfo}>
                    <Text
                      style={[styles.animalTag, { color: colors.textPrimary }]}
                    >
                      Tag: {anim.earTag || anim.animalId}
                    </Text>
                    <Text
                      style={[
                        styles.animalBreed,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {anim.breed} ({anim.species})
                    </Text>
                  </View>
                  <CheckCircle size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            disabled={completing}
            style={[
              styles.completeBtn,
              {
                backgroundColor: completing
                  ? "#34d399"
                  : isDark
                    ? "#10b981"
                    : "#00643B",
                shadowColor: isDark ? "transparent" : "#00643B",
                opacity: completing ? 0.7 : 1,
              },
            ]}
            onPress={handleComplete}
          >
            {completing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <CheckCircle size={20} color="#fff" />
                <Text style={styles.completeBtnText}>Mark as Completed</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    marginRight: 16,
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
    color: "#1e293b",
  },
  mapContainer: {
    height: 300,
    width: "100%",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingNav: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#00643B",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  navText: {
    color: "#fff",
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
  customMarker: {
    backgroundColor: "#dc2626",
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 14,
    color: "#00643B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  farmerName: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 24,
    color: "#1e293b",
  },
  farmerSub: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    color: "#64748b",
    marginLeft: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  notesText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 16,
    color: "#475569",
    lineHeight: 24,
  },
  animalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  animalInfo: {
    flex: 1,
  },
  animalTag: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    color: "#1e293b",
  },
  animalBreed: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    color: "#64748b",
  },
  completeBtn: {
    backgroundColor: "#00643B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 24,
    gap: 12,
    marginTop: 20,
    shadowColor: "#00643B",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  completeBtnText: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  attributionText: {
    position: "absolute",
    left: 12,
    bottom: 12,
    fontSize: 9,
    fontFamily: "Outfit_500Medium",
    color: "rgba(0,0,0,0.45)",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 101,
  },
});
