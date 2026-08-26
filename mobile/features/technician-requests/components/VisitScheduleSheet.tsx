import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Clock3,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { formatLocalCalendarDate } from "../utils/aiWorkflow";
import type { VisitPeriod } from "../types/technicianRequests.types";
import {
  getVisitSchedulePeriodAvailability,
  type VisitScheduleTiming,
} from "../utils/visitScheduleAvailability";

export interface VisitSchedulePayload {
  scheduledDate: string;
  visitPeriod: VisitPeriod;
  samePeriodConfirmed?: boolean;
}

export interface VisitPeriodAvailability {
  disabled: boolean;
  requiresConfirmation?: boolean;
  supportingText?: string;
  timing?: VisitScheduleTiming;
}

interface VisitScheduleSheetProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting: boolean;
  errorMessage?: string | null;
  initialDate?: string | null;
  initialVisitPeriod?: VisitPeriod | null;
  getPeriodAvailability?: (
    date: Date,
    period: VisitPeriod,
    now?: Date,
  ) => VisitPeriodAvailability;
  onClose: () => void;
  onErrorClear?: () => void;
  onConfirm: (payload: VisitSchedulePayload) => Promise<void>;
}

const startOfToday = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const parseInitialDate = (value?: string | null) => {
  if (!value) return startOfToday();
  const dateKey = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = dateKey
    ? new Date(Number(dateKey[1]), Number(dateKey[2]) - 1, Number(dateKey[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return startOfToday();
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export function VisitScheduleSheet({
  visible,
  title,
  description,
  confirmLabel,
  isSubmitting,
  errorMessage,
  initialDate,
  initialVisitPeriod,
  getPeriodAvailability = getVisitSchedulePeriodAvailability,
  onClose,
  onErrorClear,
  onConfirm,
}: VisitScheduleSheetProps) {
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(startOfToday);
  const [dateChoice, setDateChoice] = useState<"today" | "tomorrow" | "custom">(
    "today",
  );
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrentPeriodWarning, setShowCurrentPeriodWarning] =
    useState(false);
  const [availabilityNow, setAvailabilityNow] = useState(() => new Date());
  const submitLock = useRef(false);

  useEffect(() => {
    if (!visible) return;

    const refreshAvailability = () => setAvailabilityNow(new Date());
    refreshAvailability();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const millisecondsToNextMinute = 60_000 - (Date.now() % 60_000) + 25;
    const timeoutId = setTimeout(() => {
      refreshAvailability();
      intervalId = setInterval(refreshAvailability, 60_000);
    }, millisecondsToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || !visitPeriod) return;
    const availability = getPeriodAvailability(
      selectedDate,
      visitPeriod,
      availabilityNow,
    );
    if (!availability.disabled) return;

    setVisitPeriod(null);
    setShowCurrentPeriodWarning(false);
  }, [
    availabilityNow,
    getPeriodAvailability,
    selectedDate,
    visible,
    visitPeriod,
  ]);

  useEffect(() => {
    if (!visible) return;
    const nextDate = parseInitialDate(initialDate);
    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    const nextKey = formatLocalCalendarDate(nextDate);
    const initialAvailability = initialVisitPeriod
      ? getPeriodAvailability(nextDate, initialVisitPeriod, new Date())
      : null;
    setSelectedDate(nextDate);
    setDateChoice(
      nextKey === formatLocalCalendarDate(today)
        ? "today"
        : nextKey === formatLocalCalendarDate(tomorrow)
          ? "tomorrow"
          : "custom",
    );
    setVisitPeriod(
      initialAvailability?.disabled ? null : initialVisitPeriod || null,
    );
    setShowDatePicker(false);
    setShowCurrentPeriodWarning(false);
    submitLock.current = false;
  }, [getPeriodAvailability, initialDate, initialVisitPeriod, visible]);

  const closeSheet = () => {
    onErrorClear?.();
    onClose();
  };

  const selectDate = (
    nextDate: Date,
    choice: "today" | "tomorrow" | "custom",
  ) => {
    nextDate.setHours(0, 0, 0, 0);
    setSelectedDate(nextDate);
    setDateChoice(choice);
    setShowCurrentPeriodWarning(false);
    onErrorClear?.();
    if (
      visitPeriod &&
      getPeriodAvailability(nextDate, visitPeriod, new Date()).disabled
    ) {
      setVisitPeriod(null);
    }
  };

  const submitSchedule = async (samePeriodConfirmed = false) => {
    if (!visitPeriod || submitLock.current) return;
    onErrorClear?.();
    const availability = getPeriodAvailability(
      selectedDate,
      visitPeriod,
      new Date(),
    );
    if (availability.disabled) return;
    if (availability.requiresConfirmation && !samePeriodConfirmed) {
      setShowCurrentPeriodWarning(true);
      return;
    }
    submitLock.current = true;
    try {
      await onConfirm({
        scheduledDate: formatLocalCalendarDate(selectedDate),
        visitPeriod,
        ...(samePeriodConfirmed ? { samePeriodConfirmed: true } : {}),
      });
    } finally {
      submitLock.current = false;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={isSubmitting ? undefined : closeSheet}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <Pressable
          accessible={false}
          disabled={isSubmitting}
          onPress={closeSheet}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView
          edges={["bottom"]}
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: colors.card,
            paddingHorizontal: 16,
            paddingTop: 20,
          }}
        >
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            {title}
          </Text>
          <Text
            textRole="body"
            style={{ color: colors.textSecondary, marginTop: 4 }}
          >
            {description}
          </Text>

          <View style={{ marginTop: 20 }}>
            <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
              Visit Date
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {(["today", "tomorrow", "custom"] as const).map((choice) => {
                const selected = dateChoice === choice;
                const label =
                  choice === "today"
                    ? "Today"
                    : choice === "tomorrow"
                      ? "Tomorrow"
                      : "Choose date";
                return (
                  <TouchableOpacity
                    key={choice}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    disabled={isSubmitting}
                    onPress={() => {
                      if (choice === "custom") {
                        setDateChoice("custom");
                        setShowDatePicker(true);
                        onErrorClear?.();
                        return;
                      }
                      const today = startOfToday();
                      selectDate(
                        choice === "today" ? today : addDays(today, 1),
                        choice,
                      );
                    }}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? isDark
                          ? colors.tint
                          : colors.successContainer
                        : colors.card,
                    }}
                  >
                    <Text
                      textRole="label"
                      style={{
                        color: selected ? colors.primary : colors.textSecondary,
                        textAlign: "center",
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
              }}
            >
              <CalendarDays size={18} color={colors.primary} />
              <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                {selectedDate.toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 20 }}>
            <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
              Visit Period
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              {(["morning", "afternoon"] as const).map((period) => {
                const selected = visitPeriod === period;
                const label = period === "morning" ? "Morning" : "Afternoon";
                const availability = getPeriodAvailability(
                  selectedDate,
                  period,
                  availabilityNow,
                );
                return (
                  <TouchableOpacity
                    key={period}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected,
                      disabled: availability.disabled,
                    }}
                    accessibilityLabel={label}
                    disabled={isSubmitting || availability.disabled}
                    onPress={() => {
                      setVisitPeriod(period);
                      setShowCurrentPeriodWarning(false);
                      onErrorClear?.();
                    }}
                    style={{
                      flex: 1,
                      minHeight: availability.supportingText ? 58 : 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? isDark
                          ? colors.tint
                          : colors.successContainer
                        : availability.disabled
                          ? colors.surfaceSubtle
                          : colors.card,
                      opacity: availability.disabled ? 0.58 : 1,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Clock3
                        size={17}
                        color={
                          availability.disabled
                            ? colors.textMuted
                            : colors.primary
                        }
                      />
                      <Text
                        textRole="bodyStrong"
                        style={{
                          color: availability.disabled
                            ? colors.textMuted
                            : selected
                              ? colors.primary
                              : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                    {availability.supportingText ? (
                      <Text
                        textRole="caption"
                        style={{
                          width: "100%",
                          marginTop: 2,
                          paddingHorizontal: 8,
                          color: colors.textMuted,
                          textAlign: "center",
                        }}
                      >
                        {availability.supportingText}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {showCurrentPeriodWarning && visitPeriod ? (
            <View
              accessibilityRole="alert"
              style={{
                marginTop: 20,
                padding: 14,
                borderRadius: 12,
                backgroundColor: colors.warningContainer,
                gap: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <AlertTriangle size={20} color={colors.warningForeground} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    textRole="bodyStrong"
                    style={{ color: colors.warningForeground }}
                  >
                    Schedule for the current period?
                  </Text>
                  <Text
                    textRole="caption"
                    style={{ color: colors.warningForeground, lineHeight: 18 }}
                  >
                    It is already Today{" "}
                    {visitPeriod === "morning" ? "Morning" : "Afternoon"}. Make
                    sure you still have enough time to travel to the farm and
                    provide the service.
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Go back and change the visit period"
                  disabled={isSubmitting}
                  onPress={() => setShowCurrentPeriodWarning(false)}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.warningForeground,
                  }}
                >
                  <Text
                    textRole="bodyStrong"
                    style={{ color: colors.warningForeground }}
                  >
                    Go Back
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Schedule during the current period anyway"
                  disabled={isSubmitting}
                  onPress={() => void submitSchedule(true)}
                  style={{
                    flex: 1.35,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    backgroundColor: colors.warningForeground,
                  }}
                >
                  <Text textRole="bodyStrong" style={{ color: colors.card }}>
                    Schedule Anyway
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {errorMessage ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                marginTop: 20,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.errorBorder,
                backgroundColor: colors.errorContainer,
              }}
            >
              <AlertCircle size={19} color={colors.errorForeground} />
              <Text
                textRole="body"
                style={{ flex: 1, color: colors.errorForeground }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {!showCurrentPeriodWarning ? (
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                marginTop: 24,
                marginBottom: 8,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                disabled={isSubmitting}
                onPress={closeSheet}
                style={{
                  flex: 1,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  textRole="bodyStrong"
                  style={{ color: colors.textPrimary }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                disabled={isSubmitting || !visitPeriod}
                onPress={() => void submitSchedule(false)}
                style={{
                  flex: 1.35,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  opacity: isSubmitting || !visitPeriod ? 0.55 : 1,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text
                    textRole="bodyStrong"
                    style={{ color: colors.onPrimary }}
                  >
                    {confirmLabel}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ height: 8 }} />
          )}
        </SafeAreaView>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            minimumDate={startOfToday()}
            onChange={(_, value) => {
              setShowDatePicker(false);
              if (value) selectDate(value, "custom");
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
