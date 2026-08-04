import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Clock3, MapPin, Phone, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import type {
  RequestItem,
  VisitPeriod,
} from "../types/technicianRequests.types";
import { formatLocalCalendarDate } from "../utils/aiWorkflow";

interface AIRequestModalProps {
  request: RequestItem | null;
  visible: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (
    workflowId: string,
    payload: { scheduledDate: string; visitPeriod: VisitPeriod },
  ) => Promise<void>;
}

const startOfToday = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (date: Date, days: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

export function AIRequestModal({
  request,
  visible,
  isSubmitting,
  onClose,
  onConfirm,
}: AIRequestModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(startOfToday);
  const [dateChoice, setDateChoice] = useState<"today" | "tomorrow" | "custom">(
    "today",
  );
  const [visitPeriod, setVisitPeriod] = useState<VisitPeriod | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setSelectedDate(startOfToday());
    setDateChoice("today");
    setVisitPeriod(null);
    setShowDatePicker(false);
    submittingRef.current = false;
  }, [request?.workflowId, visible]);

  if (!request) return null;

  const workflowId = request.workflowId;
  const farmerName = request.farmerDetails?.name || request.farmer;
  const farmerPhone =
    request.farmerDetails?.phone || request.phone || request.farmerPhone;
  const location =
    request.farmerDetails?.location ||
    request.locationLabel ||
    request.location ||
    "Location not provided";
  const submittedAt = request.requestSubmissionDate || request.createdAt;
  const heatSigns = request.heatSigns || request.raw?.heatSigns || [];
  const attachments = request.attachments?.urls || [];
  const canSchedule =
    request.workflowType === "AI" &&
    request.allowedAction === "CLAIM_AND_SCHEDULE" &&
    Boolean(workflowId);

  const selectRelativeDate = (choice: "today" | "tomorrow") => {
    setDateChoice(choice);
    setSelectedDate(addDays(startOfToday(), choice === "tomorrow" ? 1 : 0));
  };


  const confirmSchedule = async () => {
    if (
      submittingRef.current ||
      isSubmitting ||
      !workflowId ||
      !visitPeriod ||
      !canSchedule
    ) {
      return;
    }
    submittingRef.current = true;
    try {
      await onConfirm(workflowId, {
        scheduledDate: formatLocalCalendarDate(selectedDate),
        visitPeriod,
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const cardStyle = {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
  } as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      navigationBarTranslucent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            minHeight: 64,
            paddingHorizontal: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{ color: colors.textPrimary, fontSize: 18 }}
              variant="extrabold"
            >
              AI Service Request
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {request.actionLabel || "Artificial Insemination"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Close AI request"
            style={{ padding: 10 }}
          >
            <X size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 18,
            paddingBottom: 36,
            gap: 14,
          }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={cardStyle}>
            <Text
              style={{ color: colors.textPrimary, fontSize: 16 }}
              variant="bold"
            >
              {farmerName}
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 3 }}>
              {request.animal || "Animal not provided"}
              {request.earTag ? ` · ${request.earTag}` : ""}
            </Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              <SummaryRow
                icon={Phone}
                text={farmerPhone || "Phone not provided"}
              />
              <SummaryRow icon={MapPin} text={location} />
              <SummaryRow
                icon={CalendarDays}
                text={`Submitted ${new Date(submittedAt).toLocaleDateString(
                  "en-PH",
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  },
                )}`}
              />
            </View>
          </View>


              <View style={cardStyle}>
                <Text
                  style={{ color: colors.textMuted, fontSize: 11 }}
                  variant="bold"
                >
                  HEAT SIGNS
                </Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    marginTop: 6,
                    lineHeight: 20,
                  }}
                >
                  {heatSigns.length > 0
                    ? heatSigns.join(", ")
                    : "No heat signs submitted."}
                </Text>
              </View>

              <View style={cardStyle}>
                <Text
                  style={{ color: colors.textMuted, fontSize: 11 }}
                  variant="bold"
                >
                  ATTACHMENTS (
                  {request.attachments?.count || attachments.length})
                </Text>
                {attachments.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 10 }}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {attachments.map((uri, index) => (
                      <Image
                        key={`${uri}-${index}`}
                        source={{ uri }}
                        style={{ width: 150, height: 120, borderRadius: 12 }}
                        resizeMode="cover"
                        accessibilityLabel={`AI request attachment ${index + 1}`}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
                    No attachments submitted.
                  </Text>
                )}
              </View>

              <View style={cardStyle}>
                <Text
                  style={{ color: colors.textMuted, fontSize: 11 }}
                  variant="bold"
                >
                  STATUS
                </Text>
                <Text
                  style={{ color: colors.textPrimary, marginTop: 6 }}
                  variant="bold"
                >
                  {request.status}
                </Text>
              </View>

              {canSchedule ? (
                <>
              <View style={cardStyle}>
                <Text
                  style={{ color: colors.textPrimary, marginBottom: 10 }}
                  variant="bold"
                >
                  Visit date
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["today", "tomorrow", "custom"] as const).map((choice) => (
                    <TouchableOpacity
                      key={choice}
                      onPress={() => {
                        if (choice === "custom") {
                          setDateChoice("custom");
                          setShowDatePicker(true);
                        } else {
                          selectRelativeDate(choice);
                        }
                      }}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor:
                          dateChoice === choice
                            ? colors.primary
                            : colors.border,
                        backgroundColor:
                          dateChoice === choice
                            ? isDark
                              ? "rgba(16,185,129,0.15)"
                              : colors.tint
                            : colors.card,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            dateChoice === choice
                              ? colors.primary
                              : colors.textSecondary,
                          fontSize: 12,
                        }}
                        variant="bold"
                      >
                        {choice === "today"
                          ? "Today"
                          : choice === "tomorrow"
                            ? "Tomorrow"
                            : "Custom"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={{
                    marginTop: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CalendarDays size={17} color={colors.primary} />
                  <Text style={{ color: colors.textPrimary }} variant="bold">
                    {selectedDate.toLocaleDateString("en-PH", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>

              <View style={cardStyle}>
                <Text
                  style={{ color: colors.textPrimary, marginBottom: 10 }}
                  variant="bold"
                >
                  Visit period
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {(["morning", "afternoon"] as const).map((period) => (
                    <TouchableOpacity
                      key={period}
                      onPress={() => setVisitPeriod(period)}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        borderRadius: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        borderWidth: 1,
                        borderColor:
                          visitPeriod === period
                            ? colors.primary
                            : colors.border,
                        backgroundColor:
                          visitPeriod === period
                            ? isDark
                              ? "rgba(16,185,129,0.15)"
                              : colors.tint
                            : colors.card,
                      }}
                    >
                      <Clock3 size={16} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.textPrimary,
                          textTransform: "capitalize",
                        }}
                        variant="bold"
                      >
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={onClose}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.textPrimary }} variant="bold">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmSchedule}
                  disabled={isSubmitting || !visitPeriod || !workflowId}
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary,
                    opacity:
                      isSubmitting || !visitPeriod || !workflowId ? 0.55 : 1,
                  }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text
                      style={{ color: colors.onPrimary, fontSize: 15 }}
                      variant="bold"
                    >
                      Confirm Schedule
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </ScrollView>

        {showDatePicker ? (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            minimumDate={startOfToday()}
            onChange={(_, value) => {
              setShowDatePicker(false);
              if (value) {
                value.setHours(0, 0, 0, 0);
                setSelectedDate(value);
                setDateChoice("custom");
              }
            }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function SummaryRow({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<any>;
  text: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Icon size={15} color={colors.textMuted} />
      <Text style={{ color: colors.textSecondary, flex: 1 }}>{text}</Text>
    </View>
  );
}
