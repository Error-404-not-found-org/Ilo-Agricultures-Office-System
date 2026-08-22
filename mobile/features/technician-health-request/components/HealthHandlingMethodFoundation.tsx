import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Building2,
  CalendarDays,
  Check,
  MessageSquareText,
} from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import type { HealthHandlingMethod } from "@/types";
import {
  formatHealthFollowUpDateKey,
  formatHealthFollowUpDateLabel,
  MAX_HEALTH_ADVICE_LENGTH,
  parseHealthFollowUpDateKey,
} from "../utils/healthAdviceWorkflow";
import {
  MAX_HEALTH_PICKUP_ITEM_LENGTH,
  MAX_HEALTH_PICKUP_TEXT_LENGTH,
  type HealthOfficePickupDraft,
} from "../utils/healthOfficePickupWorkflow";

const METHODS: {
  value: HealthHandlingMethod;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}[] = [
  {
    value: "advice",
    label: "Give Advice",
    description: "Send guidance without scheduling a visit",
    icon: MessageSquareText,
  },
  {
    value: "office_pickup",
    label: "Office Pickup",
    description: "Confirm an item is available at the office",
    icon: Building2,
  },
  {
    value: "farm_visit",
    label: "Schedule Farm Visit",
    description: "Schedule a date and service period",
    icon: CalendarDays,
  },
];

export interface AdviceResponseValues {
  adviceForFarmer: string;
  followUpDate: string;
  internalNote: string;
}

export type OfficePickupResponseValues = HealthOfficePickupDraft;

interface HealthHandlingMethodSelectorProps {
  value: HealthHandlingMethod | null;
  onChange: (method: HealthHandlingMethod) => void;
  disabled?: boolean;
  disabledMethods?: Partial<Record<HealthHandlingMethod, boolean>>;
}

export function HealthHandlingMethodSelector({
  value,
  onChange,
  disabled = false,
  disabledMethods,
}: HealthHandlingMethodSelectorProps) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text textRole="title" style={{ color: colors.textPrimary }}>
          How will you handle this request?
        </Text>
        <Text
          textRole="body"
          style={{ color: colors.textSecondary, marginTop: 3 }}
        >
          Choose one response method.
        </Text>
      </View>
      {METHODS.map((method) => {
        const selected = value === method.value;
        const Icon = method.icon;
        const methodDisabled =
          disabled || disabledMethods?.[method.value] === true;
        return (
          <TouchableOpacity
            key={method.value}
            accessibilityRole="radio"
            accessibilityLabel={method.label}
            accessibilityState={{ selected, disabled: methodDisabled }}
            disabled={methodDisabled}
            activeOpacity={0.75}
            onPress={() => onChange(method.value)}
            style={{
              minHeight: 64,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected
                ? colors.successContainer
                : methodDisabled
                  ? colors.surfaceSubtle
                  : colors.card,
              opacity: methodDisabled ? 0.72 : 1,
            }}
          >
            <Icon size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
                {method.label}
              </Text>
              <Text
                textRole="caption"
                style={{ color: colors.textSecondary, marginTop: 2 }}
              >
                {method.description}
              </Text>
            </View>
            {selected ? <Check size={18} color={colors.primary} /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FollowUpDateField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pendingFollowUpDate, setPendingFollowUpDate] = useState<Date | null>(
    null,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedFollowUpDate = parseHealthFollowUpDateKey(value);
  const pickerDate =
    parsedFollowUpDate && parsedFollowUpDate >= today
      ? parsedFollowUpDate
      : today;
  const followUpDateLabel = formatHealthFollowUpDateLabel(value);

  return (
    <View style={{ gap: 6 }}>
      <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
        Follow-up date
      </Text>
      <Text textRole="caption" style={{ color: colors.textSecondary }}>
        Optional
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            followUpDateLabel
              ? `Change follow-up date, currently ${followUpDateLabel}`
              : "Choose an optional follow-up date"
          }
          disabled={disabled}
          onPress={() => {
            setPendingFollowUpDate(pickerDate);
            setShowDatePicker(true);
          }}
          activeOpacity={0.75}
          style={{
            minHeight: 48,
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: disabled ? 0.65 : 1,
          }}
        >
          <CalendarDays size={19} color={colors.primary} />
          <Text
            textRole="body"
            numberOfLines={1}
            style={{
              flex: 1,
              color: followUpDateLabel
                ? colors.textPrimary
                : colors.textSecondary,
            }}
          >
            {followUpDateLabel || "Choose a date"}
          </Text>
        </TouchableOpacity>
        {followUpDateLabel ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear follow-up date"
            disabled={disabled}
            onPress={() => {
              setShowDatePicker(false);
              setPendingFollowUpDate(null);
              onChange("");
            }}
            activeOpacity={0.75}
            style={{
              minHeight: 48,
              justifyContent: "center",
              paddingHorizontal: 10,
            }}
          >
            <Text textRole="label" style={{ color: colors.primary }}>
              Clear
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {showDatePicker ? (
        <View>
          <DateTimePicker
            value={pendingFollowUpDate || pickerDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={today}
            onChange={(event, selectedDate) => {
              if (event.type === "dismissed" || !selectedDate) {
                setShowDatePicker(false);
                setPendingFollowUpDate(null);
                return;
              }
              if (Platform.OS === "ios") {
                setPendingFollowUpDate(selectedDate);
                return;
              }
              setShowDatePicker(false);
              setPendingFollowUpDate(null);
              onChange(formatHealthFollowUpDateKey(selectedDate));
            }}
          />
          {Platform.OS === "ios" ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Cancel follow-up date selection"
                onPress={() => {
                  setShowDatePicker(false);
                  setPendingFollowUpDate(null);
                }}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                }}
              >
                <Text textRole="label" style={{ color: colors.textSecondary }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Confirm follow-up date"
                onPress={() => {
                  const selectedDate = pendingFollowUpDate || pickerDate;
                  setShowDatePicker(false);
                  setPendingFollowUpDate(null);
                  onChange(formatHealthFollowUpDateKey(selectedDate));
                }}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                }}
              >
                <Text textRole="label" style={{ color: colors.primary }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function AdviceResponseForm({
  values,
  onChange,
  error,
  disabled = false,
}: {
  values: AdviceResponseValues;
  onChange: (values: AdviceResponseValues) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 16 }}>
      <FoundationField
        label="Advice for Farmer"
        helper="Required · Farmer will see this."
        value={values.adviceForFarmer}
        onChangeText={(adviceForFarmer) =>
          onChange({ ...values, adviceForFarmer })
        }
        multiline
        maxLength={MAX_HEALTH_ADVICE_LENGTH}
        footer={`${values.adviceForFarmer.length.toLocaleString()} / ${MAX_HEALTH_ADVICE_LENGTH.toLocaleString()}`}
        error={error}
        disabled={disabled}
      />
      <FollowUpDateField
        value={values.followUpDate}
        onChange={(followUpDate) => onChange({ ...values, followUpDate })}
        disabled={disabled}
      />
      <FoundationField
        label="Internal Note"
        helper="Optional · Only technicians and administrators can see this."
        value={values.internalNote}
        onChangeText={(internalNote) => onChange({ ...values, internalNote })}
        multiline
        internal
        disabled={disabled}
      />
    </View>
  );
}

export function OfficePickupResponseForm({
  values,
  onChange,
  error,
  disabled = false,
}: {
  values: OfficePickupResponseValues;
  onChange: (values: OfficePickupResponseValues) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 16 }}>
      {error ? (
        <View accessibilityRole="alert">
          <Text textRole="caption" style={{ color: colors.error }}>
            {error}
          </Text>
        </View>
      ) : null}
      <FoundationField
        label="Item available for pickup"
        helper="Required"
        placeholder="Dewormer, medicine, vaccine, supplements, etc."
        value={values.item}
        maxLength={MAX_HEALTH_PICKUP_ITEM_LENGTH}
        onChangeText={(item) => onChange({ ...values, item })}
        disabled={disabled}
      />
      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityLabel="I confirm this item is available for office pickup"
        accessibilityState={{ checked: values.availabilityConfirmed }}
        disabled={disabled}
        onPress={() =>
          onChange({
            ...values,
            availabilityConfirmed: !values.availabilityConfirmed,
          })
        }
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: disabled ? 0.65 : 1,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            borderWidth: 1,
            borderColor: values.availabilityConfirmed
              ? colors.primary
              : colors.textMuted,
            backgroundColor: values.availabilityConfirmed
              ? colors.primary
              : colors.card,
          }}
        >
          {values.availabilityConfirmed ? (
            <Check size={15} color={colors.onPrimary} />
          ) : null}
        </View>
        <Text textRole="body" style={{ flex: 1, color: colors.textPrimary }}>
          I confirm this item is available for office pickup
        </Text>
      </TouchableOpacity>
      <FoundationField
        label="Pickup instructions"
        helper="Required"
        placeholder="Available at the Municipal Agriculture Office. Please visit during office hours."
        value={values.pickupInstructions}
        maxLength={MAX_HEALTH_PICKUP_TEXT_LENGTH}
        onChangeText={(pickupInstructions) =>
          onChange({ ...values, pickupInstructions })
        }
        multiline
        disabled={disabled}
      />
      <FoundationField
        label="Message for Farmer"
        helper="Optional · This will be visible to the farmer."
        placeholder="You may collect the dewormer from our office."
        value={values.farmerMessage}
        maxLength={MAX_HEALTH_PICKUP_TEXT_LENGTH}
        onChangeText={(farmerMessage) => onChange({ ...values, farmerMessage })}
        multiline
        disabled={disabled}
      />
      <FoundationField
        label="Dosage / Use instructions"
        helper="Optional"
        value={values.dosageInstructions}
        maxLength={MAX_HEALTH_PICKUP_TEXT_LENGTH}
        onChangeText={(dosageInstructions) =>
          onChange({ ...values, dosageInstructions })
        }
        multiline
        disabled={disabled}
      />
      <FoundationField
        label="Withdrawal guidance"
        helper="Optional"
        value={values.withdrawalGuidance}
        maxLength={MAX_HEALTH_PICKUP_TEXT_LENGTH}
        onChangeText={(withdrawalGuidance) =>
          onChange({ ...values, withdrawalGuidance })
        }
        multiline
        disabled={disabled}
      />
      <FollowUpDateField
        value={values.followUpDate}
        onChange={(followUpDate) => onChange({ ...values, followUpDate })}
        disabled={disabled}
      />
      <FoundationField
        label="Internal Note"
        helper="Optional · Only visible to technicians and administrators."
        value={values.internalNote}
        maxLength={MAX_HEALTH_PICKUP_TEXT_LENGTH}
        onChangeText={(internalNote) => onChange({ ...values, internalNote })}
        multiline
        internal
        disabled={disabled}
      />
    </View>
  );
}

export function FarmVisitAction({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={{
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: colors.primary,
        opacity: disabled || loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text textRole="bodyStrong" style={{ color: colors.onPrimary }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function FoundationField({
  label,
  helper,
  value,
  placeholder,
  multiline = false,
  internal = false,
  maxLength,
  footer,
  error,
  disabled = false,
  onChangeText,
}: {
  label: string;
  helper?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  internal?: boolean;
  maxLength?: number;
  footer?: string;
  error?: string | null;
  disabled?: boolean;
  onChangeText: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
        {label}
      </Text>
      {helper ? (
        <Text textRole="caption" style={{ color: colors.textSecondary }}>
          {helper}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 96 : 48,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.border,
          backgroundColor: internal ? colors.surfaceSubtle : colors.card,
          color: colors.textPrimary,
          fontFamily: "Outfit_400Regular",
          fontSize: 14,
          lineHeight: 20,
          opacity: disabled ? 0.65 : 1,
        }}
      />
      {error ? (
        <Text textRole="caption" style={{ color: colors.error }}>
          {error}
        </Text>
      ) : footer ? (
        <Text
          textRole="caption"
          style={{ color: colors.textMuted, textAlign: "right" }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}
