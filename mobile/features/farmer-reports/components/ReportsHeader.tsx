import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Printer } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { AppPageHeader } from "@/components/AppPageHeader";

interface ReportsHeaderProps {
  onExport: () => void;
  children?: React.ReactNode;
}

const ReportsHeader = ({ onExport, children }: ReportsHeaderProps) => {
  const { colors } = useTheme();

  return (
    <View style={{ marginHorizontal: -24, marginBottom: 24 }}>
      <AppPageHeader
        title="Records"
        rightAction={
          <TouchableOpacity
            onPress={onExport}
            accessibilityRole="button"
            accessibilityLabel="Export records"
            activeOpacity={0.8}
            hitSlop={6}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.primary,
            }}
          >
            <Printer color={colors.onPrimary} size={14} />
            <Text style={{ color: colors.onPrimary, fontFamily: "Outfit_700Bold", fontSize: 11 }}>
              Export
            </Text>
          </TouchableOpacity>
        }
      />
      {children ? <View style={{ paddingHorizontal: 24 }}>{children}</View> : null}
    </View>
  );
};

export default ReportsHeader;
