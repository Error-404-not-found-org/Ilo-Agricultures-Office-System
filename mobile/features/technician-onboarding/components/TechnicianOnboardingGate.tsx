import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  FileCheck2,
  Leaf,
  Radio,
} from "lucide-react-native";

import { ScreenLayout } from "@/components/ScreenLayout";
import { Text } from "@/components/ui/Text";
import { useApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import {
  completeOnboarding,
  enableRequestAcceptance,
  isTechnicianAcceptingRequests,
  shouldShowTechnicianOnboarding,
  suppressNextProfileWarningForSession,
  type TechnicianOnboardingUser,
} from "../utils/technicianOnboarding";

const TOTAL_STEPS = 3;

const getErrorMessage = (error: unknown, fallback: string) => {
  const message = (error as any)?.response?.data?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

export function TechnicianOnboardingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState(0);
  const [acceptingRequests, setAcceptingRequests] = useState(false);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const userQuery = useQuery<TechnicianOnboardingUser>({
    queryKey: ["user", "me"],
    queryFn: async () => {
      const response = await api.get("/user/me");
      return response.data || {};
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const user = userQuery.data;
  const onboardingVisible = shouldShowTechnicianOnboarding(user);
  const isAccepting =
    acceptingRequests || isTechnicianAcceptingRequests(user);

  useEffect(() => {
    if (!onboardingVisible) return;
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [onboardingVisible, opacity, step, translateY]);

  if (userQuery.isLoading) {
    return (
      <ScreenLayout contentStyle={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text textRole="bodyStrong" color="secondary" style={styles.loadingText}>
          Preparing your Technician workspace…
        </Text>
      </ScreenLayout>
    );
  }

  if (userQuery.isError && !user) {
    return (
      <ScreenLayout contentStyle={[styles.centered, styles.errorPadding]}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? "#143428" : "#E8F5EC" }]}>
          <Radio size={30} color={colors.primary} />
        </View>
        <Text textRole="headline" style={styles.centerText}>Unable to load your profile</Text>
        <Text textRole="body" color="secondary" style={[styles.centerText, styles.errorCopy]}>
          Check your connection and try again before entering the Technician workspace.
        </Text>
        <PrimaryButton label="Try Again" onPress={() => userQuery.refetch()} colors={colors} />
      </ScreenLayout>
    );
  }

  if (!onboardingVisible) return children;

  const moveTo = (nextStep: number) => {
    setErrorMessage(null);
    setStep(nextStep);
  };

  const startAcceptingRequests = async () => {
    if (availabilityPending) return;
    setErrorMessage(null);
    setAvailabilityPending(true);
    try {
      await enableRequestAcceptance(api, queryClient);
      setAcceptingRequests(true);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "We could not update your availability. Check your connection and try again.",
        ),
      );
    } finally {
      setAvailabilityPending(false);
    }
  };

  const finishOnboarding = async () => {
    if (completionPending) return;
    setErrorMessage(null);
    setCompletionPending(true);
    try {
      await completeOnboarding(api, queryClient, () =>
        suppressNextProfileWarningForSession(user?._id),
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "We could not finish setup. Check your connection and try again.",
        ),
      );
      setCompletionPending(false);
    }
  };

  return (
    <ScreenLayout edges={["top", "bottom", "left", "right"]} bottomInset={0}>
      <View style={styles.shell}>
        <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    index <= step ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
          <Text textRole="caption" color="muted" style={styles.progressLabel}>
            {step + 1} of {TOTAL_STEPS}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{ opacity, transform: [{ translateY }], width: "100%" }}
          >
            {step === 0 && (
              <WelcomeStep colors={colors} isDark={isDark} />
            )}
            {step === 1 && (
              <AvailabilityStep
                colors={colors}
                isDark={isDark}
                isAccepting={isAccepting}
              />
            )}
            {step === 2 && <WorkFlowStep colors={colors} isDark={isDark} />}

            {errorMessage && (
              <View
                accessibilityRole="alert"
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: isDark ? "#3F1D22" : "#FEF2F2",
                    borderColor: isDark ? "#7F1D1D" : "#FECACA",
                  },
                ]}
              >
                <Text textRole="bodyStrong" style={{ color: isDark ? "#FCA5A5" : "#B91C1C" }}>
                  {errorMessage}
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.actions}>
          {step === 0 && (
            <PrimaryButton label="Continue" onPress={() => moveTo(1)} colors={colors} />
          )}
          {step === 1 && !isAccepting && (
            <>
              <PrimaryButton
                label="Start Accepting Requests"
                onPress={startAcceptingRequests}
                loading={availabilityPending}
                colors={colors}
              />
              <SecondaryButton label="Not now" onPress={() => moveTo(2)} colors={colors} />
            </>
          )}
          {step === 1 && isAccepting && (
            <PrimaryButton label="Continue" onPress={() => moveTo(2)} colors={colors} />
          )}
          {step === 2 && (
            <>
              <PrimaryButton
                label="Start Using BreedSmart"
                onPress={finishOnboarding}
                loading={completionPending}
                colors={colors}
              />
              <SecondaryButton label="Back" onPress={() => moveTo(1)} colors={colors} />
            </>
          )}
        </View>
      </View>
    </ScreenLayout>
  );
}

function WelcomeStep({ colors, isDark }: any) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.heroIcon, { backgroundColor: isDark ? "#0B3D2C" : "#E8F5EC" }]}>
        <Leaf size={48} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text textRole="label" color="brand" style={styles.eyebrow}>BREEDSMART TECHNICIAN</Text>
      <Text textRole="headline" style={styles.title}>Welcome to BreedSmart</Text>
      <Text textRole="body" color="secondary" style={styles.copy}>
        You&apos;re signed in as an Agricultural Technician.{"\n\n"}
        We&apos;ll show you a few things to help you get started.
      </Text>
    </View>
  );
}

function AvailabilityStep({ colors, isDark, isAccepting }: any) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.heroIcon, { backgroundColor: isDark ? "#0B3D2C" : "#E8F5EC" }]}>
        {isAccepting ? <Check size={48} color={colors.primary} /> : <Radio size={48} color={colors.primary} />}
      </View>
      <Text textRole="headline" style={styles.title}>Ready to receive Farmer requests?</Text>
      <View style={[styles.statusPill, { backgroundColor: isAccepting ? (isDark ? "#0B3D2C" : "#DCFCE7") : (isDark ? "#292524" : "#F1F5F9") }]}>
        <View style={[styles.statusDot, { backgroundColor: isAccepting ? "#22C55E" : colors.textMuted }]} />
        <Text textRole="label" style={{ color: isAccepting ? colors.primary : colors.textSecondary }}>
          {isAccepting ? "Accepting Requests" : "Off Duty · Not accepting requests"}
        </Text>
      </View>
      <Text textRole="body" color="secondary" style={styles.copy}>
        {isAccepting
          ? "You’re now accepting requests. New Farmer requests can appear in Open Requests."
          : "New Technician accounts start Off Duty.\n\nWhen you’re ready, turn on Accepting Requests so new AI and health assistance requests can appear for you.\n\nYou can pause requests anytime from your Profile."}
      </Text>
    </View>
  );
}

function WorkFlowStep({ colors, isDark }: any) {
  const items = [
    { icon: ClipboardList, title: "Open Requests", copy: "New Farmer requests appear here." },
    { icon: BriefcaseBusiness, title: "My Work", copy: "Requests you claim and tasks you need to handle stay here." },
    { icon: FileCheck2, title: "Records", copy: "Completed services and official records can be reviewed here." },
  ];
  return (
    <View style={styles.stepContent}>
      <Text textRole="headline" style={styles.title}>Know where your work goes</Text>
      <Text textRole="body" color="secondary" style={[styles.copy, styles.workflowIntro]}>
        BreedSmart keeps new, active, and completed work in clear places.
      </Text>
      <View style={styles.flowList}>
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.title}>
              <View style={[styles.flowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.flowIcon, { backgroundColor: isDark ? "#0B3D2C" : "#E8F5EC" }]}>
                  <Icon size={23} color={colors.primary} />
                </View>
                <View style={styles.flowText}>
                  <Text textRole="title">{item.title}</Text>
                  <Text textRole="body" color="secondary" style={styles.flowCopy}>{item.copy}</Text>
                </View>
              </View>
              {index < items.length - 1 && (
                <ArrowDown size={18} color={colors.textMuted} style={styles.arrow} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, loading = false, colors }: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={loading}
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.18)" }}
      style={[
        styles.primaryButton,
        {
          backgroundColor: colors.primary,
          opacity: loading ? 0.65 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text
          textRole="bodyStrong"
          style={[styles.primaryLabel, { color: colors.onPrimary }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function SecondaryButton({ label, onPress, colors }: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
    >
      <Text textRole="bodyStrong" color="secondary">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  centered: { alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14 },
  errorPadding: { paddingHorizontal: 28 },
  centerText: { textAlign: "center" },
  errorCopy: { marginTop: 10, marginBottom: 28, maxWidth: 330 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  progressRow: { flexDirection: "row", alignItems: "center", minHeight: 28 },
  progressDot: { width: 24, height: 4, borderRadius: 2, marginRight: 6 },
  progressLabel: { marginLeft: "auto" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingVertical: 18 },
  stepContent: { alignItems: "center", width: "100%" },
  heroIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  eyebrow: { letterSpacing: 1.2, marginBottom: 12 },
  title: { textAlign: "center", fontSize: 28, lineHeight: 34, maxWidth: 340 },
  copy: { textAlign: "center", fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 350 },
  statusPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginTop: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 20 },
  actions: { width: "100%", gap: 10, paddingTop: 10, flexShrink: 0 },
  primaryButton: { width: "100%", minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, overflow: "hidden" },
  primaryLabel: { fontSize: 16, textAlign: "center" },
  secondaryButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  workflowIntro: { marginTop: 10 },
  flowList: { width: "100%", marginTop: 26 },
  flowCard: { width: "100%", borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center" },
  flowIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  flowText: { flex: 1, marginLeft: 14 },
  flowCopy: { marginTop: 2 },
  arrow: { alignSelf: "center", marginVertical: 7 },
});
