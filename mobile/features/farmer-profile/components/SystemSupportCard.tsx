import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Moon, Sun, Settings, RefreshCw, Lock, Shield, HelpCircle, LogOut } from "lucide-react-native";
import { useTheme } from "@/lib/theme";
import { useTranslation } from "../../../contexts/TranslationContext";
import ActionItem from "./ActionItem";

interface SystemSupportCardProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onChangePassword: () => void;
  onSignOut: () => void;
}

const Divider = () => {
  const { colors } = useTheme();
  return (
    <View
      className="h-[1px] ml-16"
      style={{ backgroundColor: colors.border }}
    />
  );
};

const SystemSupportCard = ({
  isDark,
  onToggleTheme,
  onChangePassword,
  onSignOut,
}: SystemSupportCardProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="px-6">
      {/* Quick Actions */}
      <Text
        className="font-outfit-black text-[10px] uppercase tracking-widest mb-3 ml-1"
        style={{ color: colors.textMuted }}
      >
        System & Support
      </Text>

      <View
        className="rounded-3xl overflow-hidden border mb-10"
        style={{ backgroundColor: colors.card, borderColor: colors.border }}
      >
        <TouchableOpacity
          onPress={onToggleTheme}
          style={{
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.card,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isDark ? (
                <Moon size={18} color="#94a3b8" />
              ) : (
                <Sun size={18} color="#f59e0b" />
              )}
            </View>
            <View>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: "Outfit_600SemiBold",
                  color: colors.textPrimary,
                }}
              >
                {t("themeMode")}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Outfit_700Bold",
                  color: colors.textMuted,
                  textTransform: "uppercase",
                }}
              >
                {isDark ? t("darkMode") : t("lightMode")}
              </Text>
            </View>
          </View>
          <View
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              backgroundColor: isDark ? colors.primary : "#e2e8f0",
              padding: 2,
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: "#fff",
                alignSelf: isDark ? "flex-end" : "flex-start",
                shadowColor: "#000",
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              }}
            />
          </View>
        </TouchableOpacity>
        <Divider />
        <ActionItem
          icon={<Settings size={18} color={colors.textSecondary} />}
          label={t("appSettings")}
          onPress={() => router.push("/(farmer)/settings")}
        />
        <Divider />
        <ActionItem
          icon={<RefreshCw size={18} color={colors.textSecondary} />}
          label="Sync Center"
          onPress={() => router.push("/(farmer)/sync-center")}
        />
        <Divider />
        <ActionItem
          icon={<Lock size={18} color={colors.textSecondary} />}
          label={t("changePassword")}
          onPress={onChangePassword}
        />
        <Divider />
        <ActionItem
          icon={<Shield size={18} color={colors.textSecondary} />}
          label={t("privacyPolicy")}
          onPress={() => router.push("/privacy-policy" as any)}
        />
        <Divider />
        <ActionItem
          icon={<HelpCircle size={18} color={colors.textSecondary} />}
          label={t("helpCenter")}
          onPress={() => router.push("/help-center")}
        />
        <Divider />
        <ActionItem
          icon={<LogOut size={18} color={colors.error} />}
          label={t("signOut")}
          onPress={onSignOut}
          isDestructive
        />
      </View>
    </View>
  );
};

export default SystemSupportCard;
