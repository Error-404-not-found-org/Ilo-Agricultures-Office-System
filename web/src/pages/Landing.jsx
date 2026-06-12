import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser, SignInButton, SignOutButton } from "@clerk/clerk-react";
import { 
  ShieldCheck, Smartphone, Download, ArrowRight, LayoutDashboard, 
  CheckCircle2, Shield, Award, MapPin, Database, Sprout, HeartPulse, FileText 
} from 'lucide-react';

const Landing = () => {
    const { isSignedIn, isLoaded, user } = useUser();

    if (isLoaded && isSignedIn) {
        // Redirect based on role
        if (user?.publicMetadata?.role === 'admin') {
            return <Navigate to="/admin/dashboard" replace />;
        } else if (user?.publicMetadata?.role === 'technician') {
            return <Navigate to="/technician/dashboard" replace />;
        } else if (user?.publicMetadata?.role === 'farmer') {
            return <Navigate to="/farmer/dashboard" replace />;
        }
    }

    return (
      <div className="font-['Outfit'] min-h-screen flex flex-col bg-white text-slate-800 transition-colors duration-300">
        {/* Header Navbar */}
        <nav className="navbar px-4 sm:px-6 lg:px-12 py-3 bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://res.cloudinary.com/donhulins/image/upload/v1780316603/OtonImg2_fwxtsh.png"
              alt="Oton Agriculture Logo"
              className="w-10 h-10 object-contain hover:scale-105 transition-transform duration-300"
            />
            <div className="flex flex-col">
              <span className="text-sm font-extrabold uppercase tracking-widest text-[#074033]">
                Municipality of Oton
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Office of the Municipal Agriculturist
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-500/10 text-[10px] font-bold uppercase tracking-wider text-[#074033]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              System Online
            </div>
            {isSignedIn && (
              <SignOutButton>
                <button className="btn btn-xs btn-outline border-slate-200 text-xs font-semibold cursor-pointer">
                  Sign Out
                </button>
              </SignOutButton>
            )}
          </div>
        </nav>

        {/* Hero Banner Section with Background Image */}
        <header
          className="relative bg-cover bg-center py-16 md:py-24 px-4 sm:px-6 lg:px-12 flex items-center justify-center overflow-hidden min-h-[500px]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.45)), url('https://res.cloudinary.com/donhulins/image/upload/v1780317557/farmHeroBg_u0yuso.jpg')",
          }}
        >
          {/* Visual Glassmorphic Hero Card */}
          <div className="max-w-5xl w-full bg-white/70 backdrop-blur-lg rounded-3xl p-6 sm:p-8 lg:p-12 shadow-2xl border border-white/40 flex flex-col md:flex-row items-center gap-8 sm:gap-12 relative z-10">
            {/* Left Side: Copy and Actions */}
            <div className="flex-1 text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#074033]/15 text-[#074033] text-xs font-extrabold tracking-wider uppercase border border-[#074033]/10">
                <Sprout size={13} className="animate-bounce" /> Oton Municipal
                Portal
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                Smart Breeding <br />
                <span className="text-[#074033]">BreedSmart Portal</span>
              </h1>

              <p className="text-sm sm:text-base text-slate-650 leading-relaxed font-semibold">
                Empowering livestock breeders, streamlining technician
                operations, and tracking field health requests across Oton,
                Iloilo.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-2">
                {isSignedIn &&
                !["admin", "technician", "farmer"].includes(
                  user?.publicMetadata?.role,
                ) ? (
                  <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100 flex flex-col gap-2 max-w-md">
                    <p className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Access Restricted
                    </p>
                    <p className="text-xs font-semibold leading-relaxed">
                      You are signed in as{" "}
                      <strong>
                        {String(user?.publicMetadata?.role || "Guest")}
                      </strong>
                      . Please contact the agricultural administrator to
                      provision your account credentials.
                    </p>
                    <SignOutButton>
                      <button className="btn btn-xs bg-rose-600 hover:bg-rose-700 border-none text-white font-bold rounded-xl mt-2 cursor-pointer w-fit">
                        Sign Out & Switch Account
                      </button>
                    </SignOutButton>
                  </div>
                ) : (
                  <SignInButton mode="modal">
                    <button className="btn btn-md sm:btn-lg bg-[#074033] hover:bg-[#052e24] border-none text-white font-extrabold rounded-2xl px-6 sm:px-8 shadow-lg shadow-emerald-950/20 hover:shadow-emerald-950/30 transition-all flex items-center gap-2 cursor-pointer active:scale-98">
                      <LayoutDashboard size={18} />
                      Access Command Center
                      <ArrowRight size={16} />
                    </button>
                  </SignInButton>
                )}
              </div>
            </div>

            {/* Right Side: Large Oton Seal Badge */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-white shadow-xl border border-slate-100 hover:scale-105 transition-transform duration-300 flex items-center justify-center shrink-0 relative p-3">
                <img
                  src="https://res.cloudinary.com/donhulins/image/upload/v1780319299/foreground_fpxivy.png"
                  alt="Oton Municipal Seal"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#074033] mt-3">
                Official Seal
              </span>
            </div>
          </div>
        </header>

        {/* Dedicated Mobile App Showcase Section (Mockup + QR Code below) */}
        <section className="bg-slate-50 border-t border-b border-slate-100 py-16 px-4 sm:px-6 lg:px-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Mobile App Mockup Image */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-[280px] sm:max-w-[320px] transition-transform duration-500 hover:scale-103">
                <img
                  src="https://res.cloudinary.com/donhulins/image/upload/v1780318231/mockup_1.png"
                  alt="BreedSmart Mobile Companion"
                  className="w-full h-full object-contain drop-shadow-2xl"
                />
              </div>
            </div>

            {/* Right Column: App Description & QR Code area */}
            <div className="lg:col-span-6 text-left space-y-6">
              <div className="inline-flex items-center gap-1.5 text-[#074033] font-extrabold">
                <Smartphone size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Farmer's Mobile Companion
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-wide leading-tight">
                BreedSmart Mobile System
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                Download the BreedSmart Farmer Companion mobile app. Scan
                livestock profiles, request artificial insemination services,
                schedule veterinary visits, and review cattle history in one
                clean dashboard.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs items-center">
                {/* QR Code Container */}
                <div className="sm:col-span-4 flex justify-center sm:justify-start">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs shrink-0 flex items-center justify-center">
                    <img
                      src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://expo.dev/accounts/johndong28/projects/mobile/builds/b04de87e-0342-4443-8824-ac2ba4cf7737"
                      alt="Download Mobile App QR"
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                </div>

                {/* Scan & Actions info */}
                <div className="sm:col-span-8 space-y-2 text-center sm:text-left">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Scan to Install App
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                    Align your device camera with the QR code to install
                    instantly or click the button below to get the APK file.
                  </p>
                  <a 
                    href="https://expo.dev/accounts/johndong28/projects/mobile/builds/b04de87e-0342-4443-8824-ac2ba4cf7737"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-xs btn-outline border-slate-200 text-[10px] font-bold uppercase tracking-wider gap-1.5 cursor-pointer mt-1 inline-flex items-center"
                  >
                    <Download size={11} /> Download APK File
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Municipal Program Features Grid */}
        <section className="bg-white px-4 sm:px-6 lg:px-12 py-16">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <span className="text-[10px] font-black text-[#074033] uppercase tracking-widest">
                Digital Solutions Matrix
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                Core Office Services
              </h3>
              <div className="w-12 h-1 bg-[#074033] mx-auto rounded-full mt-3"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Service 1 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-500/20 hover:bg-white hover:shadow-md transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#074033] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <Sprout size={18} />
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Artificial Insemination
                </h4>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Complete artificial insemination tracking from synchronization
                  logs to calving outputs.
                </p>
              </div>

              {/* Service 2 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-rose-500/20 hover:bg-white hover:shadow-md transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <HeartPulse size={18} />
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Livestock Health Logs
                </h4>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Centralized diagnostics records keeping, vaccination
                  scheduling, and emergency dispatch services.
                </p>
              </div>

              {/* Service 3 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-500/20 hover:bg-white hover:shadow-md transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <Database size={18} />
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Farmer Registries
                </h4>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Secure client database linking farmer listings with their
                  specific cattle inventory records.
                </p>
              </div>

              {/* Service 4 */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-purple-500/20 hover:bg-white hover:shadow-md transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
                  <FileText size={18} />
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Reports & Analytics
                </h4>
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Detailed monthly accomplishment reports exporting and live
                  statistical tracking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 sm:px-6 lg:px-12 py-6 bg-slate-50 border-t border-slate-200/50 text-center text-slate-500 text-xs font-medium space-y-2">
          <div className="flex items-center justify-center gap-2">
            <img
              src="https://res.cloudinary.com/donhulins/image/upload/v1780316603/OtonImg2_fwxtsh.png"
              alt="Oton Agriculture Logo"
              className="w-5 h-5 object-contain"
            />
            <p>
              &copy; {new Date().getFullYear()} Municipality of Oton, Iloilo.
              All Rights Reserved.
            </p>
          </div>
          <p className="text-[10px] opacity-75 font-semibold">
            Authorized Personnel Access Only. BreedSmart system metrics
            synchronized.
          </p>
        </footer>
      </div>
    );
};

export default Landing;
