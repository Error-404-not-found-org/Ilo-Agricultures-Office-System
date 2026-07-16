import React from "react";
import { View, ScrollView } from "react-native";
import {
  Shield,
  Lock,
  Database,
  FileText,
  Mail,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/lib/theme";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/AppPageHeader";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const primaryColor = isDark ? colors.primary : "#00643B";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppPageHeader title="Privacy Policy" subtitle="Last updated June 2026" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text
          variant="semibold"
          size={14}
          style={{
            color: colors.textSecondary,
            marginBottom: 20,
            lineHeight: 22,
          }}
        >
          Welcome to the BreedSmart mobile application. We are deeply committed
          to protecting your personal information and your farm&apos;s operational
          records. This Privacy Policy details how we handle data to support
          sustainable agriculture and technical operations in Oton, Iloilo.
        </Text>

        <View style={{ gap: 20 }}>
          {/* Card 1: Data Collection */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Database size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant="extrabold"
                  size={15}
                  style={{ color: colors.textPrimary, marginBottom: 6 }}
                >
                  1. Information We Collect
                </Text>
                <Text
                  variant="medium"
                  size={13}
                  style={{ color: colors.textSecondary, lineHeight: 20 }}
                >
                  We collect user profiles (name, phone, barangay location) and
                  livestock records including tag IDs, breeding histories, heat
                  detection dates, and calving cycles to log actions.
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 2: How We Use Data */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant="extrabold"
                  size={15}
                  style={{ color: colors.textPrimary, marginBottom: 6 }}
                >
                  2. How We Use Information
                </Text>
                <Text
                  variant="medium"
                  size={13}
                  style={{ color: colors.textSecondary, lineHeight: 20 }}
                >
                  Your data is used to optimize artificial insemination
                  schedules, calculate pregnancy timelines, dispatch technician
                  routes, and trigger automatic health notification updates.
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 3: Storage & Security */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Lock size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant="extrabold"
                  size={15}
                  style={{ color: colors.textPrimary, marginBottom: 6 }}
                >
                  3. Data Storage & Encryption
                </Text>
                <Text
                  variant="medium"
                  size={13}
                  style={{ color: colors.textSecondary, lineHeight: 20 }}
                >
                  All offline cached data remains encrypted on your local
                  device. Central synchronization uses end-to-end HTTPS
                  transfers, and authentication is securely handled by Clerk.
                </Text>
              </View>
            </View>
          </Card>

          {/* Card 4: Access and Control */}
          <Card>
            <View
              style={{
                flexDirection: "row",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: isDark
                    ? "rgba(16, 185, 129, 0.15)"
                    : "#ecfdf5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield size={20} color={primaryColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  variant="extrabold"
                  size={15}
                  style={{ color: colors.textPrimary, marginBottom: 6 }}
                >
                  4. Your Controls & Choices
                </Text>
                <Text
                  variant="medium"
                  size={13}
                  style={{ color: colors.textSecondary, lineHeight: 20 }}
                >
                  You hold full rights to view, update, and manage your
                  livestock information. You can also purge local app caches
                  instantly from the account settings tab at any time.
                </Text>
              </View>
            </View>
          </Card>

          {/* Contact details */}
          <View
            style={{
              marginTop: 10,
              padding: 20,
              borderRadius: 24,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 5,
              borderLeftColor: primaryColor,
            }}
          >
            <Text
              variant="extrabold"
              size={15}
              style={{ color: colors.textPrimary, marginBottom: 4 }}
            >
              Questions or Concerns?
            </Text>
            <Text
              variant="semibold"
              size={12}
              style={{ color: colors.textMuted, marginBottom: 16 }}
            >
              Contact our Data Protection Office for any privacy inquiries.
            </Text>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Mail size={16} color={primaryColor} />
              <Text
                variant="bold"
                size={13}
                style={{ color: colors.textSecondary }}
              >
                oton.agri.privacy@gmail.com
              </Text>
            </View>
          </View>

          <Text
            variant="bold"
            size={11}
            style={{
              color: colors.textMuted,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            BreedSmart • Compliance Team
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
