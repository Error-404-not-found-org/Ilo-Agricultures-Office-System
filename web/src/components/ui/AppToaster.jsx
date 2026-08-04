import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { isDarkTheme } from "../../lib/theme";

const getActiveTheme = () =>
  isDarkTheme(document.documentElement.dataset.theme)
    ? "dark"
    : "light";

export default function AppToaster() {
  const [theme, setTheme] = useState(getActiveTheme);

  useEffect(() => {
    const syncTheme = () => setTheme(getActiveTheme());
    window.addEventListener("theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  return (
    <Toaster
      position="top-right"
      richColors
      theme={theme}
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans",
          title: "font-semibold",
          description: "text-sm",
        },
      }}
    />
  );
}
