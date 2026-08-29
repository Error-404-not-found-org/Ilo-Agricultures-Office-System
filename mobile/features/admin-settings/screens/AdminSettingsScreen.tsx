import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch } from "react-native";
import { useTheme } from "@/lib/theme";
import { ScreenLayout } from "@/components/ScreenLayout";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sun, Moon } from "lucide-react-native";

const PRIMARY = "#1e3a5f";

export default function AdminSettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const handleToggleTheme = async () => {
    const newScheme = colorScheme === "dark" ? "light" : "dark";
    toggleColorScheme();
    try {
      await AsyncStorage.setItem("theme_preference", newScheme);
    } catch (e) {
      console.warn("Failed to save theme preference:", e);
    }
  };

  return (
    <ScreenLayout>
      {/* Custom back-header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, marginLeft: -8 }}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "Outfit_800ExtraBold",
            fontSize: 18,
            color: colors.textPrimary,
            marginLeft: 8,
            flex: 1,
          }}
        >
          System Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 100,
        }}
      >
        {/* Appearance Settings */}
        <View
          style={{
            backgroundColor: colors.card,
            padding: 16,
            borderRadius: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Outfit_800ExtraBold",
              color: colors.textSecondary,
              marginBottom: 14,
            }}
          >
            APPEARANCE
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    colorScheme === "dark"
                      ? "rgba(245,158,11,0.1)"
                      : "rgba(100,116,139,0.1)",
                }}
              >
                {colorScheme === "dark" ? (
                  <Moon size={20} color="#f59e0b" />
                ) : (
                  <Sun size={20} color="#94a3b8" />
                )}
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 13.5,
                    fontFamily: "Outfit_700Bold",
                    color: colors.textPrimary,
                  }}
                >
                  Dark Mode
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Outfit_500Medium",
                    color: colors.textSecondary,
                  }}
                >
                  Switch between light and dark theme
                </Text>
              </View>
            </View>
            <Switch
              accessibilityLabel="Dark Mode"
              value={colorScheme === "dark"}
              onValueChange={handleToggleTheme}
              trackColor={{ true: PRIMARY }}
              thumbColor={colorScheme === "dark" ? "#f59e0b" : "#f4f3f4"}
            />
          </View>
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}
