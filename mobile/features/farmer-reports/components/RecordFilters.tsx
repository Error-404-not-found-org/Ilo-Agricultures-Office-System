import React from "react";
import { View, TextInput, ScrollView, TouchableOpacity, Text } from "react-native";
import { Search } from "lucide-react-native";
import { useTheme } from "@/lib/theme";

interface RecordFiltersProps {
  recordSearch: string;
  setRecordSearch: (val: string) => void;
  recordStatus: "all" | "open" | "completed" | "closed";
  setRecordStatus: (val: "all" | "open" | "completed" | "closed") => void;
  recordPeriod: "all" | "30" | "90";
  setRecordPeriod: (val: "all" | "30" | "90") => void;
}

const RecordFilters = ({
  recordSearch,
  setRecordSearch,
  recordStatus,
  setRecordStatus,
  recordPeriod,
  setRecordPeriod,
}: RecordFiltersProps) => {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 16 }}>
      <View
        style={{
          height: 46,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          backgroundColor: colors.card,
          marginBottom: 12,
        }}
      >
        <Search size={17} color={colors.textMuted} />
        <TextInput
          value={recordSearch}
          onChangeText={setRecordSearch}
          placeholder="Search animal, breed, or record..."
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            marginLeft: 9,
            color: colors.textPrimary,
            fontFamily: "Outfit_500Medium",
            fontSize: 13,
          }}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
      >
        {(
          [
            ["all", "Any status"],
            ["open", "Open"],
            ["completed", "Completed"],
            ["closed", "Closed"],
          ] as const
        ).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => setRecordStatus(value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor:
                recordStatus === value ? colors.tint : "transparent",
              borderWidth: 1,
              borderColor:
                recordStatus === value ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color:
                  recordStatus === value
                    ? colors.primary
                    : colors.textMuted,
                fontFamily: "Outfit_700Bold",
                fontSize: 10,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        {(
          [
            ["all", "Any date"],
            ["30", "30 days"],
            ["90", "90 days"],
          ] as const
        ).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => setRecordPeriod(value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 8,
              backgroundColor:
                recordPeriod === value ? colors.tint : "transparent",
              borderWidth: 1,
              borderColor:
                recordPeriod === value ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color:
                  recordPeriod === value
                    ? colors.primary
                    : colors.textMuted,
                fontFamily: "Outfit_700Bold",
                fontSize: 10,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default RecordFilters;
