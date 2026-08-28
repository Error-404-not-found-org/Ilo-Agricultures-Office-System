import BRAND_LOGO from "../../assets/branding/logo.png";
import OTON_SEAL from "../../assets/branding/OtonImg2.png";

export default function AuthShell({
  context,
  title,
  description,
  children,
  helper,
  accountAction,
}) {
  return (
    <main className="auth-shell min-h-dvh bg-[#f6f8f6] px-4 py-8 text-slate-800 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-6 text-center">
          <img
            src={BRAND_LOGO}
            alt="BreedSmart"
            className="mx-auto h-20 w-20 rounded-2xl object-contain sm:h-24 sm:w-24"
          />
          <p className="mt-3 text-xl font-extrabold tracking-tight text-[#174f32]">
            BreedSmart
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-6 sm:px-8 sm:py-8">
          {accountAction ? (
            <div className="mb-5 flex justify-end">{accountAction}</div>
          ) : null}

          <div className="text-center">
            {context ? (
              <p className="mb-2 text-sm font-semibold text-[#17663a]">
                {context}
              </p>
            ) : null}
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-slate-600 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>

          <div className="mt-7">{children}</div>

          {helper ? (
            <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm leading-5 text-slate-700">
              {helper}
            </p>
          ) : null}
        </section>

        <footer className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-4 text-slate-800">
          <img
            src={OTON_SEAL}
            alt="Municipality of Oton"
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span>A service of the Municipality of Oton, Iloilo</span>
        </footer>
      </div>
    </main>
  );
}
