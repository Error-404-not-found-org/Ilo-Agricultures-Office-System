import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Image,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Calendar,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  HelpCircle,
  Eye,
} from "lucide-react-native";
import { toast } from "sonner-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme";
import { useApi } from "@/lib/api";
import { taskKeys, animalKeys, breedingKeys } from "@/lib/queryKeys";
import {
  ImageViewerModal,
  type ImageViewerItem,
} from "@/components/shared/ImageViewerModal";
import { AppPageHeader } from "@/components/AppPageHeader";
import { formatPregnancyLossLocation } from "@/features/breeding/utils/pregnancyLossWorkflow";

interface PregnancyLossReviewTaskViewProps {
  task: any;
  onReviewed?: () => void;
}

export default function PregnancyLossReviewTaskView({
  task,
  onReviewed,
}: PregnancyLossReviewTaskViewProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();

  const primaryColor = isDark ? colors.primary : "#00643B";

  // Resolve animal, farmer, pregnancy, and loss report
  const animal =
    task.animalIds?.[0] ||
    task.animalId ||
    task.context?.animal ||
    task.pregnancyLossReport?.animalId;
  const farmer =
    task.farmerId ||
    task.context?.farmer ||
    task.pregnancyLossReport?.farmerId;
  const pregnancy =
    task.pregnancy ||
    task.context?.pregnancy ||
    task.pregnancyLossReport?.pregnancyId;
  const insemination =
    task.insemination ||
    task.context?.insemination ||
    task.pregnancyLossReport?.inseminationId;

  // Report details from task or populated pregnancyLossReport
  const report = task.pregnancyLossReport || task.context || {};
  const reportId =
    task.metadata?.reportId ||
    task.context?.reportId ||
    report._id ||
    task.relatedRecordId;

  const observationDate =
    report.observationDate || task.context?.observationDate;
  const reportedAt = report.reportedAt || task.context?.reportedAt || task.createdAt;
  const notes = report.notes || task.context?.notes || "No notes provided.";
  const evidencePhotos: string[] =
    report.evidencePhotos || task.context?.evidencePhotos || [];

  const reportStatus = report.status || (task.status === "Completed" ? "reviewed" : "pending_review");
  const isReviewed =
    ["confirmed", "not_confirmed"].includes(reportStatus) ||
    task.status === "Completed";
  const needsFollowUp = reportStatus === "needs_visit";

  const [reviewNotes, setReviewNotes] = useState(report.reviewNotes || "");
  const [submittingOutcome, setSubmittingOutcome] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Photo viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const photoItems = useMemo<ImageViewerItem[]>(
    () =>
      evidencePhotos.map((uri, idx) => ({
        uri,
        fileName: `pregnancy-loss-photo-${idx + 1}`,
        accessibilityLabel: `Evidence photo ${idx + 1}`,
      })),
    [evidencePhotos],
  );

  const handleReview = async (outcome: "confirm_loss" | "not_confirmed" | "needs_visit") => {
    if (!reportId) {
      toast.error("Pregnancy loss report reference ID is missing.");
      return;
    }

    setSubmittingOutcome(outcome);
    try {
      await api.post(`/technician/pregnancy-loss-reports/${reportId}/review`, {
        outcome,
        reviewNotes: reviewNotes.trim(),
      });

      if (outcome === "confirm_loss") {
        toast.success("Pregnancy loss confirmed.");
      } else if (outcome === "needs_visit") {
        toast.success("Pregnancy loss report kept open for follow-up.");
      } else {
        toast.success("Pregnancy loss not confirmed. Pregnancy monitoring will continue.");
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: animalKeys.all });
      if (animal?._id) {
        queryClient.invalidateQueries({ queryKey: breedingKeys.tracker(String(animal._id)) });
        queryClient.invalidateQueries({ queryKey: animalKeys.detail(String(animal._id)) });
      }

      if (onReviewed) {
        onReviewed();
      } else {
        router.back();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit review.");
    } finally {
      setSubmittingOutcome(null);
      setShowConfirmModal(false);
    }
  };

  const formatDate = (val: unknown) => {
    if (!val) return "N/A";
    const d = new Date(String(val));
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const farmerName =
    (typeof farmer?.name === "string" && farmer.name.trim()) ||
    (typeof farmer?.fullName === "string" && farmer.fullName.trim()) ||
    [farmer?.firstName, farmer?.lastName]
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .join(" ") ||
    "Farmer";

  const farmerLocationText = formatPregnancyLossLocation(
    farmer,
    "Location not recorded",
  );

  const farmerPhone =
    typeof farmer?.phoneNumber === "string" && farmer.phoneNumber.trim()
      ? farmer.phoneNumber.trim()
      : typeof farmer?.phone === "string" && farmer.phone.trim()
        ? farmer.phone.trim()
        : null;

  const animalTag =
    (typeof animal?.earTag === "string" && animal.earTag.trim()) ||
    (typeof animal?.name === "string" && animal.name.trim()) ||
    (typeof animal?.animalId === "string" && animal.animalId.trim()) ||
    "Ear Tag N/A";

  const animalBreed =
    typeof animal?.breed === "string" && animal.breed.trim()
      ? animal.breed.trim()
      : "Crossbreed";

  const animalSpecies =
    typeof animal?.species === "string" && animal.species.trim()
      ? animal.species.trim()
      : "Cattle";

  const animalStatus =
    typeof animal?.reproductiveStatus === "string" && animal.reproductiveStatus.trim()
      ? animal.reproductiveStatus.trim()
      : "Pregnant";

  const notesText =
    typeof notes === "string"
      ? notes
      : typeof report?.notes === "string"
        ? report.notes
        : "No notes provided.";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader
        title="Pregnancy Loss Review"
        onBack={() => router.back()}
        rightAction={
          <View
            className="px-3 py-1 rounded-full border"
            style={{
              backgroundColor: isReviewed
                ? isDark
                  ? "rgba(16, 185, 129, 0.15)"
                  : "#ecfdf5"
                : needsFollowUp
                  ? isDark
                    ? "rgba(245, 158, 11, 0.15)"
                    : "#fffbeb"
                  : isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#eff6ff",
              borderColor: isReviewed
                ? isDark
                  ? "#10b981"
                  : "#059669"
                : needsFollowUp
                  ? isDark
                    ? "#f59e0b"
                    : "#d97706"
                  : isDark
                    ? "#3b82f6"
                    : "#2563eb",
            }}
          >
            <Text
              className="text-[10px] font-black uppercase tracking-wider"
              style={{
                color: isReviewed
                  ? isDark
                    ? "#34d399"
                    : "#059669"
                  : needsFollowUp
                    ? isDark
                      ? "#fbbf24"
                      : "#d97706"
                    : isDark
                      ? "#60a5fa"
                      : "#2563eb",
              }}
            >
              {isReviewed
                ? report.technicianOutcome === "confirm_loss"
                  ? "Loss Confirmed"
                  : "Completed"
                : needsFollowUp
                  ? "Follow-up Needed"
                  : "Needs Review"}
            </Text>
          </View>
        }
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        style={{ backgroundColor: colors.background }}
      >

      <View className="px-6 mt-6 gap-6">
        {/* Notice Banner */}
        <View
          className="p-4 rounded-3xl border flex-row items-start"
          style={{
            backgroundColor: isDark ? "rgba(245, 158, 11, 0.1)" : "#fffbeb",
            borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#fde68a",
          }}
        >
          <AlertTriangle
            size={18}
            color={isDark ? "#fbbf24" : "#d97706"}
            style={{ marginTop: 2 }}
          />
          <View className="ml-3 flex-1">
            <Text
              className="text-xs font-bold"
              style={{ color: isDark ? "#fef3c7" : "#92400e" }}
            >
              Pregnancy remains active until the loss is confirmed.
            </Text>
            <Text
              className="text-[11px] font-medium leading-4 mt-1"
              style={{ color: isDark ? "#fde68a" : "#b45309" }}
            >
              If the report is not confirmed or needs follow-up, pregnancy monitoring will continue.
            </Text>
          </View>
        </View>

        {/* Mother Animal Card */}
        {animal ? (
          <TouchableOpacity
            onPress={() =>
              animal._id &&
              router.push(`/(technician)/animal-details?id=${animal._id}` as any)
            }
            activeOpacity={0.8}
            className="p-5 rounded-[28px] border shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text
              className="text-[10px] font-black uppercase tracking-widest mb-3"
              style={{ color: primaryColor }}
            >
              Mother Animal (Dam)
            </Text>
            <View className="flex-row items-center">
              {animal.imageUrl ? (
                <Image
                  source={{ uri: animal.imageUrl }}
                  className="w-14 h-14 rounded-2xl"
                  resizeMode="cover"
                />
              ) : (
                <View
                  className="w-14 h-14 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }}
                >
                  <Text className="font-black text-base" style={{ color: colors.textSecondary }}>
                    {(animal.species || "C").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="ml-4 flex-1">
                <Text className="text-base font-black" style={{ color: colors.textPrimary }}>
                  {animalTag}
                </Text>
                <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                  {animalBreed} · {animalSpecies}
                </Text>
                <View className="flex-row items-center gap-2 mt-2">
                  <View
                    className="px-2.5 py-0.5 rounded-md border"
                    style={{
                      backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
                      borderColor: isDark ? "#10b981" : "#059669",
                    }}
                  >
                    <Text className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      {animalStatus}
                    </Text>
                  </View>
                  {pregnancy?.expectedCalvingDate ? (
                    <Text className="text-[10px] font-medium" style={{ color: colors.textMuted }}>
                      Due: {formatDate(pregnancy.expectedCalvingDate)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Farmer Information Card */}
        {farmer ? (
          <View
            className="p-5 rounded-[28px] border shadow-sm"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <Text
              className="text-[10px] font-black uppercase tracking-widest mb-3"
              style={{ color: primaryColor }}
            >
              Reporting Farmer
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
                  {farmerName}
                </Text>
                <Text className="text-xs font-medium mt-0.5" style={{ color: colors.textSecondary }}>
                  {farmerLocationText}
                </Text>
              </View>
              {farmerPhone ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${farmerPhone}`)}
                  className="w-10 h-10 rounded-full items-center justify-center border"
                  style={{
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderColor: colors.border,
                  }}
                >
                  <Phone size={18} color={primaryColor} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Farmer Observation Report Section */}
        <View
          className="p-5 rounded-[28px] border shadow-sm"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: primaryColor }}
            >
              Farmer Observation Details
            </Text>
            <View className="flex-row items-center gap-1">
              <Clock size={12} color={colors.textMuted} />
              <Text className="text-[10px] font-medium" style={{ color: colors.textMuted }}>
                Reported {formatDate(reportedAt)}
              </Text>
            </View>
          </View>

          {/* Observation Date Row */}
          <View
            className="p-3.5 rounded-2xl mb-3 flex-row items-center"
            style={{ backgroundColor: isDark ? colors.background : "#f8fafc" }}
          >
            <Calendar size={16} color={primaryColor} />
            <View className="ml-3 flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colors.textMuted }}>
                Observed Date
              </Text>
              <Text className="text-xs font-bold mt-0.5" style={{ color: colors.textPrimary }}>
                {formatDate(observationDate)}
              </Text>
            </View>
          </View>

          {/* Farmer Notes */}
          <View className="mb-4">
            <Text className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.textMuted }}>
              Farmer Observations / Notes
            </Text>
            <View
              className="p-4 rounded-2xl border"
              style={{
                backgroundColor: isDark ? colors.background : "#f8fafc",
                borderColor: colors.border,
              }}
            >
              <Text className="text-xs font-medium leading-5" style={{ color: colors.textPrimary }}>
                {notesText}
              </Text>
            </View>
          </View>

          {/* Evidence Photos */}
          {evidencePhotos.length > 0 ? (
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
                Evidence Photos ({evidencePhotos.length})
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {evidencePhotos.map((photoUri, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      setViewerIndex(idx);
                      setViewerVisible(true);
                    }}
                    activeOpacity={0.8}
                    className="rounded-2xl overflow-hidden border relative"
                    style={{ width: 90, height: 90, borderColor: colors.border }}
                  >
                    <Image
                      source={{ uri: photoUri }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <View
                      className="absolute bottom-1 right-1 w-6 h-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                    >
                      <Eye size={12} color="white" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <Text className="text-xs font-medium italic" style={{ color: colors.textMuted }}>
              No evidence photos were attached to this report.
            </Text>
          )}
        </View>

        {/* Technician Determination Section */}
        <View
          className="p-5 rounded-[28px] border shadow-sm"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <Text
            className="text-[10px] font-black uppercase tracking-widest mb-2"
            style={{ color: primaryColor }}
          >
            Technician Clinical Determination
          </Text>

          {isReviewed ? (
            <View className="gap-3 mt-2">
              <View
                className="p-4 rounded-2xl border"
                style={{
                  backgroundColor:
                    report.technicianOutcome === "confirm_loss"
                      ? isDark
                        ? "rgba(239, 68, 68, 0.1)"
                        : "#fef2f2"
                      : isDark
                        ? "rgba(59, 130, 246, 0.1)"
                        : "#eff6ff",
                  borderColor:
                    report.technicianOutcome === "confirm_loss"
                      ? isDark
                        ? "rgba(239, 68, 68, 0.3)"
                        : "#fecaca"
                      : isDark
                        ? "rgba(59, 130, 246, 0.3)"
                        : "#bfdbfe",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{
                    color:
                      report.technicianOutcome === "confirm_loss"
                        ? isDark
                          ? "#f87171"
                          : "#b91c1c"
                        : isDark
                          ? "#60a5fa"
                          : "#1d4ed8",
                  }}
                >
                  Clinical Outcome:{" "}
                  {report.technicianOutcome === "confirm_loss"
                    ? "Loss Confirmed"
                    : report.technicianOutcome === "needs_visit"
                      ? "Follow-up Needed"
                      : "Loss Not Confirmed"}
                </Text>
                {report.reviewedAt ? (
                  <Text className="text-[10px] font-medium mt-1" style={{ color: colors.textMuted }}>
                    Reviewed on: {formatDate(report.reviewedAt)}
                  </Text>
                ) : null}
                {report.reviewedBy?.name ? (
                  <Text className="text-[10px] font-medium" style={{ color: colors.textMuted }}>
                    Reviewed by: {report.reviewedBy.name}
                  </Text>
                ) : null}
                {report.reviewNotes ? (
                  <Text className="text-xs font-medium mt-2" style={{ color: colors.textPrimary }}>
                    Notes: {report.reviewNotes}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View className="gap-4 mt-2">
              {needsFollowUp ? (
                <View
                  style={{
                    padding: 16,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(245, 158, 11, 0.4)" : "#fde68a",
                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#fffbeb",
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Clock size={16} color={isDark ? "#fbbf24" : "#d97706"} />
                    <Text
                      style={{
                        fontFamily: "Outfit_700Bold",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: isDark ? "#fbbf24" : "#b45309",
                      }}
                    >
                      Follow-up Needed
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.textPrimary,
                    }}
                  >
                    More information is needed before confirming this report. Pregnancy monitoring will continue.
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_400Regular",
                      fontSize: 11,
                      color: colors.textMuted,
                    }}
                  >
                    No visit has been scheduled.
                  </Text>
                </View>
              ) : (
                <Text className="text-xs font-medium leading-5" style={{ color: colors.textSecondary }}>
                  Enter your review notes and select an outcome.
                </Text>
              )}

              {/* Review Notes Input */}
              <View>
                <Text
                  className="text-[10px] font-black uppercase tracking-widest ml-1 mb-2"
                  style={{ color: colors.textMuted }}
                >
                  Review Notes (Optional)
                </Text>
                <TextInput
                  className="border rounded-[20px] p-4 text-xs min-h-[100px]"
                  style={{
                    backgroundColor: isDark ? colors.background : "#f8fafc",
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  }}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholder="Record your findings, observations, or follow-up recommendations..."
                  placeholderTextColor={colors.textMuted}
                  value={reviewNotes}
                  onChangeText={setReviewNotes}
                />
              </View>

              {/* Action Buttons */}
              <View className="gap-3 mt-2">
                {/* 1. Confirm Loss */}
                <TouchableOpacity
                  onPress={() => setShowConfirmModal(true)}
                  disabled={Boolean(submittingOutcome)}
                  className="h-14 rounded-2xl flex-row items-center justify-center gap-2 border"
                  style={{
                    backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                    borderColor: isDark ? "rgba(239, 68, 68, 0.4)" : "#fecaca",
                  }}
                >
                  <XCircle size={18} color={isDark ? "#f87171" : "#dc2626"} />
                  <Text
                    className="font-black text-xs uppercase tracking-wider"
                    style={{ color: isDark ? "#f87171" : "#dc2626" }}
                  >
                    Confirm Pregnancy Loss
                  </Text>
                </TouchableOpacity>

                {/* 2. Not Confirmed */}
                <TouchableOpacity
                  onPress={() => handleReview("not_confirmed")}
                  disabled={Boolean(submittingOutcome)}
                  className="h-14 rounded-2xl flex-row items-center justify-center gap-2 border"
                  style={{
                    backgroundColor: isDark ? "rgba(59, 130, 246, 0.12)" : "#eff6ff",
                    borderColor: isDark ? "rgba(59, 130, 246, 0.35)" : "#bfdbfe",
                  }}
                >
                  {submittingOutcome === "not_confirmed" ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <>
                      <CheckCircle2 size={18} color={isDark ? "#60a5fa" : "#2563eb"} />
                      <Text
                        className="font-black text-xs uppercase tracking-wider"
                        style={{ color: isDark ? "#60a5fa" : "#2563eb" }}
                      >
                        Pregnancy Loss Not Confirmed
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* 3. Needs Follow-up */}
                <TouchableOpacity
                  onPress={() => handleReview("needs_visit")}
                  disabled={Boolean(submittingOutcome)}
                  className="h-14 rounded-2xl flex-row items-center justify-center gap-2 border"
                  style={{
                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.12)" : "#fffbeb",
                    borderColor: isDark ? "rgba(245, 158, 11, 0.35)" : "#fde68a",
                  }}
                >
                  {submittingOutcome === "needs_visit" ? (
                    <ActivityIndicator size="small" color={isDark ? "#fbbf24" : "#d97706"} />
                  ) : (
                    <>
                      <Clock size={18} color={isDark ? "#fbbf24" : "#d97706"} />
                      <Text
                        className="font-black text-xs uppercase tracking-wider"
                        style={{ color: isDark ? "#fbbf24" : "#d97706" }}
                      >
                        Needs Follow-up
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Confirmation Modal for Confirm Loss */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View
          className="flex-1 justify-center items-center px-6"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <View
            className="w-full max-w-sm rounded-[32px] p-6 border shadow-2xl"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2" }}
            >
              <AlertTriangle size={24} color={isDark ? "#f87171" : "#dc2626"} />
            </View>

            <Text className="text-lg font-black" style={{ color: colors.textPrimary }}>
              Confirm pregnancy loss?
            </Text>

            <Text
              className="text-xs font-medium leading-5 mt-2"
              style={{ color: colors.textSecondary }}
            >
              This will confirm the pregnancy loss, close the current pregnancy, and begin post-pregnancy recovery.
            </Text>

            <View className="gap-3 mt-6">
              <TouchableOpacity
                onPress={() => handleReview("confirm_loss")}
                disabled={Boolean(submittingOutcome)}
                className="h-13 py-3.5 rounded-2xl items-center justify-center"
                style={{ backgroundColor: isDark ? "#ef4444" : "#dc2626" }}
              >
                {submittingOutcome === "confirm_loss" ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-xs uppercase tracking-wider">
                    Confirm Pregnancy Loss
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowConfirmModal(false)}
                disabled={Boolean(submittingOutcome)}
                className="h-13 py-3.5 rounded-2xl items-center justify-center border"
                style={{
                  backgroundColor: isDark ? colors.background : "#f8fafc",
                  borderColor: colors.border,
                }}
              >
                <Text className="font-bold text-xs" style={{ color: colors.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      {evidencePhotos.length > 0 && (
        <ImageViewerModal
          visible={viewerVisible}
          images={photoItems}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
          title="Evidence Photos"
        />
      )}
      </ScrollView>
    </View>
  );
}
