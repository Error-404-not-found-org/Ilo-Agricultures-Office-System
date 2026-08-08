import React, { useMemo, useState } from "react";
import {
  useWindowDimensions,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  Heart,
  Info,
  MapPin,
  MessageSquareText,
  Phone,
  Stethoscope,
  Syringe,
  UserRound,
  VenusAndMars,
} from "lucide-react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AppPageHeader } from "@/components/AppPageHeader";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { formatAddressLabel } from "@/constants/address";
import { useAnimalRecords } from "@/features/animal-records/hooks/useAnimalTimeline";
import { formatAnimalRecord } from "@/features/animal-records/utils/recordPresentation";
import { AnimalProfileSkeleton } from "@/features/animals/components/skeletons/AnimalProfileSkeleton";
import { useAnimalDetailsQuery } from "@/features/animals/hooks/useAnimalDetails";
import { useTheme } from "@/lib/theme";
import {
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  isBreedingObservationAwaitingReview,
} from "@/features/breeding/utils/breedingObservationPresentation";
import type {
  AIRequest,
  Animal,
  Farmer,
  HealthRequest,
  Technician,
} from "@/types";
import { safeBack } from "@/utils/navigation";

export type AnimalDetailsRole = "farmer" | "technician" | "admin";

type Props = {
  id: string;
  role: AnimalDetailsRole;
};

type AnimalOwner = Partial<Farmer> & {
  contact?: string;
  phone?: string;
};

type AnimalDetailsData = Omit<Animal, "farmerId" | "inseminations"> & {
  farmerId?: string | AnimalOwner;
  inseminations?: AIRequest[];
  healthRecords?: HealthRequest[];
  healthRequests?: HealthRequest[];
  bloodline?: string;
  geneticLineage?: string;
  markings?: string;
  isVerified?: boolean;
};

type ServiceSummary = {
  id: string;
  kind: "ai" | "health";
  title: string;
  status: string;
  activityDate?: string;
  scheduledDate?: string;
  technician?: string;
  location?: string;
};

type QuickFact = {
  key: string;
  label: string;
  value: string;
  icon: React.ReactNode;
};

type InformationItem = {
  key: string;
  label: string;
  value: string;
};

const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

const CHEVRON_RAIL_SIZE = 24;

const ACTIVE_REQUEST_STATUSES = new Set([
  "pending",
  "triaged",
  "assigned",
  "approved",
  "scheduled",
  "in-progress",
  "in_progress",
]);

const SCHEDULED_VISIT_STATUSES = new Set(["assigned", "approved", "scheduled"]);

const formatDate = (value?: string, includeTime = false) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
};

const formatAge = (birthDate?: string) => {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime()) || birth.getTime() > Date.now()) return "";

  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years && remainingMonths) return `${years}y ${remainingMonths}m`;
  if (years) return `${years}y`;
  if (remainingMonths) return `${remainingMonths}m`;
  return "Newborn";
};

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getOwner = (animal: AnimalDetailsData): AnimalOwner | undefined =>
  typeof animal.farmerId === "object" && animal.farmerId
    ? animal.farmerId
    : undefined;

const getCompactLocation = (owner?: AnimalOwner) => {
  const address = owner?.address;
  if (address?.barangay || address?.city) {
    return [
      address.barangay ? `Brgy. ${address.barangay}` : "",
      address.city || "",
    ]
      .filter(Boolean)
      .join(", ");
  }
  return formatAddressLabel(owner?.address, owner?.farmLocation, "");
};

const getPersonName = (person?: string | Technician) =>
  typeof person === "object" && person ? person.name : undefined;

const getHealthTitle = (requestType?: string) => {
  switch (requestType?.toLowerCase()) {
    case "vaccination":
      return "Vaccination";
    case "deworming":
      return "Deworming";
    case "medicine":
    case "treatment":
      return "Treatment";
    case "pregnancy_check":
    case "pregnancy-check":
      return "Pregnancy Check";
    default:
      return "Health Assistance";
  }
};

const getServices = (animal?: AnimalDetailsData): ServiceSummary[] => {
  if (!animal) return [];

  const location = getCompactLocation(getOwner(animal));
  const services = new Map<string, ServiceSummary>();

  (animal.inseminations || []).forEach((item) => {
    const id = item._id;
    const status = typeof item.status === "string" ? item.status.trim() : "";
    if (!id || !status) return;

    services.set(`ai:${id}`, {
      id,
      kind: "ai",
      title: "AI Service",
      status,
      scheduledDate: item.scheduledDate,
      activityDate:
        item.scheduledDate ||
        item.inseminationDate ||
        item.preferredDate ||
        item.createdAt,
      technician:
        getPersonName(item.technicianId) || getPersonName(item.approvedBy),
      location,
    });
  });

  [...(animal.healthRecords || []), ...(animal.healthRequests || [])].forEach(
    (item) => {
      const id = item._id;
      const status = typeof item.status === "string" ? item.status.trim() : "";
      if (!id || !status) return;

      services.set(`health:${id}`, {
        id,
        kind: "health",
        title: getHealthTitle(item.requestType),
        status,
        scheduledDate: item.scheduledDate,
        activityDate:
          item.scheduledDate || item.preferredDate || item.createdAt,
        technician:
          getPersonName(item.assignedTechnicianId) ||
          getPersonName(item.handledBy),
        location,
      });
    },
  );

  return [...services.values()].sort(
    (first, second) =>
      new Date(second.activityDate || 0).getTime() -
      new Date(first.activityDate || 0).getTime(),
  );
};

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        minHeight: 32,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.md,
      }}
    >
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
        }}
      >
        <View
          style={{
            width: CHEVRON_RAIL_SIZE,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.textPrimary,
            fontFamily: "Outfit_700Bold",
            fontSize: 16,
            lineHeight: 20,
          }}
        >
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

function QuickFactsCard({ facts }: { facts: QuickFact[] }) {
  const { colors, isDark } = useTheme();
  if (!facts.length) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {facts.map((fact) => (
        <View
          key={fact.key}
          style={{
            flex: 1,
            minWidth: 140,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? "rgba(0,100,59,0.18)" : "#E6F4EA",
            }}
          >
            {fact.icon}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              {fact.label}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_700Bold",
                fontSize: 13,
                lineHeight: 18,
                marginTop: 1,
              }}
            >
              {fact.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function RoleAwareAnimalDetailsScreen({ id, role }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const [showAllRecords, setShowAllRecords] = useState(false);
  const animalQuery = useAnimalDetailsQuery(id);
  const recordsQuery = useAnimalRecords({ animalId: id, limit: 10 });
  const animal = animalQuery.data as AnimalDetailsData | undefined;

  const services = useMemo(() => getServices(animal), [animal]);
  const activeServices = useMemo(
    () =>
      services.filter((service) =>
        ACTIVE_REQUEST_STATUSES.has(service.status.toLowerCase()),
      ),
    [services],
  );
  const nextVisit = useMemo(
    () =>
      activeServices
        .filter((service) => {
          if (
            !service.scheduledDate ||
            !SCHEDULED_VISIT_STATUSES.has(service.status.toLowerCase())
          ) {
            return false;
          }
          const scheduledAt = new Date(service.scheduledDate).getTime();
          return Number.isFinite(scheduledAt) && scheduledAt > Date.now();
        })
        .sort(
          (first, second) =>
            new Date(first.scheduledDate || 0).getTime() -
            new Date(second.scheduledDate || 0).getTime(),
        )[0],
    [activeServices],
  );
  const activeRequest = useMemo(
    () =>
      activeServices.find(
        (service) =>
          service.id !== nextVisit?.id || service.kind !== nextVisit.kind,
      ),
    [activeServices, nextVisit],
  );

  if (animalQuery.isLoading && !animal) return <AnimalProfileSkeleton />;

  const backRoute =
    role === "farmer"
      ? "/(farmer)/(tabs)/farmer.records"
      : role === "technician"
        ? "/(technician)/(tabs)/technician.animals"
        : "/(admin)/(tabs)/admin.animals";

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppPageHeader
          title="Animal Details"
          onBack={() => safeBack(backRoute)}
        />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <MaterialCommunityIcons
            name="cow-off"
            size={44}
            color={colors.textMuted}
          />
          <Text
            textRole="title"
            style={{ marginTop: SPACE.lg, textAlign: "center" }}
          >
            Animal profile unavailable
          </Text>
          <Text
            textRole="body"
            color="secondary"
            style={{ marginTop: SPACE.xs, textAlign: "center" }}
          >
            Check your connection, then try again.
          </Text>
        </View>
      </View>
    );
  }

  const owner = getOwner(animal);
  const age = formatAge(animal.birthDate);
  const location = getCompactLocation(owner);
  const gender = animal.gender || animal.sex || "";
  const primaryIdentity =
    animal.name || animal.breed || animal.earTag || animal.animalId;
  const speciesBreed = [animal.species, animal.breed]
    .filter(
      (value, index, values): value is string =>
        Boolean(value?.trim()) &&
        values.findIndex(
          (candidate) =>
            candidate?.trim().toLowerCase() === value?.trim().toLowerCase(),
        ) === index,
    )
    .join(" · ");
  const identityLabel = animal.earTag
    ? { label: "Ear Tag", value: animal.earTag }
    : animal.animalId
      ? { label: "Registration", value: animal.animalId }
      : undefined;
  const heroStatus =
    typeof animal.status === "string" && animal.status.trim()
      ? titleCase(animal.status)
      : animal.isVerified === true
        ? "Verified"
        : "";

  const validInseminations = (animal.inseminations || [])
    .map((item) => ({
      item,
      value: item.inseminationDate,
      timestamp: new Date(item.inseminationDate || "").getTime(),
    }))
    .filter((entry) => entry.value && Number.isFinite(entry.timestamp))
    .sort((first, second) => second.timestamp - first.timestamp);
  const latestAi = validInseminations[0];
  const latestObservation = validInseminations.find(
    (entry) => entry.item.farmerOutcomeReport,
  )?.item;
  const canReportBreedingObservation =
    role === "farmer" &&
    Boolean(latestAi?.item?._id) &&
    ["done", "completed", "resolved"].includes(
      String(latestAi?.item?.status || "").toLowerCase(),
    ) &&
    ["Inseminated", "Likely Pregnant", "In Heat"].includes(
      animal.reproductiveStatus || "",
    );
  const hasPregnancyTrackerData = Boolean(
    latestAi?.value ||
    animal.lastInseminationDate ||
    animal.expectedCalvingDate ||
    animal.pregnancyConfirmedAt ||
    ["Inseminated", "Likely Pregnant", "Pregnant"].includes(
      animal.reproductiveStatus || "",
    ),
  );
  const canOpenPregnancyTracker = role === "farmer" && hasPregnancyTrackerData;

  const quickFacts: QuickFact[] = [];
  if (gender) {
    quickFacts.push({
      key: "gender",
      label: "Gender",
      value: titleCase(gender),
      icon: <VenusAndMars size={16} color={colors.primary} />,
    });
  }
  if (age) {
    quickFacts.push({
      key: "age",
      label: "Age",
      value: age,
      icon: <Calendar size={16} color={colors.primary} />,
    });
  }
  if (location) {
    quickFacts.push({
      key: "location",
      label: "Location",
      value: location,
      icon: <MapPin size={16} color={colors.primary} />,
    });
  }

  const informationItems: InformationItem[] = [
    animal.breed
      ? { key: "breed", label: "Breed", value: animal.breed }
      : undefined,
    animal.species
      ? { key: "species", label: "Species", value: animal.species }
      : undefined,
    animal.bloodline || animal.geneticLineage
      ? {
          key: "bloodline",
          label: "Bloodline",
          value: animal.bloodline || animal.geneticLineage || "",
        }
      : undefined,
    formatDate(animal.birthDate)
      ? {
          key: "birth-date",
          label: "Date of birth",
          value: formatDate(animal.birthDate),
        }
      : undefined,
    animal.animalId
      ? {
          key: "registration",
          label: "Registration no.",
          value: animal.animalId,
        }
      : undefined,
    animal.earTag
      ? { key: "ear-tag", label: "Ear tag", value: animal.earTag }
      : undefined,
    animal.color
      ? { key: "color", label: "Color", value: animal.color }
      : undefined,
    animal.markings
      ? { key: "markings", label: "Markings", value: animal.markings }
      : undefined,
  ].filter((item): item is InformationItem => Boolean(item?.value));

  const records = recordsQuery.data?.records || [];
  const totalRecords = recordsQuery.data?.total || records.length;
  const visibleRecords = showAllRecords ? records : records.slice(0, 3);
  const ownerAddress = owner
    ? formatAddressLabel(owner.address, owner.farmLocation, "")
    : "";
  const ownerPhone =
    owner?.phoneNumber ||
    owner?.contact ||
    owner?.phone ||
    owner?.address?.phoneNumber ||
    "";
  const latitude = owner?.farmLocation?.latitude;
  const longitude = owner?.farmLocation?.longitude;
  const canOpenMap =
    typeof latitude === "number" && typeof longitude === "number";

  const openService = (service: ServiceSummary) => {
    if (role === "farmer") {
      router.push({
        pathname:
          service.kind === "ai"
            ? "/(farmer)/ai-request-detail"
            : "/(farmer)/health-request-detail",
        params: { id: service.id },
      } as never);
      return;
    }

    router.push({
      pathname:
        role === "admin"
          ? "/(admin)/request-details"
          : "/(technician)/request-details",
      params: { id: service.id, type: service.kind },
    } as never);
  };

  const openRecord = (record: Record<string, unknown>) => {
    if (role === "farmer") {
      router.push({
        pathname: "/(farmer)/animal-record-detail",
        params: {
          animalId: id,
          recordId: String(record.sourceId || record._id || record.id || ""),
          recordType: String(record.recordKind || record.type || ""),
        },
      } as never);
    } else if (role === "technician") {
      router.push({
        pathname: "/(technician)/record-details",
        params: {
          animalId: id,
          recordId: String(record.sourceId || record._id || record.id || ""),
          recordType: String(record.recordKind || record.type || ""),
        },
      } as never);
    }
  };

  const ownerId = owner?._id;
  const actionFarmerId = ownerId || "";
  const singleColumnInformation = width < 360 || fontScale > 1.15;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader
        title="Animal Details"
        onBack={() => safeBack(backRoute)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          paddingTop: SPACE.lg,
          paddingBottom: SPACE.xxl,
          gap: SPACE.xl,
        }}
      >
        <View style={{ gap: SPACE.sm }}>
          <View
            style={{
              borderRadius: 20,
              padding: 16,
              backgroundColor: isDark ? "#064629" : "#00643B",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            {animal.imageUrl?.trim() ? (
              <Image
                source={{ uri: animal.imageUrl }}
                resizeMode="cover"
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: "rgba(255,255,255,0.35)",
                }}
                accessibilityLabel="Animal photo"
              />
            ) : (
              <View
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.24)",
                }}
              >
                <MaterialCommunityIcons
                  name="cow"
                  size={44}
                  color="rgba(255,255,255,0.88)"
                />
              </View>
            )}

            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "Outfit_700Bold",
                    fontSize: 22,
                    lineHeight: 26,
                    flexShrink: 1,
                  }}
                >
                  {primaryIdentity || "Animal profile"}
                </Text>
                {heroStatus ? (
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor: "rgba(255,255,255,0.2)",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={12}
                      color="#FFFFFF"
                    />
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 11,
                        lineHeight: 14,
                      }}
                    >
                      {heroStatus}
                    </Text>
                  </View>
                ) : null}
              </View>

              {speciesBreed ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "Outfit_500Medium",
                    fontSize: 13,
                    lineHeight: 16,
                  }}
                >
                  {speciesBreed}
                </Text>
              ) : null}

              {identityLabel ? (
                <View
                  style={{
                    alignSelf: "flex-start",
                    maxWidth: "100%",
                    borderRadius: 10,
                    marginTop: 2,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: "rgba(255,255,255,0.14)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.22)",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: "#FFFFFF",
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 12,
                      lineHeight: 15,
                    }}
                  >
                    {identityLabel.label}: {identityLabel.value}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <QuickFactsCard facts={quickFacts} />

          {nextVisit ? (
            <View
              style={{
                width: "100%",
                marginTop: SPACE.xs,
                borderRadius: 16,
                backgroundColor: isDark ? "rgba(0,100,59,0.14)" : "#F0FDF4",
                borderWidth: 1,
                borderColor: isDark ? "rgba(52,211,153,0.3)" : "#D1FAE5",
                overflow: "hidden",
              }}
            >
              <Pressable
                onPress={() => openService(nextVisit)}
                accessibilityRole="button"
                accessibilityLabel={`Open next visit for ${nextVisit.title}`}
                style={({ pressed }) => ({
                  width: "100%",
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    width: "100%",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isDark
                        ? "rgba(52,211,153,0.18)"
                        : "#DCFCE7",
                    }}
                  >
                    <Calendar
                      size={20}
                      color={isDark ? "#34D399" : "#00643B"}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: isDark ? "#34D399" : "#00643B",
                        fontFamily: "Outfit_700Bold",
                        fontSize: 14,
                        lineHeight: 18,
                      }}
                    >
                      Next Visit: {formatDate(nextVisit.scheduledDate, true)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_500Medium",
                        fontSize: 12,
                        lineHeight: 16,
                        marginTop: 2,
                      }}
                    >
                      {[nextVisit.title, nextVisit.technician]
                        .filter(Boolean)
                        .join(" with ")}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={{ gap: SPACE.sm }}>
          <SectionHeader
            icon={
              <MaterialCommunityIcons
                name="cow"
                size={18}
                color={colors.primary}
              />
            }
            title="Reproductive Status"
          />
          <Pressable
            disabled={!canOpenPregnancyTracker}
            accessibilityRole={canOpenPregnancyTracker ? "button" : undefined}
            accessibilityLabel={
              canOpenPregnancyTracker
                ? `View pregnancy tracker for ${primaryIdentity}`
                : undefined
            }
            accessibilityHint={
              canOpenPregnancyTracker
                ? "Opens the reproductive timeline and pregnancy progress."
                : undefined
            }
            onPress={
              canOpenPregnancyTracker
                ? () =>
                    router.push({
                      pathname: "/(farmer)/pregnancy-tracker",
                      params: { id: animal._id },
                    } as never)
                : undefined
            }
            style={({ pressed }) => ({
              opacity: pressed && canOpenPregnancyTracker ? 0.78 : 1,
            })}
          >
            <View
              style={{
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  width: "100%",
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDark ? "rgba(0,100,59,0.15)" : "#E6F4EA",
                  }}
                >
                  <Heart size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: animal.reproductiveStatus
                        ? colors.primary
                        : colors.textSecondary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 15,
                      lineHeight: 20,
                    }}
                  >
                    {animal.reproductiveStatus ||
                      "No reproductive status recorded."}
                  </Text>
                  {latestAi?.value ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_500Medium",
                        fontSize: 12,
                        lineHeight: 16,
                        marginTop: 2,
                      }}
                    >
                      Last AI: {formatDate(latestAi.value)}
                    </Text>
                  ) : null}
                </View>
                {canOpenPregnancyTracker ? (
                  <ChevronRight size={18} color={colors.textMuted} />
                ) : null}
              </View>
            </View>
          </Pressable>
        </View>

        {latestObservation || canReportBreedingObservation ? (
          <View style={{ gap: SPACE.sm }}>
            <SectionHeader
              icon={<MessageSquareText size={18} color={colors.primary} />}
              title="Breeding Follow-up"
            />
            <View
              style={{
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                gap: 12,
              }}
            >
              {latestObservation ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: "Outfit_700Bold",
                          fontSize: 15,
                          lineHeight: 20,
                        }}
                      >
                        {getBreedingObservationLabel(
                          latestObservation.farmerOutcomeReport,
                        )}
                      </Text>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 12,
                          lineHeight: 16,
                          marginTop: 2,
                        }}
                      >
                        Farmer observation
                        {latestObservation.farmerOutcomeReportedAt
                          ? ` · ${formatDate(
                              latestObservation.farmerOutcomeReportedAt,
                            )}`
                          : ""}
                      </Text>
                    </View>
                    {isBreedingObservationAwaitingReview(
                      latestObservation.verificationStatus ||
                        latestObservation.outcomeVerificationStatus,
                    ) ? (
                      <StatusBadge
                        label="Needs review"
                        variant="warning"
                        compact
                      />
                    ) : null}
                  </View>

                  {latestObservation.farmerObservationSigns?.length ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: "Outfit_500Medium",
                        fontSize: 12,
                        lineHeight: 17,
                      }}
                    >
                      {latestObservation.farmerObservationSigns
                        .map(getBreedingObservationSignLabel)
                        .join(" · ")}
                    </Text>
                  ) : null}

                  <Text
                    style={{
                      color: colors.textMuted,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      lineHeight: 17,
                    }}
                  >
                    {role === "farmer"
                      ? "This report is shared with the technician and does not confirm pregnancy."
                      : "Review the farmer observation before recording an official pregnancy diagnosis."}
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 15,
                    }}
                  >
                    Have you noticed changes after insemination?
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      lineHeight: 17,
                    }}
                  >
                    Share what you observed so the technician can recommend the
                    correct follow-up.
                  </Text>
                </>
              )}

              {role === "farmer" && latestAi?.item?._id ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/(farmer)/report-breeding-observation",
                      params: {
                        animalId: animal._id,
                        requestId: latestAi.item._id,
                        defaultReport:
                          latestObservation?.farmerOutcomeReport || "unsure",
                      },
                    } as never)
                  }
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontFamily: "Outfit_700Bold",
                      fontSize: 14,
                    }}
                  >
                    {latestObservation
                      ? "Update observation"
                      : "Report an observation"}
                  </Text>
                </Pressable>
              ) : role === "technician" && latestObservation ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/(technician)/request-details",
                      params: { id: latestObservation._id, type: "ai" },
                    } as never)
                  }
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 14,
                    }}
                  >
                    Review observation
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {activeRequest
          ? (() => {
              const isUnclaimedActiveRequest =
                activeRequest.status?.toLowerCase() === "pending" ||
                !activeRequest.technician;
              return (
                <View style={{ gap: SPACE.sm }}>
                  <SectionHeader
                    icon={<Clock size={18} color={colors.primary} />}
                    title="Active Request / Visit"
                  />
                  <View
                    style={{
                      width: "100%",
                      borderRadius: 16,
                      backgroundColor: isDark
                        ? "rgba(0,100,59,0.14)"
                        : "#F0FDF4",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(52,211,153,0.3)" : "#D1FAE5",
                      overflow: "hidden",
                    }}
                  >
                    <Pressable
                      onPress={() => openService(activeRequest)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${activeRequest.title}`}
                      style={({ pressed }) => ({
                        width: "100%",
                        opacity: pressed ? 0.78 : 1,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          width: "100%",
                          gap: 12,
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isDark
                              ? "rgba(52,211,153,0.18)"
                              : "#DCFCE7",
                          }}
                        >
                          {activeRequest.kind === "health" ? (
                            <Stethoscope size={20} color={colors.primary} />
                          ) : (
                            <Syringe size={20} color={colors.primary} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.textPrimary,
                              fontFamily: "Outfit_700Bold",
                              fontSize: 15,
                              lineHeight: 20,
                            }}
                          >
                            {activeRequest.title}
                          </Text>
                          {activeRequest.activityDate ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.textSecondary,
                                fontFamily: "Outfit_500Medium",
                                fontSize: 12,
                                lineHeight: 16,
                              }}
                            >
                              📅 {formatDate(activeRequest.activityDate, true)}
                            </Text>
                          ) : null}
                          {activeRequest.location ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                color: colors.textSecondary,
                                fontFamily: "Outfit_500Medium",
                                fontSize: 12,
                                lineHeight: 16,
                              }}
                            >
                              📍 {activeRequest.location}
                            </Text>
                          ) : null}
                          {role === "technician" && isUnclaimedActiveRequest ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                color: isDark ? "#FBBF24" : "#D97706",
                                fontFamily: "Outfit_600SemiBold",
                                fontSize: 12,
                                lineHeight: 16,
                                marginTop: 2,
                              }}
                            >
                              ✋ Unclaimed — Tap to review & claim
                            </Text>
                          ) : null}
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <StatusBadge
                            label={
                              isUnclaimedActiveRequest
                                ? "Unclaimed"
                                : activeRequest.status
                            }
                            variant={
                              isUnclaimedActiveRequest ? "warning" : undefined
                            }
                            domain="request"
                            compact
                          />
                          <ChevronRight size={18} color={colors.textMuted} />
                        </View>
                      </View>
                    </Pressable>
                  </View>
                </View>
              );
            })()
          : null}

        <View style={{ gap: SPACE.sm, marginTop: SPACE.xs }}>
          <SectionHeader
            icon={<FileText size={18} color={colors.primary} />}
            title="Recent Records"
            action={
              totalRecords > 3 ? (
                <Pressable
                  onPress={() => setShowAllRecords((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showAllRecords
                      ? "Show fewer animal records"
                      : "View all animal records"
                  }
                  hitSlop={SPACE.md}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 13,
                    }}
                  >
                    {showAllRecords ? "Show less" : "View all"}
                  </Text>
                </Pressable>
              ) : undefined
            }
          />

          <View
            style={{
              overflow: "hidden",
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {recordsQuery.isLoading ? (
              <View style={{ paddingVertical: 32, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : visibleRecords.length ? (
              visibleRecords.map((record, index) => {
                const presentation = formatAnimalRecord(record, animal);
                const canOpenRecord = role !== "admin";

                const isHealth = presentation.category === "Health";
                const isPregnancyOrCalving =
                  presentation.category === "Calving" ||
                  /pregnancy|calving/i.test(
                    String(record.recordKind || record.type || ""),
                  );

                const iconBg = isHealth
                  ? isDark
                    ? "rgba(245,158,11,0.15)"
                    : "#FFF7ED"
                  : isPregnancyOrCalving
                    ? isDark
                      ? "rgba(168,85,247,0.15)"
                      : "#F3E8FF"
                    : isDark
                      ? "rgba(0,100,59,0.15)"
                      : "#E6F4EA";

                const iconColor = isHealth
                  ? isDark
                    ? "#FBBF24"
                    : "#D97706"
                  : isPregnancyOrCalving
                    ? isDark
                      ? "#C084FC"
                      : "#7E22CE"
                    : isDark
                      ? "#34D399"
                      : "#00643B";

                const detailPerson = presentation.details
                  .find((d: string) =>
                    /^(technician|farmer|approved by|confirmed by):/i.test(d),
                  )
                  ?.replace(/^[^:]+:\s*/, "");
                const secondaryText =
                  detailPerson || presentation.details[0] || "";
                const subtitleText = [
                  formatDate(presentation.date),
                  secondaryText,
                ]
                  .filter(Boolean)
                  .join(" · ");

                const itemRowStyle = {
                  flexDirection: "row" as const,
                  alignItems: "center" as const,
                  width: "100%" as const,
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: colors.border,
                };
                const key = String(
                  record.sourceId ||
                    record._id ||
                    record.id ||
                    `record-${index}`,
                );

                const rowInnerContent = (
                  <>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: iconBg,
                      }}
                    >
                      {isHealth ? (
                        <Stethoscope size={20} color={iconColor} />
                      ) : isPregnancyOrCalving ? (
                        <MaterialCommunityIcons
                          name="cow"
                          size={20}
                          color={iconColor}
                        />
                      ) : (
                        <Syringe size={20} color={iconColor} />
                      )}
                    </View>

                    <View
                      style={{ flex: 1, minWidth: 0, justifyContent: "center" }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.textPrimary,
                          fontFamily: "Outfit_700Bold",
                          fontSize: 15,
                          lineHeight: 20,
                        }}
                      >
                        {presentation.pageTitle}
                      </Text>
                      {subtitleText ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            color: colors.textSecondary,
                            fontFamily: "Outfit_500Medium",
                            fontSize: 12,
                            lineHeight: 16,
                            marginTop: 2,
                          }}
                        >
                          {subtitleText}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {presentation.badges[0] ? (
                        <StatusBadge
                          label={presentation.badges[0].label}
                          domain={presentation.badges[0].domain}
                          variant={presentation.badges[0].variant}
                          compact
                        />
                      ) : null}

                      {canOpenRecord ? (
                        <ChevronRight size={18} color={colors.textMuted} />
                      ) : null}
                    </View>
                  </>
                );

                return canOpenRecord ? (
                  <Pressable
                    key={key}
                    onPress={() =>
                      openRecord(record as Record<string, unknown>)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${presentation.pageTitle}`}
                    style={({ pressed }) => ({
                      width: "100%",
                      opacity: pressed ? 0.76 : 1,
                    })}
                  >
                    <View style={itemRowStyle}>{rowInnerContent}</View>
                  </Pressable>
                ) : (
                  <View key={key} style={itemRowStyle}>
                    {rowInnerContent}
                  </View>
                );
              })
            ) : (
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 24,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  No records have been added yet.
                </Text>
              </View>
            )}

            {showAllRecords && recordsQuery.hasNextPage ? (
              <Pressable
                onPress={() => void recordsQuery.fetchNextPage()}
                disabled={recordsQuery.isFetchingNextPage}
                accessibilityRole="button"
                accessibilityLabel="Load more animal records"
                style={({ pressed }) => ({
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                {recordsQuery.isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text textRole="label" style={{ color: colors.primary }}>
                    Load more
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ gap: SPACE.sm }}>
          <SectionHeader
            icon={<Info size={18} color={colors.primary} />}
            title="Animal Information"
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              overflow: "hidden",
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {informationItems.map((item, index) => {
              const isUnpairedLastItem =
                !singleColumnInformation &&
                informationItems.length % 2 === 1 &&
                index === informationItems.length - 1;
              const isLeft = singleColumnInformation || index % 2 === 0;
              const hasRowAbove = singleColumnInformation
                ? index > 0
                : index >= 2;
              return (
                <View
                  key={item.key}
                  style={{
                    width:
                      singleColumnInformation || isUnpairedLastItem
                        ? "100%"
                        : "50%",
                    minHeight: 64,
                    justifyContent: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderLeftWidth: isLeft || isUnpairedLastItem ? 0 : 1,
                    borderLeftColor: colors.border,
                    borderTopWidth: hasRowAbove ? 1 : 0,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      lineHeight: 16,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 14,
                      lineHeight: 18,
                      marginTop: 4,
                    }}
                  >
                    {item.value}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {role !== "farmer" && owner ? (
          <View style={{ gap: SPACE.sm }}>
            <SectionHeader
              icon={<UserRound size={18} color={colors.primary} />}
              title="Ownership"
            />
            <View
              style={{
                borderRadius: 20,
                padding: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 14,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDark ? "rgba(0,100,59,0.15)" : "#E6F4EA",
                  }}
                >
                  <UserRound size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: "Outfit_500Medium",
                      fontSize: 12,
                      lineHeight: 16,
                    }}
                  >
                    Registered Farmer
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 16,
                      lineHeight: 20,
                      marginTop: 2,
                    }}
                  >
                    {owner.name || "N/A"}
                  </Text>
                </View>
              </View>

              {ownerPhone || ownerAddress ? (
                <View
                  style={{
                    gap: 8,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {ownerPhone ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Phone size={15} color={colors.primary} />
                      <Text
                        selectable
                        style={{
                          color: colors.textPrimary,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 13,
                          lineHeight: 18,
                        }}
                      >
                        {ownerPhone}
                      </Text>
                    </View>
                  ) : null}

                  {ownerAddress ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <MapPin size={15} color={colors.primary} />
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.textSecondary,
                          fontFamily: "Outfit_500Medium",
                          fontSize: 13,
                          lineHeight: 18,
                          flex: 1,
                        }}
                      >
                        {ownerAddress}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 4,
                }}
              >
                {ownerPhone ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      void Linking.openURL(
                        `tel:${ownerPhone.replace(/[^\d+]/g, "")}`,
                      )
                    }
                    accessibilityLabel={`Call ${owner.name || "farmer"}`}
                    style={{
                      flex: 1,
                      minWidth: 100,
                      borderRadius: 12,
                    }}
                  >
                    <Phone size={15} color={colors.primary} />
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 13,
                        marginLeft: 6,
                      }}
                    >
                      Call
                    </Text>
                  </Button>
                ) : null}

                {canOpenMap ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      void Linking.openURL(
                        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
                      )
                    }
                    accessibilityLabel="Open farm location in maps"
                    style={{
                      flex: 1,
                      minWidth: 100,
                      borderRadius: 12,
                    }}
                  >
                    <MapPin size={15} color={colors.primary} />
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 13,
                        marginLeft: 6,
                      }}
                    >
                      Open map
                    </Text>
                  </Button>
                ) : null}

                {role === "admin" && ownerId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      router.push({
                        pathname: "/(admin)/user-details",
                        params: { id: ownerId },
                      } as never)
                    }
                    style={{
                      flex: 1,
                      minWidth: 100,
                      borderRadius: 12,
                    }}
                  >
                    <UserRound size={15} color={colors.primary} />
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: "Outfit_700Bold",
                        fontSize: 13,
                        marginLeft: 6,
                      }}
                    >
                      View farmer
                    </Text>
                  </Button>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky Fixed Bottom Action Footer */}
      {role === "farmer" || role === "technician" ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 14),
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 8,
          }}
        >
          {role === "farmer" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                variant="outline"
                onPress={() =>
                  router.push("/(farmer)/report-sickness" as never)
                }
                style={{ flex: 1, borderRadius: 14, minHeight: 46 }}
              >
                <Stethoscope size={16} color={colors.primary} />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 13,
                    marginLeft: 6,
                  }}
                >
                  Report Health
                </Text>
              </Button>
              <Button
                onPress={() =>
                  router.push({
                    pathname: "/(farmer)/request-ai",
                    params: { animalId: animal._id },
                  } as never)
                }
                style={{
                  flex: 1,
                  borderRadius: 14,
                  minHeight: 46,
                  backgroundColor: colors.primary,
                }}
              >
                <Syringe size={16} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "Outfit_700Bold",
                    fontSize: 13,
                    marginLeft: 6,
                  }}
                >
                  Request AI
                </Text>
              </Button>
            </View>
          ) : role === "technician" ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/(technician)/health-log",
                      params: {
                        animalId: animal._id,
                        farmerId: actionFarmerId,
                      },
                    } as never)
                  }
                  style={{ flex: 1, borderRadius: 14, minHeight: 44 }}
                >
                  <Stethoscope size={16} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 13,
                      marginLeft: 6,
                    }}
                  >
                    Health Record
                  </Text>
                </Button>
                <Button
                  variant="outline"
                  onPress={() =>
                    router.push({
                      pathname: "/(technician)/pregnancy-check",
                      params: {
                        animalId: animal._id,
                        farmerId: actionFarmerId,
                        farmerName: owner?.name || "",
                      },
                    } as never)
                  }
                  style={{ flex: 1, borderRadius: 14, minHeight: 44 }}
                >
                  <MaterialCommunityIcons
                    name="cow"
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 13,
                      marginLeft: 6,
                    }}
                  >
                    Pregnancy Check
                  </Text>
                </Button>
              </View>
              <Button
                onPress={() =>
                  router.push({
                    pathname: "/(technician)/record-ai",
                    params: {
                      animalId: animal._id,
                      farmerId: actionFarmerId,
                      source: "animal-profile",
                    },
                  } as never)
                }
                style={{
                  width: "100%",
                  borderRadius: 14,
                  minHeight: 48,
                  backgroundColor: colors.primary,
                }}
              >
                <Syringe size={18} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontFamily: "Outfit_700Bold",
                    fontSize: 14,
                    marginLeft: 6,
                  }}
                >
                  + Record AI Service
                </Text>
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
