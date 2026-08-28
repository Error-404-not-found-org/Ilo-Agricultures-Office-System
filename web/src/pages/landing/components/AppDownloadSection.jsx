import { Download, Smartphone, QrCode } from 'lucide-react';
import { APK_URL, QR_URL } from '../data/landingContent';

export default function AppDownloadSection() {
  const steps = [
    "Download the official Android file.",
    "Open the downloaded file.",
    "Allow installation when prompted.",
    "Install and open BreedSmart.",
  ];

  return (
    <section id="download-app" className="bg-[#FAF9F5] py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto space-y-12 text-left">
        
        {/* Header */}
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#074033] text-white text-xs font-bold uppercase tracking-wider">
            <Smartphone size={14} />
            Android Application
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Download BreedSmart for Android
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            Install the official BreedSmart Android app for authorized Farmers and Technicians.
          </p>
        </div>

        {/* Action Card Container */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left / Top: Direct Download & Steps */}
          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-4">
              {APK_URL ? (
                <a
                  href={APK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-[#074033] hover:bg-[#052E24] text-white text-base font-extrabold transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
                >
                  <Download size={20} />
                  Download BreedSmart
                </a>
              ) : (
                <p className="inline-flex rounded-2xl bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
                  The current app download is not configured yet.
                </p>
              )}
              <p className="text-xs font-semibold text-slate-500">
                Downloads the latest official BreedSmart Android release.
              </p>
            </div>

            {/* Installation Steps */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Installation Steps
              </h3>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {steps.map((step, idx) => (
                  <li key={step} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 bg-[#FAF9F5] p-3 rounded-xl border border-slate-200/60">
                    <span className="w-5 h-5 rounded-full bg-[#074033] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Right / Bottom: QR Code Container (Desktop View) */}
          {QR_URL && <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-[#EDF3E8]/60 rounded-2xl border border-slate-200/60 text-center">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs mb-3">
              <img
                src={QR_URL}
                alt="QR Code to scan and download the BreedSmart Android app"
                className="w-36 h-36 object-contain"
                width="144"
                height="144"
              />
            </div>
            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <QrCode size={14} className="text-[#074033]" />
              Scan QR Code on Desktop
            </span>
            <span className="text-[11px] font-medium text-slate-600 mt-1">
              Point your smartphone camera to access the download.
            </span>
          </div>}

        </div>

      </div>
    </section>
  );
}
