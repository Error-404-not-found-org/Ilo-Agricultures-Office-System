import { HOW_IT_WORKS_STEPS } from "../data/landingContent";

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      data-motion-section
      className="bg-[#F5F2E8] py-28 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div data-motion-intro className="flex items-center gap-4 mb-16">
          <span className="font-mono-brand text-[#1A5C35] text-[11px] uppercase tracking-wider">
            How it works
          </span>
          <div className="flex-1 h-px bg-[#061A0E]/10" />
        </div>

        {/* Header Content */}
        <div data-motion-intro className="grid md:grid-cols-2 gap-16 mb-16">
          <h2 className="font-display font-bold text-[#061A0E] text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-tight">
            From farm to service
            <br />
            in four simple steps
          </h2>
          <p className="text-[#061A0E]/60 text-[1.1rem] leading-relaxed self-end">
            BreedSmart's dispatch system connects farmers to the right
            technician instantly — every step logged, timestamped, and traceable
            for quality assurance.
          </p>
        </div>

        {/* 4 Steps Flow */}
        <div className="grid md:grid-cols-4 gap-4 lg:gap-6">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <div key={step.step} data-motion-item className="relative">
              {/* Step Card */}
              <div className="bg-[#F5F2E8] p-8 h-full group hover:bg-white transition-colors duration-200 border border-[#061A0E]/10 rounded-sm">
                {/* Number */}
                <p className="font-mono-brand text-[#A8E063] text-[2.5rem] font-bold mb-6 leading-none">
                  {step.step}
                </p>

                {/* Title */}
                <h3 className="font-display font-semibold text-[#061A0E] text-[1.15rem] mb-3 group-hover:text-[#0D3320] transition-colors duration-200">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-[#061A0E]/50 text-[14px] leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Connector arrow (except last item) */}
              {index < HOW_IT_WORKS_STEPS.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-5 lg:-right-7 -translate-y-1/2 z-20">
                  <div className="w-8 h-8 bg-[#0D3320] rounded-full flex items-center justify-center border-2 border-[#F5F2E8] shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5h6M5 2l3 3-3 3"
                        stroke="#A8E063"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
