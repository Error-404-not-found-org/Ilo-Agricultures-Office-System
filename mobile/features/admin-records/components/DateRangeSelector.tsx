import React from "react";
import { View, TouchableOpacity, Modal, Text } from "react-native";
import { X, Calendar } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import DateTimePicker from "@react-native-community/datetimepicker";

const PRIMARY = "#1e3a5f";

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
  const { colors, isDark } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            padding: 24,
            paddingBottom: 40,
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

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
              Filter by Date Range
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 16, marginBottom: 24 }}>
            {/* Start Date */}
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_800ExtraBold",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  marginBottom: 6,
                  marginLeft: 2,
                }}
              >
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  borderRadius: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_600SemiBold",
                    color: startDate ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {startDate
                    ? startDate.toLocaleDateString()
                    : "Select start date"}
                </Text>
                <Calendar size={18} color={isDark ? colors.primary : PRIMARY} />
              </TouchableOpacity>
            </View>

            {/* End Date */}
            <View>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_800ExtraBold",
                  color: colors.textSecondary,
                  textTransform: "uppercase",
                  marginBottom: 6,
                  marginLeft: 2,
                }}
              >
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  borderRadius: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "Outfit_600SemiBold",
                    color: endDate ? colors.textPrimary : colors.textMuted,
                  }}
                >
                  {endDate ? endDate.toLocaleDateString() : "Select end date"}
                </Text>
                <Calendar size={18} color={isDark ? colors.primary : PRIMARY} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker Triggers */}
          {showStartPicker && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="default"
              onChange={(e, date) => {
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
              onChange={(e, date) => {
                setShowEndPicker(false);
                if (date) onSelectEnd(date);
              }}
            />
          )}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                onClear();
                onClose();
              }}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                paddingVertical: 16,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 15,
                }}
              >
                Clear Filters
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: isDark ? colors.primary : PRIMARY,
                paddingVertical: 16,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "Outfit_800ExtraBold",
                  fontSize: 15,
                }}
              >
                Apply Range
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
