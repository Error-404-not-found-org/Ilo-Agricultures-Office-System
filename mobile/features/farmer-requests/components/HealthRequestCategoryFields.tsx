import React from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Check, CircleAlert } from "lucide-react-native";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import {
  HEALTH_OBSERVED_SIGN_OPTIONS,
  type FarmerHealthAssistance,
  type FarmerHealthObservedSign,
} from "../utils/healthRequestInput";

const CATEGORY_COPY: Record<
  FarmerHealthAssistance,
  {
    optionsLabel?: string;
    descriptionLabel: string;
    placeholder: string;
    helper?: string;
  }
> = {
  health_concern: {
    optionsLabel: "What signs have you observed?",
    descriptionLabel: "Description",
    placeholder: "Tell the technician what you noticed.",
    helper: "Choose observations, not a diagnosis.",
  },
  medicine_request: {
    optionsLabel: "What signs have you observed? (Optional)",
    descriptionLabel: "Reason / Notes (Optional)",
    placeholder: "Tell the technician what the animal needs.",
  },
  preventive_care: {
    optionsLabel: "What signs have you observed? (Optional)",
    descriptionLabel: "Reason for request (Optional)",
    placeholder: "Add any useful details for the technician.",
  },
  other: {
    optionsLabel: "What signs have you observed? (Optional)",
    descriptionLabel: "Description",
    placeholder: "Tell the technician what help you need.",
  },
};

interface HealthRequestCategoryFieldsProps {
  category: FarmerHealthAssistance;
  selectedOptions: FarmerHealthObservedSign[];
  description: string;
  pregnancyConcern?: boolean;
  onToggleOption: (option: FarmerHealthObservedSign) => void;
  onDescriptionChange: (value: string) => void;
  onDescriptionFocus?: () => void;
}

export function HealthRequestCategoryFields({
  category,
  selectedOptions,
  description,
  pregnancyConcern = false,
  onToggleOption,
  onDescriptionChange,
  onDescriptionFocus,
}: HealthRequestCategoryFieldsProps) {
  const { colors } = useTheme();
  const copy = CATEGORY_COPY[category];
  const options = HEALTH_OBSERVED_SIGN_OPTIONS;

  return (
    <View style={{ gap: 12 }}>
      {pregnancyConcern ? (
        <View
          accessibilityRole="summary"
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceSubtle,
          }}
        >
          <CircleAlert
            size={18}
            color={colors.primary}
            style={{ marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
              Pregnancy-related health concern
            </Text>
            <Text
              textRole="body"
              style={{ color: colors.textSecondary, marginTop: 2 }}
            >
              This will be sent through the current Health request workflow.
            </Text>
          </View>
        </View>
      ) : null}

      {copy.optionsLabel ? (
        <View style={{ gap: 8 }}>
          <View>
            <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
              {copy.optionsLabel}
            </Text>
            {copy.helper ? (
              <Text
                textRole="caption"
                style={{ color: colors.textSecondary, marginTop: 2 }}
              >
                {copy.helper}
              </Text>
            ) : null}
          </View>

          {options.map((option) => {
            const selected = selectedOptions.includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                accessibilityRole="checkbox"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                activeOpacity={0.75}
                onPress={() => onToggleOption(option.value)}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? colors.successContainer
                    : colors.card,
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
                    borderColor: selected ? colors.primary : colors.textMuted,
                    backgroundColor: selected ? colors.primary : colors.card,
                  }}
                >
                  {selected ? (
                    <Check size={15} color={colors.onPrimary} />
                  ) : null}
                </View>
                <Text
                  textRole="body"
                  style={{ flex: 1, color: colors.textPrimary }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text textRole="bodyStrong" style={{ color: colors.textPrimary }}>
          {copy.descriptionLabel}
        </Text>
        <TextInput
          accessibilityLabel={copy.descriptionLabel}
          value={description}
          onChangeText={onDescriptionChange}
          onFocus={onDescriptionFocus}
          placeholder={copy.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            minHeight: 112,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            color: colors.textPrimary,
            fontFamily: "Outfit_400Regular",
            fontSize: 14,
            lineHeight: 20,
          }}
        />
      </View>
    </View>
  );
}
