import React from "react";
import { View, Text, TextInput } from "react-native";
import { Search } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { SelectDropdown } from "@/components/shared";

interface RecordFiltersProps {
  recordSearch: string;
  setRecordSearch: (val: string) => void;
  recordPeriod: "all" | "30" | "90";
  setRecordPeriod: (val: "all" | "30" | "90") => void;
}

const RecordFilters = ({
  recordSearch,
  setRecordSearch,
  recordPeriod,
  setRecordPeriod,
}: RecordFiltersProps) => {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 20 }}>
      <View
        style={{
          height: 54,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 16,
          backgroundColor: colors.card,
          marginBottom: 12,
        }}
      >
        <Search size={20} color={colors.textMuted} />
        <TextInput
          value={recordSearch}
          onChangeText={setRecordSearch}
          placeholder="Search animal tag, breed, or record"
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            marginLeft: 9,
            color: colors.textPrimary,
            fontFamily: "Outfit_500Medium",
            fontSize: 15,
          }}
          returnKeyType="search"
          accessibilityLabel="Search records"
        />
      </View>
      <View>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: "Outfit_700Bold",
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          Date range
        </Text>
        <SelectDropdown
          label="Choose a date range"
          options={[
            { value: "all", label: "Any date" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]}
          value={recordPeriod}
          onChange={(value) => setRecordPeriod(value as typeof recordPeriod)}
        />
      </View>
    </View>
  );
};

export default RecordFilters;
