import React from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";

interface TechnicianHeroHeaderProps {
  clerkUser: any;
  unreadCount: number;
}

export function TechnicianHeroHeader({
  clerkUser,
  unreadCount,
}: TechnicianHeroHeaderProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
  const technicianName =
    clerkUser?.firstName || clerkUser?.username || "Technician";

  return (
    <View
      style={{
        backgroundColor: isDark ? "#064e3e" : "#00643B",
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 130,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/(technician)/(tabs)/profile" as any)}
          accessibilityRole="button"
          accessibilityLabel="Open technician profile"
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.28)",
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {clerkUser?.imageUrl ? (
              <Image
                source={{ uri: clerkUser.imageUrl }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <MaterialCommunityIcons
                name="account-outline"
                size={22}
                color="#fff"
              />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="medium"
              size={11}
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              {greeting}
            </Text>
            <Text
              variant="extrabold"
              size={19}
              numberOfLines={1}
              style={{ color: "#fff", marginTop: 1 }}
            >
              {technicianName}
            </Text>
            <Text
              variant="medium"
              size={11}
              numberOfLines={1}
              style={{ color: "rgba(255,255,255,0.68)", marginTop: 2 }}
            >
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/notifications" as any)}
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0
              ? "Notifications, " + unreadCount + " unread"
              : "Notifications"
          }
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="bell-outline" size={22} color="#fff" />
          {unreadCount > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 5,
                right: 5,
                minWidth: 17,
                height: 17,
                borderRadius: 9,
                paddingHorizontal: 3,
                backgroundColor: "#ef4444",
                borderWidth: 1.5,
                borderColor: isDark ? "#064e3e" : "#00643B",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="black" size={8} style={{ color: "#fff" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}
