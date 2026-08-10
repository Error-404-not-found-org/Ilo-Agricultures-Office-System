import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Info,
  CheckCircle,
  FileText,
  Heart,
  CalendarCheck,
} from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useApi } from "@/lib/api";
import { toast } from "sonner-native";
import { useTheme } from "@/lib/theme";
import { generatePregnancyTimeline, TimelineMilestones } from "@/lib/cattleCore";
import { useQueryClient } from "@tanstack/react-query";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
} from "@/features/breeding/utils/breedingObservationPresentation";

export default function PregnancyVerificationScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();

  const [task, setTask] = useState<any>(null);
  const [insem, setInsem] = useState<any>(null);
  const [milestones, setMilestones] = useState<TimelineMilestones | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [verificationResult, setVerificationResult] = useState<
    "pregnant" | "not_pregnant" | "return_to_heat" | "needs_recheck" | ""
  >("");
  const [checkMethod, setCheckMethod] = useState("");
  const [checkedAt, setCheckedAt] = useState<Date>(new Date());
  const [nextCheckDate, setNextCheckDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");

  // Date picker visibility states
  const [showCheckedAtPicker, setShowCheckedAtPicker] = useState(false);
  const [showNextCheckDatePicker, setShowNextCheckDatePicker] = useState(false);
  const pregnancyReadiness = task?.pregnancyReadiness || insem?.pregnancyReadiness || null;
  const methodBased = pregnancyReadiness?.policyMode === "method_based";
  const methodOptions = methodBased
    ? pregnancyReadiness?.methods || []
    : [
        { methodCode: "palpation", label: "palpation", enabled: true, isEligible: pregnancyReadiness?.isEligible, reason: pregnancyReadiness?.reason },
        { methodCode: "ultrasound", label: "ultrasound", enabled: true, isEligible: pregnancyReadiness?.isEligible, reason: pregnancyReadiness?.reason },
        { methodCode: "visual_observation", label: "visual observation", enabled: true, isEligible: pregnancyReadiness?.isEligible, reason: pregnancyReadiness?.reason },
        { methodCode: "farmer_interview", label: "farmer interview", enabled: true, isEligible: pregnancyReadiness?.isEligible, reason: pregnancyReadiness?.reason },
        { methodCode: "other", label: "other", enabled: true, isEligible: pregnancyReadiness?.isEligible, reason: pregnancyReadiness?.reason },
      ];
  const selectedMethod = methodOptions.find((method: any) => method.methodCode === checkMethod);
  const officialDiagnosis = ["pregnant", "not_pregnant"].includes(verificationResult);
  const officialDiagnosisReady = methodBased
    ? Boolean(selectedMethod?.enabled && selectedMethod?.isEligible)
    : Boolean(pregnancyReadiness?.isEligible);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const res = await api.get(`/tasks/${id}`);
        setTask(res.data);
        if (res.data?.insemination) {
          const insemData = res.data.insemination;
          setInsem(insemData);
          
          const animalObj = insemData.animalId;
          const start = insemData.inseminationDate || insemData.createdAt;
          if (start && animalObj) {
            const milestonesObj = generatePregnancyTimeline(
              start,
              animalObj.species,
              undefined,
              animalObj.breed
            );
            setMilestones(milestonesObj);
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load task details");
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
  }, [id, api]);

  const handleVerify = async () => {
    if (officialDiagnosis && !officialDiagnosisReady) {
      toast.error(
        pregnancyReadiness?.reason || "Pregnancy check is not yet available.",
      );
      return;
    }
    if (!verificationResult) {
      toast.error("Please select a verification result.");
      return;
    }
    if (!checkMethod && (methodBased || officialDiagnosis)) {
      toast.error("Please select a diagnostic method.");
      return;
    }
    if (verificationResult === "needs_recheck" && !nextCheckDate) {
      toast.error("Please specify a next check date for rechecks.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/ai-request/${insem._id}/verify-breeding-observation`, {
        verificationResult,
        checkMethod,
        checkedAt: checkedAt.toISOString(),
        technicianNotes: notes,
        nextCheckDate: nextCheckDate ? nextCheckDate.toISOString() : undefined,
        policyVersion: pregnancyReadiness?.policyVersion,
        taskId: task?._id,
      });

      queryClient.invalidateQueries({ queryKey: ["technician", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "records"] });
      toast.success("Pregnancy verification recorded!");
      
      // Navigate back and dismiss this screen
      router.dismiss(2);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={isDark ? "#10b981" : "#00643B"} />
      </View>
    );
  }

  if (!task || !insem) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_700Bold" }}>
          Task or AI record not found
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={{ color: "#fff", fontFamily: "Outfit_700Bold" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const animal = insem.animalId || {};

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: isDark ? colors.card : "#f8fafc" }]}
        >
          <ArrowLeft size={24} color={isDark ? "white" : "#1e293b"} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Pregnancy Verification
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {/* Compact Context Summary */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Cow {animal.earTag || animal.animalId || "N/A"} · Attempt #{insem.attemptNumber || "N/A"}
            </Text>
            <View style={{ marginTop: 8, gap: 2 }}>
              <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 13, color: colors.textSecondary }}>
                AI date: {formatDate(insem.inseminationDate || insem.scheduledDate)}
              </Text>
              {pregnancyReadiness?.daysPostAI !== undefined ? (
                <Text style={{ fontFamily: "Outfit_500Medium", fontSize: 13, color: colors.textSecondary }}>
                  Day {pregnancyReadiness.daysPostAI} after AI
                </Text>
              ) : null}
            </View>
          </View>

          {/* Verification Outcome Form */}
          <Text style={[styles.sectionTitle, { color: isDark ? "#34d399" : "#00643B" }]}>Verification Form</Text>

          {pregnancyReadiness && !pregnancyReadiness.isEligible && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? "rgba(245,158,11,0.10)" : "#fffbeb",
                  borderColor: isDark ? "rgba(245,158,11,0.30)" : "#fde68a",
                  marginBottom: 20,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Info size={20} color={isDark ? "#fbbf24" : "#92400e"} />
                <Text style={[styles.cardTitle, { color: isDark ? "#fbbf24" : "#92400e" }]}>
                  Pregnancy check not yet available
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                {pregnancyReadiness.reason}
              </Text>
            </View>
          )}

          {/* Outcome Segmented Control */}
          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Pregnancy Diagnosis Outcome</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                verificationResult === "pregnant" && [styles.segmentBtnActive, { backgroundColor: isDark ? "#10b981" : "#00643B" }],
                { borderColor: colors.border }
              ]}
              onPress={() => setVerificationResult("pregnant")}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: verificationResult === "pregnant" ? "#fff" : colors.textPrimary }
                ]}
              >
                Pregnant
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                verificationResult === "not_pregnant" && [styles.segmentBtnActive, { backgroundColor: "#ef4444" }],
                { borderColor: colors.border }
              ]}
              onPress={() => setVerificationResult("not_pregnant")}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: verificationResult === "not_pregnant" ? "#fff" : colors.textPrimary }
                ]}
              >
                Empty
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                verificationResult === "return_to_heat" && [styles.segmentBtnActive, { backgroundColor: "#f59e0b" }],
                { borderColor: colors.border }
              ]}
              onPress={() => setVerificationResult("return_to_heat")}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: verificationResult === "return_to_heat" ? "#fff" : colors.textPrimary }
                ]}
              >
                Re-heat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                verificationResult === "needs_recheck" && [styles.segmentBtnActive, { backgroundColor: "#3b82f6" }],
                { borderColor: colors.border }
              ]}
              onPress={() => setVerificationResult("needs_recheck")}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: verificationResult === "needs_recheck" ? "#fff" : colors.textPrimary }
                ]}
              >
                Recheck
              </Text>
            </TouchableOpacity>
          </View>

          {/* Diagnostic Check Method */}
          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Diagnostic Method</Text>
          <View style={styles.pillRow}>
            {methodOptions.map(
              (method: any) => (
                <TouchableOpacity
                  key={method.methodCode}
                  disabled={!method.enabled || !method.isEligible}
                  style={[
                    styles.pillBtn,
                    {
                      borderColor: checkMethod === method.methodCode
                        ? isDark ? "#047857" : "#00643B"
                        : colors.border,
                      backgroundColor: checkMethod === method.methodCode
                        ? isDark ? "#047857" : "#00643B"
                        : colors.card,
                      opacity: method.enabled && method.isEligible ? 1 : 0.5,
                    },
                    checkMethod === method.methodCode && styles.pillBtnActive,
                  ]}
                  onPress={() => setCheckMethod(method.methodCode)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: checkMethod === method.methodCode ? "#fff" : colors.textPrimary }
                    ]}
                  >
                    {method.label}
                  </Text>
                  {methodBased && (
                    <Text style={[styles.pillText, { color: checkMethod === method.methodCode ? "#fff" : colors.textSecondary, fontSize: 9 }]}>
                      {method.isEligible ? "Available" : method.availableDateLabel || method.reason}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            )}
          </View>

          {/* Date of Diagnosis */}
          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Checked At</Text>
          <TouchableOpacity
            style={[styles.dateInput, { backgroundColor: colors.card, borderColor: colors.border }]}
            disabled={officialDiagnosis && !officialDiagnosisReady}
            onPress={() => setShowCheckedAtPicker(true)}
          >
            <CalendarIcon size={18} color={colors.textSecondary} />
            <Text style={[styles.dateInputText, { color: colors.textPrimary }]}>
              {formatDate(checkedAt)}
            </Text>
          </TouchableOpacity>

          {/* Next Check Date (Visible only on needs_recheck) */}
          {verificationResult === "needs_recheck" && (
            <>
              <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Next Recheck Date</Text>
              <TouchableOpacity
                style={[styles.dateInput, { backgroundColor: colors.card, borderColor: colors.border }]}
                disabled={officialDiagnosis && !officialDiagnosisReady}
                onPress={() => setShowNextCheckDatePicker(true)}
              >
                <CalendarIcon size={18} color={colors.textSecondary} />
                <Text style={[styles.dateInputText, { color: colors.textPrimary }]}>
                  {nextCheckDate ? formatDate(nextCheckDate) : "Select date..."}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Notes */}
          <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Technician notes</Text>
          <TextInput
            editable={!officialDiagnosis || officialDiagnosisReady}
            multiline
            numberOfLines={4}
            placeholder="Add diagnosis details, health notes, recommendation..."
            placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            value={notes}
            onChangeText={setNotes}
          />

          {/* Submit Button */}
          <TouchableOpacity
            disabled={submitting || (officialDiagnosis && !officialDiagnosisReady)}
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  submitting || (officialDiagnosis && !officialDiagnosisReady)
                    ? colors.textMuted
                    : isDark ? "#10b981" : "#00643B",
                shadowColor: isDark ? "transparent" : "#00643B",
              },
            ]}
            onPress={handleVerify}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <CheckCircle size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Save Pregnancy Confirmation</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      {showCheckedAtPicker && (
        <DateTimePicker
          value={checkedAt}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowCheckedAtPicker(false);
            if (date) setCheckedAt(date);
          }}
        />
      )}

      {showNextCheckDatePicker && (
        <DateTimePicker
          value={nextCheckDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowNextCheckDatePicker(false);
            if (date) setNextCheckDate(date);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    backgroundColor: "#00643B",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 16,
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 20,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },
  gridItem: {
    width: "50%",
  },
  label: {
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
  },
  obsSection: {
    marginBottom: 16,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  badgeText: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  signsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  signPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  signText: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
  },
  notesText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 20,
    marginTop: 4,
  },
  milestonesDesc: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    marginBottom: 16,
  },
  milestoneList: {
    gap: 12,
  },
  milestoneItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  milestoneLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
  },
  milestoneValue: {
    fontFamily: "Outfit_650Medium",
    fontSize: 13,
  },
  sectionTitle: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 18,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  formLabel: {
    fontFamily: "Outfit_700Bold",
    fontSize: 14,
    marginBottom: 10,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  segmentBtnActive: {
    borderWidth: 0,
  },
  segmentText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  pillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillBtnActive: {
    borderWidth: 0,
  },
  pillText: {
    fontFamily: "Outfit_650Medium",
    fontSize: 13,
    textTransform: "capitalize",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  dateInputText: {
    fontFamily: "Outfit_650Medium",
    fontSize: 14,
  },
  notesInput: {
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 40,
  },
  submitBtnText: {
    color: "#fff",
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 16,
  },
});
