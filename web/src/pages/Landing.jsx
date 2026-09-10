import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import error503Icon from "../assets/branding/503_icon.webp";
import axiosInstance from "../lib/axios";
import {
  classifyStaffBootstrapFailure,
  getStaffAccessNavigationState,
  STAFF_SIGN_IN_INTENT_KEY,
} from "../config/staffAccess";

import PublicNavbar from "./landing/components/PublicNavbar";
import StaffSigningInScreen from "../components/auth/StaffSigningInScreen";
import LandingHero from "./landing/components/LandingHero";
import ValueStrip from "./landing/components/ValueStrip";
import HowItWorks from "./landing/components/HowItWorks";
import FarmerAppSection from "./landing/components/FarmerAppSection";
import StaffPortalSection from "./landing/components/StaffPortalSection";
import OtonCommunitySection from "./landing/components/OtonCommunitySection";
import InAction from "./landing/components/InAction";
import FinalCTA from "./landing/components/FinalCTA";
import PublicFooter from "./landing/components/PublicFooter";
import Developers from "./landing/components/Developers";
import useLandingAnimations from "./landing/hooks/useLandingAnimations";
import "./landing/landingMotion.css";

function AnimatedPublicLanding() {
  const landingRef = useRef(null);
  useLandingAnimations(landingRef);

  return (
    <div
      ref={landingRef}
      data-landing-motion
      className="font-['Outfit'] min-h-screen flex flex-col bg-[#FAF9F5] text-slate-900 antialiased selection:bg-[#EDF3E8] selection:text-[#074033]"
    >
      <PublicNavbar />
      <main className="flex-1">
        <LandingHero />
        <ValueStrip />
        <HowItWorks />
        <FarmerAppSection />
        <StaffPortalSection />
        <OtonCommunitySection />
        <InAction />
        <Developers />
        <FinalCTA />
      </main>
      <PublicFooter />
    </div>
  );
}

const MIN_SIGN_IN_DISPLAY_MS =
  import.meta.env?.MODE === "test" ? 0 : 650;

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
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null,
    });

    if (feedback.type === "error") {
      toast.error(feedback.title, {
        description: feedback.description,
        closeButton: false,
        className: "landing-progress-toast",
      });
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
          closeButton: false,
          className: "landing-progress-toast",
        });
        return;
      }
    };

    const resolveStaffAccess = async () => {
      try {
        const token = await getToken();
        const [response] = await Promise.all([
          axiosInstance.post(
            "/user/staff-bootstrap",
            {},
            { headers: { Authorization: `Bearer ${token}` } },
          ),
          new Promise((resolve) => setTimeout(resolve, MIN_SIGN_IN_DISPLAY_MS)),
        ]);
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
      <main className="min-h-dvh flex items-center justify-center px-5 py-12 bg-[#061A0E]">
        <div className="w-full max-w-lg flex flex-col items-center text-center">
          <div className="mb-8">
            <span className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider">
              BreedSmart Staff
            </span>
          </div>

          <img
            src={error503Icon}
            alt="Connection problem"
            className="w-64 h-auto object-contain mb-8 opacity-80"
          />

          <h1 className="font-display font-semibold text-[clamp(1.5rem,3vw,2rem)] leading-tight mb-4 text-white">
            Connection problem
          </h1>

          <p className="text-[1rem] leading-relaxed max-w-sm mb-12 text-white/50">
            {staffAccessIssue?.description ||
              "BreedSmart could not reach the server to verify your staff profile. Check your connection and try again."}
          </p>

          <div className="flex flex-col w-full sm:flex-row justify-center gap-4">
            <button
              type="button"
              className="group inline-flex items-center justify-center gap-2 font-display font-semibold text-[14px] px-6 py-3 rounded-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-[#0D3320] text-[#A8E063] hover:bg-[#1A5C35] focus-visible:ring-[#A8E063] focus-visible:ring-offset-[#061A0E]"
              onClick={() => {
                setStaffAccessIssue(null);
                setStaffAccessRetry((current) => current + 1);
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try Again
            </button>

            <button
              type="button"
              className="group inline-flex items-center justify-center gap-2 font-display font-semibold text-[14px] px-6 py-3 rounded-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-transparent border-2 border-[#A8E063] text-white hover:bg-[#A8E063]/10 focus-visible:ring-[#A8E063] focus-visible:ring-offset-[#061A0E]"
              onClick={() => {
                window.sessionStorage.removeItem(STAFF_SIGN_IN_INTENT_KEY);
                setStaffAccessIssue(null);
                setIsHandlingStaffAccessFeedback(true);
              }}
            >
              Return to public site
            </button>
          </div>

          <p className="mt-12 text-white/20 font-mono-brand text-[11px] uppercase tracking-wider">
            Your sign-in is still active. Retrying will only check your BreedSmart profile again.
          </p>
        </div>
      </main>
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

  const isSigningInStaff = hasStaffSignInIntent && isSignedIn;
  const userEmail =
    isSigningInStaff || isRejectingStaffAccess
      ? user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        ""
      : "";

  return (
    <>
      <AnimatedPublicLanding />
      {isRejectingStaffAccess ? (
        <StaffSigningInScreen email={userEmail} mode="signing-out" />
      ) : isSigningInStaff ? (
        <StaffSigningInScreen email={userEmail} mode="signing-in" />
      ) : null}
    </>
  );
}
