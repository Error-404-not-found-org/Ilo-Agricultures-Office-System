import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { CalendarDays, Check, ChevronDown, Clock, X } from "lucide-react-native";
import { CATTLE_BREEDS } from "@/lib/constants";
import { useTheme } from "@/lib/theme";
import type {
  AIRecordingValues,
  EstrusType,
} from "../types/technicianAIRecording.types";

interface AIRecordingFieldsProps {
  values: AIRecordingValues;
  onDateChange: (value: Date) => void;
  onTimeChange: (value: Date) => void;
  onEstrusChange: (value: EstrusType) => void;
  onSireBreedChange: (value: string) => void;
  onSireCodeChange: (value: string) => void;
  onSemenDosesChange: (value: string) => void;
  onTechnicianNoteChange: (value: string) => void;
  disabled?: boolean;
}

const estrusOptions: EstrusType[] = ["Natural", "Synchronized", "Induced"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.textSecondary,
        fontFamily: "Outfit_700Bold",
        fontSize: 11,
        letterSpacing: 0.6,
        marginBottom: 7,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

export function AIRecordingFields({
  values,
  onDateChange,
  onTimeChange,
  onEstrusChange,
  onSireBreedChange,
  onSireCodeChange,
  onSemenDosesChange,
  onTechnicianNoteChange,
  disabled = false,
}: AIRecordingFieldsProps) {
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showBreedModal, setShowBreedModal] = useState(false);

  const inputStyle = {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    backgroundColor: colors.card,
    fontFamily: "Outfit_500Medium",
    fontSize: 14,
  } as const;

  const handleDatePicker = (
    _event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDatePicker(false);
    if (selectedDate) onDateChange(selectedDate);
  };

  const handleTimePicker = (
    _event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    setShowTimePicker(false);
    if (selectedTime) onTimeChange(selectedTime);
  };

  return (
    <>
      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Actual Insemination Date</FieldLabel>
            <TouchableOpacity
              disabled={disabled}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select actual insemination date"
              style={[
                inputStyle,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: disabled ? 0.55 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                }}
              >
                {values.inseminationDate.toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <CalendarDays size={17} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <FieldLabel>Actual Insemination Time</FieldLabel>
            <TouchableOpacity
              disabled={disabled}
              onPress={() => setShowTimePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select actual insemination time"
              style={[
                inputStyle,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: disabled ? 0.55 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: "Outfit_600SemiBold",
                  fontSize: 12,
                }}
              >
                {values.inseminationTime.toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
              <Clock size={17} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <FieldLabel>Estrus Type</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {estrusOptions.map((option) => {
              const selected = values.estrus === option;
              return (
                <TouchableOpacity
                  key={option}
                  disabled={disabled}
                  onPress={() => onEstrusChange(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  style={{
                    flex: 1,
                    minHeight: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.card,
                    opacity: disabled ? 0.55 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.onPrimary : colors.textSecondary,
                      fontFamily: "Outfit_700Bold",
                      fontSize: 11,
                    }}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!values.estrus ? (
            <Text
              style={{
                color: colors.textMuted,
                fontFamily: "Outfit_500Medium",
                fontSize: 11,
                marginTop: 7,
              }}
            >
              Select the estrus type observed for this insemination.
            </Text>
          ) : null}
        </View>

        <View>
          <FieldLabel>Sire Breed</FieldLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              editable={!disabled}
              value={values.sireBreed}
              onChangeText={onSireBreedChange}
              maxLength={100}
              placeholder="Enter sire breed"
              placeholderTextColor={colors.textMuted}
              style={[inputStyle, { flex: 1 }]}
            />
            <TouchableOpacity
              disabled={disabled}
              onPress={() => setShowBreedModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Browse sire breed suggestions"
              style={{
                width: 50,
                minHeight: 50,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.card,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <ChevronDown size={19} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <FieldLabel>Sire Code</FieldLabel>
          <TextInput
            editable={!disabled}
            value={values.sireCode}
            onChangeText={onSireCodeChange}
            maxLength={64}
            autoCapitalize="characters"
            placeholder="Enter the actual sire or semen code"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>

        <View>
          <FieldLabel>Semen Doses Used</FieldLabel>
          <TextInput
            editable={!disabled}
            value={values.semenDosesUsed}
            onChangeText={onSemenDosesChange}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
        </View>

        <View>
          <FieldLabel>Technician Note (Optional)</FieldLabel>
          <TextInput
            editable={!disabled}
            value={values.technicianNote}
            onChangeText={onTechnicianNoteChange}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            placeholder="Add relevant service observations"
            placeholderTextColor={colors.textMuted}
            style={[inputStyle, { minHeight: 112, paddingTop: 14 }]}
          />
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: "Outfit_500Medium",
              fontSize: 10,
              marginTop: 5,
              textAlign: "right",
            }}
          >
            {values.technicianNote.length}/2000
          </Text>
        </View>
      </View>

      <Modal
        visible={showBreedModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBreedModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: colors.modalBackdrop,
          }}
        >
          <View
            style={{
              maxHeight: "72%",
              padding: 20,
              paddingBottom: 36,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: "Outfit_800ExtraBold",
                    fontSize: 20,
                  }}
                >
                  Select Sire Breed
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: "Outfit_500Medium",
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  This does not fill or change the sire code.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowBreedModal(false)}
                accessibilityLabel="Close sire breed suggestions"
                style={{ padding: 10 }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={CATTLE_BREEDS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item === values.sireBreed;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onSireBreedChange(item);
                      setShowBreedModal(false);
                    }}
                    style={{
                      minHeight: 52,
                      paddingHorizontal: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: colors.textPrimary,
                        fontFamily: selected
                          ? "Outfit_700Bold"
                          : "Outfit_500Medium",
                        fontSize: 14,
                      }}
                    >
                      {item}
                    </Text>
                    {selected ? (
                      <Check size={19} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {showDatePicker ? (
        <DateTimePicker
          value={values.inseminationDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleDatePicker}
        />
      ) : null}

      {showTimePicker ? (
        <DateTimePicker
          value={values.inseminationTime}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={handleTimePicker}
        />
      ) : null}
    </>
  );
}
