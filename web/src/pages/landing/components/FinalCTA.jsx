import { Smartphone } from "lucide-react";
import StaffSignInButton from "../../../components/auth/StaffSignInButton";

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
            href="/download-app"
            className="inline-flex min-h-12 items-center justify-center gap-2.5 px-8 py-3 rounded-xl bg-white text-[#074033] hover:bg-[#FAF9F5] text-base font-extrabold transition-colors w-full sm:w-auto"
          >
            <Smartphone size={20} />
            Download Farmer App
          </a>

          <StaffSignInButton
            variant="inverse"
            size="lg"
            className="w-full sm:w-auto"
          />
        </div>
      </div>
    </section>
  );
}
