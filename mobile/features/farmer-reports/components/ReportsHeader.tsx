import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Printer } from "lucide-react-native";

interface ReportsHeaderProps {
  insets: { top: number };
  onExport: () => void;
  children?: React.ReactNode;
}

const ReportsHeader = ({ insets, onExport, children }: ReportsHeaderProps) => {
  return (
    <View
      style={{
        paddingTop: insets.top + 20,
        backgroundColor: "#00643B",
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        paddingHorizontal: 24,
        marginHorizontal: -24,
        marginTop: 0,
        marginBottom: 24,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontFamily: "Outfit_500Medium",
              fontSize: 13,
            }}
          >
            Production Dashboard
          </Text>
          <Text
            style={{
              color: "#fff",
              fontFamily: "Outfit_900Black",
              fontSize: 28,
            }}
          >
            Reports Center
          </Text>
        </View>
        <TouchableOpacity
          onPress={onExport}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
          }}
        >
          <Printer color="#fff" size={16} />
          <Text
            style={{
              color: "#fff",
              fontFamily: "Outfit_700Bold",
              fontSize: 11,
            }}
          >
            EXPORT
          </Text>
        </TouchableOpacity>
      </View>
      {children}
    </View>
  );
};

export default ReportsHeader;
