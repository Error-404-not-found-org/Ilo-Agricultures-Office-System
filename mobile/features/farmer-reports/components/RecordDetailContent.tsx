import React from "react";
import { View, Image } from "react-native";
import { CalendarCheck, Syringe, Stethoscope } from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import type { ActivityFeedItem } from "../types/farmerReports.types";
import DetailRow from "./DetailRow";
import { RecordEvidenceGallery } from "./RecordEvidenceGallery";
import {
  formatAnimalReference,
  getFullAnimalReference,
} from "@/features/farmer-dashboard/utils/farmerDashboard.transforms";

interface RecordDetailContentProps {
  selectedActivity: ActivityFeedItem;
}

const hasDisplayValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  return Boolean(text) && !["n/a", "na", "none", "null", "undefined"].includes(text);
};

const humanize = (value: unknown) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

const formatRecordDate = (value: unknown, includeTime = false) => {
  if (!hasDisplayValue(value)) return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? { hour: "numeric", minute: "2-digit", hour12: true }
      : {}),
  }).format(date);
};

const calfSexLabel = (value: unknown) => {
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return humanize(value) || "Not recorded";
};

export function RecordDetailContent({ selectedActivity }: RecordDetailContentProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ gap: 20 }}>
      {/* Category Header Card */}
      <View
        style={{
          alignItems: "center",
          gap: 8,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor:
              selectedActivity.type === "health"
                ? isDark
                  ? "rgba(239, 68, 68, 0.15)"
                  : "#fef2f2"
                : selectedActivity.type === "ai"
                  ? isDark
                    ? "rgba(59, 130, 246, 0.15)"
                    : "#eff6ff"
                  : selectedActivity.type === "pregnancy"
                    ? isDark
                      ? "rgba(236, 72, 153, 0.15)"
                      : "#fdf2f8"
                  : isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#f0fdf4",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selectedActivity.type === "ai" ? (
            <Syringe size={26} color="#2563eb" />
          ) : selectedActivity.type === "pregnancy" ? (
            <CalendarCheck size={26} color="#db2777" />
          ) : selectedActivity.type === "health" ? (
            <Stethoscope size={26} color="#dc2626" />
          ) : (
            <MaterialCommunityIcons
              name="cow"
              size={30}
              color="#b45309"
            />
          )}
        </View>
        <Text
          style={{
            fontSize: 18,
            fontFamily: "Outfit_800ExtraBold",
            color: colors.textPrimary,
            textAlign: "center",
          }}
        >
          {selectedActivity.title}
        </Text>
        <Text textRole="label" style={{ color: colors.textMuted }}>
          {selectedActivity.dateLabel || "Official record date"}
        </Text>
        <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
          {selectedActivity.date
            ? formatRecordDate(
                selectedActivity.date,
                selectedActivity.datePrecision !== "date",
              )
            : "No Date"}
        </Text>
      </View>

      {/* Animal Info */}
      {selectedActivity.animalId && (
        <View
          accessible
          accessibilityLabel={`Subject animal ${getFullAnimalReference(selectedActivity.animalId)}. ${selectedActivity.animalId.breed || "Breed unavailable"}. ${selectedActivity.animalId.species || "Species unavailable"}.`}
          style={{
            backgroundColor: isDark
              ? "rgba(255,255,255,0.03)"
              : "#f8fafc",
            borderRadius: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {selectedActivity.animalId.imageUrl ? (
              <Image
                source={{ uri: selectedActivity.animalId.imageUrl }}
                resizeMode="cover"
                accessibilityLabel={`Animal ${formatAnimalReference(selectedActivity.animalId)}`}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceSubtle,
                }}
              />
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text textRole="label" style={{ color: colors.textMuted }}>
                Subject animal
              </Text>
              <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                Tag: #{formatAnimalReference(selectedActivity.animalId)}
              </Text>
              <Text textRole="caption" style={{ color: colors.textSecondary }}>
                {selectedActivity.animalId.breed || "Breed unavailable"} •{" "}
                {selectedActivity.animalId.species || "Species unavailable"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Detailed Information */}
      <View style={{ gap: 14 }}>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Outfit_800ExtraBold",
            color: colors.textMuted,
            textTransform: "uppercase",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: 4,
          }}
        >
          Details
        </Text>

        <View style={{ gap: 10 }}>
          {hasDisplayValue(selectedActivity.details?.serviceDate) ? (
            <DetailRow
              label={
                selectedActivity.details?.serviceDateLabel ||
                selectedActivity.dateLabel ||
                "Official record date"
              }
              value={formatRecordDate(
                selectedActivity.details?.serviceDate,
                selectedActivity.datePrecision === "datetime",
              )}
            />
          ) : null}
          {hasDisplayValue(selectedActivity.details?.entryDate) ? (
            <DetailRow
              label={
                selectedActivity.details?.entryDateLabel ||
                "Recorded in BreedSmart at"
              }
              value={formatRecordDate(selectedActivity.details?.entryDate, true)}
            />
          ) : null}
          {selectedActivity.details?.isHistoricalEntry && (
            <DetailRow label="Entry Type" value="Past Record" highlightColor="#d97706" />
          )}
          {hasDisplayValue(selectedActivity.details?.performedByName) ? (
            <DetailRow
              label="Originally Performed By"
              value={selectedActivity.details?.performedByName}
            />
          ) : null}
          {hasDisplayValue(selectedActivity.details?.lateEntryReason) ? (
            <DetailRow
              label="Reason for Late Entry"
              value={selectedActivity.details?.lateEntryReason}
            />
          ) : null}
        </View>

        {!selectedActivity.details ? (
          <View
            style={{
              padding: 12,
              backgroundColor: isDark
                ? "rgba(239, 68, 68, 0.1)"
                : "#fef2f2",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(239, 68, 68, 0.2)"
                : "#fee2e2",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Outfit_500Medium",
                color: isDark ? "#f87171" : "#dc2626",
                lineHeight: 18,
              }}
            >
              ⚠️ Detailed data is missing from the server response.
              If running locally, please restart your backend server
              (`npm run dev`) and reload the mobile app to apply the
              updates.
            </Text>
          </View>
        ) : (
          <>
            {selectedActivity.type === "ai" && (
              <View style={{ gap: 10 }}>
                <DetailRow
                  label="Status"
                  value={
                    selectedActivity.details.status === "rejected"
                      ? "Declined"
                      : selectedActivity.details.status ===
                          "cancelled"
                        ? "Cancelled"
                        : selectedActivity.details.status ===
                            "approved"
                          ? "Accepted"
                          : selectedActivity.details.status ===
                              "done"
                            ? "Completed"
                            : selectedActivity.details.status
                  }
                  highlightColor={
                    selectedActivity.details.status ===
                      "rejected" ||
                    selectedActivity.details.status === "cancelled"
                      ? "#dc2626"
                      : selectedActivity.details.status ===
                            "approved" ||
                          selectedActivity.details.status === "done"
                        ? "#00643B"
                        : "#d97706"
                  }
                />
                <DetailRow
                  label="Sire Breed"
                  value={selectedActivity.details.sireBreed}
                />
                <DetailRow
                  label="Sire Code"
                  value={selectedActivity.details.sireCode}
                />
                <DetailRow
                  label="Semen Doses"
                  value={selectedActivity.details.semenDosesUsed?.toString()}
                />
                <DetailRow
                  label="Attempt Number"
                  value={selectedActivity.details.attemptNumber?.toString()}
                />
                <DetailRow
                  label="Previous Attempt"
                  value={
                    selectedActivity.details.previousAttemptNumber
                      ? `Attempt ${selectedActivity.details.previousAttemptNumber}`
                      : undefined
                  }
                />
                <DetailRow
                  label="Estrus Type"
                  value={selectedActivity.details.estrus}
                />
                <DetailRow
                  label="Outcome"
                  value={selectedActivity.details.outcome}
                  highlightColor={
                    selectedActivity.details.outcome?.toLowerCase() ===
                    "success"
                      ? "#059669"
                      : selectedActivity.details.outcome?.toLowerCase() ===
                          "failed"
                        ? "#dc2626"
                        : undefined
                  }
                />
                <DetailRow
                  label="Technician"
                  value={selectedActivity.details.technician}
                />
                {hasDisplayValue(selectedActivity.details.failureReason) ? (
                  <DetailRow
                    label="Failure Reason"
                    value={humanize(selectedActivity.details.failureReason)}
                  />
                ) : null}
              </View>
            )}

            {selectedActivity.type === "pregnancy" && (
              <View style={{ gap: 10 }}>
                <DetailRow
                  label="Diagnosis Result"
                  value={selectedActivity.details.outcome}
                  highlightColor={
                    selectedActivity.details.outcome === "Pregnant"
                      ? "#00643B"
                      : selectedActivity.details.outcome === "Empty"
                        ? "#dc2626"
                        : "#d97706"
                  }
                />
                {hasDisplayValue(selectedActivity.details.diagnosticMethod) ? (
                  <DetailRow
                    label="Confirmation Method"
                    value={humanize(selectedActivity.details.diagnosticMethod)}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.confirmationStage) ? (
                  <DetailRow
                    label="Confirmation Stage"
                    value={humanize(selectedActivity.details.confirmationStage)}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.confirmedAt) ? (
                  <DetailRow
                    label="Confirmed On"
                    value={formatRecordDate(
                      selectedActivity.details.confirmedAt,
                    )}
                  />
                ) : null}
                {selectedActivity.details.relatedAttempt ? (
                  <DetailRow
                    label="Related AI Attempt"
                    value={`Attempt ${selectedActivity.details.relatedAttempt}`}
                  />
                ) : null}
                <DetailRow
                  label="Target Calving Date"
                  value={formatRecordDate(
                    selectedActivity.details.targetCalvingDate,
                  )}
                />
                {hasDisplayValue(selectedActivity.details.recheckStatus) ? (
                  <DetailRow
                    label="Recheck Status"
                    value={humanize(selectedActivity.details.recheckStatus)}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.recheckDueAt) ? (
                  <DetailRow
                    label="Recheck Due"
                    value={formatRecordDate(
                      selectedActivity.details.recheckDueAt,
                    )}
                  />
                ) : null}
                <DetailRow
                  label="Technician"
                  value={selectedActivity.details.technician}
                />
                <DetailRow
                  label="Technician Notes"
                  value={selectedActivity.details.technicianNote}
                />
              </View>
            )}

            {selectedActivity.type === "health" && (
              <View style={{ gap: 10 }}>
                {hasDisplayValue(selectedActivity.details.status) ? (
                  <DetailRow
                    label="Status"
                    value={
                      selectedActivity.details.status === "rejected"
                        ? "Declined"
                        : selectedActivity.details.status === "cancelled"
                            ? "Cancelled"
                          : ["resolved", "done", "completed"].includes(
                                selectedActivity.details.status || "",
                              )
                            ? "Completed"
                            : selectedActivity.details.status
                    }
                    highlightColor={
                      selectedActivity.details.status === "rejected" ||
                      selectedActivity.details.status === "cancelled"
                        ? "#dc2626"
                        : "#00643B"
                    }
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.requestType) ? (
                  <DetailRow
                    label="Request Type"
                    value={selectedActivity.details.requestType}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.symptoms) ? (
                  <DetailRow
                    label="Concern / Symptoms"
                    value={selectedActivity.details.symptoms}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.farmerNotes) ? (
                  <DetailRow
                    label="Farmer Notes"
                    value={selectedActivity.details.farmerNotes}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.urgency) ? (
                  <DetailRow
                    label="Urgency"
                    value={selectedActivity.details.urgency}
                    highlightColor={
                      selectedActivity.details.urgency?.toLowerCase() === "high"
                        ? "#dc2626"
                        : selectedActivity.details.urgency?.toLowerCase() ===
                            "medium"
                          ? "#d97706"
                          : "#059669"
                    }
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.diagnosis) ? (
                  <DetailRow
                    label="Diagnosis"
                    value={selectedActivity.details.diagnosis}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.treatment) ? (
                  <DetailRow
                    label="Treatment"
                    value={selectedActivity.details.treatment}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.medicine) ? (
                  <DetailRow
                    label="Medicine"
                    value={selectedActivity.details.medicine}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.dosage) ? (
                  <DetailRow
                    label="Dosage"
                    value={selectedActivity.details.dosage}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.advice) ? (
                  <DetailRow
                    label="Advice"
                    value={selectedActivity.details.advice}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.followUpDate) ? (
                  <DetailRow
                    label="Follow-up"
                    value={formatRecordDate(
                      selectedActivity.details.followUpDate,
                    )}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.withdrawalPeriod) ||
                selectedActivity.details.withdrawalPeriodDays !== undefined ? (
                  <DetailRow
                    label="Withdrawal Period"
                    value={
                      selectedActivity.details.withdrawalPeriod ||
                      `${selectedActivity.details.withdrawalPeriodDays} ${selectedActivity.details.withdrawalPeriodDays === 1 ? "day" : "days"}`
                    }
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.withdrawalEndDate) ? (
                  <DetailRow
                    label="Withdrawal Ends"
                    value={formatRecordDate(
                      selectedActivity.details.withdrawalEndDate,
                    )}
                  />
                ) : null}
                {hasDisplayValue(selectedActivity.details.technician) ? (
                  <DetailRow
                    label="Technician"
                    value={selectedActivity.details.technician}
                  />
                ) : null}
              </View>
            )}

            {selectedActivity.type === "calving" && (
              <View style={{ gap: 10 }}>
                <DetailRow
                  label="Delivery Outcome"
                  value={humanize(selectedActivity.details.calvingOutcome)}
                />
                <DetailRow
                  label="Calving Ease"
                  value={selectedActivity.details.calvingEase}
                />
                <DetailRow
                  label="Number of Calves"
                  value={selectedActivity.details.numberOfCalves?.toString()}
                />
                <DetailRow
                  label="Living Calves"
                  value={selectedActivity.details.livingCalfCount?.toString()}
                />
                <DetailRow
                  label="Stillborn Calves"
                  value={selectedActivity.details.stillbornCount?.toString()}
                />
                <DetailRow
                  label="Technician"
                  value={selectedActivity.details.technician}
                />

                {selectedActivity.details.calves &&
                  selectedActivity.details.calves.length > 0 && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: "Outfit_700Bold",
                          color: colors.textSecondary,
                        }}
                      >
                        Calves Registered:
                      </Text>
                      {selectedActivity.details.calves.map(
                        (calf, index) => (
                          <View
                            key={index}
                            style={{
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.02)"
                                : "#f8fafc",
                              padding: 8,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "Outfit_700Bold",
                                color: colors.textPrimary,
                              }}
                            >
                              Calf #{index + 1}: {calfSexLabel(calf.sex)}
                            </Text>
                            {calf.earTag && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textSecondary,
                                }}
                              >
                                Tag: #{calf.earTag}
                              </Text>
                            )}
                            {calf.weight && (
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontFamily: "Outfit_500Medium",
                                  color: colors.textSecondary,
                                }}
                              >
                                Weight: {calf.weight} kg
                              </Text>
                            )}
                            {calf.imageUrl ? (
                              <View
                                style={{
                                  marginTop: 8,
                                  borderRadius: 8,
                                  overflow: "hidden",
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                }}
                              >
                                <Image
                                  source={{ uri: calf.imageUrl }}
                                  style={{
                                    width: "100%",
                                    height: 150,
                                  }}
                                  resizeMode="cover"
                                />
                              </View>
                            ) : null}
                          </View>
                        ),
                      )}
                    </View>
                  )}
                {selectedActivity.details.nonLivingCalves &&
                selectedActivity.details.nonLivingCalves.length > 0 ? (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: "Outfit_700Bold",
                        color: colors.textSecondary,
                      }}
                    >
                      Non-living offspring:
                    </Text>
                    {selectedActivity.details.nonLivingCalves.map(
                      (calf, index) => (
                        <View
                          key={`${calf.earTag || "non-living"}-${index}`}
                          style={{
                            backgroundColor: colors.surfaceSubtle,
                            padding: 8,
                            borderRadius: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: "Outfit_700Bold",
                              color: colors.textPrimary,
                            }}
                          >
                            Offspring #{index + 1}: {calfSexLabel(calf.sex)}
                          </Text>
                          {calf.earTag ? (
                            <Text
                              style={{
                                fontSize: 11,
                                fontFamily: "Outfit_500Medium",
                                color: colors.textSecondary,
                              }}
                            >
                              Tag: #{calf.earTag}
                            </Text>
                          ) : null}
                        </View>
                      ),
                    )}
                  </View>
                ) : null}
              </View>
            )}
          </>
        )}
      </View>

      <RecordEvidenceGallery
        attachments={selectedActivity.attachments?.filter(
          (attachment) => attachment.category !== "offspring_identity",
        )}
      />

      {/* Technician Notes */}
      {selectedActivity.details?.technicianNote && (
        <View
          style={{
            gap: 6,
            backgroundColor: isDark
              ? "rgba(0, 100, 59, 0.05)"
              : "#f0fdf4",
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: isDark
              ? "rgba(0, 100, 59, 0.2)"
              : "#d1fae5",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Outfit_800ExtraBold",
              color: isDark ? "#34d399" : "#00643B",
              textTransform: "uppercase",
            }}
          >
            Observations / Notes
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Outfit_500Medium",
              color: colors.textPrimary,
              fontStyle: "italic",
              lineHeight: 18,
            }}
          >
            &quot;{selectedActivity.details.technicianNote}&quot;
          </Text>
        </View>
      )}
    </View>
  );
}
