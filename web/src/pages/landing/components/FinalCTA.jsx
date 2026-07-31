import { SignInButton } from "@clerk/clerk-react";
import { Smartphone, ShieldCheck } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="bg-[#074033] text-white py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
          Better records. Better service. <br className="hidden sm:inline" />
          <span className="text-[#EDF3E8]">Stronger cattle care.</span>
        </h2>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#download-app"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-white text-[#074033] hover:bg-[#FAF9F5] text-base font-extrabold transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
          >
            <Smartphone size={20} />
            Download Farmer App
          </a>

          <SignInButton mode="modal">
            <button className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full border border-white/30 hover:border-white text-white text-base font-bold transition-all cursor-pointer w-full sm:w-auto">
              <ShieldCheck size={20} />
              Staff Sign In
            </button>
          </SignInButton>
        </div>
      </div>
    </section>
  );
}
