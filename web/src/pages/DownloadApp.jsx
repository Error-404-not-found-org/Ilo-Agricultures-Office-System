import { SignUp, UserButton, useAuth } from "@clerk/clerk-react";
import {
  CheckCircle2,
  Download,
  Smartphone,
  TriangleAlert,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AuthShell from "../components/auth/AuthShell";
import { APP_DEEP_LINK_URL, APP_DOWNLOAD_URL } from "../config/appDistribution";
import { clerkEmbeddedAppearance } from "../config/clerkAppearance";
import { resolveFarmerDownloadAccess } from "../config/onboardingBridge";
import axiosInstance from "../lib/axios";

const TEMPORARY_MESSAGE =
  "We couldn't reach BreedSmart. You can retry without signing in again.";

export default function DownloadApp() {
  const { getToken, isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const [searchParams] = useSearchParams();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const identity = isLoaded && isSignedIn ? userId : null;
  const requestKey = JSON.stringify([isLoaded, identity, sessionId, attempt]);
  const current = result?.key === requestKey ? result : { state: "checking" };
  const hasInvitationTicket = Boolean(searchParams.get("__clerk_ticket"));

  useEffect(() => {
    if (isLoaded && !isSignedIn) return undefined;

    const controller = new AbortController();
    let finished = false;
    const publish = (value) => setResult({ key: requestKey, ...value });
    const slowTimer = setTimeout(() => {
      if (!finished) publish({ state: "checking", slow: true });
    }, 5000);
    const deadline = setTimeout(() => {
      if (finished) return;
      finished = true;
      controller.abort();
      publish({ state: "temporary", message: TEMPORARY_MESSAGE });
      clearTimeout(slowTimer);
    }, 15000);

    const verify = async () => {
      try {
        const token = await getToken({ skipCache: true });
        if (finished) return;
        if (!token) {
          publish({ state: "auth", message: "Your sign-in could not be verified. Try again, or use the account menu to sign out and sign in again." });
          return;
        }
        const response = await axiosInstance.post(
          "/user/bootstrap",
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            timeout: 15000,
            skipGlobalAuthSignOut: true,
          },
        );
        if (finished) return;
        const state = resolveFarmerDownloadAccess(response.data?.user);
        publish({
          state,
          message: state === "not-farmer"
            ? "This signed-in account is not a Farmer account. Please use the appropriate BreedSmart workspace."
            : "",
        });
      } catch (error) {
        if (finished) return;
        const status = error.response?.status;
        const payload = error.response?.data;
        if (status === 401) {
          publish({ state: "auth", message: "Your sign-in could not be verified. Try again, or use the account menu to sign out and sign in again." });
        } else if (!error.response || status >= 500 || status === 408 || status === 429 || payload?.retryable === true) {
          publish({ state: "temporary", message: TEMPORARY_MESSAGE });
        } else {
          publish({ state: "account", message: payload?.message || "This account could not be verified. Please contact your agricultural Technician or administrator." });
        }
      } finally {
        finished = true;
        clearTimeout(slowTimer);
        clearTimeout(deadline);
      }
    };

    // Clerk initialization is bounded too; public content never waits for it.
    if (isLoaded && isSignedIn && identity) verify();
    return () => {
      finished = true;
      controller.abort();
      clearTimeout(slowTimer);
      clearTimeout(deadline);
    };
  }, [getToken, isLoaded, isSignedIn, identity, requestKey]);

  const showStatus = !isLoaded || isSignedIn;
  const failed = ["temporary", "auth", "account", "not-farmer"].includes(current.state);

  return (
    <AuthShell
      context="Official BreedSmart App"
      title="BreedSmart Mobile"
      description="The mobile app for Farmers and agricultural Technicians in Oton, Iloilo."
      accountAction={isLoaded && isSignedIn ? <UserButton afterSignOutUrl="/" /> : null}
      helper={
        APP_DOWNLOAD_URL ? (
          "Download and install BreedSmart, then sign in using the same account."
        ) : (
          <span className="block space-y-1">
            <span className="block font-semibold text-[#061A0E]">Need the BreedSmart app?</span>
            <span className="block text-[#061A0E]/60">
              Please contact your agricultural technician or BreedSmart administrator for the latest installer.
            </span>
            <span className="block">After installing BreedSmart, sign in using the same account.</span>
          </span>
        )
      }
    >
      <AppActions />
      <a href="/" className="btn btn-ghost mt-3 w-full">Return Home</a>

      {showStatus ? (
        <section className="mt-6 rounded-sm border border-[#0D3320]/15 bg-[#0D3320]/5 p-4 text-sm text-[#061A0E]"
          role={failed ? "alert" : "status"} aria-live="polite">
          {current.state === "checking" ? (
            <>
              <p className="flex items-center gap-2 font-semibold">
                <span className="loading loading-dots loading-sm" aria-hidden="true" />
                Checking your BreedSmart account...
              </p>
              {current.slow ? <p className="mt-2">This is taking longer than usual. Your connection may be slow; you can still download the app.</p> : null}
            </>
          ) : current.state === "farmer" ? (
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={18} aria-hidden="true" /> Farmer profile connected
            </p>
          ) : (
            <>
              <h2 className="flex items-center gap-2 font-semibold">
                <TriangleAlert size={18} className="shrink-0" aria-hidden="true" />
                {current.state === "temporary" ? "Your account check couldn't finish"
                  : current.state === "auth" ? "Please check your sign-in"
                  : current.state === "not-farmer" ? "This link is for a Farmer account"
                  : "We could not verify this account"}
              </h2>
              <p className="mt-2">{current.message}</p>
              {["temporary", "auth"].includes(current.state) ? (
                <button type="button" className="btn btn-sm mt-3"
                  onClick={() => setAttempt((value) => value + 1)}>Try Again</button>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {isLoaded && !isSignedIn && hasInvitationTicket ? (
        <section className="mt-6 border-t border-[#0D3320]/15 pt-5">
          <h2 className="text-lg font-semibold">Complete your Farmer account</h2>
          <p className="mb-4 mt-2 text-sm">
            Your agricultural Technician has already prepared your BreedSmart profile.
            Create your account using the same email address that received the invitation.
          </p>
          <SignUp
            routing="virtual"
            forceRedirectUrl="/download-app"
            signInForceRedirectUrl="/download-app"
            appearance={clerkEmbeddedAppearance}
          />
        </section>
      ) : null}
    </AuthShell>
  );
}

function AppActions() {
  return (
    <div className="grid gap-3">
      <a
        className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-[#0D3320] px-5 font-display font-semibold text-[#A8E063] transition-colors duration-200 hover:bg-[#1A5C35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8E063] focus-visible:ring-offset-2"
        href={APP_DEEP_LINK_URL}
      >
        <Smartphone className="h-5 w-5" aria-hidden="true" />
        Open BreedSmart App
        <ArrowRight
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-1"
        />
      </a>
      {APP_DOWNLOAD_URL ? (
        <a
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-2 border-[#0D3320] bg-transparent px-5 font-display font-semibold text-[#061A0E] transition-colors duration-200 hover:bg-[#0D3320]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8E063] focus-visible:ring-offset-2"
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
