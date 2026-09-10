import StaffSignInButton from "../../../components/auth/StaffSignInButton";
import { ArrowUp, Sprout } from "lucide-react";
import {
  BRAND_LOGO_TRANSPARENT,
  OTON_LOGO,
  NAV_LINKS,
} from "../data/landingContent";

export default function PublicFooter() {
  return (
    <footer data-motion-section className="bg-[#061A0E] text-white/40 py-16 px-4 sm:px-6 lg:px-8 border-t border-white/10 text-center md:text-left">
      <div data-motion-intro className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
          {/* Col 1: Brand & Location */}
          <div className="md:col-span-5 space-y-6">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <img
                src={BRAND_LOGO_TRANSPARENT}
                alt="BreedSmart"
                className="w-8 h-8 object-contain"
                width="32"
                height="32"
              />
              <span className="font-display font-bold text-white text-[15px] tracking-tight">
                BreedSmart
              </span>
            </div>

            <p className="text-white/40 text-[14px] leading-relaxed max-w-sm mx-auto md:mx-0">
              Livestock-management and agricultural-service coordination
              platform for cattle Farmers and Technicians in Oton, Iloilo.
            </p>

            <div className="flex items-center justify-center md:justify-start gap-2">
              <img
                src={OTON_LOGO}
                alt="Municipality of Oton"
                className="h-6 w-6 object-contain"
                width="24"
                height="24"
              />
              <span className="font-mono-brand text-white/30 text-[11px] uppercase tracking-wider">
                Oton, Iloilo, Philippines
              </span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="md:col-span-4">
            <p className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider mb-6">
              Platform
            </p>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/40 text-[14px] hover:text-white/70 transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Staff Access */}
          <div className="md:col-span-3">
            <p className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider mb-6">
              Staff Access
            </p>
            <p className="text-white/40 text-[14px] leading-relaxed mb-4">
              Authorized Technicians & Administrators portal access.
            </p>
            <StaffSignInButton variant="inverse" size="sm" showIcon={true} />
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="font-mono-brand text-white/20 text-[11px]">
            © {new Date().getFullYear()} BreedSmart · Office of the Municipal
            Agriculturist, Oton, Iloilo
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#home"
              className="text-white/20 text-[11px] font-mono-brand hover:text-white/40 transition-colors duration-200"
            >
              Privacy Policy
            </a>
            <span className="text-white/10">•</span>
            <a
              href="#home"
              className="text-white/20 text-[11px] font-mono-brand hover:text-white/40 transition-colors duration-200"
            >
              Terms of Use
            </a>
          </div>
          <button
            type="button"
            aria-label="Back to top"
            title="Back to top"
            className="btn btn-circle btn-lg relative shrink-0 self-end md:self-auto bg-[#A8E063] text-[#061A0E] border-0 hover:bg-[#C5EF89] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A8E063]"
            onClick={() => {
              const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
              document.getElementById("home")?.focus({ preventScroll: true });
            }}
          >
            <Sprout size={22} aria-hidden="true" />
            <ArrowUp size={14} aria-hidden="true" className="absolute right-1 top-1" />
          </button>
        </div>
      </div>
    </footer>
  );
}
