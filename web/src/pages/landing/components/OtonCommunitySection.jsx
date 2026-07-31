import { MapPin, Building2 } from "lucide-react";
import { OTON_LOGO, MUNICIPAL_SEAL } from "../data/landingContent";

export default function OtonCommunitySection() {
  return (
    <section className="bg-[#EDF3E8] py-16 lg:py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center text-left">
        {/* Left Side: Logos & Branding */}
        <div className="md:col-span-4 flex items-center gap-4 justify-start">
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
          <div className="h-10 w-px bg-slate-300 mx-1" />
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-wider text-[#074033]">
              Oton, Iloilo
            </span>
            <span className="text-[11px] font-bold text-slate-600">
              Philippines
            </span>
          </div>
        </div>

        {/* Right Side: Purpose Copy */}
        <div className="md:col-span-8 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Designed for Oton's farming community
          </h2>
          <p className="text-sm sm:text-base text-slate-700 font-medium leading-relaxed max-w-2xl">
            BreedSmart supports more organized coordination between local cattle
            Farmers and the Office of the Municipal Agriculturist of Oton,
            Iloilo.
          </p>
        </div>
      </div>
    </section>
  );
}
