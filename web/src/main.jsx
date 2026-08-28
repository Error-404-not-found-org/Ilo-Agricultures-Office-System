import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { SocketProvider } from "./contexts/SocketContext.jsx";
import "./index.css";
import App from "./App.jsx";
import AppToaster from "./components/ui/AppToaster.jsx";
import { applyTheme, getStoredTheme } from "./lib/theme.js";
import {
  clerkAppearance,
  clerkLocalization,
} from "./config/clerkAppearance.js";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const queryClient = new QueryClient();

// Apply the persisted theme before React renders to prevent a stale-theme flash.
applyTheme(getStoredTheme());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={clerkAppearance}
      localization={clerkLocalization}
    >
      <SocketProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <AppToaster />
        </QueryClientProvider>
      </SocketProvider>
    </ClerkProvider>
  </StrictMode>,
);
