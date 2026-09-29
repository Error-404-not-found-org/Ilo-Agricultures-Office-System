import { useAuth } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useRootNavigationState, useSegments } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, Text, TouchableOpacity, View } from "react-native";
import type { AxiosInstance } from "axios";

import {
  clearQueryCacheIdentity,
  establishQueryCacheOwner,
} from "@/lib/queryClient";
import { getApiErrorDetails } from "@/lib/api";
import {
  getBootstrapUserQueryKey,
  useBootstrapUser,
} from "@/features/auth/hooks/useBootstrapUser";
import { getBootstrapErrorPresentation } from "@/features/auth/utils/bootstrapError";
import { getBootstrapGateState } from "@/features/auth/utils/bootstrapGateState";
import { signOutWithPushCleanup } from "@/lib/notifications";
import {
  getSuspendedAccount,
  signOutFromSuspendedAccount,
  subscribeSuspendedAccount,
} from "@/features/auth/utils/suspendedAccount";

interface AuthBootstrapGateProps {
  api: AxiosInstance;
  children: ReactNode;
  colors: {
    background: string;
  };
  isDark: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId?: string;
  onResolvedUserId?: (userId?: string) => void;
}

export function AuthBootstrapGate({
  api,
  children,
  colors,
  isDark,
  isLoaded,
  isSignedIn,
  userId,
  onResolvedUserId,
}: AuthBootstrapGateProps) {
  const { signOut } = useAuth();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const {
    dbUser,
    bootstrapError,
    isBootstrapLoading,
    retryBootstrap,
  } = useBootstrapUser({ api, isSignedIn, userId });
  const [establishedOwnerId, setEstablishedOwnerId] = useState<string>();
  const [signOutError, setSignOutError] = useState(false);
  const isSuspended = useSyncExternalStore(
    subscribeSuspendedAccount,
    getSuspendedAccount,
    getSuspendedAccount,
  );
  const appState = useRef(AppState.currentState);
  const normalizedBootstrapError = bootstrapError
    ? (bootstrapError as any)?.apiError || getApiErrorDetails(bootstrapError)
    : undefined;
  const gateState = getBootstrapGateState({
    isSignedIn,
    dbUserId: dbUser?._id,
    establishedOwnerId,
    isBootstrapLoading,
    hasBootstrapError: Boolean(bootstrapError),
    isTransientBootstrapError: normalizedBootstrapError
      ? getBootstrapErrorPresentation(normalizedBootstrapError).primaryAction === "retry"
      : false,
    isSuspended,
  });

  useEffect(() => {
    if (__DEV__ && isSuspended) console.info("[Auth diagnostic] Blocked account gate active", { isSignedIn });
  }, [isSignedIn, isSuspended]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && appState.current !== "active" && isSignedIn && userId && !isSuspended) {
        void retryBootstrap();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [isSignedIn, isSuspended, retryBootstrap, userId]);

  const handleSignOut = async () => {
    try {
      setSignOutError(false);
      await signOutFromSuspendedAccount(
        isSignedIn ? () => signOutWithPushCleanup(api, signOut) : async () => {},
      );
      router.replace("/(auth)");
    } catch {
      setSignOutError(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (isLoaded && !isSignedIn) {
      setEstablishedOwnerId(undefined);
      onResolvedUserId?.(undefined);
      void clearQueryCacheIdentity().catch((error) =>
        console.error("Failed to clear signed-out query cache", error),
      );
      return () => {
        cancelled = true;
      };
    }

    if (!isSignedIn || !userId || !dbUser?._id) return;
    void establishQueryCacheOwner({
      ownerUserId: dbUser._id,
      bootstrapQueryKey: getBootstrapUserQueryKey(userId),
      bootstrapData: { user: dbUser },
    })
      .then(() => {
        if (cancelled) return;
        setEstablishedOwnerId(dbUser._id);
        onResolvedUserId?.(dbUser._id);
      })
      .catch((error) => {
        console.error("Failed to establish query cache account boundary", error);
      });

    return () => {
      cancelled = true;
    };
  }, [dbUser, isLoaded, isSignedIn, onResolvedUserId, userId]);

  useEffect(() => {
    if (!navigationState?.key) return;
    if (isSuspended) return;

    const routeSegments = segments as string[];
    const inAuthGroup = routeSegments[0] === "(auth)";
    const isVerifying = routeSegments[1] === "verify";
    const inTechnicianGroup = routeSegments[0] === "(technician)";
    const inFarmerGroup = routeSegments[0] === "(farmer)";
    const inAdminGroup = routeSegments[0] === "(admin)";
    const isActuallySignedIn = isSignedIn && Boolean(userId);

    if (isActuallySignedIn) {
      if (gateState !== "authenticated") return;

      if (dbUser) {
        if (!dbUser.isVerified) {
          if (!isVerifying) router.replace("/(auth)/verify");
          return;
        }

        const atRoot = routeSegments.length === 0 || routeSegments[0] === "";
        const wrongGroup =
          (inAdminGroup && dbUser.role !== "admin") ||
          (inTechnicianGroup && dbUser.role !== "technician") ||
          (inFarmerGroup &&
            (dbUser.role === "technician" || dbUser.role === "admin"));

        if (inAuthGroup || atRoot || wrongGroup) {
          if (dbUser.role === "admin") {
            router.replace("/(admin)/(tabs)/admin.dashboard");
          } else if (dbUser.role === "technician") {
            router.replace("/(technician)/(tabs)/technician.dashboard");
          } else {
            router.replace("/(farmer)/(tabs)");
          }
        }
      }
    } else if (isLoaded && !isSignedIn && !inAuthGroup) {
      router.replace("/(auth)");
    }
  }, [
    bootstrapError,
    dbUser,
    gateState,
    isLoaded,
    isSignedIn,
    isSuspended,
    navigationState?.key,
    segments,
    userId,
  ]);

  if (gateState === "suspended") {
    return (
      <View
        accessibilityRole="alert"
        style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <MaterialCommunityIcons name="account-lock-outline" size={48} color="#b45309" />
        <Text style={{ marginTop: 16, fontSize: 22, fontFamily: "Outfit_700Bold", textAlign: "center", color: isDark ? "#f8fafc" : "#1e293b" }}>
          Account suspended
        </Text>
        <Text style={{ marginTop: 12, fontFamily: "Outfit_400Regular", textAlign: "center", color: isDark ? "#cbd5e1" : "#475569" }}>
          Your BreedSmart account has been suspended. Please contact the Municipal Agriculture Office for assistance.
        </Text>
        {signOutError ? (
          <Text style={{ marginTop: 12, textAlign: "center", color: "#b91c1c" }}>
            Could not sign out. Please try again.
          </Text>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void handleSignOut()}
          style={{ marginTop: 24, backgroundColor: "#00643B", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: "white", fontFamily: "Outfit_600SemiBold" }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (gateState === "initial-loading") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#00643B" />
        <Text
          style={{
            marginTop: 12,
            fontFamily: "Outfit_600SemiBold",
            color: "#004D2E",
          }}
        >
          Loading your profile...
        </Text>
      </View>
    );
  }

  if (gateState === "error") {
    const errorPresentation =
      getBootstrapErrorPresentation(normalizedBootstrapError!);
    const shouldRetry = errorPresentation.primaryAction === "retry";

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color="#ef4444"
        />
        <Text
          style={{
            fontSize: 20,
            fontFamily: "Outfit_700Bold",
            marginTop: 16,
            textAlign: "center",
            color: isDark ? "#f8fafc" : "#1e293b",
          }}
        >
          {errorPresentation.title}
        </Text>
        <Text
          style={{
            marginTop: 12,
            textAlign: "center",
            fontFamily: "Outfit_400Regular",
            color: isDark ? "#cbd5e1" : "#64748b",
          }}
        >
          {errorPresentation.message}
        </Text>

        {shouldRetry && (
          <TouchableOpacity
            onPress={() => retryBootstrap()}
            style={{
              marginTop: 24,
              backgroundColor: "#00643B",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: "white",
                fontFamily: "Outfit_600SemiBold",
              }}
            >
              {errorPresentation.primaryActionLabel}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => void signOutWithPushCleanup(api, signOut)}
          style={{
            marginTop: shouldRetry ? 16 : 24,
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{ color: "#ef4444", fontFamily: "Outfit_600SemiBold" }}
          >
            {shouldRetry ? "Sign Out" : errorPresentation.primaryActionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Foreground revalidation leaves the existing navigator and form state untouched.
  return children;
}
