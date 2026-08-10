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
import { formatLocalCalendarDate } from "../utils/aiWorkflow";
import type { VisitPeriod } from "../types/technicianRequests.types";

export interface VisitSchedulePayload {
  scheduledDate: string;
  visitPeriod: VisitPeriod;
}

export interface VisitPeriodAvailability {
  disabled: boolean;
  supportingText?: string;
}

interface VisitScheduleSheetProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isSubmitting: boolean;
  initialDate?: string | null;
  initialVisitPeriod?: VisitPeriod | null;
  getPeriodAvailability?: (
    date: Date,
    period: VisitPeriod,
  ) => VisitPeriodAvailability;
  onClose: () => void;
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

const available = (): VisitPeriodAvailability => ({ disabled: false });

export function VisitScheduleSheet({
  visible,
  title,
  description,
  confirmLabel,
  isSubmitting,
  initialDate,
  initialVisitPeriod,
  getPeriodAvailability = available,
  onClose,
  onConfirm,
}: VisitScheduleSheetProps) {
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
    const initialAvailability = initialVisitPeriod
      ? getPeriodAvailability(nextDate, initialVisitPeriod)
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
    submitLock.current = false;
  }, [getPeriodAvailability, initialDate, initialVisitPeriod, visible]);

  const selectDate = (
    nextDate: Date,
    choice: "today" | "tomorrow" | "custom",
  ) => {
    nextDate.setHours(0, 0, 0, 0);
    setSelectedDate(nextDate);
    setDateChoice(choice);
    if (
      visitPeriod &&
      getPeriodAvailability(nextDate, visitPeriod).disabled
    ) {
      setVisitPeriod(null);
    }
  };

  const handleConfirm = async () => {
    if (!visitPeriod || submitLock.current) return;
    if (getPeriodAvailability(selectedDate, visitPeriod).disabled) return;
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
                const availability = getPeriodAvailability(
                  selectedDate,
                  period,
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
                    onPress={() => setVisitPeriod(period)}
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
                        style={{ color: colors.textMuted, marginTop: 2 }}
                      >
                        {availability.supportingText}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

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
              if (value) selectDate(value, "custom");
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
