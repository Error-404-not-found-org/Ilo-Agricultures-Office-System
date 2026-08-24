import { SignInButton, SignUp, UserButton, useAuth } from "@clerk/clerk-react";
import { CheckCircle2, Download, ExternalLink, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import axiosInstance from "../lib/axios";
import {
  APP_DEEP_LINK_URL,
  APP_DOWNLOAD_URL,
} from "../config/appDistribution";
import { resolveTechnicianWelcomeAccess } from "../config/onboardingBridge";

const hasClerkInvitationTicket = (search) =>
  Boolean(new URLSearchParams(search).get("__clerk_ticket"));

export default function TechnicianWelcome() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const [accessState, setAccessState] = useState("loading");
  const [message, setMessage] = useState("");
  const hasInvitationTicket = hasClerkInvitationTicket(location.search);
  const displayState = !isLoaded
    ? "loading"
    : !isSignedIn
      ? hasInvitationTicket
        ? "invitation"
        : "signed-out"
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

        const nextAccess = resolveTechnicianWelcomeAccess(response.data?.user);
        setAccessState(nextAccess);
        if (nextAccess !== "technician") {
          setMessage(
            "This signed-in account is not an approved Technician account.",
          );
        }
      } catch (error) {
        if (cancelled) return;
        setAccessState("error");
        setMessage(
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

  return (
    <main className="min-h-dvh bg-base-200 px-4 py-8 text-base-content sm:px-6">
      <div className="mx-auto flex max-w-2xl justify-end pb-4">
        {isSignedIn && <UserButton afterSignOutUrl="/" />}
      </div>

      <section className="card card-border mx-auto max-w-2xl bg-base-100 shadow-xl">
        <div className="card-body gap-6 p-6 sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-base-200 text-base-content">
            <Smartphone aria-hidden="true" size={24} />
          </div>

          <div>
            <p className="text-sm font-semibold text-base-content/60">
              BreedSmart Technician onboarding
            </p>
            <h1 className="card-title mt-2 text-3xl">
              Welcome to BreedSmart
            </h1>
          </div>

          {displayState === "loading" && (
            <div className="flex items-center gap-3" role="status">
              <span className="loading loading-spinner loading-md" />
              <span>Confirming your account…</span>
            </div>
          )}

          {displayState === "signed-out" && (
            <div className="alert alert-info alert-soft">
              <span>
                Sign in with the same email address that received the Technician
                invitation.
              </span>
              <SignInButton mode="modal">
                <button className="btn btn-sm">Sign in</button>
              </SignInButton>
            </div>
          )}

          {displayState === "invitation" && (
            <div className="flex flex-col items-center gap-4">
              <div className="alert alert-info alert-soft w-full">
                <span>
                  Complete your Technician invitation to create your account.
                </span>
              </div>
              <SignUp
                routing="virtual"
                forceRedirectUrl="/technician/welcome"
                signInForceRedirectUrl="/technician/welcome"
              />
            </div>
          )}

          {(displayState === "not-technician" || displayState === "error") && (
            <div className="alert alert-warning alert-soft" role="alert">
              <span>{message}</span>
            </div>
          )}

          {displayState === "technician" && (
            <>
              <div className="alert alert-success alert-soft">
                <CheckCircle2 aria-hidden="true" size={20} />
                <span>
                  Your Technician account is confirmed. You can now open the
                  mobile app or continue to the existing web workspace.
                </span>
              </div>

              <div className="card-actions grid gap-3 sm:grid-cols-2">
                <a className="btn btn-primary" href={APP_DEEP_LINK_URL}>
                  <Smartphone aria-hidden="true" size={18} />
                  Open BreedSmart App
                </a>
                <Link className="btn" to="/technician/dashboard">
                  Continue on Web
                  <ExternalLink aria-hidden="true" size={17} />
                </Link>
              </div>

              {APP_DOWNLOAD_URL ? (
                <a
                  className="btn btn-outline"
                  href={APP_DOWNLOAD_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Download aria-hidden="true" size={18} />
                  Download BreedSmart App
                </a>
              ) : (
                <p className="text-sm text-base-content/65">
                  If the app is not installed, ask your BreedSmart administrator
                  for the current approved build.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
