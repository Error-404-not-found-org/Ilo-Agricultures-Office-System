import { CheckCircle2, Smartphone } from "lucide-react";
import { MOCKUP_IMG, FARMER_APP_FEATURES } from "../data/landingContent";

export default function FarmerAppSection() {
  return (
    <section
      id="for-farmers"
      className="bg-[#EDF3E8]/60 py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200/60"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Side: Copy & Key Capabilities */}
        <div className="lg:col-span-7 text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-breedsmart-deep text-white text-xs font-bold uppercase tracking-wider">
            <Smartphone size={14} />
            Farmer Android App
          </div>

          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-slate-900 tracking-tight leading-tight">
            Cattle care in the palm of your hand
          </h2>

          <p className="text-base sm:text-sm text-slate-700 font-medium leading-relaxed max-w-xl">
            The BreedSmart Android app helps Farmers in Oton manage cattle
            information, request services, and receive Technician updates.
          </p>

          <div className="space-y-3 pt-2">
            {FARMER_APP_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-breedsmart-deep shrink-0" />
                <span className="text-sm font-bold text-slate-800">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <a
              href="#download-app"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-breedsmart-deep hover:bg-breedsmart-dark text-white text-sm font-bold transition-all shadow-md hover:shadow-lg"
            >
              Download Farmer App
            </a>
          </div>
        </div>

        {/* Right Side: Real Phone Mockup Frame */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-75 sm:max-w-85 relative">
            <img
              src={MOCKUP_IMG}
              alt="BreedSmart Farmer mobile companion interface preview"
              className="w-full h-auto object-contain drop-shadow-xl"
              loading="lazy"
              width="340"
              height="680"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
