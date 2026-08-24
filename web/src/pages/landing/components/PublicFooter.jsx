import StaffSignInButton from "../../../components/auth/StaffSignInButton";
import { BRAND_LOGO, OTON_LOGO, NAV_LINKS } from "../data/landingContent";

export default function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-left">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Col 1: Brand & Location */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGO}
                alt="BreedSmart"
                className="w-10 h-10 object-contain"
                width="32"
                height="32"
              />
              <span className="text-lg font-extrabold text-white tracking-tight">
                BreedSmart
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium max-w-sm leading-relaxed">
              Livestock-management and agricultural-service coordination
              platform for cattle Farmers and Technicians in Oton, Iloilo.
            </p>
            <p className="text-xs font-semibold text-slate-400">
              <img
                src={OTON_LOGO}
                alt="Municipality of Oton"
                className="mr-2 inline-block h-5 w-5 object-contain"
              />
              Oton, Iloilo, Philippines
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
              Navigation
            </h3>
            <ul className="space-y-2 text-xs font-medium">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Staff Access */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
              Staff Access
            </h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Authorized Technicians & Administrators portal access.
            </p>
            <div>
              <StaffSignInButton
                variant="link"
                size="sm"
                showIcon={false}
                className="min-h-0 p-0 text-xs font-bold text-emerald-400 underline hover:bg-transparent hover:text-emerald-300"
              />
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-medium text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} BreedSmart. Office of the
            Municipal Agriculturist, Oton, Iloilo.
          </p>
          <div className="flex items-center gap-4">
            <a href="#home" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="#home" className="hover:text-white transition-colors">
              Terms of Use
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
