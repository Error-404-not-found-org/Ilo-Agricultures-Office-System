import { SignUp, UserButton, useAuth } from "@clerk/clerk-react";
import {
  CheckCircle2,
  Download,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AuthShell from "../components/auth/AuthShell";
import {
  APP_DEEP_LINK_URL,
  APP_DOWNLOAD_URL,
} from "../config/appDistribution";
import { clerkEmbeddedAppearance } from "../config/clerkAppearance";
import { resolveFarmerDownloadAccess } from "../config/onboardingBridge";
import axiosInstance from "../lib/axios";

export default function DownloadApp() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const [accessState, setAccessState] = useState("loading");
  const [accessMessage, setAccessMessage] = useState("");
  const hasInvitationTicket = Boolean(searchParams.get("__clerk_ticket"));
  const displayState = !isLoaded
    ? "loading"
    : !isSignedIn
      ? hasInvitationTicket
        ? "invitation"
        : "public"
      : accessState;

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !isSignedIn) return () => {};

    const resolveIdentity = async () => {
      try {
        const token = await getToken();
        const response = await axiosInstance.post(
          "/user/bootstrap",
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (cancelled) return;

        const nextAccess = resolveFarmerDownloadAccess(response.data?.user);
        setAccessState(nextAccess);
        if (nextAccess !== "farmer") {
          setAccessMessage(
            "This signed-in account is not a Farmer account. Please use the appropriate BreedSmart workspace.",
          );
        }
      } catch (error) {
        if (cancelled) return;
        setAccessState("error");
        setAccessMessage(
          error.response?.data?.message ||
            "We could not confirm this account. Please try signing in again.",
        );
      }
    };

    resolveIdentity();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  if (displayState === "invitation") {
    return (
      <AuthShell
        context="BreedSmart Farmer"
        title="Complete your Farmer account"
        description="Your agricultural Technician has already prepared your BreedSmart profile. Create your account using the same email address that received the invitation."
        helper="After setup, continue in the BreedSmart mobile app to manage your animals, requests, and records."
      >
        <SignUp
          routing="virtual"
          forceRedirectUrl="/download-app"
          signInForceRedirectUrl="/download-app"
          appearance={clerkEmbeddedAppearance}
        />
      </AuthShell>
    );
  }

  if (displayState === "loading") {
    return (
      <AuthShell
        context="BreedSmart Farmer"
        title="Confirming your account"
        description="BreedSmart is securely checking your Farmer profile."
      >
        <div
          className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600"
          role="status"
        >
          <span className="loading loading-dots loading-sm text-[#17663a]" />
          <span>Confirming your account</span>
        </div>
      </AuthShell>
    );
  }

  if (displayState === "not-farmer" || displayState === "error") {
    return (
      <AuthShell
        context="BreedSmart Farmer"
        title={
          displayState === "not-farmer"
            ? "This link is for a Farmer account"
            : "We could not confirm your account"
        }
        description={
          displayState === "not-farmer"
            ? "You're currently signed in with a different BreedSmart role."
            : "Your Farmer profile could not be verified. Review the message below, then sign in again if needed."
        }
        accountAction={<UserButton afterSignOutUrl="/" />}
      >
        <div
          className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-5 text-amber-950"
          role="alert"
        >
          <TriangleAlert
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden="true"
          />
          <span>{accessMessage}</span>
        </div>
      </AuthShell>
    );
  }

  if (displayState === "farmer") {
    return (
      <AuthShell
        context="BreedSmart Farmer"
        title="Your Farmer account is ready"
        description="Your profile is connected. Continue in BreedSmart Mobile to manage your animals and service requests."
        helper="Use the same BreedSmart account when signing in on your phone."
        accountAction={<UserButton afterSignOutUrl="/" />}
      >
        <div className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <span>Farmer profile connected</span>
        </div>
        <AppActions />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      context="Official BreedSmart App"
      title="BreedSmart Mobile"
      description="The mobile app for Farmers and agricultural Technicians in Oton, Iloilo."
      helper={
        APP_DOWNLOAD_URL
          ? "After installation, sign in using your authorized BreedSmart account."
          : (
              <span className="block space-y-1">
                <span className="block font-semibold text-slate-800">
                  Need the BreedSmart app?
                </span>
                <span className="block">
                  Please contact your agricultural technician or BreedSmart
                  administrator for the latest installer.
                </span>
              </span>
            )
      }
    >
      <AppActions />
    </AuthShell>
  );
}

function AppActions() {
  return (
    <div className="grid gap-3">
      <a
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17663a] px-5 font-bold text-white transition-colors hover:bg-[#12512e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17663a] focus-visible:ring-offset-2"
        href={APP_DEEP_LINK_URL}
      >
        <Smartphone className="h-5 w-5" aria-hidden="true" />
        Open BreedSmart App
      </a>
      {APP_DOWNLOAD_URL ? (
        <a
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-bold text-slate-800 transition-colors hover:border-[#17663a] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17663a] focus-visible:ring-offset-2"
          href={APP_DOWNLOAD_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          Download BreedSmart
        </a>
      ) : null}
    </div>
  );
}
