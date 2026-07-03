import { router } from "expo-router";

export const safeBack = (fallback: string = "/(farmer)/(tabs)") => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
};
