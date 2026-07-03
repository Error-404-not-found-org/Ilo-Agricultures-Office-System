import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function ActivityTimeline() {
  const { colors, isDark } = useTheme();

  const timelineItems = [
    {
      id: "1",
      title: "Pregnancy Confirmed",
      time: "10 mins ago",
      desc: "Cow #E102 (Holstein) confirmed pregnant in Brgy. Trapiche.",
      icon: "heart-pulse",
      color: "#16a34a",
      bg: "rgba(22, 163, 74, 0.15)",
    },
    {
      id: "2",
      title: "Animal Registered",
      time: "1 hr ago",
      desc: "Farmer Mary Cruz registered a new Carabao (#E109) in Santa Rita.",
      icon: "cow",
      color: "#7c3aed",
      bg: "rgba(124, 58, 237, 0.15)",
    },
    {
      id: "3",
      title: "AI Completed",
      time: "2 hrs ago",
      desc: "Technician John Doe completed insemination on Tag #E094.",
      icon: "needle",
      color: "#2563EB",
      bg: "rgba(37, 99, 235, 0.15)",
    },
    {
      id: "4",
      title: "Health Request",
      time: "4 hrs ago",
      desc: "Emergency sickness report logged by Farmer Jose Trapiche.",
      icon: "medical-bag",
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.15)",
    },
    {
      id: "5",
      title: "New User Registered",
      time: "Yesterday",
      desc: "New technician account created for Robert Green.",
      icon: "account-plus",
      color: "#d97706",
      bg: "rgba(217, 119, 6, 0.15)",
    },
    {
      id: "6",
      title: "Calving Recorded",
      time: "Yesterday",
      desc: "Calf drop (Female) successfully registered for Tag #E052.",
      icon: "baby-carriage",
      color: "#0891b2",
      bg: "rgba(8, 145, 178, 0.15)",
    },
  ];

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 40 }}>
      <Text style={{ fontSize: 16, fontFamily: "Outfit_800ExtraBold", color: colors.textPrimary, marginBottom: 16 }}>
        Recent Activities
      </Text>

      <View style={{ position: "relative" }}>
        {/* Timeline vertical line */}
        <View
          style={{
            position: "absolute",
            left: 20,
            top: 10,
            bottom: 10,
            width: 2,
            backgroundColor: colors.border,
          }}
        />

        {timelineItems.map((item, index) => (
          <View key={item.id} style={{ flexDirection: "row", marginBottom: 20, position: "relative" }}>
            {/* Timeline icon node */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: item.bg,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
                borderWidth: 2,
                borderColor: colors.card,
              }}
            >
              <MaterialCommunityIcons name={item.icon as any} size={18} color={item.color} />
            </View>

            {/* Timeline content block */}
            <View style={{ flex: 1, marginLeft: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontFamily: "Outfit_700Bold", color: colors.textPrimary }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: "Outfit_600SemiBold", color: colors.textMuted }}>
                  {item.time}
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontFamily: "Outfit_500Medium", color: colors.textSecondary, lineHeight: 16 }}>
                {item.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
