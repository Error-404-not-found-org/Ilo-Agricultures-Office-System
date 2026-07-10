import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  Download,
  Leaf,
  MapPinned,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const APK_URL =
  "https://expo.dev/accounts/johndong28/projects/mobile/builds/3fdaa274-212f-435e-9ceb-626608c66ebe";
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
  APK_URL,
)}`;
const LOGO_URL =
  "https://res.cloudinary.com/donhulins/image/upload/v1780319299/foreground_fpxivy.png";
const MOCKUP_URL =
  "https://res.cloudinary.com/donhulins/image/upload/v1780318231/mockup_1.png";
const OTON_LOGO =
  "https://res.cloudinary.com/donhulins/image/upload/v1780316603/OtonImg2_fwxtsh.png";

export default function DownloadApp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source") || searchParams.get("mode");
  const isInviteFlow =
    source === "invite" ||
    source === "invite-complete" ||
    source === "account-ready";

  const headline = isInviteFlow
    ? "Your BreedSmart account is ready"
    : "Install BreedSmart Mobile";
  const intro = isInviteFlow
    ? "Finish by installing the app, then sign in with the same account you used for the invitation."
    : "Download the mobile app used by farmers and technicians to manage animal records, service requests, visits, and field updates.";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#f5fbf1] font-sans text-slate-950 antialiased">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-28 -top-32 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="absolute -right-28 top-1/3 h-96 w-96 rounded-full bg-lime-300/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-60 bg-linear-to-t from-emerald-900/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 px-4 text-[11px] font-black uppercase tracking-wider text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            <ChevronLeft size={14} /> Go Back
          </button>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 rounded-full border border-emerald-900/10 bg-white/85 px-4 py-2 shadow-sm sm:flex">
            <img
              src={OTON_LOGO}
              alt="BreedSmart logo"
              className="h-9 w-9 rounded-full object-contain"
            />
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-950">
              Oton Municipal Agriculture
            </span>
          </div>

          <SignedIn>
            <div className="flex items-center gap-3 rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 shadow-sm">
              <UserButton afterSignOutUrl="/" />
              <span className="hidden text-[11px] font-black uppercase tracking-wider text-emerald-950 sm:block">
                Account
              </span>
            </div>
          </SignedIn>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-12">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-6 inline-flex items-center gap-3 rounded-full border border-emerald-900/10 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-900 shadow-sm"
            >
              <img
                src={LOGO_URL}
                alt=""
                className="h-7 w-7 rounded-full object-contain"
              />
              BreedSmart Mobile App
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.45 }}
              className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-emerald-950 sm:text-6xl lg:text-7xl"
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.45 }}
              className="mt-6 max-w-xl text-base font-semibold leading-7 text-slate-700 sm:text-lg"
            >
              {intro}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="mt-8 grid max-w-xl gap-4 rounded-4xl border border-emerald-900/10 bg-white/85 p-4 shadow-xl shadow-emerald-900/10 backdrop-blur sm:grid-cols-[148px_1fr]"
            >
              <div className="rounded-3xl border border-emerald-900/10 bg-white p-3 shadow-sm">
                <img
                  src={QR_URL}
                  alt="QR code to download the BreedSmart APK"
                  className="aspect-square w-full rounded-2xl object-contain"
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                  Scan or tap to install
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  Use your phone camera to scan the QR code, or tap the download
                  button to get the Android APK.
                </p>
                <a
                  href={APK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-14 items-center justify-center gap-3 rounded-full bg-emerald-700 px-6 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800"
                >
                  <Download size={19} /> Download APK
                </a>
              </div>
            </motion.div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <TrustItem
                icon={<ShieldCheck size={18} />}
                title="Secure sign in"
                body="Use your Clerk account in the mobile app."
              />
              <TrustItem
                icon={<MapPinned size={18} />}
                title="Field ready"
                body="Built for farm visits and service requests."
              />
              <TrustItem
                icon={<Leaf size={18} />}
                title="Livestock records"
                body="Track animals, health, breeding, and calving."
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative mx-auto w-full max-w-lg"
          >
            <div className="absolute -left-7 top-16 z-10 hidden rounded-3xl bg-white px-5 py-4 shadow-2xl shadow-emerald-900/10 lg:block">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Service Status
              </p>
              <p className="mt-1 text-sm font-black text-emerald-950">
                Ready for field use
              </p>
            </div>

            <div className="relative rounded-[2.25rem] border border-emerald-900/10 bg-white/75 p-5 shadow-2xl shadow-emerald-900/15 backdrop-blur">
              <div className="absolute right-6 top-10 z-10 flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-sm">
                <Sprout size={14} className="text-emerald-700" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-950">
                  Farmer ready
                </span>
              </div>

              <div className="overflow-hidden rounded-[1.75rem] bg-linear-to-br from-emerald-900 via-emerald-700 to-lime-500">
                <img
                  src={MOCKUP_URL}
                  alt="BreedSmart mobile app mockup"
                  className="mx-auto max-h-[560px] w-full object-contain drop-shadow-2xl"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {["AI requests", "Health logs", "Animal records"].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-2 py-3 text-center"
                    >
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-emerald-700"
                      />
                      <span className="text-[10px] font-black text-emerald-950">
                        {item}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>

            <SignedOut>
              <p className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-100/80 px-4 py-3 text-center text-xs font-bold leading-5 text-amber-950">
                If you received an invitation, complete account setup from your
                email first. Then install the app and sign in.
              </p>
            </SignedOut>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function TrustItem({ icon, title, body }) {
  return (
    <div className="rounded-3xl border border-emerald-900/10 bg-white/75 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
        {icon}
      </div>
      <p className="text-sm font-black text-emerald-950">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {body}
      </p>
    </div>
  );
}
