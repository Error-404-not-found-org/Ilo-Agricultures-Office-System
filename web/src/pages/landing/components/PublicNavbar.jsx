import { useState } from "react";
import {
  SignInButton,
  SignOutButton,
  useUser,
} from "@clerk/clerk-react";
import { Menu, X, ArrowRight } from "lucide-react";
import { OTON_LOGO, NAV_LINKS } from "../data/landingContent";

export default function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSignedIn, user } = useUser();

  const isStaffRole = ["admin", "technician"].includes(
    user?.publicMetadata?.role,
  );

  return (
    <header className="sticky top-0 z-50 bg-[#FAF9F5]/95 backdrop-blur-md border-b border-slate-200/60 transition-colors">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Name */}
        <a
          href="#home"
          className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-[#074033] rounded-lg p-1"
        >
          <img
            src={OTON_LOGO}
            alt="Oton Agriculture Seal"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
            width="40"
            height="40"
          />
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-extrabold text-[#074033] tracking-tight">
                BreedSmart
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#052E24] bg-[#EDF3E8] px-2 py-0.5 rounded-full border border-[#074033]/10">
                Oton, Iloilo
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 hidden sm:inline-block">
              Better cattle care for Oton, Iloilo.
            </span>
          </div>
        </a>

        {/* Center Navigation Links (Desktop) */}
        <div className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-700">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-[#074033] transition-colors focus:outline-none focus:ring-2 focus:ring-[#074033] rounded-md px-2 py-1"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right Side Actions */}
        <div className="hidden sm:flex items-center gap-3">
          {isSignedIn && isStaffRole ? (
            <a
              href={
                user?.publicMetadata?.role === "admin"
                  ? "/admin/dashboard"
                  : "/technician/dashboard"
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#074033] hover:bg-[#052E24] text-white text-xs sm:text-sm font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-[#074033]"
            >
              Go to Portal <ArrowRight size={14} />
            </a>
          ) : (
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full border border-[#074033]/30 text-[#074033] hover:bg-[#EDF3E8] text-xs sm:text-sm font-bold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#074033]">
                Staff Sign In
              </button>
            </SignInButton>
          )}

          <a
            href="#download-app"
            className="px-5 py-2 rounded-full bg-[#074033] hover:bg-[#052E24] text-white text-xs sm:text-sm font-bold transition-all shadow-xs hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#074033]"
          >
            Download App
          </a>

          {isSignedIn && (
            <SignOutButton>
              <button className="text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer ml-1">
                Sign Out
              </button>
            </SignOutButton>
          )}
        </div>

        {/* Mobile Hamburger Menu Button */}
        <div className="flex sm:hidden items-center gap-2">
          <a
            href="#download-app"
            className="px-3.5 py-1.5 rounded-full bg-[#074033] text-white text-xs font-bold"
          >
            Download
          </a>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 hover:text-[#074033] focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-[#FAF9F5] border-b border-slate-200 px-4 py-5 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col gap-3 font-semibold text-sm text-slate-700">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-[#074033] border-b border-slate-100"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <SignInButton mode="modal">
              <button className="w-full text-center py-2.5 rounded-full border border-[#074033] text-[#074033] font-bold text-xs">
                Staff Sign In
              </button>
            </SignInButton>

            <a
              href="#download-app"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-full bg-[#074033] text-white font-bold text-xs"
            >
              Download Farmer App
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
