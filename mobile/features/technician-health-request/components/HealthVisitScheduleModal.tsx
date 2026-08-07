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
import { CalendarDays, Clock3 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { formatLocalCalendarDate } from "@/features/technician-requests/utils/aiWorkflow";
import type { VisitPeriod } from "@/features/technician-requests/types/technicianRequests.types";

export interface HealthVisitSchedulePayload {
  scheduledDate: string;
  visitPeriod: VisitPeriod;
}

interface HealthVisitScheduleModalProps {
  visible: boolean;
  mode: "accept" | "schedule" | "reschedule";
  isSubmitting: boolean;
  initialDate?: string | null;
  initialVisitPeriod?: VisitPeriod | null;
  onClose: () => void;
  onConfirm: (payload: HealthVisitSchedulePayload) => Promise<void>;
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return startOfToday();
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export function HealthVisitScheduleModal({
  visible,
  mode,
  isSubmitting,
  initialDate,
  initialVisitPeriod,
  onClose,
  onConfirm,
}: HealthVisitScheduleModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(startOfToday);
  const [dateChoice, setDateChoice] = useState<
    "today" | "tomorrow" | "custom"
  >("today");
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    const nextDate = parseInitialDate(initialDate);
    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    const nextKey = formatLocalCalendarDate(nextDate);
    setSelectedDate(nextDate);
    setDateChoice(
      nextKey === formatLocalCalendarDate(today)
        ? "today"
        : nextKey === formatLocalCalendarDate(tomorrow)
          ? "tomorrow"
          : "custom",
    );
    setVisitPeriod(initialVisitPeriod || null);
    setShowDatePicker(false);
    submitLock.current = false;
  }, [initialDate, initialVisitPeriod, visible]);

  const confirmLabel =
    mode === "accept"
      ? "Accept & Schedule"
      : mode === "reschedule"
        ? "Save New Visit"
        : "Schedule Visit";

  const selectRelativeDate = (choice: "today" | "tomorrow") => {
    const today = startOfToday();
    setDateChoice(choice);
    setSelectedDate(choice === "today" ? today : addDays(today, 1));
  };

  const handleConfirm = async () => {
    if (!visitPeriod || submitLock.current) return;
    submitLock.current = true;
    try {
      await onConfirm({
        scheduledDate: formatLocalCalendarDate(selectedDate),
        visitPeriod,
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
      onRequestClose={isSubmitting ? undefined : onClose}
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
          onPress={onClose}
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
            Set Health Visit
          </Text>
          <Text
            textRole="body"
            style={{ color: colors.textSecondary, marginTop: 4 }}
          >
            Choose a visit day and service period. The farmer will see the
            confirmed window, not an exact appointment time.
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
                    onPress={() => {
                      if (choice === "custom") {
                        setDateChoice("custom");
                        setShowDatePicker(true);
                        return;
                      }
                      selectRelativeDate(choice);
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
                        color: selected
                          ? colors.primary
                          : colors.textSecondary,
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
                return (
                  <TouchableOpacity
                    key={period}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    onPress={() => setVisitPeriod(period)}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
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
                    <Clock3 size={17} color={colors.primary} />
                    <Text
                      textRole="bodyStrong"
                      style={{
                        color: selected
                          ? colors.primary
                          : colors.textSecondary,
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View
            style={{ flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 8 }}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={isSubmitting}
              onPress={onClose}
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
              <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              disabled={isSubmitting || !visitPeriod}
              onPress={handleConfirm}
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
                <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
                  {confirmLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            minimumDate={startOfToday()}
            onChange={(_, value) => {
              setShowDatePicker(false);
              if (!value) return;
              value.setHours(0, 0, 0, 0);
              setSelectedDate(value);
              setDateChoice("custom");
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
