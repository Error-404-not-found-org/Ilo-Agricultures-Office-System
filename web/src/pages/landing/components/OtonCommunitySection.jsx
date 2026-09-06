import { OTON_LOGO, MUNICIPAL_SEAL } from "../data/landingContent";

export default function OtonCommunitySection() {
  return (
    <section data-motion-section className="bg-[#F5F2E8] py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Side: Logos & Branding */}
          <div data-motion-visual data-motion-x="-22" className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <img
                src={OTON_LOGO}
                alt="Municipality of Oton Logo"
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                width="64"
                height="64"
              />
              <img
                src={MUNICIPAL_SEAL}
                alt="Oton Municipal Seal"
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                width="64"
                height="64"
              />
            </div>

            <div className="h-12 w-px bg-[#061A0E]/10" />

            <div className="flex flex-col">
              <span className="font-mono-brand text-[#1A5C35] text-[11px] uppercase tracking-wider mb-1">
                Municipality of
              </span>
              <span className="font-display font-bold text-[#061A0E] text-[1.5rem] leading-tight">
                Oton, Iloilo
              </span>
              <span className="font-mono-brand text-[#061A0E]/50 text-[11px] uppercase tracking-wider mt-1">
                Philippines
              </span>
            </div>
          </div>

          {/* Right Side: Purpose Copy */}
          <div data-motion-intro className="space-y-4">
            <h2 className="font-display font-bold text-[#061A0E] text-[clamp(1.5rem,3vw,2.5rem)] leading-[1.1] tracking-tight">
              Designed for Oton's
              <br />
              farming community
            </h2>
            <p className="text-[#061A0E]/60 text-[1rem] leading-relaxed max-w-lg">
              BreedSmart supports more organized coordination between local
              cattle Farmers and the Office of the Municipal Agriculturist of
              Oton, Iloilo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
