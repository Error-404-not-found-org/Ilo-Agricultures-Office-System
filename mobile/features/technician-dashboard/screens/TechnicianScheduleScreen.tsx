import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  PawPrint,
  UserRound,
  UsersRound,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

import { useTheme } from "@/lib/theme";
import { AppPageHeader } from "@/components/AppPageHeader";
import { AsyncState } from "@/components/shared";
import {
  useCurrentTechnicianProfileQuery,
  useTechnicianFullAgendaQuery,
} from "@/features/technician/hooks/useTechnicianDashboard";
import {
  AgendaItem,
  deduplicateCalendarVisits,
  getCalendarAnimalIdentity,
  getCalendarVisitTarget,
} from "@/features/technician-dashboard/utils/calendarPresentation";

type Props = {
  embeddedInTab?: boolean;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const itemDate = (item: AgendaItem) => {
  const value =
    item.displayDate ||
    item.scheduledDate ||
    item.preferredDate ||
    item.raw?.scheduledDate ||
    item.raw?.preferredDate;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isUrgentVisit = (item: AgendaItem) =>
  item.overdue === true ||
  item.urgency === "urgent" ||
  item.raw?.urgency === "urgent";

const serviceName = (item: AgendaItem) => {
  if (item.type === "insemination" || item.type === "ai") return "AI Service";
  if (item.type === "health") return "Health Assistance";
  return item.taskType || item.serviceType || "Farm Visit";
};

const statusName = (item: AgendaItem) => {
  if (item.overdue) return "Overdue";
  const value = String(item.displayStatus || item.status || "Scheduled")
    .replace(/_/g, " ")
    .replace(/-/g, " ");
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function TechnicianScheduleScreen({
  embeddedInTab = false,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
  } = useTechnicianFullAgendaQuery();
  const { data: technician } = useCurrentTechnicianProfileQuery();

  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today);
    }, []),
  );

  const visits = useMemo(
    () => deduplicateCalendarVisits(dashboardData?.agendaItems || []),
    [dashboardData?.agendaItems],
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [currentMonth]);

  const selectedVisits = useMemo(() => {
    const todaySelected = isToday(selectedDate);
    return visits
      .filter((visit) => {
        const date = itemDate(visit);
        if (date && isSameDay(date, selectedDate)) return true;
        return todaySelected && visit.overdue === true;
      })
      .sort((a, b) => {
        const aDate = itemDate(a)?.getTime() || 0;
        const bDate = itemDate(b)?.getTime() || 0;
        return aDate - bDate;
      });
  }, [selectedDate, visits]);

  const farmerCount = useMemo(() => {
    const farmers = new Set(
      selectedVisits
        .map(
          (visit) =>
            visit.raw?.farmerId?._id ||
            visit.farmerId ||
            visit.farmerName ||
            visit.farmer,
        )
        .filter(Boolean)
        .map(String),
    );
    return farmers.size;
  }, [selectedVisits]);

  const urgentCount = selectedVisits.filter(isUrgentVisit).length;

  const selectToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const header = (
    <>
      <AppPageHeader
        title="Schedule"
        showBackButton={!embeddedInTab}
        variant={embeddedInTab ? "top-level" : "detail"}
        rightAction={
          <TouchableOpacity
            onPress={selectToday}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            style={styles.todayButton}
          >
            <Text style={[styles.todayText, { color: colors.primary }]}>
              Today
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        <View style={styles.monthRow}>
          <MonthButton
            label="Previous month"
            onPress={() => {
              const month = subMonths(currentMonth, 1);
              setCurrentMonth(month);
              setSelectedDate(startOfMonth(month));
            }}
            colors={colors}
          >
            <ChevronLeft size={20} color={colors.primary} />
          </MonthButton>
          <Text style={[styles.monthTitle, { color: colors.textPrimary }]}>
            {format(currentMonth, "MMMM yyyy")}
          </Text>
          <MonthButton
            label="Next month"
            onPress={() => {
              const month = addMonths(currentMonth, 1);
              setCurrentMonth(month);
              setSelectedDate(startOfMonth(month));
            }}
            colors={colors}
          >
            <ChevronRight size={20} color={colors.primary} />
          </MonthButton>
        </View>

        <View
          style={[
            styles.calendar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day, index) => (
              <Text
                key={`${day}-${index}`}
                style={[styles.weekday, { color: colors.textMuted }]}
              >
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.dateGrid}>
            {calendarDays.map((day) => {
              const selected = isSameDay(day, selectedDate);
              const inMonth = isSameMonth(day, currentMonth);
              const visitsOnDay = visits.filter((visit) => {
                const date = itemDate(visit);
                return date ? isSameDay(date, day) : false;
              });
              const urgent = visitsOnDay.some(isUrgentVisit);

              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  onPress={() => setSelectedDate(day)}
                  accessibilityRole="button"
                  accessibilityLabel={format(day, "EEEE, MMMM d")}
                  accessibilityState={{ selected }}
                  style={styles.dateCell}
                >
                  <View
                    style={[
                      styles.dateCircle,
                      selected && { backgroundColor: colors.primary },
                      isToday(day) &&
                        !selected && {
                          borderWidth: 1,
                          borderColor: colors.primary,
                        },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateText,
                        {
                          color: selected
                            ? "#fff"
                            : inMonth
                              ? colors.textPrimary
                              : colors.textMuted,
                          opacity: inMonth ? 1 : 0.38,
                        },
                      ]}
                    >
                      {format(day, "d")}
                    </Text>
                  </View>
                  <View style={styles.markerSlot}>
                    {visitsOnDay.length > 0 ? (
                      <View
                        style={[
                          styles.marker,
                          {
                            backgroundColor: urgent
                              ? colors.warning
                              : colors.primary,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.agendaHeading}>
          <Text style={[styles.agendaTitle, { color: colors.textPrimary }]}>
            {format(selectedDate, "EEEE, MMMM d")}
          </Text>
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isDark ? "rgba(16,185,129,0.14)" : colors.tint,
              },
            ]}
          >
            <Text style={[styles.countText, { color: colors.primary }]}>
              {selectedVisits.length}{" "}
              {selectedVisits.length === 1 ? "visit" : "visits"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.summary,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <SummaryItem
            icon={CalendarDays}
            value={selectedVisits.length}
            label="Visits"
            color={colors.primary}
            textColor={colors.textPrimary}
          />
          <View
            style={[styles.summaryDivider, { backgroundColor: colors.border }]}
          />
          <SummaryItem
            icon={UsersRound}
            value={farmerCount}
            label="Farmers"
            color={colors.primary}
            textColor={colors.textPrimary}
          />
          <View
            style={[styles.summaryDivider, { backgroundColor: colors.border }]}
          />
          <SummaryItem
            icon={AlertTriangle}
            value={urgentCount}
            label="Urgent"
            color={colors.warning}
            textColor={colors.textPrimary}
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {isLoading ? (
        <>
          {header}
          <AsyncState
            state="loading"
            style={{ paddingHorizontal: 16 }}
          />
        </>
      ) : isError ? (
        <>
          {header}
          <AsyncState
            state="error"
            title="Couldn’t load the schedule"
            message="Check your connection and try again."
            onAction={() => refetch()}
          />
        </>
      ) : (
        <FlatList
          data={selectedVisits}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <VisitCard
              item={item}
              technicianId={technician?._id}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push(getCalendarVisitTarget(item) as never)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: isDark ? colors.card : colors.tint },
                ]}
              >
                <CalendarDays size={26} color={colors.primary} />
              </View>
              <Text style={[styles.stateTitle, { color: colors.textPrimary }]}>
                No visits scheduled
              </Text>
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Assigned and scheduled services will appear here.
              </Text>
            </View>
          }
          contentContainerStyle={{
            paddingBottom: embeddedInTab
              ? insets.bottom + 92
              : insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function MonthButton({ children, label, onPress, colors }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.monthButton, { borderColor: colors.border }]}
    >
      {children}
    </TouchableOpacity>
  );
}

function SummaryItem({ icon: Icon, value, label, color, textColor }: any) {
  return (
    <View style={styles.summaryItem}>
      <Icon size={18} color={color} />
      <View>
        <Text style={[styles.summaryValue, { color: textColor }]}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

function VisitCard({ item, technicianId, colors, isDark, onPress }: any) {
  const date = itemDate(item);
  const urgent = isUrgentVisit(item);
  const animal = getCalendarAnimalIdentity(item);
  const farmer =
    item.farmerName || item.farmer || item.raw?.farmerId?.name || "Farmer";
  const location =
    item.farmLocationLabel ||
    item.locationLabel ||
    item.location ||
    item.raw?.farmAddress ||
    "Location not provided";
  const assignedTechnician =
    item.raw?.approvedBy?._id ||
    item.raw?.approvedBy ||
    item.raw?.handledBy?._id ||
    item.raw?.handledBy;
  const locked =
    assignedTechnician &&
    technicianId &&
    String(assignedTechnician) !== String(technicianId);

  return (
    <View
      style={[
        styles.visitCard,
        {
          backgroundColor: colors.card,
          borderColor: urgent
            ? isDark
              ? "rgba(251,191,36,0.38)"
              : "#fcd34d"
            : colors.border,
        },
      ]}
    >
      <View style={styles.visitTopRow}>
        <View style={styles.timeRow}>
          <Clock3 size={16} color={urgent ? colors.warning : colors.primary} />
          <Text style={[styles.visitTime, { color: colors.textPrimary }]}>
            {date ? format(date, "h:mm a") : item.time || "Time not set"}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: urgent
                ? isDark
                  ? "rgba(251,191,36,0.14)"
                  : "#fffbeb"
                : isDark
                  ? "rgba(16,185,129,0.14)"
                  : colors.tint,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: urgent ? colors.warning : colors.primary },
            ]}
          >
            {locked ? "Assigned" : statusName(item)}
          </Text>
        </View>
      </View>

      <Text style={[styles.visitTitle, { color: colors.textPrimary }]}>
        {serviceName(item)}
      </Text>
      <Metadata icon={UserRound} text={farmer} colors={colors} />
      <Metadata icon={PawPrint} text={animal.compact} colors={colors} />
      <Metadata icon={MapPin} text={location} colors={colors} />

      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${serviceName(item)} visit`}
        style={[styles.viewButton, { borderColor: colors.primary }]}
      >
        <Text style={[styles.viewButtonText, { color: colors.primary }]}>
          View visit
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function Metadata({ icon: Icon, text, colors }: any) {
  return (
    <View style={styles.metadataRow}>
      <Icon size={16} color={colors.textMuted} />
      <Text
        numberOfLines={2}
        style={[styles.metadataText, { color: colors.textSecondary }]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  headerCopy: { flex: 1, marginLeft: 2 },
  title: {
    fontFamily: "Outfit_800ExtraBold",
    fontSize: 22,
    lineHeight: 27,
  },
  subtitle: {
    marginTop: 1,
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    lineHeight: 16,
  },
  todayButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  todayText: { fontFamily: "Outfit_700Bold", fontSize: 14 },
  content: { paddingHorizontal: 16 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  monthButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 17,
    lineHeight: 22,
  },
  calendar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  weekRow: { flexDirection: "row" },
  weekday: {
    width: "14.285%",
    textAlign: "center",
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
  },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  dateCell: {
    width: "14.285%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 13,
    lineHeight: 17,
  },
  markerSlot: { height: 5, marginTop: 1 },
  marker: { width: 4, height: 4, borderRadius: 2 },
  agendaHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  agendaTitle: {
    flex: 1,
    fontFamily: "Outfit_700Bold",
    fontSize: 18,
    lineHeight: 23,
  },
  countBadge: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  summaryValue: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    lineHeight: 18,
  },
  summaryLabel: {
    color: "#64748b",
    fontFamily: "Outfit_500Medium",
    fontSize: 10,
    lineHeight: 13,
  },
  visitCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  visitTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  visitTime: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 17,
  },
  statusBadge: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 10,
    lineHeight: 13,
  },
  visitTitle: {
    marginTop: 12,
    marginBottom: 9,
    fontFamily: "Outfit_700Bold",
    fontSize: 17,
    lineHeight: 21,
  },
  metadataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 7,
  },
  metadataText: {
    flex: 1,
    fontFamily: "Outfit_500Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  viewButton: {
    minHeight: 44,
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButtonText: {
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
    lineHeight: 17,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stateTitle: {
    fontFamily: "Outfit_700Bold",
    fontSize: 16,
    lineHeight: 21,
    textAlign: "center",
  },
  stateText: {
    marginTop: 5,
    fontFamily: "Outfit_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: "#fff",
    fontFamily: "Outfit_700Bold",
    fontSize: 13,
  },
});
