import { useOAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { useApi } from "@/lib/api";

// 1. Warm up browser (Required for Android)
export const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

WebBrowser.maybeCompleteAuthSession();

function useSocialAuth() {
  useWarmUpBrowser();
  const router = useRouter();
  const api = useApi();

  const [loadingStrategy, setLoadingStrategy] = useState<string | null>(null);
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: "oauth_apple" });

  const handleSocialAuth = useCallback(async (strategy: "oauth_google" | "oauth_apple") => {
    setLoadingStrategy(strategy);

    const startOAuthFlow = strategy === "oauth_google" ? startGoogleFlow : startAppleFlow;

    if (!startOAuthFlow) return;

    try {
      const redirectUrl = Linking.createURL("/sso-callback");
      
      console.log("👉 Auto-Generated Redirect URL:", redirectUrl);

      const { createdSessionId, setActive, signIn, signUp } = await startOAuthFlow({
        redirectUrl: redirectUrl,
      });

      console.log("👉 Session ID:", createdSessionId);

      if (createdSessionId && setActive) {
        console.log("✅ Login Successful! Setting active...");
        await setActive({ session: createdSessionId });
        
        try {
          // Add a small delay to ensure Clerk session is fully active and token is available
          await new Promise((resolve) => setTimeout(resolve, 500));
          await api.post("/user/bootstrap");
          console.log("✅ User bootstrapped in MongoDB");
        } catch (syncErr) {
          console.error("⚠️ Bootstrap failed:", syncErr);
          throw new Error("Account setup failed. Please check your connection and try again.");
        }
      }

    } catch (err: any) {
      console.error("OAuth error", err);
      toast.error("Authentication Failed", {
        description: err?.errors?.[0]?.message || "There was an issue signing in with your account."
      });
    } finally {
      setLoadingStrategy(null);
    }
  }, [startGoogleFlow, startAppleFlow]);

  return { loadingStrategy, handleSocialAuth };
}

export default useSocialAuth;