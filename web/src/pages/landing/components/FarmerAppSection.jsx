import { CheckCircle2, ArrowRight } from "lucide-react";
import { FARMER_APP_FEATURES } from "../data/landingContent";

export default function FarmerAppSection() {
  return (
    <section
      id="for-farmers"
      data-motion-section
      className="bg-[#F5F2E8] py-28 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div data-motion-intro className="flex items-center gap-4 mb-16">
          <span className="font-mono-brand text-[#1A5C35] text-[11px] uppercase tracking-wider">
            Farmer Experience
          </span>
          <div className="flex-1 h-px bg-[#061A0E]/10" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Left Side: Phone Mockup */}
          <div data-motion-visual data-motion-x="-28" className="relative flex justify-center order-2 lg:order-1">
            <div className="relative">
              {/* Phone frame */}
              <div className="w-70 bg-[#061A0E] rounded-[2.5rem] p-2 shadow-2xl shadow-[#061A0E]/30">
                <div className="bg-[#0D1F0F] rounded-4xl overflow-hidden">
                  {/* Status bar */}
                  <div className="bg-[#0D3320] px-5 pt-4 pb-2 flex justify-between items-center">
                    <span className="text-white/60 font-mono-brand text-[10px]">
                      9:41
                    </span>
                    <div className="w-16 h-4 bg-[#061A0E] rounded-full mx-auto" />
                    <span className="text-white/60 font-mono-brand text-[10px]">
                      ●●●
                    </span>
                  </div>

                  {/* App content */}
                  <div className="bg-[#0D1F0F] p-4 min-h-120">
                    <p className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider mb-4">
                      BreedSmart · My Herd
                    </p>

                    {/* Alert card */}
                    <div className="bg-[#A8E063]/10 border border-[#A8E063]/30 rounded-sm p-3 mb-3">
                      <p className="text-[#A8E063] text-[11px] font-mono-brand uppercase tracking-wide mb-1">
                        🔥 Heat Alert
                      </p>
                      <p className="text-white text-[13px] font-medium">
                        Abena #47
                      </p>
                      <p className="text-white/50 text-[11px]">
                        Optimal window: Now → 18hrs
                      </p>
                    </div>

                    {/* Animal list */}
                    {[
                      {
                        id: "#12",
                        name: "Akosua",
                        stage: "Pregnant — Day 64",
                        color: "#7CBF3A",
                      },
                      {
                        id: "#31",
                        name: "Ama",
                        stage: "Dry period",
                        color: "#8FA896",
                      },
                      {
                        id: "#58",
                        name: "Adwoa",
                        stage: "Calving in 12 days",
                        color: "#A8E063",
                      },
                    ].map((animal) => (
                      <div
                        key={animal.id}
                        className="flex items-center gap-3 py-2.5 border-b border-white/5"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: animal.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[13px] font-medium">
                            {animal.id} · {animal.name}
                          </p>
                          <p className="text-white/40 text-[11px]">
                            {animal.stage}
                          </p>
                        </div>
                      </div>
                    ))}

                    <div className="mt-4 bg-[#A8E063] rounded-sm py-2.5 text-center hover:bg-[#C5EF89] transition-colors cursor-pointer">
                      <p className="text-[#061A0E] text-[12px] font-display font-semibold">
                        Request Technician
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -right-8 top-16 bg-white rounded-sm shadow-lg p-3 border border-[#061A0E]/5 hidden sm:block">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#A8E063] rounded-full flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-[#061A0E]" />
                  </div>
                  <div>
                    <p className="text-[#061A0E] text-[11px] font-semibold">
                      Pregnancy confirmed
                    </p>
                    <p className="text-[#061A0E]/40 text-[10px]">
                      Akosua · Day 60 scan
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Copy & Features */}
          <div data-motion-intro className="order-1 lg:order-2">
            <h2 className="font-display font-bold text-[#061A0E] text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-tight mb-6">
              Every farmer
              <br />
              becomes an expert
            </h2>

            <p className="text-[#061A0E]/60 text-[1.05rem] leading-relaxed mb-10 max-w-md">
              No training required. BreedSmart guides farmers through every
              stage of the reproductive cycle with simple, localized alerts and
              clear next steps.
            </p>

            <ul className="space-y-3 mb-10">
              {FARMER_APP_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2
                    size={16}
                    className="text-[#A8E063] shrink-0 mt-0.5"
                    strokeWidth={2}
                  />
                  <span className="text-[#061A0E]/70 text-[15px] leading-relaxed">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <a
              data-motion-cta
              href="/download-app"
              className="group inline-flex items-center gap-2 bg-[#0D3320] text-[#A8E063] font-display font-semibold text-[15px] px-8 py-4 rounded-sm hover:bg-[#1A5C35] transition-colors duration-200"
            >
              Download Farmer App
              <ArrowRight
                size={16}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
