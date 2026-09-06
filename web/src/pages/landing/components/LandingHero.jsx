import { ArrowRight } from "lucide-react";
import { HERO_BG } from "../data/landingContent";

export default function LandingHero() {
  return (
    <section
      id="home"
      tabIndex={-1}
      data-motion-hero
      className="relative bg-[#061A0E] overflow-hidden min-h-screen flex flex-col justify-end"
    >
      {/* Background image with parallax */}
      <div className="absolute inset-0">
        <div data-motion-hero-image className="absolute inset-0">
          <img
            src={HERO_BG}
            alt="Filipino cattle farmer tending to cattle in a lush green pasture in Oton, Iloilo under warm golden hour sunlight"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </div>
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#061A0E] via-[#061A0E]/70 to-[#061A0E]/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#061A0E]/60 to-transparent" />
      </div>

      {/* Grid lines */}
      <div className="absolute inset-0 grid grid-cols-6 pointer-events-none opacity-10">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="border-l border-white/30 h-full" />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 w-full">
        {/* Label */}
        <div className="mb-8" data-motion-hero-part>
          <span className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#A8E063]/10 border border-[#A8E063]/20">
            <span className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider">
              Built for Livestock Services in Oton, Iloilo
            </span>
          </span>
        </div>

        {/* Headline */}
        <h1
          data-motion-hero-part
          className="font-display font-bold text-white text-[clamp(3rem,8vw,7.5rem)] leading-[0.9] tracking-tight max-w-4xl mb-8"
        >
          Breed
          <br />
          <span className="text-[#A8E063]">Smarter.</span>
          <br />
          Farm Better.
        </h1>

        <p
          data-motion-hero-part
          className="text-white/60 text-[clamp(1rem,1.5vw,1.25rem)] max-w-xl leading-relaxed mb-12 font-light"
        >
          BreedSmart helps local Farmers request Artificial Insemination and
          health assistance, manage cattle records, and stay connected with
          Agricultural Technicians.
        </p>
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center">
          <a
            data-motion-hero-cta
            href="#platform-overview"
            className="group inline-flex items-center justify-center gap-2 bg-[#A8E063] text-[#061A0E] font-display font-semibold text-[15px] px-8 py-4 rounded-sm hover:bg-[#C5EF89] transition-colors duration-200"
          >
            Explore Platform
            <ArrowRight
              size={16}
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </a>

          <a
            data-motion-hero-cta
            href="#how-it-works"
            className="inline-flex items-center justify-center text-white/70 font-medium text-[15px] px-8 py-4 border border-white/20 rounded-sm hover:border-white/40 hover:text-white transition-colors duration-200"
          >
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}
