import { Smartphone } from "lucide-react";
import StaffSignInButton from "../../../components/auth/StaffSignInButton";
import { HERO_BG } from "../data/landingContent";

export default function LandingHero() {
  return (
    <section
      id="home"
      className="relative bg-[#FAF9F5] overflow-hidden border-b border-slate-200/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Left Column: Editorial Headline & Copy */}
        <div className="lg:col-span-6 space-y-6 text-left z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.08] tracking-tight">
            Better cattle care <br className="hidden sm:inline" />
            <span className="text-[#074033]">for Oton, Iloilo.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-700 font-small max-w-xl leading-relaxed">
            BreedSmart helps local cattle Farmers request services, organize
            animal records, and stay connected with agricultural Technicians.
          </p>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <a
              href="/download-app"
              className="inline-flex min-h-12 items-center justify-center gap-2.5 px-7 py-3 rounded-xl bg-[#074033] hover:bg-[#052E24] text-white text-sm sm:text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#074033] focus-visible:ring-offset-2"
            >
              <Smartphone size={18} />
              Download Farmer App
            </a>

            <StaffSignInButton size="lg" />
          </div>
        </div>

        {/* Right Column: Hero Photograph Frame */}
        <div className="lg:col-span-6 relative">
          <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 bg-slate-100 aspect-[4/3] sm:aspect-[16/10] lg:aspect-[4/3]">
            <img
              src={HERO_BG}
              alt="Filipino cattle farmer tending to cattle in a lush green pasture in Oton, Iloilo under warm golden hour sunlight"
              className="w-full h-full object-cover object-center"
              loading="eager"
              width="800"
              height="600"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
