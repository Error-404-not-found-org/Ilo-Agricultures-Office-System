import { ArrowRight } from "lucide-react";
import StaffSignInButton from "../../../components/auth/StaffSignInButton";

export default function FinalCTA() {
  return (
    <section data-motion-section className="bg-[#0D3320] py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        {/* Section Label */}
        <div data-motion-intro className="flex items-center justify-center gap-4 mb-12">
          <div className="flex-1 h-px bg-white/10 max-w-24" />
          <span className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider">
            Get Started
          </span>
          <div className="flex-1 h-px bg-white/10 max-w-24" />
        </div>

        {/* Headline */}
        <h2 data-motion-intro className="font-display font-bold text-white text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.95] tracking-tight mb-8">
          Ready to breed
          <br />
          <span className="text-[#A8E063]">smarter?</span>
        </h2>

        <p data-motion-intro className="text-white/50 text-[1.1rem] leading-relaxed mb-12 max-w-xl mx-auto">
          Join farmers and technicians across Oton who are already using
          BreedSmart to improve their livestock operations.
        </p>

        {/* Action Buttons */}
        <div data-motion-cta className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/download-app"
            className="group inline-flex items-center gap-2 bg-[#A8E063] text-[#061A0E] font-display font-semibold text-[15px] px-8 py-4 rounded-sm hover:bg-[#C5EF89] transition-colors duration-200 w-full sm:w-auto justify-center"
          >
            Download Farmer App
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>

          <StaffSignInButton
            variant="inverse"
            size="lg"
            className="w-full sm:w-auto"
          />
        </div>

        {/* Bottom note */}
        <p data-motion-cta className="mt-8 text-white/30 font-mono-brand text-[11px] uppercase tracking-wider">
          Free for farmers · No training required
        </p>
      </div>
    </section>
  );
}
