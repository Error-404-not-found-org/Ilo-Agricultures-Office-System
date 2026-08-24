import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useRootNavigationState, useSegments } from "expo-router";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import type { AxiosInstance } from "axios";

import { queryClient } from "@/lib/queryClient";
import { getApiErrorDetails } from "@/lib/api";
import { useBootstrapUser } from "@/features/auth/hooks/useBootstrapUser";
import { getBootstrapErrorPresentation } from "@/features/auth/utils/bootstrapError";

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
}

export function AuthBootstrapGate({
  api,
  children,
  colors,
  isDark,
  isLoaded,
  isSignedIn,
  userId,
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

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      queryClient.clear();
      AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE").catch((error) =>
        console.error("Failed to clear AsyncStorage react-query cache", error),
      );
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!navigationState?.key) return;

    const routeSegments = segments as string[];
    const inAuthGroup = routeSegments[0] === "(auth)";
    const isVerifying = routeSegments[1] === "verify";
    const inTechnicianGroup = routeSegments[0] === "(technician)";
    const inFarmerGroup = routeSegments[0] === "(farmer)";
    const inAdminGroup = routeSegments[0] === "(admin)";
    const isActuallySignedIn = isSignedIn && Boolean(userId);

    if (isActuallySignedIn) {
      if (isBootstrapLoading || bootstrapError) return;

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
    isBootstrapLoading,
    isLoaded,
    isSignedIn,
    navigationState?.key,
    segments,
    userId,
  ]);

  if (isSignedIn && isBootstrapLoading) {
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

  if (isSignedIn && bootstrapError) {
    const normalizedError =
      (bootstrapError as any)?.apiError ||
      getApiErrorDetails(bootstrapError);
    const errorPresentation =
      getBootstrapErrorPresentation(normalizedError);
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
          onPress={() => signOut()}
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

  return children;
}
