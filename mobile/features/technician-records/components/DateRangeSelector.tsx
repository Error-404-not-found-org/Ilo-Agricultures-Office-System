import React from "react";
import { Modal, Pressable, StyleSheet, View, TouchableOpacity } from "react-native";
import { Calendar } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface DateRangeSelectorProps {
  visible: boolean;
  startDate: Date | null;
  endDate: Date | null;
  onClose: () => void;
  onSelectStart: (date: Date) => void;
  onSelectEnd: (date: Date) => void;
  onClear: () => void;
  showStartPicker: boolean;
  showEndPicker: boolean;
  setShowStartPicker: (val: boolean) => void;
  setShowEndPicker: (val: boolean) => void;
}

export function DateRangeSelector({
  visible,
  startDate,
  endDate,
  onClose,
  onSelectStart,
  onSelectEnd,
  onClear,
  showStartPicker,
  showEndPicker,
  setShowStartPicker,
  setShowEndPicker,
}: DateRangeSelectorProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
          backgroundColor: colors.modalBackdrop,
        }}
      >
        <Pressable
          accessible={false}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 24,
            borderRadius: 16,
            backgroundColor: colors.card,
            shadowColor: "#0f172a",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Text textRole="title" style={{ color: colors.textPrimary }}>
            Filter by date range
          </Text>

          <View style={{ gap: 16, marginVertical: 20 }}>
            <View>
              <Text textRole="label" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                Start date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSubtle,
                }}
              >
                <Text textRole="body" style={{ color: colors.textPrimary }}>
                  {startDate ? startDate.toLocaleDateString() : "Select start date"}
                </Text>
                <Calendar size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View>
              <Text textRole="label" style={{ color: colors.textSecondary, marginBottom: 8 }}>
                End date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={{
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceSubtle,
                }}
              >
                <Text textRole="body" style={{ color: colors.textPrimary }}>
                  {endDate ? endDate.toLocaleDateString() : "Select end date"}
                </Text>
                <Calendar size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="default"
              onChange={(_event, date) => {
                setShowStartPicker(false);
                if (date) onSelectStart(date);
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate || new Date()}
              mode="date"
              display="default"
              onChange={(_event, date) => {
                setShowEndPicker(false);
                if (date) onSelectEnd(date);
              }}
            />
          )}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Button
              variant="outline"
              className="flex-1"
              label="Clear filters"
              onPress={() => {
                onClear();
                onClose();
              }}
            />
            <Button
              variant="default"
              className="flex-1"
              label="Apply range"
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
