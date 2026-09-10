import { ArrowLeft, House, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import notFoundIcon from "../assets/branding/404_icon.webp";

const DESTINATIONS = {
  admin: { homePath: "/admin/dashboard", homeLabel: "Admin Dashboard" },
  technician: {
    homePath: "/technician/dashboard",
    homeLabel: "Technician Dashboard",
  },
  public: { homePath: "/", homeLabel: "BreedSmart Home" },
};

export default function NotFound({ role = "public" }) {
  const navigate = useNavigate();
  const destination = DESTINATIONS[role] || DESTINATIONS.public;
  const isPublic = role === "public";

  return (
    <main
      className={`min-h-dvh flex items-center justify-center px-5 py-12 ${
        isPublic ? "bg-[#061A0E]" : "bg-base-200"
      }`}
    >
      <div className="w-full max-w-lg flex flex-col items-center text-center">
        {/* Label - Only for public */}
        {isPublic && (
          <div className="mb-8">
            <span className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider">
              Error 404
            </span>
          </div>
        )}

        {/* Icon */}
        <img
          src={notFoundIcon}
          alt="404 - Page not found"
          className={`w-64 h-auto object-contain mb-8 ${
            isPublic ? "opacity-80" : ""
          }`}
        />

        {/* Heading */}
        <h1
          className={`font-display font-semibold text-[clamp(1.5rem,3vw,2rem)] leading-tight mb-4 ${
            isPublic ? "text-white" : "text-base-content"
          }`}
        >
          Page not found
        </h1>

        <p
          className={`text-[1rem] leading-relaxed max-w-sm mb-12 ${
            isPublic ? "text-white/50" : "text-base-content/80"
          }`}
        >
          This page may have moved or the address may be incorrect.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col w-full sm:flex-row justify-center gap-4">
          <button
            type="button"
            className={`group inline-flex items-center justify-center gap-2 font-display font-semibold text-[14px] px-6 py-3 rounded-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isPublic
                ? "bg-[#0D3320] text-[#A8E063] hover:bg-[#1A5C35] focus-visible:ring-[#A8E063] focus-visible:ring-offset-[#061A0E]"
                : "btn bg-base-content text-base-100 hover:bg-base-content/90 focus-visible:ring-base-content focus-visible:ring-offset-base-200"
            }`}
            onClick={() => navigate(-1)}
          >
            <ArrowLeft
              size={16}
              className="transition-transform duration-200 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            Go Back
          </button>

          <Link
            className={`group inline-flex items-center justify-center gap-2 font-display font-semibold text-[14px] px-6 py-3 rounded-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isPublic
                ? "bg-transparent border-2 border-[#A8E063] text-white hover:bg-[#A8E063]/10 focus-visible:ring-[#A8E063] focus-visible:ring-offset-[#061A0E]"
                : "btn btn-primary focus-visible:ring-primary focus-visible:ring-offset-base-200"
            }`}
            to={destination.homePath}
          >
            <House size={16} aria-hidden="true" />
            {destination.homeLabel}
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* Bottom note - Only for public */}
        {isPublic && (
          <p className="mt-12 text-white/20 font-mono-brand text-[11px] uppercase tracking-wider">
            BreedSmart · Oton, Iloilo
          </p>
        )}
      </div>
    </main>
  );
}
