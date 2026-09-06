import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import StaffSignInButton from "../../../components/auth/StaffSignInButton";
import { BRAND_LOGO_TRANSPARENT, NAV_LINKS } from "../data/landingContent";

export default function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      data-motion-navbar
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled || mobileMenuOpen
          ? "bg-[#F5F2E8]/95 backdrop-blur-md border-b border-[#061A0E]/10"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16 sm:h-20">
        {/* Left Side: Brand Logo & Name */}
        <a href="#home" className="flex items-center gap-2.5 group">
          <img
            src={BRAND_LOGO_TRANSPARENT}
            alt="BreedSmart"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
            width="36"
            height="36"
          />
          <div className="flex flex-col text-left">
            <span
              className={`font-display font-bold text-[15px] sm:text-base tracking-tight leading-tight transition-colors duration-300 ${
                scrolled ? "text-[#061A0E]" : "text-white"
              }`}
            >
              BreedSmart
            </span>
            <span
              className={`text-[10px] sm:text-[11px] font-mono-brand hidden sm:inline-block uppercase tracking-wider transition-colors duration-300 ${
                scrolled ? "text-[#061A0E]/50" : "text-white/50"
              }`}
            >
              Oton, Iloilo
            </span>
          </div>
        </a>

        {/* Center Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`text-[13px] font-medium tracking-wide transition-colors duration-300 ${
                scrolled
                  ? "text-[#061A0E]/70 hover:text-[#0D3320]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <StaffSignInButton
            size="sm"
            variant={scrolled ? "outline" : "inverse"}
          />

          <a
            href="/download-app"
            className="group inline-flex items-center gap-2 bg-[#A8E063] text-[#061A0E] text-[13px] font-semibold px-5 py-2.5 rounded-sm hover:bg-[#C5EF89] transition-colors duration-200"
          >
            Download App
            <ArrowRight
              size={14}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>
        </div>

        {/* Mobile Hamburger Menu Button */}
        <div className="flex sm:hidden items-center gap-2">
          <a
            href="/download-app"
            className="bg-[#A8E063] text-[#061A0E] text-xs font-semibold px-4 py-2.5 rounded-sm"
          >
            Download App
          </a>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 transition-colors duration-300 ${
              scrolled ? "text-[#061A0E]" : "text-white"
            }`}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      <div
        className={`lg:hidden bg-[#F5F2E8] border-b border-[#061A0E]/10 overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-6 pb-6 pt-4 flex flex-col gap-2">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="py-3 text-[15px] text-[#061A0E] font-medium border-b border-[#061A0E]/5"
            >
              {link.label}
            </a>
          ))}

          <div className="flex flex-col gap-3 pt-4">
            <StaffSignInButton
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setMobileMenuOpen(false)}
            />

            <a
              href="/download-app"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-3 rounded-sm bg-[#0D3320] text-[#A8E063] font-semibold text-sm"
            >
              Download App
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
