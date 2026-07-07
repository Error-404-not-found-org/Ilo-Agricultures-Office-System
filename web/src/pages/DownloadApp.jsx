import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Download,
  Leaf,
  MapPinned,
  ShieldCheck,
  Smartphone,
  Sprout,
  UserCheck,
} from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";

const APK_URL =
  "https://expo.dev/accounts/johndong28/projects/mobile/builds/3fdaa274-212f-435e-9ceb-626608c66ebe";

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
    <main className="min-h-[100dvh] overflow-hidden bg-[#f5fbf1] text-slate-950 relative font-sans antialiased">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-28 h-80 w-80 rounded-full bg-emerald-300/35 blur-3xl" />
        <div className="absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-lime-300/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-emerald-900/10 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 px-4 text-[11px] font-black uppercase tracking-wider text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
          >
            <ChevronLeft size={14} /> Go Back
          </button>

          <SignedIn>
            <div className="flex items-center gap-3 rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 shadow-sm">
              <UserButton afterSignOutUrl="/" />
              <span className="hidden text-[11px] font-black uppercase tracking-wider text-emerald-950 sm:block">
                Account
              </span>
            </div>
          </SignedIn>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.04fr_0.96fr] lg:py-12">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-emerald-900 shadow-sm"
            >
              <Sprout size={15} />
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
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <a
                href={APK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-emerald-700 px-6 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                <Download size={19} /> Download APK
              </a>
              <a
                href={APK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-emerald-900/15 bg-white/85 px-6 text-sm font-black uppercase tracking-wider text-emerald-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Open Build Page <ArrowRight size={18} />
              </a>
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
            className="relative mx-auto w-full max-w-md"
          >
            <div className="absolute -left-8 top-10 hidden rounded-3xl bg-white px-5 py-4 shadow-2xl shadow-emerald-900/10 lg:block">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Service Status
              </p>
              <p className="mt-1 text-sm font-black text-emerald-950">
                Ready for field use
              </p>
            </div>

            <div className="rounded-[2rem] border border-emerald-900/10 bg-white/85 p-4 shadow-2xl shadow-emerald-900/15 backdrop-blur">
              <div className="rounded-[1.55rem] bg-emerald-950 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                      BreedSmart
                    </p>
                    <p className="mt-1 text-xl font-black">Farm Dashboard</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500">
                    <Smartphone size={24} />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MiniMetric label="Animals" value="24" />
                  <MiniMetric label="Visits" value="Today" />
                </div>

                <div className="mt-4 rounded-2xl bg-white p-4 text-slate-950">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                      <UserCheck size={21} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {isInviteFlow ? "Account setup complete" : "Install and sign in"}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">
                        {isInviteFlow
                          ? "Use the same invited account in the app."
                          : "Farmers and technicians can access assigned workflows."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {["AI service requests", "Health assistance", "Animal history"].map(
                    (item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3"
                      >
                        <span className="text-sm font-bold text-emerald-50">
                          {item}
                        </span>
                        <CheckCircle2 size={17} className="text-lime-300" />
                      </div>
                    ),
                  )}
                </div>
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

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}
