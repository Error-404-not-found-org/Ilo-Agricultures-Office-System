import React, { useState, useMemo } from "react";
import { Image, ScrollView, StyleSheet, View, Pressable } from "react-native";
import {
  CalendarCheck,
  CalendarDays,
  Stethoscope,
  Syringe,
  ClipboardList,
  User as UserIcon,
  Activity,
  HeartPulse,
  HandHeartIcon,
  CalendarClock,
  CheckCheckIcon,
  AlarmClockMinus,
 
  Dna,
  Hash,
  Flame,
  Droplets,
  Sun,
  Info,
  History,
  AlertTriangle,
  PawPrint,
  Heart,
  HeartOff,
  Siren,
  MessageSquare,
  Search,
  Bandage,
  Pill,
  MessageCircle,
  ShieldAlert,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { ImageViewerModal, type ImageViewerItem } from "@/components/shared";
import { RecordPhotoEvidence } from "@/features/farmer-reports/components/RecordPhotoEvidence";
import type {
  OfficialRecordDetail,
  RecordAttachment,
} from "@/features/farmer-reports/types/farmerReports.types";
import {
  formatAnimalReference,
  getFullAnimalReference,
} from "@/features/farmer-dashboard/utils/farmerDashboard.transforms";

// --- EXISTING DATA HELPERS ---
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
  icon?: React.ReactNode;
  long?: boolean;
};

// --- NEW PRESENTATION HELPERS ---

function RecordDetailCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: "Outfit_500Medium",
              fontSize: 13,
              lineHeight: 18,
              marginTop: 4,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View style={{ padding: 16 }}>{children}</View>
    </View>
  );
}

function RecordDetailRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? colors.background : "#F0FDF4",
          }}
        >
          {icon}
        </View>
      ) : null}
      <View style={{ marginLeft: icon ? 12 : 0, flex: 1 }}>
        <Text
          style={{
            color: colors.textMuted,
            fontFamily: "Outfit_700Bold",
            fontSize: 12,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 15,
            lineHeight: 22,
            marginTop: 4,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function RecordDetailField({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          color: colors.textMuted,
          fontFamily: "Outfit_700Bold",
          fontSize: 12,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: "Outfit_500Medium",
          fontSize: 15,
          lineHeight: 22,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function HeaderCard({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
        paddingHorizontal: 4,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: isDark ? colors.background : "#F0FDF4",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 16,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Outfit_700Bold",
            fontSize: 20,
            color: colors.textPrimary,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: "Outfit_500Medium",
              fontSize: 14,
              color: colors.textMuted,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function EvidenceSection({
  attachments,
  title = "Evidence",
  inline = false,
}: {
  attachments: RecordAttachment[];
  title?: string;
  inline?: boolean;
}) {
  const { colors } = useTheme();
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);

  const galleryImages = useMemo<ImageViewerItem[]>(() => {
    return attachments.map((attachment, index) => ({
      uri: attachment.url,
      fileName: attachment.label || `evidence-photo-${index + 1}`,
      accessibilityLabel: attachment.label || `Evidence photo ${index + 1}`,
    }));
  }, [attachments]);

  if (attachments.length === 0) return null;

  const content = (
    <View>
      {inline && (
        <Text
          style={{
            fontFamily: "Outfit_700Bold",
            fontSize: 13,
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 12,
          }}
        >
          {title} ({attachments.length})
        </Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {attachments.map((attachment, index) => (
          <View key={`${attachment.url}-${index}`} style={{ width: 120 }}>
            <RecordPhotoEvidence
              url={attachment.url}
              label={attachment.label}
              width={120}
              height={84}
              compact
              resizeMode="cover"
              onPress={() => {
                setGalleryInitialIndex(index);
                setGalleryVisible(true);
              }}
            />
            {attachment.label ? (
              <Text
                numberOfLines={2}
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                {attachment.label}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <ImageViewerModal
        visible={galleryVisible}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        title={title}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  );

  if (inline) {
    return <View style={{ marginTop: 16 }}>{content}</View>;
  }

  return (
    <RecordDetailCard
      title={title}
      description={`${attachments.length} saved photo(s)`}
    >
      {content}
    </RecordDetailCard>
  );
}

export function TechnicianOfficialRecordContent({
  record,
}: {
  record: OfficialRecordDetail;
}) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [calfGalleryVisible, setCalfGalleryVisible] = useState(false);
  const [calfGalleryImages, setCalfGalleryImages] = useState<ImageViewerItem[]>([]);
  const [calfGalleryInitialIndex, setCalfGalleryInitialIndex] = useState(0);
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
      <Syringe size={24} color={colors.primary} />
    ) : record.type === "pregnancy" ? (
      <CalendarCheck size={24} color={colors.primary} />
    ) : record.type === "health" ? (
      <Stethoscope size={24} color={colors.primary} />
    ) : (
      <MaterialCommunityIcons name="cow" size={26} color={colors.primary} />
    );

  const getRecordTitle = () => {
    switch (record.type) {
      case "ai":
        return "ARTIFICIAL INSEMINATION";
      case "pregnancy":
        return "PREGNANCY CHECK";
      case "calving":
        return "CALVING";
      case "health":
        return "HEALTH RECORD";
      default:
        return "OFFICIAL RECORD";
    }
  };

  const getRecordSubtitle = () => {
    const parts = [];
    if (record.type === "ai" && hasValue(details.outcome))
      parts.push(humanize(details.outcome));
    else if (record.type === "pregnancy" && hasValue(details.outcome))
      parts.push(humanize(details.outcome));
    else if (record.type === "calving" && hasValue(details.calvingOutcome))
      parts.push(humanize(details.calvingOutcome));
    else if (record.type === "health" && hasValue(details.status))
      parts.push(humanize(details.status));

    if (eventDate) parts.push(eventDate);
    return parts.join(" • ");
  };

  const aiRows: (DisplayRow | null)[] = [
    details.attemptNumber !== undefined
      ? {
          label: "Attempt",
          value: `Attempt ${details.attemptNumber}`,
          icon: <ClipboardList size={18} color={colors.primary} />,
        }
      : null,
    hasValue(details.sireBreed)
      ? { label: "Sire breed", value: details.sireBreed || "", icon: <Dna size={18} color={colors.primary} /> }
      : null,
    hasValue(details.sireCode)
      ? { label: "Sire code", value: details.sireCode || "", icon: <Hash size={18} color={colors.primary} /> }
      : null,
    hasValue(details.estrus)
      ? { label: "Estrus type", value: humanize(details.estrus), icon: <Flame size={18} color={colors.primary} /> }
      : null,
    details.semenDosesUsed !== undefined
      ? { label: "Semen doses", value: String(details.semenDosesUsed), icon: <Droplets size={18} color={colors.primary} /> }
      : null,
    hasValue(details.scheduledDate)
      ? {
          label: "Scheduled visit",
          value: formatDate(details.scheduledDate) || "",
          icon: <CalendarClock size={18} color={colors.primary} />,
        }
      : null,
    hasValue(details.visitPeriod)
      ? { label: "Visit period", value: humanize(details.visitPeriod), icon: <Sun size={18} color={colors.primary} /> }
      : null,
    hasValue(details.status)
      ? { label: "Status", value: humanize(details.status), icon: <Info size={18} color={colors.primary} /> }
      : null,
    details.previousAttemptNumber !== undefined
      ? {
          label: "Previous attempt",
          value: `Attempt ${details.previousAttemptNumber}`,
          icon: <History size={18} color={colors.primary} />,
        }
      : null,
    hasValue(details.failureReason)
      ? { label: "Failure reason", value: humanize(details.failureReason), icon: <AlertTriangle size={18} color={colors.primary} /> }
      : null,
  ];

  const pregnancyRows: (DisplayRow | null)[] = [
    hasValue(details.diagnosticMethod)
      ? {
          label: "Confirmation method",
          value: humanize(details.diagnosticMethod),
          icon: <HandHeartIcon size={18} color={colors.primary} />,
        }
      : null,
    hasValue(details.targetCalvingDate)
      ? {
          label: "Expected calving",
          value: formatDate(details.targetCalvingDate) || "",
          icon: <CalendarClock size={18} color={colors.primary} />,
        }
      : null,
    details.recheckRequired !== undefined
      ? {
          label: "Recheck required",
          value: details.recheckRequired ? "Yes" : "No",
          icon: <CheckCheckIcon size={18} color={colors.primary} />,
        }
      : null,

    hasValue(details.recheckDueAt)
      ? {
          label: "Recheck due",
          value: formatDate(details.recheckDueAt) || "",
          icon: <AlarmClockMinus size={18} color={colors.primary} />,
        }
      : null,

    hasValue(details.confirmedAt)
      ? {
          label: "Confirmed on",
          value: formatDate(details.confirmedAt) || "",
          icon: <CalendarCheck size={18} color={colors.primary} />,
        }
      : null,
    details.relatedAttempt !== undefined
      ? {
          label: "Related AI",
          value: `Attempt ${details.relatedAttempt}`,
          icon: <Syringe size={18} color={colors.primary} />,
        }
      : null,
  ];

  const calvingRows: (DisplayRow | null)[] = [
    hasValue(details.calvingEase)
      ? {
          label: "Delivery method",
          value: humanize(details.calvingEase),
          icon: <Activity size={18} color={colors.primary} />,
        }
      : null,
    details.numberOfCalves !== undefined
      ? { label: "Delivered", value: String(details.numberOfCalves), icon: <PawPrint size={18} color={colors.primary} /> }
      : null,
    details.livingCalfCount !== undefined
      ? { label: "Living", value: String(details.livingCalfCount), icon: <Heart size={18} color={colors.primary} /> }
      : null,
    details.stillbornCount !== undefined
      ? { label: "Stillborn", value: String(details.stillbornCount), icon: <HeartOff size={18} color={colors.primary} /> }
      : null,
  ];

  const healthRows: (DisplayRow | null)[] = [
    hasValue(details.requestType)
      ? {
          label: "Request type",
          value: humanize(details.requestType),
          icon: <HeartPulse size={18} color={colors.primary} />,
        }
      : null,
    hasValue(details.urgency)
      ? { label: "Urgency", value: humanize(details.urgency), icon: <Siren size={18} color={colors.primary} /> }
      : null,
    hasValue(details.symptoms)
      ? { label: "Concern or symptoms", value: details.symptoms || "", icon: <Stethoscope size={18} color={colors.primary} /> }
      : null,
    hasValue(details.farmerNotes)
      ? { label: "Farmer notes", value: details.farmerNotes || "", icon: <MessageSquare size={18} color={colors.primary} /> }
      : null,
    hasValue(details.diagnosis)
      ? { label: "Diagnosis or findings", value: details.diagnosis || "", icon: <Search size={18} color={colors.primary} /> }
      : null,
    hasValue(details.treatment)
      ? { label: "Treatment", value: details.treatment || "", icon: <Bandage size={18} color={colors.primary} /> }
      : null,
    hasValue(details.medicine)
      ? { label: "Medicine", value: details.medicine || "", icon: <Pill size={18} color={colors.primary} /> }
      : null,
    hasValue(details.dosage)
      ? { label: "Dosage", value: details.dosage || "", icon: <Syringe size={18} color={colors.primary} /> }
      : null,
    hasValue(details.advice)
      ? { label: "Advice", value: details.advice || "", icon: <MessageCircle size={18} color={colors.primary} /> }
      : null,
    hasValue(details.followUpDate)
      ? {
          label: "Follow-up",
          value: formatDate(details.followUpDate) || "",
          icon: <CalendarDays size={18} color={colors.primary} />,
        }
      : null,
    hasValue(details.withdrawalPeriod)
      ? { label: "Withdrawal period", value: details.withdrawalPeriod || "", icon: <ShieldAlert size={18} color={colors.primary} /> }
      : details.withdrawalPeriodDays !== undefined
        ? {
            label: "Withdrawal period",
            value: `${details.withdrawalPeriodDays} ${details.withdrawalPeriodDays === 1 ? "day" : "days"}`,
            icon: <ShieldAlert size={18} color={colors.primary} />,
          }
        : null,
    hasValue(details.withdrawalEndDate)
      ? {
          label: "Withdrawal ends",
          value: formatDate(details.withdrawalEndDate) || "",
          icon: <CalendarCheck size={18} color={colors.primary} />,
        }
      : null,
  ];

  const additionalRows: (DisplayRow | null)[] = [
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
        }
      : null,
    hasValue(details.relatedInseminationId)
      ? {
          label: "Related AI ID",
          value: details.relatedInseminationId || "",
        }
      : null,
    hasValue(record.sourceId)
      ? { label: "Official record ID", value: record.sourceId }
      : null,
  ];

  const renderRows = (rows: (DisplayRow | null)[]) => {
    const visible = rows.filter((r): r is DisplayRow => Boolean(r));
    return visible.map((row, index) => (
      <RecordDetailRow
        key={`${row.label}-${index}`}
        label={row.label}
        value={row.value}
        icon={row.icon}
        isLast={index === visible.length - 1}
      />
    ));
  };

  const visibleAiRows = aiRows.filter(Boolean);
  const visiblePregnancyRows = pregnancyRows.filter(Boolean);
  const visibleCalvingRows = calvingRows.filter(Boolean);
  const visibleHealthRows = healthRows.filter(Boolean);
  const visibleAdditionalRows = additionalRows.filter((r): r is DisplayRow =>
    Boolean(r),
  );

  const livingCalves = (details.calves || []).filter(
    (calf: any) =>
      hasValue(calf.earTag) ||
      hasValue(calf.sex) ||
      calf.weight !== undefined ||
      hasValue(calf.imageUrl),
  );
  const nonLivingCalves = (details.nonLivingCalves || []).filter(
    (calf: any) => hasValue(calf.earTag) || hasValue(calf.sex),
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 0, paddingBottom: 48 }}
    >
      {/* 2. ANIMAL */}
      <RecordDetailCard title="ANIMAL">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          {record.animalId?.imageUrl ? (
            <Image
              source={{ uri: record.animalId.imageUrl }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                marginRight: 12,
              }}
            />
          ) : (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                marginRight: 12,
                backgroundColor: isDark ? colors.tint : colors.successContainer,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons
                name="cow"
                size={24}
                color={colors.primary}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 16,
                color: colors.textPrimary,
              }}
            >
              {compactAnimalReference
                ? `Tag #${compactAnimalReference}`
                : "Animal record"}
            </Text>
            {record.animalId?.breed || record.animalId?.species ? (
              <Text
                style={{
                  fontFamily: "Outfit_500Medium",
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {[record.animalId.breed, record.animalId.species]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            ) : null}
          </View>
        </View>
        {(record.animalId as any)?.farmerId?.firstName ||
        (record.animalId as any)?.farmerId?.lastName ? (
          <RecordDetailRow
            label="Owner / Farmer"
            value={[
              (record.animalId as any).farmerId.firstName,
              (record.animalId as any).farmerId.lastName,
            ]
              .filter(Boolean)
              .join(" ")}
            icon={<UserIcon size={18} color={colors.primary} />}
            isLast={true}
          />
        ) : null}
      </RecordDetailCard>

      {/* 3. RECORD-SPECIFIC DETAILS */}

      {/* If it's a CALVING record, show unified card */}
      {record.type === "calving" ? (
        <RecordDetailCard title="CALVING DETAILS">
          {eventDate ? (
            <RecordDetailRow
              label={
                details.serviceDateLabel || record.dateLabel || "Calving Date"
              }
              value={eventDate}
              icon={<CalendarDays size={18} color={colors.primary} />}
            />
          ) : null}
          {hasValue(details.technician || record.technician?.name) ? (
            <RecordDetailRow
              label="Technician"
              value={details.technician || record.technician?.name || ""}
              icon={<Stethoscope size={18} color={colors.primary} />}
            />
          ) : null}
          {visibleCalvingRows.length > 0 ? (
            <View style={{ marginTop: 8 }}>{renderRows(calvingRows)}</View>
          ) : null}

          {hasValue(details.technicianNote) ? (
            <View
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 13,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                Technician Notes
              </Text>
              <Text
                style={{
                  fontFamily: "Outfit_400Regular",
                  fontSize: 15,
                  color: colors.textPrimary,
                  lineHeight: 22,
                }}
              >
                {details.technicianNote}
              </Text>
            </View>
          ) : null}


        </RecordDetailCard>
      ) : (
        /* COMMON DETAILS for non-calving records */
        <RecordDetailCard title="SERVICE DETAILS">
          {eventDate ? (
            <RecordDetailRow
              label={
                details.serviceDateLabel || record.dateLabel || "Service Date"
              }
              value={eventDate}
              icon={<CalendarDays size={18} color={colors.primary} />}
              isLast={
                !hasValue(details.technician || record.technician?.name) &&
                visibleAiRows.length === 0 &&
                visiblePregnancyRows.length === 0 &&
                visibleHealthRows.length === 0
              }
            />
          ) : null}
          {hasValue(details.technician || record.technician?.name) ? (
            <RecordDetailRow
              label="Technician"
              value={details.technician || record.technician?.name || ""}
              icon={<Stethoscope size={18} color={colors.primary} />}
              isLast={
                record.type !== "ai" &&
                record.type !== "pregnancy" &&
                record.type !== "health"
              }
            />
          ) : null}

          {record.type === "ai" && visibleAiRows.length > 0 ? (
            <View style={{ marginTop: 8 }}>{renderRows(aiRows)}</View>
          ) : null}

          {record.type === "pregnancy" && visiblePregnancyRows.length > 0 ? (
            <View style={{ marginTop: 8 }}>{renderRows(pregnancyRows)}</View>
          ) : null}

          {record.type === "health" && visibleHealthRows.length > 0 ? (
            <View style={{ marginTop: 8 }}>{renderRows(healthRows)}</View>
          ) : null}
        </RecordDetailCard>
      )}

      {/* OFFSPRING DETAILS */}
      {record.type === "calving" &&
      (livingCalves.length > 0 || nonLivingCalves.length > 0) ? (
        <View style={{ marginTop: 8 }}>
          {livingCalves.map((calf: any, index: number) => {
            let photos: any[] = [];
            if (calf.imageUrl) {
              photos = [{ url: calf.imageUrl, label: calf.earTag ? `Calf ${calf.earTag}` : `Calf ${index + 1}` }];
            } else if (livingCalves.length === 1) {
              photos = offspringEvidence;
            } else if (calf.earTag) {
              photos = offspringEvidence.filter(e => e.label && e.label.includes(calf.earTag));
            }
            if (photos.length === 0 && offspringEvidence[index]) {
              photos = [offspringEvidence[index]];
            }

            return (
            <RecordDetailCard
              key={`${calf.animalId || calf.earTag || "calf"}-${index}`}
              title={`CALF ${index + 1}`}
              description="Living offspring"
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {photos.length > 0 && photos[0]?.url ? (
                  <View style={{ marginRight: 12, width: 80, height: 80, borderRadius: 12, overflow: 'hidden' }}>
                    <RecordPhotoEvidence
                      url={photos[0].url}
                      label={photos[0].label || `Calf photo`}
                      width={80}
                      height={80}
                      compact
                      resizeMode="cover"
                      onPress={() => {
                        setCalfGalleryImages(
                          photos.map((p, i) => ({
                            uri: p.url,
                            fileName: p.label || `calf-photo-${i + 1}`,
                            accessibilityLabel: p.label || `Calf photo ${i + 1}`,
                          }))
                        );
                        setCalfGalleryInitialIndex(0);
                        setCalfGalleryVisible(true);
                      }}
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      backgroundColor: isDark ? colors.background : colors.successContainer,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <MaterialCommunityIcons name="cow" size={28} color={colors.primary} />
                  </View>
                )}

                <View style={{ flex: 1, justifyContent: "center" }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    {hasValue(calf.earTag) ? (
                      <RecordDetailField label="Ear Tag" value={`#${calf.earTag}`} />
                    ) : null}
                    {hasValue(calf.sex) ? (
                      <RecordDetailField label="Sex" value={calfSex(calf.sex)} />
                    ) : null}
                    {calf.weight !== undefined ? (
                      <RecordDetailField label="Weight" value={`${calf.weight} kg`} />
                    ) : null}
                  </View>

                  {calf.animalId ? (
                    <Pressable
                      onPress={() => {
                        router.push(`/(technician)/animal-details?id=${calf.animalId}`);
                      }}
                      style={({ pressed }) => ({
                        marginTop: 8,
                        alignSelf: 'flex-start',
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 6,
                        paddingHorizontal: 0,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ color: colors.primary, fontFamily: "Outfit_600SemiBold", fontSize: 13, marginRight: 4 }}>
                        View offspring
                      </Text>
                      <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </RecordDetailCard>
          )})}
          {nonLivingCalves.map((calf: any, index: number) => (
            <RecordDetailCard
              key={`non-living-${index}`}
              title={`NON-LIVING OFFSPRING ${index + 1}`}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {hasValue(calf.earTag) ? (
                  <RecordDetailField
                    label="Ear Tag"
                    value={`#${calf.earTag}`}
                  />
                ) : null}
                {hasValue(calf.sex) ? (
                  <RecordDetailField label="Sex" value={calfSex(calf.sex)} />
                ) : null}
              </View>
            </RecordDetailCard>
          ))}
        </View>
      ) : null}

      {/* 5. NOTES & ATTACHMENTS FOR NON-CALVING */}
      <EvidenceSection title="ATTACHMENTS" attachments={nonOffspringEvidence} />

      {hasValue(details.technicianNote) && record.type !== "calving" ? (
        <RecordDetailCard title="TECHNICIAN NOTES">
          <Text
            style={{
              fontFamily: "Outfit_400Regular",
              fontSize: 15,
              color: colors.textPrimary,
              lineHeight: 22,
            }}
          >
            {details.technicianNote}
          </Text>
        </RecordDetailCard>
      ) : null}

      {/* 6. RECORD INFORMATION (Metadata) */}
      {entryDate || visibleAdditionalRows.length > 0 ? (
        <View style={{ marginTop: 12, marginHorizontal: 16 }}>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 13,
              color: colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Record Information
          </Text>
          <View
            style={{
              padding: 16,
              backgroundColor: colors.surfaceSubtle,
              borderRadius: 12,
            }}
          >
            {entryDate ? (
              <View
                style={{
                  marginBottom: visibleAdditionalRows.length > 0 ? 8 : 0,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  {details.entryDateLabel || "Recorded in BreedSmart at"}
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_400Regular",
                    fontSize: 15,
                    color: colors.textSecondary,
                  }}
                >
                  {entryDate}
                </Text>
              </View>
            ) : null}
            {visibleAdditionalRows.map((row, index) => (
              <View
                key={index}
                style={{ marginTop: index > 0 || entryDate ? 8 : 0 }}
              >
                <Text
                  style={{
                    fontFamily: "Outfit_500Medium",
                    fontSize: 13,
                    color: colors.textMuted,
                  }}
                >
                  {row.label}
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_400Regular",
                    fontSize: 15,
                    color: colors.textSecondary,
                  }}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <ImageViewerModal
        visible={calfGalleryVisible}
        images={calfGalleryImages}
        initialIndex={calfGalleryInitialIndex}
        title="Calf Photo(s)"
        onClose={() => setCalfGalleryVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
