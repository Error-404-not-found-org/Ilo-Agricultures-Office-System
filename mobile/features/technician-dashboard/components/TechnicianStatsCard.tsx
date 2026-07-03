import React from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface TechnicianStatsCardProps {
  stats: any;
  analytics: any;
  agendaItems?: any[];
}

export function TechnicianStatsCard({
  stats,
  analytics,
  agendaItems = [],
}: TechnicianStatsCardProps) {
  const { colors, isDark } = useTheme();

  // Section 1: Today's Work calculations
  const todayVisits = stats.todayActivities || 0;
  const readyToday = agendaItems.filter((item) => item.isReadyToday).length;
  const completedToday = stats.completedToday || 0;

  // Section 2: Service Summary calculations
  const aiServicesMonth = stats.totalInsemMonth || 0;
  const healthCasesMonth = analytics.totalHealth_Month || 0;

  return (
    <View style={{ gap: 16, marginBottom: 24 }}>
      {/* SECTION 1: TODAY'S WORK */}
      <Card
        style={{
          padding: 18,
          borderWidth: 1,
          borderColor: isDark
            ? "rgba(16, 185, 129, 0.2)"
            : "rgba(0, 100, 59, 0.15)",
          backgroundColor: isDark ? "rgba(6, 78, 62, 0.15)" : "#f0fdf4",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
            gap: 6,
          }}
        >
          <MaterialCommunityIcons
            name="calendar-today"
            size={16}
            color={isDark ? colors.primary : "#00643B"}
          />
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 13,
              color: isDark ? colors.primary : "#00643B",
              letterSpacing: 0.5,
            }}
          >
            TODAY'S WORK
          </Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <StatBox
            label="Visits Today"
            subLabel="Assigned"
            value={todayVisits}
            color={isDark ? colors.primary : "#00643B"}
            icon="calendar-multiselect"
          />
          <View
            style={{
              width: 1,
              height: "70%",
              backgroundColor: isDark
                ? "rgba(16, 185, 129, 0.2)"
                : "rgba(0, 100, 59, 0.15)",
              alignSelf: "center",
            }}
          />
          <StatBox
            label="Ready Today"
            subLabel="Ready to Start"
            value={readyToday}
            color={readyToday > 0 ? "#eab308" : colors.textMuted}
            icon="play-circle-outline"
          />
          <View
            style={{
              width: 1,
              height: "70%",
              backgroundColor: isDark
                ? "rgba(16, 185, 129, 0.2)"
                : "rgba(0, 100, 59, 0.15)",
              alignSelf: "center",
            }}
          />
          <StatBox
            label="Completed Today"
            subLabel="Finished"
            value={completedToday}
            color={completedToday > 0 ? "#10b981" : colors.textMuted}
            icon="check-circle-outline"
          />
        </View>
      </Card>

      {/* SECTION 2: SERVICE SUMMARY */}
      <Card
        style={{
          padding: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 14,
            gap: 6,
          }}
        >
          <MaterialCommunityIcons
            name="chart-bar"
            size={16}
            color={colors.textSecondary}
          />
          <Text
            style={{
              fontFamily: "Outfit_800ExtraBold",
              fontSize: 13,
              color: colors.textSecondary,
              letterSpacing: 0.5,
            }}
          >
            SERVICE SUMMARY
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            rowGap: 16,
          }}
        >
          <View style={{ width: "23%", alignItems: "center" }}>
            <MaterialCommunityIcons name="needle" size={18} color="#0891b2" />
            <Text
              variant="black"
              size={16}
              style={{ marginTop: 4, color: colors.textPrimary }}
            >
              {aiServicesMonth}
            </Text>
            <Text
              variant="bold"
              color="primary"
              size={9}
              style={{ textAlign: "center", marginTop: 2 }}
            >
              AI Services
            </Text>
            <Text
              color="muted"
              size={8}
              style={{
                textTransform: "uppercase",
                fontSize: 7,
                fontFamily: "Outfit_700Bold",
                marginTop: 1,
              }}
            >
              This Month
            </Text>
          </View>

          <View
            style={{
              width: "1%",
              height: 35,
              backgroundColor: colors.border,
              alignSelf: "center",
            }}
          />

          <View style={{ width: "23%", alignItems: "center" }}>
            <MaterialCommunityIcons
              name="stethoscope"
              size={18}
              color="#2563eb"
            />
            <Text
              variant="black"
              size={16}
              style={{ marginTop: 4, color: colors.textPrimary }}
            >
              {healthCasesMonth}
            </Text>
            <Text
              variant="bold"
              color="primary"
              size={9}
              style={{ textAlign: "center", marginTop: 2 }}
            >
              Health Cases
            </Text>
            <Text
              color="muted"
              size={8}
              style={{
                textTransform: "uppercase",
                fontSize: 7,
                fontFamily: "Outfit_700Bold",
                marginTop: 1,
              }}
            >
              This Month
            </Text>
          </View>

          <View
            style={{
              width: "1%",
              height: 35,
              backgroundColor: colors.border,
              alignSelf: "center",
            }}
          />

          <View style={{ width: "23%", alignItems: "center" }}>
            <MaterialCommunityIcons
              name="baby-face-outline"
              size={18}
              color="#7c3aed"
            />
            <Text
              variant="black"
              size={16}
              style={{ marginTop: 4, color: colors.textPrimary }}
            >
              {stats.totalPregnancyCheckupMonth || 0}
            </Text>
            <Text
              variant="bold"
              color="primary"
              size={9}
              style={{ textAlign: "center", marginTop: 2 }}
            >
              Pregnancy Chk
            </Text>
            <Text
              color="muted"
              size={8}
              style={{
                textTransform: "uppercase",
                fontSize: 7,
                fontFamily: "Outfit_700Bold",
                marginTop: 1,
              }}
            >
              This Month
            </Text>
          </View>

          <View
            style={{
              width: "1%",
              height: 35,
              backgroundColor: colors.border,
              alignSelf: "center",
            }}
          />

          <View style={{ width: "23%", alignItems: "center" }}>
            <MaterialCommunityIcons name="cow" size={18} color="#db2777" />
            <Text
              variant="black"
              size={16}
              style={{ marginTop: 4, color: colors.textPrimary }}
            >
              {stats.totalCalvingMonth || 0}
            </Text>
            <Text
              variant="bold"
              color="primary"
              size={9}
              style={{ textAlign: "center", marginTop: 2 }}
            >
              Calvings
            </Text>
            <Text
              color="muted"
              size={8}
              style={{
                textTransform: "uppercase",
                fontSize: 7,
                fontFamily: "Outfit_700Bold",
                marginTop: 1,
              }}
            >
              This Month
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

const StatBox = ({ label, value, icon, color, subLabel }: any) => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text
        variant="black"
        size={20}
        style={{ marginTop: 4, color: colors.textPrimary }}
      >
        {value}
      </Text>
      <Text variant="bold" color="primary" size={10} style={{ marginTop: 2 }}>
        {label}
      </Text>
      <Text
        color="muted"
        size={8}
        style={{
          textTransform: "uppercase",
          fontSize: 7.5,
          fontFamily: "Outfit_700Bold",
        }}
      >
        {subLabel}
      </Text>
    </View>
  );
};
