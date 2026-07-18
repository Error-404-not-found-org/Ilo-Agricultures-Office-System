import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
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
  Lock,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { useTechnicianTasks } from "@/features/technician/hooks/useTechnicianTasks";

export default function TaskDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const { taskDetailsQuery, claimTaskMutation, completeTaskMutation } = useTechnicianTasks(String(id));
  const { data: task, isLoading, refetch } = taskDetailsQuery;
  const pregnancyWorkflowStage =
    task?.metadata?.workflowStage || task?.workflowStage || "initial_confirmation";
  const initialPregnancyCheckLocked = Boolean(
    task?.taskType === "PD" &&
      pregnancyWorkflowStage === "initial_confirmation" &&
      task?.pregnancyReadiness &&
      !task.pregnancyReadiness.isEligible,
  );

  const [completing, setCompleting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await claimTaskMutation.mutateAsync(String(id));
      toast.success("Task claimed successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to claim task");
    } finally {
      setClaiming(false);
    }
  };

  const handleComplete = async () => {
    if (completing) return;
    setCompleting(true);
    try {
      await completeTaskMutation.mutateAsync(String(id));
      toast.success("Visit marked as completed!");
      router.back();
    } catch (err) {
      toast.error("Update failed");
    } finally {
      setCompleting(false);
    }
  };

  const getPrimaryAction = () => {
    const taskType = task?.taskType;
    if (taskType === "AI") {
      return { label: "Record AI Service", pathname: "/(technician)/record-ai" };
    }
    if (["Health", "Treatment", "Vaccination", "Deworming"].includes(taskType)) {
      return { label: "Record Health Assistance", pathname: "/(technician)/health-log" };
    }
    if (taskType === "PD") {
      if (pregnancyWorkflowStage === "continuation_recheck") {
        return { label: "Record Continuation Recheck", pathname: "/(technician)/pregnancy-verification" };
      }
      if (pregnancyWorkflowStage === "diagnostic_follow_up") {
        return { label: "Record Diagnostic Follow-up", pathname: "/(technician)/pregnancy-verification" };
      }
      return { label: "Record Pregnancy Check", pathname: "/(technician)/pregnancy-verification" };
    }
    if (taskType === "CD" || taskType === "Calving") {
      return { label: "Record Calving", pathname: "/(technician)/record-calf-drop" };
    }
    return { label: "Complete General Visit", pathname: null };
  };

  const handlePrimaryAction = () => {
    if (initialPregnancyCheckLocked) {
      toast.error(task?.pregnancyReadiness?.reason || "Pregnancy check is not yet available.");
      return;
    }
    const action = getPrimaryAction();
    if (!action.pathname) {
      handleComplete();
      return;
    }

    const animal = task.animalIds?.[0];
    const params: Record<string, string> = {
      taskId: String(task._id),
      farmerId: String(task.farmerId?._id || ""),
      farmerName: String(task.farmerId?.name || ""),
      source: "task",
    };

    if (animal?._id) {
      if (task.taskType === "CD" || task.taskType === "Calving") {
        params.motherId = String(animal._id);
      } else {
        params.animalId = String(animal._id);
      }
    }

    if (task.taskType === "PD") {
      router.push(`/(technician)/pregnancy-verification?id=${task._id}` as any);
      return;
    }

    router.push({ pathname: action.pathname as any, params } as any);
  };

  if (isLoading) {
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
  }

  if (!task) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <Text style={{ color: colors.textPrimary }}>Visit or task not found</Text>
      </View>
    );
  }

  const isClaimed = !!task.technicianId;
  const pregnancyReadiness =
    task.taskType === "PD" ? task.pregnancyReadiness : null;

  const farmLocation = task.farmerId?.farmLocation;
  const farmerCoords =
    typeof farmLocation?.latitude === "number" &&
    typeof farmLocation?.longitude === "number"
      ? {
          lat: farmLocation.latitude,
          lng: farmLocation.longitude,
          isExact: true,
        }
      : {
          lat: task.farmerId?.address?.coordinates?.lat || 10.693,
          lng: task.farmerId?.address?.coordinates?.lng || 122.474,
          isExact: false,
        };

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
          Visit / Task Details
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Task Info Content */}
        <View style={styles.content}>
          
          {/* Farmer Info section */}
          <View style={[styles.section, styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
              {/* Farmer Profile Pic */}
              {task.farmerId?.imageUrl ? (
                <Image
                  source={{ uri: task.farmerId.imageUrl }}
                  style={styles.profileAvatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.profileAvatar, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                  <User size={24} color={colors.textSecondary} />
                </View>
              )}
              
              <View style={{ flex: 1 }}>
                <Text style={[styles.farmerName, { color: colors.textPrimary }]}>
                  {task.farmerId?.name}
                </Text>
                
                {isClaimed ? (
                  <>
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
                        {task.farmerId?.address?.city || task.farmerId?.address?.municipality || "Iloilo"}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                      Landmark: {task.farmerId?.farmLocation?.landmark || task.farmerId?.address?.landmark || "None listed"}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                      Directions: {task.farmerId?.farmLocation?.directionsNote || "None listed"}
                    </Text>
                  </>
                ) : (
                  <View style={styles.row}>
                    <Lock size={14} color={colors.textMuted} />
                    <Text style={[styles.farmerSub, { color: colors.textMuted, fontStyle: "italic" }]}>
                      Claim task to view contact details
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            {/* Navigate Button */}
            {isClaimed && (
              <TouchableOpacity
                style={[
                  styles.navigateBtn,
                  {
                    backgroundColor: isDark ? '#064e3b' : '#f0fdf4',
                    borderColor: isDark ? '#065f46' : '#bbf7d0',
                  }
                ]}
                onPress={() => {
                  let destinationQuery = "";
                  if (farmLocation?.latitude && farmLocation?.longitude) {
                    destinationQuery = `${farmLocation.latitude},${farmLocation.longitude}`;
                  } else if (task.farmerId?.address?.coordinates?.lat && task.farmerId?.address?.coordinates?.lng) {
                    destinationQuery = `${task.farmerId.address.coordinates.lat},${task.farmerId.address.coordinates.lng}`;
                  } else {
                    const addr = task.farmerId?.address || {};
                    destinationQuery = `${addr.barangay || ""}, ${addr.city || addr.municipality || "Iloilo"}`;
                  }

                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;
                  Linking.openURL(url).catch((err) =>
                    console.error("Failed to open maps", err),
                  );
                }}
              >
                <Navigation size={14} color={isDark ? '#34d399' : '#00643B'} />
                <Text style={[styles.navigateBtnText, { color: isDark ? '#34d399' : '#00643B' }]}>
                  {typeof farmLocation?.latitude === "number"
                    ? "Get directions to farm"
                    : (task.farmerId?.address?.coordinates?.lat
                      ? "Navigate to Address Coordinates"
                      : "Navigate to Barangay Area")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Task Description section */}
          <View style={[styles.section, styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Info size={18} color={isDark ? "#34d399" : "#00643B"} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B" },
                ]}
              >
                Visit / Task Description
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

          {/* Associated Animals section */}
          {task.animalIds && task.animalIds.length > 0 && (
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: isDark ? "#34d399" : "#00643B", marginBottom: 12, marginLeft: 4 },
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
                  {/* Animal Profile Pic */}
                  {anim.imageUrl ? (
                    <Image
                      source={{ uri: anim.imageUrl }}
                      style={styles.animalAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.animalAvatar, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                      <Text style={{ fontFamily: 'Outfit_700Bold', color: colors.textSecondary, fontSize: 16 }}>
                        {(anim.species || 'A').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

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

          {pregnancyReadiness && !pregnancyReadiness.isEligible && (
            <View
              style={[
                styles.section,
                styles.cardContainer,
                {
                  backgroundColor: isDark ? "rgba(245,158,11,0.10)" : "#fffbeb",
                  borderColor: isDark ? "rgba(245,158,11,0.30)" : "#fde68a",
                },
              ]}
            >
              <View style={styles.sectionHeader}>
                <Info size={18} color={isDark ? "#fbbf24" : "#92400e"} />
                <Text style={[styles.sectionTitle, { color: isDark ? "#fbbf24" : "#92400e" }]}>
                  Pregnancy check not yet available
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                {pregnancyReadiness.reason}
              </Text>
            </View>
          )}

          {/* Save/Action Button */}
          {!isClaimed ? (
            <TouchableOpacity
              disabled={claiming}
              style={[
                styles.completeBtn,
                {
                  backgroundColor: claiming
                    ? "#34d399"
                    : isDark
                      ? "#10b981"
                      : "#00643B",
                  shadowColor: isDark ? "transparent" : "#00643B",
                  opacity: claiming ? 0.7 : 1,
                },
              ]}
              onPress={handleClaim}
            >
              {claiming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle size={20} color="#fff" />
                  <Text style={styles.completeBtnText}>Claim Task</Text>
                </>
              )}
            </TouchableOpacity>
          ) : task.status === "Completed" ? (
            <View
              style={[
                styles.completeBtn,
                {
                  backgroundColor: colors.border,
                  shadowColor: "transparent",
                  opacity: 0.8,
                },
              ]}
            >
              <CheckCircle size={20} color={colors.textMuted} />
              <Text style={[styles.completeBtnText, { color: colors.textMuted }]}>Completed</Text>
            </View>
          ) : (
            <TouchableOpacity
              disabled={completing || initialPregnancyCheckLocked}
              accessibilityRole="button"
              accessibilityState={{ disabled: completing || initialPregnancyCheckLocked }}
              accessibilityLabel={
                initialPregnancyCheckLocked
                  ? `Pregnancy check unavailable. ${pregnancyReadiness?.reason || "Not yet available."}`
                  : getPrimaryAction().label
              }
              style={[
                styles.completeBtn,
                {
                  backgroundColor: completing
                    ? "#34d399"
                    : isDark
                      ? "#10b981"
                      : "#00643B",
                  shadowColor: isDark ? "transparent" : "#00643B",
                  opacity: completing || initialPregnancyCheckLocked ? 0.55 : 1,
                },
              ]}
              onPress={handlePrimaryAction}
            >
              {completing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <CheckCircle size={20} color="#fff" />
                  <Text style={styles.completeBtnText}>
                    {initialPregnancyCheckLocked
                      ? "Pregnancy Check Unavailable"
                      : getPrimaryAction().label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  cardContainer: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 13,
    color: "#00643B",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerName: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
    color: "#1e293b",
  },
  farmerSub: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    color: "#64748b",
    marginLeft: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  navigateBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  notesText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
  },
  animalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
  },
  animalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    marginTop: 10,
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
});
