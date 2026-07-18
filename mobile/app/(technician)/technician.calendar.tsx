import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react"; // Added useCallback
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router"; // Added useFocusEffect
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  format,
  isSameDay,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";
import {
  useCurrentTechnicianProfileQuery,
  useTechnicianFullAgendaQuery,
} from "@/features/technician/hooks/useTechnicianDashboard";
import {
  deduplicateCalendarVisits,
  getCalendarAnimalIdentity,
  getCalendarVisitTarget,
} from "@/features/technician-dashboard/utils/calendarPresentation";

const PRIMARY = "#00643B";

export default function TechnicianCalendar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const dayListRef = useRef<FlatList>(null);

  // This fires automatically every single time this page gains active focus
  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today);
    }, []),
  );

  // Fetch data dynamically based on the visible month
  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
  } = useTechnicianFullAgendaQuery();
  const tasks = useMemo(
    () => deduplicateCalendarVisits(dashboardData?.agendaItems || []),
    [dashboardData?.agendaItems],
  );

  const { data: dbUser } = useCurrentTechnicianProfileQuery();

  const dailyTasks = useMemo(() => {
    const today = new Date();
    const isTodaySelected = isSameDay(today, selectedDate);
    return tasks.filter((t: any) => {
      const tDate = t.displayDate;
      if (!tDate) return false;
      const parsedDate = new Date(tDate);
      if (isSameDay(parsedDate, selectedDate)) return true;
      if (isTodaySelected && t.overdue === true) return true;
      return false;
    });
  }, [tasks, selectedDate]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      const nextMonth = subMonths(prev, 1);
      setSelectedDate(startOfMonth(nextMonth));
      return nextMonth;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const nextMonth = addMonths(prev, 1);
      setSelectedDate(startOfMonth(nextMonth));
      return nextMonth;
    });
  };

  useEffect(() => {
    const selectedIndex = daysInMonth.findIndex((day) =>
      isSameDay(day, selectedDate),
    );
    if (selectedIndex !== -1 && dayListRef.current) {
      setTimeout(() => {
        dayListRef.current?.scrollToIndex({
          index: selectedIndex,
          viewPosition: 0.5,
          animated: true,
        });
      }, 150); // Slightly increased timeout ensuring DOM layout settles post focus change
    }
  }, [selectedDate, daysInMonth]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? colors.card : "#fff"} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: isDark ? colors.card : "#fff",
          borderBottomWidth: 1,
          borderColor: colors.border,
          paddingTop: insets.top + 14,
          zIndex: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              padding: 8,
              backgroundColor: isDark ? "#1e293b" : "#f8fafc",
              borderRadius: 999,
            }}
          >
            <ArrowLeft size={20} color={isDark ? "#f8fafc" : "#1e293b"} />
          </TouchableOpacity>
          <View>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: "Outfit_900Black",
                fontSize: 20,
              }}
            >
              Visit Calendar
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontFamily: "Outfit_600SemiBold",
                fontSize: 11,
                marginTop: 1,
              }}
            >
              {format(currentMonth, "MMMM yyyy")}
            </Text>
          </View>
        </View>

        {/* Changeable Month Buttons */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronLeft size={18} color={isDark ? "#fff" : "#1e293b"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNextMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={{
              width: 44,
              height: 44,
              borderRadius: 18,
              backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight size={18} color={isDark ? "#fff" : "#1e293b"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Day Picker Container */}
      <View style={{ backgroundColor: isDark ? colors.card : "#fff", paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.border }}>
        <View style={{ marginTop: 14 }}>
          <FlatList
            ref={dayListRef}
            data={daysInMonth}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.toISOString()}
            getItemLayout={(data, index) => ({
              length: 61,
              offset: 61 * index,
              index,
            })}
            contentContainerStyle={{ paddingHorizontal: 4 }}
            renderItem={({ item: day }) => {
              const isSelected = isSameDay(day, selectedDate);
              return (
                <TouchableOpacity
                  onPress={() => setSelectedDate(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${format(day, "EEEE, MMMM d")}`}
                  accessibilityState={{ selected: isSelected }}
                  style={{
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRadius: 20,
                    backgroundColor: isSelected ? (isDark ? colors.background : "#f1f5f9") : "transparent",
                    minWidth: 45,
                    marginHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: "Outfit_700Bold",
                      color: isSelected ? (isDark ? colors.primary : PRIMARY) : (isDark ? "rgba(255,255,255,0.5)" : "rgba(30,41,59,0.5)"),
                    }}
                  >
                    {format(day, "EEE").toUpperCase()}
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: "Outfit_900Black",
                      color: isSelected ? (isDark ? colors.primary : PRIMARY) : colors.textPrimary,
                    }}
                  >
                    {format(day, "d")}
                  </Text>
                  {isSelected && (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: isDark ? colors.primary : PRIMARY,
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
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
              fontSize: 18,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textPrimary,
            }}
          >
            {isSameDay(new Date(), selectedDate)
              ? "Today's Agenda"
              : format(selectedDate, "EEEE, MMM do")}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : "#ecfdf5",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Outfit_900Black",
                color: isDark ? colors.primary : "#059669",
              }}
            >
              {dailyTasks.length} VISITS
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(technician)/create-task",
              params: { source: "visit-calendar" },
            } as any)
          }
          accessibilityRole="button"
          accessibilityLabel="Schedule farm visit"
          activeOpacity={0.9}
          style={{
            backgroundColor: isDark ? colors.primary : PRIMARY,
            borderRadius: 16,
            paddingVertical: 13,
            paddingHorizontal: 16,
            marginBottom: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <MaterialCommunityIcons
            name="calendar-plus"
            size={19}
            color="#fff"
          />
          <Text
            style={{
              color: "#fff",
              fontSize: 13,
              fontFamily: "Outfit_800ExtraBold",
            }}
          >
            Schedule Farm Visit
          </Text>
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator color={isDark ? colors.primary : PRIMARY} style={{ marginTop: 40 }} />
        ) : isError ? (
          <View style={{ alignItems: "center", paddingTop: 44, paddingHorizontal: 20 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: "Outfit_800ExtraBold", fontSize: 17, textAlign: "center" }}>
              Couldn’t load the calendar
            </Text>
            <Text style={{ color: colors.textSecondary, fontFamily: "Outfit_500Medium", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 }}>
              Check your connection and try again.
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading calendar"
              style={{ minHeight: 44, marginTop: 16, paddingHorizontal: 20, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontFamily: "Outfit_700Bold" }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : dailyTasks.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              marginTop: -60,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.card,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <CalendarIcon size={32} color={colors.textMuted} />
            </View>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                color: colors.textSecondary,
                fontSize: 16,
              }}
            >
              No scheduled visits
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_500Medium",
                color: colors.textMuted,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Assigned and scheduled services will appear here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={dailyTasks}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
            renderItem={({ item }) => {
              const reqTechId =
                item.raw?.approvedBy?._id ||
                item.raw?.approvedBy ||
                item.raw?.handledBy?._id ||
                item.raw?.handledBy ||
                null;

              const isLocked =
                reqTechId &&
                dbUser?._id &&
                String(reqTechId) !== String(dbUser._id);
              const scheduledTime = item.time || item.preferredTime;
              const farmerName =
                item.farmerName ||
                item.farmer ||
                item.raw?.farmerId?.name;
              const animalTag =
                item.animalTag ||
                item.animal ||
                item.raw?.animalId?.earTag ||
                item.raw?.animalId?.animalId;
              const animalIdentity = getCalendarAnimalIdentity(item);
              const displayStatus =
                item.displayStatus || item.status || "Scheduled";
              const serviceLabel =
                item.type === "insemination" || item.type === "ai"
                  ? "AI"
                  : item.type === "health"
                    ? "Health"
                    : item.taskType || "Visit";

              return (
                <TouchableOpacity
                  onPress={() => router.push(getCalendarVisitTarget(item) as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${serviceLabel} visit for ${animalIdentity.full}, ${farmerName || "farmer"}`}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: item.overdue ? (isDark ? '#2d1616' : '#fff5f5') : colors.card,
                    borderRadius: 24,
                    padding: 20,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: item.overdue ? "#ef4444" : (item.type === "health" ? "#ef4444" : item.type === "task" ? "#64748b" : (isDark ? colors.primary : PRIMARY)),
                    shadowColor: "#000",
                    shadowOpacity: 0.03,
                    shadowRadius: 10,
                    elevation: 2,
                    borderWidth: item.overdue ? 1 : 0,
                    borderColor: item.overdue ? (isDark ? 'rgba(239,68,68,0.3)' : '#fee2e2') : "transparent"
                  }}
                >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Clock size={14} color={item.overdue ? "#ef4444" : colors.textMuted} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: "Outfit_700Bold",
                        color: item.overdue ? "#ef4444" : colors.textMuted,
                      }}
                    >
                      {item.overdue
                        ? `${new Date(item.displayDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${scheduledTime || "Time not set"}`
                        : scheduledTime || "Time not set"}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8
                    }}
                  >
                    {isLocked && (
                      <View
                        style={{
                          backgroundColor: "#fef3c7",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <MaterialCommunityIcons
                          name="lock"
                          size={10}
                          color="#d97706"
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: "Outfit_800ExtraBold",
                            color: "#d97706",
                            textTransform: "uppercase",
                          }}
                        >
                          Locked
                        </Text>
                      </View>
                    )}
                    {item.overdue && (
                      <View
                        style={{
                          backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5'
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: "Outfit_800ExtraBold",
                            color: "#ef4444",
                            textTransform: "uppercase",
                          }}
                        >
                          Overdue
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        backgroundColor:
                          item.type === "health" 
                            ? (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2') 
                            : item.type === "task"
                              ? (isDark ? 'rgba(100, 116, 139, 0.2)' : '#f8fafc')
                              : (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5'),
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: "Outfit_800ExtraBold",
                          color: item.type === "health" ? "#ef4444" : item.type === "task" ? "#64748b" : (isDark ? colors.primary : "#059669"),
                          textTransform: "uppercase",
                        }}
                      >
                        {serviceLabel}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: isDark
                          ? "rgba(59,130,246,0.16)"
                          : "#eff6ff",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontFamily: "Outfit_800ExtraBold",
                          color: isDark ? "#93c5fd" : "#1d4ed8",
                          textTransform: "capitalize",
                        }}
                      >
                        {displayStatus.replaceAll("-", " ")}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: 17,
                    fontFamily: "Outfit_800ExtraBold",
                  color: colors.textPrimary,
                  }}
                >
                  {farmerName || "Unknown Farmer"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: "Outfit_600SemiBold",
                      color: colors.textSecondary,
                    }}
                  >
                    {item.farmLocationLabel ||
                      item.location ||
                      "Location not set"}
                  </Text>
                </View>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    marginTop: 16,
                    paddingTop: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  {animalTag ? (
                  <View
                    style={{
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
                        backgroundColor: colors.background,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="cow"
                        size={14}
                        color={colors.textSecondary}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: "Outfit_700Bold",
                        color: colors.textSecondary,
                      }}
                    >
                      {animalIdentity.compact}
                    </Text>
                  </View>
                  ) : <View />}
                  <TouchableOpacity
                    onPress={() => router.push(getCalendarVisitTarget(item) as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${serviceLabel} visit details`}
                    style={{
                      backgroundColor:
                        item.type === "task"
                          ? "#64748b"
                          : (isDark ? colors.primary : PRIMARY),
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 11,
                        fontFamily: "Outfit_800ExtraBold",
                      }}
                    >
                      OPEN
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          />
        )}
      </View>
    </View>
  );
}
