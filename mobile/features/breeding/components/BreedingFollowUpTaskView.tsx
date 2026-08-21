import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import { AppPageHeader } from "@/components/AppPageHeader";
import { FarmerBreedingObservationCard } from "@/features/breeding/components/FarmerBreedingObservationCard";

const formatDisplayDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const humanize = (value: unknown) =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function BreedingFollowUpTaskView({ task }: { task: any }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const insemination = task.insemination;
  const farmerObservation =
    task.insemination?.farmerObservation || insemination?.farmerObservation;
  const farmerReportType = insemination?.farmerOutcomeReport;
  const observationSource = insemination?.observationSource;

  const normalizedStatus = String(task.status || "").toLowerCase();
  const isCompleted = normalizedStatus === "completed" || normalizedStatus === "resolved";
  const isCancelled = normalizedStatus === "cancelled" || normalizedStatus === "rejected";

  const animal = task.animalIds?.[0];
  const farmer = task.farmerId;

  // Derive days since AI
  const aiDate =
    insemination?.inseminationDate || insemination?.scheduledDate
      ? new Date(insemination.inseminationDate || insemination.scheduledDate)
      : null;
  const daysSinceAI = aiDate
    ? Math.floor((Date.now() - aiDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let statusTitle = "Follow-up needed";
  let bannerTitle = "Follow-up needed";
  let bannerMessage =
    daysSinceAI !== null
      ? `${daysSinceAI} days since AI · No farmer update received`
      : "No farmer update received yet";
  let bannerIcon = "info";
  let bannerColorType = "info";

  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isFuture = dueDate && dueDate.getTime() > Date.now();

  if (isCompleted) {
    statusTitle = "Follow-up completed";
  } else if (isCancelled) {
    statusTitle = "Follow-up no longer required";
  } else if (farmerReportType === "return_to_heat") {
    statusTitle = "Needs attention";
    bannerTitle = "Needs attention";
    bannerMessage = "Farmer reported return-to-heat signs";
    bannerIcon = "alert-circle";
    bannerColorType = "warning";
  } else if (farmerReportType === "possible_pregnancy") {
    if (observationSource === "technician") {
      statusTitle = "Observation recorded";
      bannerTitle = "Observation recorded";
      bannerMessage = "No heat noticed";
      bannerColorType = "info";
    } else {
      statusTitle = "Farmer update received";
      bannerTitle = "Farmer update received";
      bannerMessage = "No heat noticed";
      bannerColorType = "info";
    }
  } else if (farmerReportType === "unsure") {
    if (observationSource === "technician") {
      statusTitle = "Observation recorded";
      bannerTitle = "Observation recorded";
      bannerMessage = "Unsure of signs";
      bannerColorType = "info";
    } else {
      statusTitle = "Farmer update received";
      bannerTitle = "Farmer update received";
      bannerMessage = "Farmer is unsure";
      bannerColorType = "info";
    }
  } else if (farmerReportType) {
    if (observationSource === "technician") {
      statusTitle = "Observation recorded";
      bannerTitle = "Observation recorded";
      bannerMessage = humanize(farmerReportType);
      bannerColorType = "info";
    } else {
      statusTitle = "Farmer update received";
      bannerTitle = "Farmer update received";
      bannerMessage = humanize(farmerReportType);
      bannerColorType = "info";
    }
  } else if (isFuture && !farmerReportType) {
    statusTitle = "Heat-return monitoring";
    bannerTitle = `Scheduled for ${formatDisplayDate(dueDate) || "Future"}`;
    bannerMessage = "Follow-up is not due yet.";
    bannerIcon = "calendar";
    bannerColorType = "info";
  }

  const animalTag =
    animal?.earTag || animal?.animalId || insemination?.animalId?.earTag;
  const animalDescription = [animal?.species, animal?.breed]
    .filter(Boolean)
    .map(humanize)
    .join(" · ");

  const sire = [insemination?.sireBreed, insemination?.sireCode]
    .filter(Boolean)
    .map((value, index) => (index === 0 ? humanize(value) : String(value)))
    .join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Breeding Follow-up" />
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.content}>
          {/* Status Banner */}
          {!isCancelled && !isCompleted && (
            <View
              style={[
                styles.banner,
                {
                  backgroundColor:
                    bannerColorType === "warning"
                      ? isDark
                        ? "#7f1d1d"
                        : "#fee2e2"
                      : isDark
                        ? "#1e3a8a"
                        : "#dbeafe",
                },
              ]}
            >
              <Feather
                name={bannerIcon as any}
                size={20}
                color={
                  bannerColorType === "warning"
                    ? isDark
                      ? "#fca5a5"
                      : "#ef4444"
                    : isDark
                      ? "#93c5fd"
                      : "#3b82f6"
                }
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text
                  style={[
                    styles.bannerTitle,
                    {
                      color:
                        bannerColorType === "warning"
                          ? isDark
                            ? "#fca5a5"
                            : "#991b1b"
                          : isDark
                            ? "#bfdbfe"
                            : "#1e40af",
                    },
                  ]}
                >
                  {bannerTitle}
                </Text>
                <Text
                  style={[
                    styles.bannerText,
                    {
                      color:
                        bannerColorType === "warning"
                          ? isDark
                            ? "#fca5a5"
                            : "#991b1b"
                          : isDark
                            ? "#bfdbfe"
                            : "#1e40af",
                    },
                  ]}
                >
                  {bannerMessage}
                </Text>
              </View>
            </View>
          )}

          {(isCompleted || isCancelled) && (
            <Text
              style={[
                styles.subtitle,
                { color: colors.textSecondary, marginBottom: 16 },
              ]}
            >
              {statusTitle}
            </Text>
          )}

          {/* Breeding Reference */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.primary }]}>
              Breeding Reference
            </Text>

            {animalTag ? (
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Outfit_600SemiBold",
                    color: colors.textPrimary,
                  }}
                >
                  {animalTag}
                </Text>
                {animalDescription ? (
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Outfit_400Regular",
                      color: colors.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {animalDescription}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {daysSinceAI !== null ? (
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Outfit_500Medium",
                  color: colors.textPrimary,
                  marginBottom: 16,
                }}
              >
                {daysSinceAI} days since Inseminated
              </Text>
            ) : null}

            <View style={{ gap: 8 }}>
              {aiDate && (
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Date Inseminated
                  </Text>
                  <Text style={[styles.value, { color: colors.textPrimary }]}>
                    {formatDisplayDate(aiDate)}
                  </Text>
                </View>
              )}
              {insemination?.attemptNumber ? (
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Attempt
                  </Text>
                  <Text style={[styles.value, { color: colors.textPrimary }]}>
                    #{insemination.attemptNumber}
                  </Text>
                </View>
              ) : null}
              {sire ? (
                <View style={styles.row}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Sire
                  </Text>
                  <Text style={[styles.value, { color: colors.textPrimary }]}>
                    {sire}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Farmer Update */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Farmer Update
          </Text>
          {farmerReportType || hasObservationDetails(insemination) ? (
            <FarmerBreedingObservationCard
              observation={farmerObservation || insemination}
            />
          ) : (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather
                name="message-circle"
                size={24}
                color={colors.textMuted}
                style={{ marginBottom: 8 }}
              />
              <Text
                style={[styles.emptyStateTitle, { color: colors.textPrimary }]}
              >
                No farmer update received
              </Text>
              <Text
                style={[styles.emptyStateText, { color: colors.textSecondary }]}
              >
                Contact the farmer to ask whether the animal showed signs of
                returning to heat.
              </Text>
            </View>
          )}

          {/* Farmer Contact */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                marginTop: 16,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.primary, marginBottom: 16 }]}>
              Farmer Contact
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              {farmer?.imageUrl ? (
                <Image
                  source={{ uri: farmer.imageUrl }}
                  style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                />
              ) : (
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Feather name="user" size={24} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.value,
                    { color: colors.textPrimary, marginBottom: 2 },
                  ]}
                >
                  {farmer?.name || "Unknown Farmer"}
                </Text>
                {farmer?.phoneNumber ? (
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {farmer.phoneNumber}
                  </Text>
                ) : (
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    No phone number available
                  </Text>
                )}
              </View>
            </View>

            {farmer?.phoneNumber && (
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.primary },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  import("react-native").then(({ Linking }) => {
                    Linking.openURL(`tel:${farmer.phoneNumber}`);
                  });
                }}
              >
                <Feather name="phone-call" size={18} color={colors.primary} />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: colors.primary },
                  ]}
                >
                  Call Farmer
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function hasObservationDetails(insemination: any) {
  return Boolean(
    insemination?.farmerObservationSigns?.length ||
    insemination?.farmerObservationNotes ||
    insemination?.evidencePhotos?.length,
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: "Outfit_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Outfit_500Medium" },
  content: { padding: 16, paddingBottom: 100 },
  banner: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  bannerText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
  },
  bannerTitle: {
    fontSize: 15,
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 2,
  },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Outfit_600SemiBold",
    marginTop: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { fontSize: 14, fontFamily: "Outfit_400Regular" },
  value: { fontSize: 14, fontFamily: "Outfit_500Medium" },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateTitle: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    fontFamily: "Outfit_400Regular",
    textAlign: "center",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: "Outfit_600SemiBold",
    marginLeft: 8,
  },
});
