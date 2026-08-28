import {
  SignIn,
  SignUp,
  UserButton,
  useAuth,
  useClerk,
} from "@clerk/clerk-react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthShell from "../components/auth/AuthShell";
import {
  clerkEmbeddedAppearance,
  clerkStaffSignInAppearance,
} from "../config/clerkAppearance";
import axiosInstance from "../lib/axios";
import { APP_DEEP_LINK_URL, APP_DOWNLOAD_URL } from "../config/appDistribution";
import { resolveTechnicianWelcomeAccess } from "../config/onboardingBridge";
import { getStaffAccessNavigationState } from "../config/staffAccess";

const hasClerkInvitationTicket = (search) =>
  Boolean(new URLSearchParams(search).get("__clerk_ticket"));

export default function TechnicianWelcome() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const location = useLocation();
  const navigate = useNavigate();
  const [accessState, setAccessState] = useState("loading");
  const [message, setMessage] = useState("");
  const hasInvitationTicket = hasClerkInvitationTicket(location.search);
  const displayState = !isLoaded
    ? "loading"
    : accessState === "rejecting"
      ? "rejecting"
    : !isSignedIn
      ? hasInvitationTicket
        ? "invitation"
        : "signed-out"
      : accessState;

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !isSignedIn) return () => {};

    const rejectStaffAccess = async (role) => {
      const navigationState = getStaffAccessNavigationState(role);
      setAccessState("rejecting");

      try {
        await signOut(() => {
          navigate("/", { replace: true, state: navigationState });
        });
      } catch {
        if (cancelled) return;
        setAccessState("error");
        setMessage(
          "We could not sign out this account. Please try signing out again.",
        );
        return;
      }

    };

    const resolveIdentity = async () => {
      try {
        const token = await getToken();
        const response = await axiosInstance.post(
          "/user/bootstrap",
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (cancelled) return;

        const role = response.data?.user?.role;
        if (role === "admin") {
          navigate("/admin/dashboard", { replace: true });
          return;
        }

        const nextAccess = resolveTechnicianWelcomeAccess(response.data?.user);
        if (nextAccess === "technician") {
          setAccessState(nextAccess);
          return;
        }

        await rejectStaffAccess(role);
      } catch {
        if (cancelled) return;
        await rejectStaffAccess();
      }
    };

    resolveIdentity();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, navigate, signOut]);

  if (displayState === "signed-out") {
    return (
      <AuthShell
        context="BreedSmart Staff"
        title="Staff Sign In"
        description="Sign in with your authorized BreedSmart staff account to access the staff workspace."
        helper="Need access? Contact your BreedSmart administrator."
      >
        <SignIn
          routing="virtual"
          forceRedirectUrl="/technician/welcome"
          withSignUp={false}
          appearance={clerkStaffSignInAppearance}
        />
      </AuthShell>
    );
  }

  if (displayState === "invitation") {
    return (
      <AuthShell
        context="BreedSmart Staff"
        title="Complete your Technician account"
        description="You've been invited to join BreedSmart. Create your account using the same email address that received the invitation."
        helper="After setup, you can use the BreedSmart mobile app or continue on the web."
      >
        <SignUp
          routing="virtual"
          forceRedirectUrl="/technician/welcome"
          signInForceRedirectUrl="/technician/welcome"
          appearance={clerkEmbeddedAppearance}
        />
      </AuthShell>
    );
  }

  if (displayState === "loading" || displayState === "rejecting") {
    const isRejecting = displayState === "rejecting";

    return (
      <AuthShell
        context="BreedSmart Staff"
        title={isRejecting ? "Signing you out" : "Confirming your account"}
        description={
          isRejecting
            ? "This account cannot access the staff workspace."
            : "BreedSmart is securely checking your staff access."
        }
      >
        <div
          className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600"
          role="status"
        >
          <span className="loading loading-dots loading-sm text-[#17663a]" />
          <span>
            {isRejecting ? "Signing you out…" : "Confirming your account"}
          </span>
        </div>
      </AuthShell>
    );
  }

  if (displayState === "not-technician" || displayState === "error") {
    return (
      <AuthShell
        context="BreedSmart Staff"
        title={
          displayState === "not-technician"
            ? "This account cannot access the staff workspace"
            : "We could not confirm your account"
        }
        description={
          displayState === "not-technician"
            ? "You're currently signed in with a different BreedSmart role."
            : "Your staff access could not be verified. Review the message below, then sign in again if needed."
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
          <span>{message}</span>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      context="BreedSmart Staff"
      title="Your Technician account is ready"
      description="Your account has been confirmed. You can now open BreedSmart Mobile or continue to the staff workspace."
      helper={
        APP_DOWNLOAD_URL
          ? "Use the same BreedSmart account when signing in on mobile or web."
          : "If the app is not installed, ask your BreedSmart administrator for the current approved build."
      }
      accountAction={<UserButton afterSignOutUrl="/" />}
    >
      <div className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        <span>Technician access confirmed</span>
      </div>

      <div className="grid gap-3">
        <a
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#17663a] px-5 font-bold text-white transition-colors hover:bg-[#12512e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17663a] focus-visible:ring-offset-2"
          href={APP_DEEP_LINK_URL}
        >
          <Smartphone className="h-5 w-5" aria-hidden="true" />
          Open BreedSmart App
        </a>
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-bold text-slate-800 transition-colors hover:border-[#17663a] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17663a] focus-visible:ring-offset-2"
          to="/technician/dashboard"
        >
          Continue on Web
          <ExternalLink className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
      </div>

      {APP_DOWNLOAD_URL ? (
        <a
          className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-[#17663a] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17663a]"
          href={APP_DOWNLOAD_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download BreedSmart
        </a>
      ) : null}
    </AuthShell>
  );
}
