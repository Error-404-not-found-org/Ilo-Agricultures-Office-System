import { ACTION_IMAGES } from "../data/landingContent";

export default function InAction() {
  return (
    <section data-motion-section className="bg-[#061A0E] py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div data-motion-intro className="flex items-center gap-4 mb-16">
          <span className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider">
            In Action
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Main Heading */}
        <div data-motion-intro className="mb-16">
          <h2 className="font-display font-bold text-white text-[clamp(2.5rem,5vw,5rem)] leading-[0.95] tracking-tight">
            See BreedSmart
            <br />
            <span className="text-[#A8E063]">in the field</span>
          </h2>
        </div>

        {/* Image Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {/* Large image */}
          <div data-motion-visual className="md:col-span-2 relative rounded-sm overflow-hidden bg-[#0D1F0F] aspect-video">
            <img
              src={ACTION_IMAGES[0]}
              alt="Farmer using BreedSmart app with cattle in Oton, Iloilo"
              className="w-full h-full object-cover opacity-70"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#061A0E]/80 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8">
              <p className="font-mono-brand text-[#A8E063] text-[11px] uppercase tracking-wider mb-2">
                Real story
              </p>
              <p className="text-white font-display font-semibold text-xl leading-snug">
                "I used to lose 3–4 cows a year to missed pregnancies. Last
                season, I had zero losses."
              </p>
              <p className="text-white/40 text-[13px] mt-2">
                — Maria Santos, Barangay San Antonio, Oton, Iloilo
              </p>
            </div>
          </div>

          {/* Two stacked images */}
          <div data-motion-visual className="flex flex-col gap-4">
            <div className="relative rounded-sm overflow-hidden bg-[#0D1F0F] flex-1">
              <img
                src={ACTION_IMAGES[1]}
                alt="Technician with cattle in Oton"
                className="w-full h-full object-cover opacity-60"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#061A0E]/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white font-display font-semibold text-[15px]">
                  Technician-led AI in 6 barangays
                </p>
              </div>
            </div>

            <div className="relative rounded-sm overflow-hidden bg-[#0D1F0F] flex-1">
              <img
                src={ACTION_IMAGES[2]}
                alt="Barn with healthy cattle in Oton"
                className="w-full h-full object-cover opacity-60"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#061A0E]/70 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white font-display font-semibold text-[15px]">
                  60% fewer emergency vet calls
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Testimonials - Without star ratings */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              quote:
                "The app pays for itself after the first pregnancy I would've missed.",
              name: "Juan Dela Cruz",
              role: "Smallholder farmer, Barangay Cagbang",
            },
            {
              quote:
                "I've cut my paperwork time from 2 hours to 10 minutes per day.",
              name: "Pedro Santos",
              role: "AI Technician, Oton Central",
            },
            {
              quote:
                "For the first time I have real data to show the municipal office. This changes everything.",
              name: "Dr. Maria Reyes",
              role: "Municipal Agriculturist Office",
            },
          ].map((testimonial) => (
            <div
              key={testimonial.name}
              data-motion-item
              className="bg-white/5 border border-white/10 rounded-sm p-6"
            >
              <p className="text-white/70 text-[15px] leading-relaxed mb-5 italic">
                "{testimonial.quote}"
              </p>
              <p className="text-white font-medium text-[14px]">
                {testimonial.name}
              </p>
              <p className="text-white/30 text-[12px] font-mono-brand">
                {testimonial.role}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
