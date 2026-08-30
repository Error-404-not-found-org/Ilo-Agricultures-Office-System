import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import AuthShell from "../components/auth/AuthShell";
import axiosInstance from "../lib/axios";
import {
  classifyStaffBootstrapFailure,
  getStaffAccessNavigationState,
  STAFF_SIGN_IN_INTENT_KEY,
} from "../config/staffAccess";

import PublicNavbar from './landing/components/PublicNavbar';
import LandingHero from './landing/components/LandingHero';
import ValueStrip from './landing/components/ValueStrip';
import HowItWorks from './landing/components/HowItWorks';
import FarmerAppSection from './landing/components/FarmerAppSection';
import StaffPortalSection from './landing/components/StaffPortalSection';
import OtonCommunitySection from './landing/components/OtonCommunitySection';
import AppDownloadSection from './landing/components/AppDownloadSection';
import FinalCTA from './landing/components/FinalCTA';
import PublicFooter from './landing/components/PublicFooter';

export default function Landing() {
  const { isSignedIn, isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const location = useLocation();
  const navigate = useNavigate();
  const consumedStaffAccessMessage = useRef(null);
  const [isHandlingStaffAccessFeedback, setIsHandlingStaffAccessFeedback] =
    useState(() => Boolean(location.state?.staffAccessMessage));
  const [isRejectingStaffAccess, setIsRejectingStaffAccess] = useState(false);
  const [staffAccessIssue, setStaffAccessIssue] = useState(null);
  const [staffAccessRetry, setStaffAccessRetry] = useState(0);
  const hasStaffSignInIntent =
    window.sessionStorage.getItem(STAFF_SIGN_IN_INTENT_KEY) === "true";

  useEffect(() => {
    const feedback = location.state?.staffAccessMessage;
    if (!feedback || consumedStaffAccessMessage.current === feedback) return;

    consumedStaffAccessMessage.current = feedback;
    navigate(
      `${location.pathname}${location.search}${location.hash}`,
      { replace: true, state: null },
    );

    if (feedback.type === "error") {
      toast.error(feedback.title, { description: feedback.description });
    }
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !isSignedIn || !hasStaffSignInIntent) {
      return () => {};
    }

    const rejectStaffAccess = async (role, message) => {
      const navigationState = getStaffAccessNavigationState(role, message);
      setIsHandlingStaffAccessFeedback(true);
      setIsRejectingStaffAccess(true);
      window.sessionStorage.removeItem(STAFF_SIGN_IN_INTENT_KEY);

      try {
        await signOut(() => {
          setIsRejectingStaffAccess(false);
          navigate("/", { replace: true, state: navigationState });
        });
      } catch {
        setIsRejectingStaffAccess(false);
        toast.error("Unable to sign out", {
          description:
            "Please try again before using another BreedSmart account.",
        });
        return;
      }

    };

    const resolveStaffAccess = async () => {
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
          setStaffAccessIssue(null);
          window.sessionStorage.removeItem(STAFF_SIGN_IN_INTENT_KEY);
          navigate("/admin/dashboard", { replace: true });
          return;
        }
        if (role === "technician") {
          setStaffAccessIssue(null);
          window.sessionStorage.removeItem(STAFF_SIGN_IN_INTENT_KEY);
          navigate("/technician/dashboard", { replace: true });
          return;
        }

        await rejectStaffAccess(role);
      } catch (error) {
        if (cancelled) return;
        const failure = classifyStaffBootstrapFailure(error);
        if (failure.kind === "server-unavailable") {
          setIsHandlingStaffAccessFeedback(true);
          setStaffAccessIssue(failure.message);
          return;
        }
        await rejectStaffAccess(undefined, failure.message);
      }
    };

    resolveStaffAccess();
    return () => {
      cancelled = true;
    };
  }, [
    getToken,
    hasStaffSignInIntent,
    isLoaded,
    isSignedIn,
    navigate,
    signOut,
    staffAccessRetry,
  ]);

  if (staffAccessIssue) {
    return (
      <AuthShell
        context="BreedSmart Staff"
        title={staffAccessIssue.title}
        description={staffAccessIssue.description}
        helper="Your Clerk session is still active. Retrying will only check your BreedSmart profile again."
      >
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            setStaffAccessIssue(null);
            setStaffAccessRetry((current) => current + 1);
          }}
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      </AuthShell>
    );
  }

  if (isRejectingStaffAccess) {
    return (
      <AuthShell
        context="BreedSmart Staff"
        title="Signing you out"
        description="This account cannot access the staff workspace."
      >
        <div
          className="flex items-center justify-center gap-3 rounded-xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600"
          role="status"
        >
          <span className="loading loading-dots loading-sm text-[#17663a]" />
          <span>Signing you out…</span>
        </div>
      </AuthShell>
    );
  }

  if (
    isLoaded &&
    isSignedIn &&
    !hasStaffSignInIntent &&
    !isHandlingStaffAccessFeedback
  ) {
    const role = user?.publicMetadata?.role;
    if (role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (role === "technician") {
      return <Navigate to="/technician/dashboard" replace />;
    } else if (role === "farmer") {
      // Farmers do not have a web portal dashboard; redirect them to the app download page
      return <Navigate to="/download-app" replace />;
    }
  }

  return (
    <div className="font-['Outfit'] min-h-screen flex flex-col bg-[#FAF9F5] text-slate-900 antialiased selection:bg-[#EDF3E8] selection:text-[#074033]">
      <PublicNavbar />
      <main className="flex-1">
        <LandingHero />
        <ValueStrip />
        <HowItWorks />
        <FarmerAppSection />
        <StaffPortalSection />
        <OtonCommunitySection />
        <AppDownloadSection />
        <FinalCTA />
      </main>
      <PublicFooter />
    </div>
  );
}
