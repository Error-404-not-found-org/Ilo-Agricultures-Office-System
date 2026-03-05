import { useOAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

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
        router.replace("/(auth)");
      }

    } catch (err) {
      console.error("OAuth error", err);
    } finally {
      setLoadingStrategy(null);
    }
  }, [startGoogleFlow, startAppleFlow]);

  return { loadingStrategy, handleSocialAuth };
}

export default useSocialAuth;