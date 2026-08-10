import React from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
  CalendarCheck,
  CalendarDays,
  Stethoscope,
  Syringe,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { RecordPhotoEvidence } from "@/features/farmer-reports/components/RecordPhotoEvidence";
import type {
  OfficialRecordDetail,
  RecordAttachment,
} from "@/features/farmer-reports/types/farmerReports.types";
import {
  formatAnimalReference,
  getFullAnimalReference,
} from "@/features/farmer-dashboard/utils/farmerDashboard.transforms";

const hasValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  return (
    Boolean(text) && !["n/a", "na", "none", "null", "undefined"].includes(text)
  );
};

const humanize = (value: unknown) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

const formatDate = (value: unknown, includeTime = false) => {
  if (!hasValue(value)) return undefined;
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

const calfSex = (value: unknown) => {
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return humanize(value);
};

type DisplayRow = {
  label: string;
  value: string;
  long?: boolean;
};

type BirthMetric = {
  label: string;
  value: string;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
      {children}
    </Text>
  );
}

function SectionSurface({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.sectionSurface,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  long = false,
  muted = false,
  showDivider = true,
}: DisplayRow & { muted?: boolean; showDivider?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        showDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Text
        style={[
          muted ? styles.metadataLabel : styles.infoLabel,
          { color: muted ? colors.textMuted : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      <Text
        selectable={long}
        style={[
          muted ? styles.metadataValue : styles.infoValue,
          { color: muted ? colors.textSecondary : colors.textPrimary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Rows({
  rows,
  muted = false,
}: {
  rows: (DisplayRow | null)[];
  muted?: boolean;
}) {
  const visibleRows = rows.filter((row): row is DisplayRow => Boolean(row));
  return (
    <>
      {visibleRows.map((row, index) => (
        <InfoRow
          key={`${row.label}-${index}`}
          {...row}
          muted={muted}
          showDivider={index < visibleRows.length - 1}
        />
      ))}
    </>
  );
}

function PrimaryResult({
  label,
  value,
  showDivider,
}: {
  label: string;
  value: string;
  showDivider: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.primaryResult,
        {
          backgroundColor: colors.surfaceSubtle,
          borderBottomColor: colors.border,
          borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      <Text style={[styles.resultLabel, { color: colors.primary }]}>
        {label}
      </Text>
      <Text style={[styles.resultValue, { color: colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

function DateItem({
  label,
  value,
  showDivider,
}: {
  label: string;
  value: string;
  showDivider: boolean;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.dateItem,
        showDivider && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.dateIcon,
          {
            backgroundColor: isDark ? colors.tint : colors.successContainer,
          },
        ]}
      >
        <CalendarDays size={18} color={colors.primary} />
      </View>
      <View style={styles.flexContent}>
        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.dateValue, { color: colors.textPrimary }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function BirthMetrics({ metrics }: { metrics: BirthMetric[] }) {
  const { colors } = useTheme();
  if (metrics.length === 0) return null;

  return (
    <View style={styles.metricGrid}>
      {metrics.map((metric) => (
        <View
          key={metric.label}
          style={[styles.metricItem, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
            {metric.label}
          </Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {metric.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EvidenceSection({
  attachments,
  title = "Evidence",
}: {
  attachments: RecordAttachment[];
  title?: string;
}) {
  const { colors } = useTheme();
  if (attachments.length === 0) return null;

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.headingGroup}>
        <SectionHeading>{title}</SectionHeading>
        <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>
          {attachments.length} saved{" "}
          {attachments.length === 1 ? "photo" : "photos"}
        </Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.evidenceScroller}
        contentContainerStyle={styles.evidenceContent}
      >
        {attachments.map((attachment, index) => (
          <View key={`${attachment.url}-${index}`} style={styles.evidenceItem}>
            <RecordPhotoEvidence
              url={attachment.url}
              label={attachment.label}
              width={140}
              height={96}
              compact
              resizeMode="contain"
            />
            <Text
              numberOfLines={2}
              style={[styles.evidenceLabel, { color: colors.textSecondary }]}
            >
              {attachment.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function TechnicianOfficialRecordContent({
  record,
}: {
  record: OfficialRecordDetail;
}) {
  const { colors, isDark } = useTheme();
  const details = record.details || {};
  const eventDate = formatDate(
    details.serviceDate || record.date,
    record.datePrecision === "datetime",
  );
  const entryDate = formatDate(details.entryDate, true);
  const compactAnimalReference = record.animalId
    ? formatAnimalReference(record.animalId)
    : "";
  const fullAnimalReference = record.animalId
    ? getFullAnimalReference(record.animalId)
    : "Animal record";
  const nonOffspringEvidence = (record.attachments || []).filter(
    (attachment) => attachment.category !== "offspring_identity",
  );
  const offspringEvidence = (record.attachments || []).filter(
    (attachment) => attachment.category === "offspring_identity",
  );

  const icon =
    record.type === "ai" ? (
      <Syringe size={22} color={colors.primary} />
    ) : record.type === "pregnancy" ? (
      <CalendarCheck size={22} color={colors.primary} />
    ) : record.type === "health" ? (
      <Stethoscope size={22} color={colors.primary} />
    ) : (
      <MaterialCommunityIcons name="cow" size={24} color={colors.primary} />
    );

  const aiRows: (DisplayRow | null)[] = [
    details.attemptNumber !== undefined
      ? { label: "Attempt", value: `Attempt ${details.attemptNumber}` }
      : null,
    hasValue(details.sireBreed)
      ? { label: "Sire breed", value: details.sireBreed || "" }
      : null,
    hasValue(details.sireCode)
      ? { label: "Sire code", value: details.sireCode || "" }
      : null,
    hasValue(details.estrus)
      ? { label: "Estrus type", value: humanize(details.estrus) }
      : null,
    details.semenDosesUsed !== undefined
      ? { label: "Semen doses", value: String(details.semenDosesUsed) }
      : null,
    hasValue(details.scheduledDate)
      ? {
          label: "Scheduled visit",
          value: formatDate(details.scheduledDate) || "",
        }
      : null,
    hasValue(details.visitPeriod)
      ? { label: "Visit period", value: humanize(details.visitPeriod) }
      : null,
    hasValue(details.status)
      ? { label: "Status", value: humanize(details.status) }
      : null,
    details.previousAttemptNumber !== undefined
      ? {
          label: "Previous attempt",
          value: `Attempt ${details.previousAttemptNumber}`,
        }
      : null,
    hasValue(details.failureReason)
      ? { label: "Failure reason", value: humanize(details.failureReason) }
      : null,
  ];

  const pregnancyRows: (DisplayRow | null)[] = [
    hasValue(details.diagnosticMethod)
      ? {
          label: "Confirmation method",
          value: humanize(details.diagnosticMethod),
        }
      : null,
    hasValue(details.targetCalvingDate)
      ? {
          label: "Expected calving",
          value: formatDate(details.targetCalvingDate) || "",
        }
      : null,
    details.recheckRequired !== undefined
      ? {
          label: "Recheck required",
          value: details.recheckRequired ? "Yes" : "No",
        }
      : null,
    hasValue(details.recheckStatus)
      ? { label: "Recheck status", value: humanize(details.recheckStatus) }
      : null,
    hasValue(details.recheckDueAt)
      ? {
          label: "Recheck due",
          value: formatDate(details.recheckDueAt) || "",
        }
      : null,
    hasValue(details.confirmationStage)
      ? {
          label: "Confirmation stage",
          value: humanize(details.confirmationStage),
        }
      : null,
    hasValue(details.confirmedAt)
      ? {
          label: "Confirmed on",
          value: formatDate(details.confirmedAt) || "",
        }
      : null,
    details.relatedAttempt !== undefined
      ? { label: "Related AI", value: `Attempt ${details.relatedAttempt}` }
      : null,
  ];

  const calvingRows: (DisplayRow | null)[] = [
    hasValue(details.calvingEase)
      ? { label: "Delivery", value: humanize(details.calvingEase) }
      : null,
  ];
  const birthMetrics: BirthMetric[] = [
    details.numberOfCalves !== undefined
      ? { label: "Delivered", value: String(details.numberOfCalves) }
      : null,
    details.livingCalfCount !== undefined
      ? { label: "Living", value: String(details.livingCalfCount) }
      : null,
    details.stillbornCount !== undefined
      ? { label: "Stillborn", value: String(details.stillbornCount) }
      : null,
  ].filter((metric): metric is BirthMetric => Boolean(metric));

  const healthRows: (DisplayRow | null)[] = [
    hasValue(details.requestType)
      ? { label: "Request type", value: humanize(details.requestType) }
      : null,
    hasValue(details.urgency)
      ? { label: "Urgency", value: humanize(details.urgency) }
      : null,
    hasValue(details.symptoms)
      ? { label: "Concern or symptoms", value: details.symptoms || "" }
      : null,
    hasValue(details.farmerNotes)
      ? { label: "Farmer notes", value: details.farmerNotes || "" }
      : null,
    hasValue(details.diagnosis)
      ? { label: "Diagnosis or findings", value: details.diagnosis || "" }
      : null,
    hasValue(details.treatment)
      ? { label: "Treatment", value: details.treatment || "" }
      : null,
    hasValue(details.medicine)
      ? { label: "Medicine", value: details.medicine || "" }
      : null,
    hasValue(details.dosage)
      ? { label: "Dosage", value: details.dosage || "" }
      : null,
    hasValue(details.advice)
      ? { label: "Advice", value: details.advice || "" }
      : null,
    hasValue(details.followUpDate)
      ? {
          label: "Follow-up",
          value: formatDate(details.followUpDate) || "",
        }
      : null,
    hasValue(details.withdrawalPeriod)
      ? { label: "Withdrawal period", value: details.withdrawalPeriod || "" }
      : details.withdrawalPeriodDays !== undefined
        ? {
            label: "Withdrawal period",
            value: `${details.withdrawalPeriodDays} ${details.withdrawalPeriodDays === 1 ? "day" : "days"}`,
          }
        : null,
    hasValue(details.withdrawalEndDate)
      ? {
          label: "Withdrawal ends",
          value: formatDate(details.withdrawalEndDate) || "",
        }
      : null,
    hasValue(details.status)
      ? { label: "Status", value: humanize(details.status) }
      : null,
  ];

  const additionalRows: (DisplayRow | null)[] = [
    hasValue(details.technician || record.technician?.name)
      ? {
          label: "Recorded by",
          value: details.technician || record.technician?.name || "",
        }
      : null,
    details.isHistoricalEntry
      ? { label: "Entry type", value: "Past record" }
      : null,
    hasValue(details.performedByName)
      ? {
          label: "Originally performed by",
          value: details.performedByName || "",
        }
      : null,
    hasValue(details.lateEntryReason)
      ? {
          label: "Reason for late entry",
          value: details.lateEntryReason || "",
        }
      : null,
    hasValue(details.relatedPregnancyId)
      ? {
          label: "Related pregnancy ID",
          value: details.relatedPregnancyId || "",
          long: true,
        }
      : null,
    hasValue(details.relatedInseminationId)
      ? {
          label: "Related AI ID",
          value: details.relatedInseminationId || "",
          long: true,
        }
      : null,
    hasValue(record.sourceId)
      ? { label: "Official record ID", value: record.sourceId, long: true }
      : null,
  ];

  const visibleAiRows = aiRows.filter(Boolean).length;
  const visiblePregnancyRows = pregnancyRows.filter(Boolean).length;
  const visibleCalvingRows = calvingRows.filter(Boolean).length;
  const visibleHealthRows = healthRows.filter(Boolean).length;
  const livingCalves = (details.calves || []).filter(
    (calf) =>
      hasValue(calf.earTag) ||
      hasValue(calf.sex) ||
      calf.weight !== undefined ||
      hasValue(calf.imageUrl),
  );
  const nonLivingCalves = (details.nonLivingCalves || []).filter(
    (calf) => hasValue(calf.earTag) || hasValue(calf.sex),
  );

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityLabel={`Subject animal ${fullAnimalReference}`}
        style={[
          styles.identityCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {record.animalId?.imageUrl ? (
          <Image
            source={{ uri: record.animalId.imageUrl }}
            resizeMode="cover"
            accessibilityLabel={`Subject animal ${fullAnimalReference}`}
            style={[
              styles.animalImage,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          />
        ) : (
          <View
            style={[
              styles.animalImage,
              styles.centerContent,
              {
                backgroundColor: isDark ? colors.tint : colors.successContainer,
              },
            ]}
          >
            {icon}
          </View>
        )}

        <View style={styles.flexContent}>
          <Text
            numberOfLines={2}
            ellipsizeMode="middle"
            accessibilityLabel={`Animal tag ${fullAnimalReference}`}
            style={[styles.animalReference, { color: colors.textPrimary }]}
          >
            {compactAnimalReference
              ? `Tag #${compactAnimalReference}`
              : "Animal record"}
          </Text>
          {record.animalId?.breed || record.animalId?.species ? (
            <Text
              numberOfLines={2}
              style={[styles.animalMeta, { color: colors.textSecondary }]}
            >
              {[record.animalId.breed, record.animalId.species]
                .filter(Boolean)
                .join(" • ")}
            </Text>
          ) : null}
        </View>
      </View>

      {eventDate || entryDate ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>Important dates</SectionHeading>
          <SectionSurface>
            {eventDate ? (
              <DateItem
                label={
                  details.serviceDateLabel ||
                  record.dateLabel ||
                  "Service or event date"
                }
                value={eventDate}
                showDivider={Boolean(entryDate)}
              />
            ) : null}
            {entryDate ? (
              <DateItem
                label={details.entryDateLabel || "Recorded in BreedSmart at"}
                value={entryDate}
                showDivider={false}
              />
            ) : null}
          </SectionSurface>
        </View>
      ) : null}

      {record.type === "ai" &&
      (hasValue(details.outcome) || visibleAiRows > 0) ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>Insemination details</SectionHeading>
          <SectionSurface>
            {hasValue(details.outcome) ? (
              <PrimaryResult
                label="Outcome"
                value={humanize(details.outcome)}
                showDivider={visibleAiRows > 0}
              />
            ) : null}
            <Rows rows={aiRows} />
          </SectionSurface>
        </View>
      ) : null}

      {record.type === "pregnancy" &&
      (hasValue(details.outcome) || visiblePregnancyRows > 0) ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>Pregnancy confirmation</SectionHeading>
          <SectionSurface>
            {hasValue(details.outcome) ? (
              <PrimaryResult
                label="Result"
                value={humanize(details.outcome)}
                showDivider={visiblePregnancyRows > 0}
              />
            ) : null}
            <Rows rows={pregnancyRows} />
          </SectionSurface>
        </View>
      ) : null}

      {record.type === "calving" &&
      (hasValue(details.calvingOutcome) ||
        visibleCalvingRows > 0 ||
        birthMetrics.length > 0) ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>Birth outcome</SectionHeading>
          <SectionSurface>
            {hasValue(details.calvingOutcome) ? (
              <PrimaryResult
                label="Result"
                value={humanize(details.calvingOutcome)}
                showDivider={visibleCalvingRows > 0 || birthMetrics.length > 0}
              />
            ) : null}
            <Rows rows={calvingRows} />
            <BirthMetrics metrics={birthMetrics} />
          </SectionSurface>
        </View>
      ) : null}

      {record.type === "calving" &&
      (livingCalves.length > 0 || nonLivingCalves.length > 0) ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>
            {livingCalves.length === 1
              ? "Registered calf"
              : "Registered calves"}
          </SectionHeading>

          {livingCalves.map((calf, index) => (
            <View
              key={`${calf.animalId || calf.earTag || "calf"}-${index}`}
              style={[
                styles.calfCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.flexContent}>
                {hasValue(calf.earTag) ? (
                  <Text
                    numberOfLines={2}
                    ellipsizeMode="middle"
                    accessibilityLabel={`Calf tag ${calf.earTag}`}
                    style={[styles.calfTag, { color: colors.textPrimary }]}
                  >
                    Tag #{calf.earTag}
                  </Text>
                ) : null}
                {hasValue(calf.sex) ? (
                  <Text
                    style={[styles.calfMeta, { color: colors.textSecondary }]}
                  >
                    {calfSex(calf.sex)}
                  </Text>
                ) : null}
                {calf.weight !== undefined ? (
                  <Text
                    style={[styles.calfMeta, { color: colors.textSecondary }]}
                  >
                    {calf.weight} kg birth weight
                  </Text>
                ) : null}
              </View>
            </View>
          ))}

          {nonLivingCalves.length > 0 ? (
            <View style={styles.subsectionBlock}>
              <Text
                style={[
                  styles.subsectionHeading,
                  { color: colors.textPrimary },
                ]}
              >
                Non-living offspring
              </Text>
              <SectionSurface>
                <Rows
                  rows={nonLivingCalves.map((calf, index) => ({
                    label: `Offspring ${index + 1}`,
                    value: [
                      calfSex(calf.sex),
                      calf.earTag ? `Tag #${calf.earTag}` : "",
                    ]
                      .filter(Boolean)
                      .join(" • "),
                  }))}
                />
              </SectionSurface>
            </View>
          ) : null}
        </View>
      ) : null}

      {record.type === "health" && visibleHealthRows > 0 ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>Health service details</SectionHeading>
          <SectionSurface>
            <Rows rows={healthRows} />
          </SectionSurface>
        </View>
      ) : null}

      {record.type === "calving" ? (
        <EvidenceSection title="Calf photo" attachments={offspringEvidence} />
      ) : null}
      <EvidenceSection attachments={nonOffspringEvidence} />

      {hasValue(details.technicianNote) ? (
        <View style={styles.sectionBlock}>
          <SectionHeading>Technician notes</SectionHeading>
          <View
            style={[
              styles.notesSurface,
              {
                backgroundColor: isDark ? colors.tint : colors.successContainer,
              },
            ]}
          >
            <Text style={[styles.notesText, { color: colors.textPrimary }]}>
              {details.technicianNote}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionHeading>Additional details</SectionHeading>
        <SectionSurface>
          <Rows rows={additionalRows} muted />
        </SectionSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 24,
  },
  identityCard: {
    width: "100%",
    minWidth: 0,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  animalImage: {
    width: 54,
    height: 54,
    borderRadius: 14,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  flexContent: {
    flex: 1,
    minWidth: 0,
  },
  animalReference: {
    maxWidth: "100%",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    lineHeight: 21,
  },
  animalMeta: {
    marginTop: 3,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionBlock: {
    width: "100%",
    minWidth: 0,
    gap: 10,
  },
  headingGroup: {
    gap: 2,
  },
  sectionHeading: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 20,
    lineHeight: 25,
  },
  sectionCaption: {
    fontFamily: "Outfit_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionSurface: {
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 14,
  },
  infoRow: {
    width: "100%",
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  infoLabel: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  infoValue: {
    maxWidth: "100%",
    marginTop: 3,
    fontFamily: "Outfit_500Medium",
    fontSize: 16,
    lineHeight: 23,
    flexShrink: 1,
  },
  metadataLabel: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  metadataValue: {
    maxWidth: "100%",
    marginTop: 3,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  primaryResult: {
    width: "100%",
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resultLabel: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  resultValue: {
    marginTop: 3,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 18,
    lineHeight: 24,
  },
  dateItem: {
    width: "100%",
    minWidth: 0,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  dateIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  dateValue: {
    marginTop: 2,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
  },
  metricGrid: {
    width: "100%",
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricItem: {
    minWidth: 92,
    flexBasis: "30%",
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 12,
  },
  metricLabel: {
    fontFamily: "Outfit_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    marginTop: 2,
    fontFamily: "Outfit_600SemiBold",
    fontSize: 18,
    lineHeight: 23,
  },
  calfCard: {
    width: "100%",
    minWidth: 0,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  calfTag: {
    maxWidth: "100%",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    lineHeight: 21,
  },
  calfMeta: {
    marginTop: 3,
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  subsectionBlock: {
    marginTop: 6,
    gap: 8,
  },
  subsectionHeading: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 16,
    lineHeight: 21,
  },
  evidenceContent: {
    gap: 10,
    paddingRight: 16,
    alignItems: "flex-start",
  },
  evidenceScroller: {
    width: "100%",
    height: 136,
    flexGrow: 0,
  },
  evidenceItem: {
    width: 140,
    gap: 6,
  },
  evidenceLabel: {
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  notesSurface: {
    width: "100%",
    minWidth: 0,
    padding: 16,
    borderRadius: 14,
  },
  notesText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    lineHeight: 24,
  },
});
