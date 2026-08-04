import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Trash2,
  Camera,
  Plus,
  MapPin,
  Clock,
  X,
  Save,
  Image as ImageIcon,
  ChevronDown,
  Search,
  User,
  Navigation,
  ClipboardList,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import * as Location from "expo-location";
import { pickImageFromSource } from "@/lib/imagePickerHelper";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const PRIMARY = "#00643B";
const TASK_TYPE_LABELS: Record<string, string> = {
  GeneralVisit: "General visit",
  FarmInspection: "Farm inspection",
  Registration: "Registration support",
  Other: "Other field work",
};

export default function PhotoNotesScreen() {
  const router = useRouter();
  const api = useApi();
  const { colors, isDark } = useTheme();
  
  const params = useLocalSearchParams<{
    farmerId?: string;
    farmerName?: string;
    taskId?: string;
    taskType?: string;
    animalId?: string;
    openEditor?: string;
  }>();

  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Farmer Selector State
  const [farmers, setFarmers] = useState<any[]>([]);
  const [showFarmerModal, setShowFarmerModal] = useState(false);
  const [searchFarmerQuery, setSearchFarmerQuery] = useState("");

  // Form State
  const [newNote, setNewNote] = useState({
    title: "",
    description: "",
    image: "",
    farmer: "", // farmerName
    farmerId: "",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    if (params?.farmerId) {
      setNewNote((prev) => ({
        ...prev,
        farmerId: params.farmerId || "",
        farmer: params.farmerName || "",
      }));
    }
    if (params?.openEditor === "true") {
      setModalVisible(true);
    }
  }, [params?.farmerId, params?.farmerName, params?.openEditor]);

  const fetchFarmers = async () => {
    try {
      const res = await api.get("/user?role=farmer");
      setFarmers(res.data || []);
    } catch (err) {
      console.error("Failed to load farmers", err);
    }
  };

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await api.get("/technician/photo-notes");
      setNotes(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load field notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    fetchFarmers();
  }, []);

  const handleSelectPhoto = async (source: "camera" | "library") => {
    const result = await pickImageFromSource(source, { aspect: [4, 3], quality: 0.6 });
    if (result) {
      setNewNote((current) => ({
        ...current,
        image: result.base64,
      }));
    }
  };

  const captureCurrentLocation = async () => {
    try {
      setLocating(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        toast.error("Location permission is needed to tag this field note.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setNewNote((current) => ({
        ...current,
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
      }));
      toast.success("Current location added.");
    } catch (error) {
      console.error("Failed to capture current location", error);
      toast.error("Current location could not be captured. Try again outdoors.");
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!newNote.title.trim()) {
      toast.error("Note title is required");
      return;
    }
    if (!newNote.description.trim() && !newNote.image) {
      toast.error("Add an observation or attach a photo");
      return;
    }

    try {
      setLoading(true);
      await api.post("/technician/photo-notes", {
        title: newNote.title.trim(),
        description: newNote.description.trim(),
        imageUrl: newNote.image,
        farmerId: newNote.farmerId || undefined,
        farmerName: newNote.farmer,
        taskId: params.taskId || undefined,
        animalId: params.animalId || undefined,
        latitude: newNote.latitude,
        longitude: newNote.longitude,
      });

      toast.success("Field note saved successfully!");
      setModalVisible(false);
      if (params.taskId) {
        router.back();
        return;
      }
      setNewNote({
        title: "",
        description: "",
        image: "",
        farmer: "",
        farmerId: "",
        latitude: "",
        longitude: "",
      });
      fetchNotes();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save field note");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrigger = (id: string) => {
    setNoteToDelete(id);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      setLoading(true);
      await api.delete(`/technician/photo-notes/${noteToDelete}`);
      toast.success("Field note archived");
      setDeleteModalVisible(false);
      setNoteToDelete(null);
      fetchNotes();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete note");
    } finally {
      setLoading(false);
    }
  };

  const renderNote = ({ item }: { item: any }) => {
    const noteDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Today";

    const noteTime = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Now";

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 28,
          overflow: "hidden",
          marginBottom: 20,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 15,
          elevation: 4,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {item.imageUrl ? (
        <View style={{ height: 180, position: "relative" }}>
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 10,
                fontFamily: "Outfit_700Bold",
              }}
            >
              {noteDate}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteTrigger(item._id)}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(239, 68, 68, 0.9)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Trash2 size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        ) : null}

        <View style={{ padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 18,
                fontFamily: "Outfit_800ExtraBold",
                color: colors.textPrimary,
              }}
            >
              {item.title}
            </Text>
            {!item.imageUrl ? (
              <TouchableOpacity
                onPress={() => handleDeleteTrigger(item._id)}
                accessibilityLabel="Archive field note"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark
                    ? "rgba(239,68,68,0.16)"
                    : "#fef2f2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={17} color="#ef4444" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 6,
            }}
          >
            {item.latitude && item.longitude ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <MapPin
                  size={12}
                  color={isDark ? colors.primary : "#059669"}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Outfit_700Bold",
                    color: isDark ? colors.primary : "#059669",
                  }}
                >
                  {Number(item.latitude).toFixed(4)},{" "}
                  {Number(item.longitude).toFixed(4)}
                </Text>
              </View>
            ) : null}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Clock size={12} color={colors.textMuted} />
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textSecondary,
                }}
              >
                {noteDate} · {noteTime}
              </Text>
            </View>
          </View>

          {item.description ? (
            <Text
            style={{
              fontSize: 14,
              fontFamily: "Outfit_500Medium",
              color: colors.textSecondary,
              marginTop: 12,
              lineHeight: 20,
            }}
          >
            {item.description}
          </Text>
          ) : null}

          {item.taskId || item.animalId ? (
            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.background,
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
              }}
            >
              <ClipboardList
                size={16}
                color={isDark ? colors.primary : PRIMARY}
              />
              <View style={{ flex: 1 }}>
                {item.taskId ? (
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      fontSize: 12,
                      color: colors.textPrimary,
                    }}
                  >
                    {TASK_TYPE_LABELS[item.taskId.taskType] ||
                      "Linked field work"}
                  </Text>
                ) : null}
                {item.animalId ? (
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      fontSize: 11,
                      color: colors.textSecondary,
                      marginTop: item.taskId ? 2 : 0,
                    }}
                  >
                    Animal:{" "}
                    {item.animalId.earTag ||
                      item.animalId.animalId ||
                      "Linked animal"}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="account"
                size={14}
                color={isDark ? colors.primary : PRIMARY}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_700Bold",
                color: colors.textPrimary,
              }}
            >
              {item.farmerName || "General Note"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Premium Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.background,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_900Black",
                fontSize: 22,
              }}
            >
              Field Notes
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 12,
              }}
            >
              {notes.length} Total Logs
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isDark ? colors.primary : PRIMARY,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: isDark ? colors.primary : PRIMARY,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Plus size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && notes.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            size="large"
            color={isDark ? colors.primary : PRIMARY}
          />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item._id}
          renderItem={renderNote}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ marginTop: 100, alignItems: "center" }}>
              <Camera size={64} color={colors.textMuted} />
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  color: colors.textSecondary,
                  marginTop: 16,
                  fontSize: 16,
                }}
              >
                No field notes yet
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  color: colors.textMuted,
                  marginTop: 4,
                }}
              >
                Add observations or photos from field work.
              </Text>
            </View>
          }
        />
      )}

      {/* Add Note Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 24,
              maxHeight: "90%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 24,
                  color: colors.textPrimary,
                }}
              >
                Add Field Note
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
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

            <ScrollView showsVerticalScrollIndicator={false}>
              {params.taskId ? (
                <View
                  style={{
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 18,
                    backgroundColor: isDark
                      ? "rgba(16,185,129,0.12)"
                      : "#ecfdf5",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <ClipboardList
                    size={18}
                    color={isDark ? colors.primary : PRIMARY}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: colors.textPrimary,
                        fontSize: 13,
                      }}
                    >
                      {TASK_TYPE_LABELS[params.taskType || ""] ||
                        "Linked field work"}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Outfit_500Medium",
                        color: colors.textSecondary,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      This note will remain attached to the task.
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Image Selector */}
              <TouchableOpacity
                onPress={() => handleSelectPhoto("library")}
                style={{
                  height: 160,
                  backgroundColor: colors.background,
                  borderRadius: 24,
                  borderStyle: "dashed",
                  borderWidth: 2,
                  borderColor: colors.border,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  marginBottom: 20,
                }}
              >
                {newNote.image ? (
                  <Image
                    source={{ uri: newNote.image }}
                    style={{ width: "100%", height: "100%" }}
                  />
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Camera size={40} color={colors.textMuted} />
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        color: colors.textSecondary,
                        marginTop: 8,
                      }}
                    >
                      Tap to capture or upload
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
                <TouchableOpacity
                  onPress={() => handleSelectPhoto("camera")}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: isDark
                      ? "rgba(37,99,235,0.15)"
                      : "#eff6ff",
                    borderRadius: 12,
                    paddingVertical: 12,
                  }}
                >
                  <Camera size={18} color="#2563eb" />
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: "#2563eb",
                      fontSize: 13,
                    }}
                  >
                    Camera
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleSelectPhoto("library")}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: isDark
                      ? "rgba(22,163,74,0.15)"
                      : "#f0fdf4",
                    borderRadius: 12,
                    paddingVertical: 12,
                  }}
                >
                  <ImageIcon size={18} color="#16a34a" />
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: "#16a34a",
                      fontSize: 13,
                    }}
                  >
                    Gallery
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={captureCurrentLocation}
                disabled={locating}
                style={{
                  minHeight: 48,
                  marginBottom: 20,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {locating ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? colors.primary : PRIMARY}
                  />
                ) : (
                  <Navigation
                    size={18}
                    color={isDark ? colors.primary : PRIMARY}
                  />
                )}
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    color: isDark ? colors.primary : PRIMARY,
                    fontSize: 13,
                  }}
                >
                  {locating
                    ? "Getting current location..."
                    : newNote.latitude && newNote.longitude
                      ? "Update current location"
                      : "Use current location (optional)"}
                </Text>
              </TouchableOpacity>

              {/* Form Fields */}
              <View style={{ gap: 20 }}>
                {newNote.latitude && newNote.longitude ? (
                  <View
                    style={{
                      borderRadius: 14,
                      backgroundColor: isDark
                        ? "rgba(16,185,129,0.12)"
                        : "#ecfdf5",
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <MapPin
                      size={16}
                      color={isDark ? colors.primary : "#059669"}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 12,
                        color: isDark ? colors.primary : "#047857",
                      }}
                    >
                      GPS {newNote.latitude}, {newNote.longitude}
                    </Text>
                  </View>
                ) : null}

                <View>
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginBottom: 8,
                      marginLeft: 4,
                    }}
                  >
                    NOTE TITLE
                  </Text>
                  <TextInput
                    placeholder="e.g. Farm condition follow-up"
                    placeholderTextColor={colors.textMuted}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 16,
                      padding: 16,
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 15,
                      borderWidth: 1,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    }}
                    value={newNote.title}
                    onChangeText={(t) => setNewNote({ ...newNote, title: t })}
                  />
                </View>

                <View>
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginBottom: 8,
                      marginLeft: 4,
                    }}
                  >
                    FARMER NAME
                  </Text>
                  <TouchableOpacity
                    disabled={Boolean(params.taskId)}
                    onPress={() => {
                      setSearchFarmerQuery("");
                      setShowFarmerModal(true);
                    }}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: params.taskId ? 0.72 : 1,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <User size={16} color={isDark ? colors.primary : PRIMARY} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "Outfit_600SemiBold",
                            fontSize: 15,
                            color: newNote.farmer ? colors.textPrimary : colors.textMuted,
                          }}
                        >
                          {newNote.farmer || "Select Farmer (Optional)"}
                        </Text>
                      </View>
                    </View>
                    <ChevronDown size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View>
                  <Text
                    style={{
                      fontFamily: "Outfit_700Bold",
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginBottom: 8,
                      marginLeft: 4,
                    }}
                  >
                    OBSERVATIONS
                  </Text>
                  <TextInput
                    placeholder="Describe what you see in the field..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    style={{
                      backgroundColor: colors.background,
                      borderRadius: 16,
                      padding: 16,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 15,
                      borderWidth: 1,
                      borderColor: colors.border,
                      height: 100,
                      textAlignVertical: "top",
                      color: colors.textPrimary,
                    }}
                    value={newNote.description}
                    onChangeText={(t) =>
                      setNewNote({ ...newNote, description: t })
                    }
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={{
                  backgroundColor: isDark ? colors.primary : PRIMARY,
                  marginTop: 32,
                  borderRadius: 20,
                  alignItems: "center",
                  shadowColor: isDark ? colors.primary : PRIMARY,
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  elevation: 8,
                  paddingVertical: 16,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Save size={20} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontFamily: "Outfit_900Black",
                          fontSize: 16,
                        }}
                      >
                        Save Field Note
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} animationType="fade" transparent={true}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 28,
              padding: 24,
              width: "100%",
              maxWidth: 340,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Trash2 size={24} color="#ef4444" />
            </View>

            <Text
              style={{
                fontSize: 20,
                fontFamily: "Outfit_800ExtraBold",
                color: colors.textPrimary,
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Archive Field Note?
            </Text>

            <Text
              style={{
                fontSize: 14,
                fontFamily: "Outfit_500Medium",
                color: colors.textSecondary,
                textAlign: "center",
                lineHeight: 20,
                marginBottom: 24,
              }}
            >
              This note will be removed from your active list. Official AI and health records are not affected.
            </Text>

            <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalVisible(false);
                  setNoteToDelete(null);
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: colors.background,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmDelete}
                disabled={loading}
                style={{
                  flex: 1,
                  backgroundColor: "#ef4444",
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Trash2 size={16} color="#ffffff" />
                    <Text
                      style={{
                        color: "#ffffff",
                        fontFamily: "Outfit_900Black",
                        fontSize: 14,
                      }}
                    >
                      Archive
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Searchable Farmer Selection Modal */}
      <Modal
        visible={showFarmerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFarmerModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              padding: 24,
              maxHeight: "80%",
              minHeight: "50%",
            }}
          >
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_900Black",
                  fontSize: 22,
                  color: colors.textPrimary,
                }}
              >
                Select Farmer
              </Text>
              <TouchableOpacity
                onPress={() => setShowFarmerModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.background,
                borderRadius: 16,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 16,
              }}
            >
              <Search size={18} color={colors.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Search by name, phone or barangay..."
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
                value={searchFarmerQuery}
                onChangeText={setSearchFarmerQuery}
              />
            </View>

            {/* General Note Option */}
            <TouchableOpacity
              onPress={() => {
                setNewNote({ ...newNote, farmer: "", farmerId: "" });
                setShowFarmerModal(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.background,
                padding: 16,
                borderRadius: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "#fffbeb",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <MaterialCommunityIcons
                  name="note-outline"
                  size={18}
                  color={isDark ? "#fbbf24" : "#d97706"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                    color: colors.textPrimary,
                  }}
                >
                  General Note (No Farmer)
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 11,
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  Create a general note not linked to any specific client
                </Text>
              </View>
            </TouchableOpacity>

            {/* Farmers List */}
            {farmers.length === 0 ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <ActivityIndicator size="small" color={isDark ? colors.primary : PRIMARY} />
              </View>
            ) : (
              <FlatList
                data={farmers.filter((f) => {
                  const query = searchFarmerQuery.toLowerCase();
                  const nameMatch = (f.name || "").toLowerCase().includes(query);
                  const phoneMatch = (f.address?.phoneNumber || f.phoneNumber || "").includes(query);
                  const barangayMatch = (f.address?.barangay || "").toLowerCase().includes(query);
                  return nameMatch || phoneMatch || barangayMatch;
                })}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                renderItem={({ item }) => {
                  const brgy = item.address?.barangay || "";
                  const phone = item.address?.phoneNumber || item.phoneNumber || "";
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setNewNote({ ...newNote, farmer: item.name, farmerId: item._id });
                        setShowFarmerModal(false);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 16,
                        backgroundColor: colors.background,
                        borderRadius: 16,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 12,
                        }}
                      >
                        <User size={20} color={isDark ? colors.primary : PRIMARY} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "Outfit_700Bold",
                            fontSize: 14,
                            color: colors.textPrimary,
                          }}
                        >
                          {item.name}
                        </Text>
                        {brgy || phone ? (
                          <Text
                            style={{
                              fontFamily: "Outfit_500Medium",
                              fontSize: 11,
                              color: colors.textMuted,
                              marginTop: 2,
                            }}
                          >
                            {brgy ? brgy : ""}
                            {brgy && phone ? " • " : ""}
                            {phone ? phone : ""}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
