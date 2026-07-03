import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import { Text } from "@/components/ui/Text";
import { useTheme } from "@/lib/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface TechnicianHeroHeaderProps {
  clerkUser: any;
  unreadCount: number;
  agendaItems: any[];
}

export function TechnicianHeroHeader({
  clerkUser,
  unreadCount,
  agendaItems,
}: TechnicianHeroHeaderProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: isDark ? "#064e3e" : "#00643B",
        paddingBottom: 80,
        borderBottomLeftRadius: 48,
        borderBottomRightRadius: 48,
        paddingHorizontal: 24,
        paddingTop: 10,
      }}
    >
      <Text
        variant="medium"
        size={12}
        style={{
          color: "rgba(255,255,255,0.7)",
          marginBottom: 8,
          marginLeft: 4,
        }}
      >
        {new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
      </Text>
      {/* Top Row: Profile (Left) & Notif (Right) */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        {/* Profile + Label (Left) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/(technician)/(tabs)/profile" as any)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: "rgba(255,255,255,0.1)",
            paddingRight: 16,
            paddingLeft: 4,
            paddingVertical: 4,
            borderRadius: 30,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: "rgba(255,255,255,0.3)",
              overflow: "hidden",
              backgroundColor: "#fff",
            }}
          >
            <Image
              source={{ uri: clerkUser?.imageUrl }}
              style={{ width: "100%", height: "100%" }}
            />
          </View>
          <View>
            <Text
              variant="extrabold"
              size={13}
              style={{
                color: "#fff",
                lineHeight: 14,
              }}
            >
              Hello, {clerkUser?.firstName || clerkUser?.username || "User"}
            </Text>
            <Text
              variant="medium"
              size={10}
              style={{
                color: "rgba(255,255,255,0.6)",
              }}
            >
              Technician
            </Text>
          </View>
        </TouchableOpacity>

        {/* Notif Bell (Right) */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/notifications" as any)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.2)",
          }}
        >
          <MaterialCommunityIcons
            name="bell-outline"
            size={22}
            color="#fff"
          />
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                backgroundColor: "#ef4444",
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: isDark ? "#064e3b" : "#00643B",
              }}
            >
              <Text
                variant="black"
                size={8}
                style={{
                  color: "#fff",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Moowie Technician Insight */}
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        <View style={{ width: 60, height: 60 }}>
          <Image
            source={{
              uri: "https://res.cloudinary.com/donhulins/image/upload/v1778122530/image-removebg-preview_f6mqrz.png",
            }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            variant="extrabold"
            size={14}
            style={{
              color: "#fff",
            }}
          >
            Greetings
          </Text>
          <Text
            variant="medium"
            size={11}
            style={{
              color: "rgba(255,255,255,0.8)",
              lineHeight: 15,
              marginTop: 2,
            }}
          >
            {agendaItems.length > 0
              ? `You have ${agendaItems.length} appointments today. Better get the truck ready! 🛻`
              : "No field visits scheduled yet. Great time to catch up on cattle registration records! 🐮"}
          </Text>
        </View>
      </View>
    </View>
  );
}
