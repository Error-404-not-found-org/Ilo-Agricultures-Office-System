import { HOW_IT_WORKS_STEPS } from "../data/landingContent";

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="bg-[#FAF9F5] py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200/60"
    >
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#074033] bg-[#EDF3E8] px-3 py-1 rounded-full border border-[#074033]/10">
            Simple Connected Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How BreedSmart works
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            A simple way for Farmers and Agricultural Technicians in Oton to
            work together.
          </p>
        </div>

        {/* 4 Steps Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div
              key={step.step}
              className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#074033] text-white font-extrabold text-sm flex items-center justify-center mb-4">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
