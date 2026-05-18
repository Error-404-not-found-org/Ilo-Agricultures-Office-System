import React from "react";

const LoadingView = ({ message = "Synchronizing Data..." }) => {
  return (
    <div className="flex justify-center items-center flex-col min-h-[60vh] gap-8 animate-fade-in">
      <div className="relative flex items-center justify-center">
        <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[3.5] opacity-20"></span>
        <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[2.5] absolute"></span>
        <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-full animate-pulse"></div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-[#074033] dark:text-emerald-500 font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">
          {message}
        </p>
        <p className="text-base-content/20 font-black uppercase tracking-[0.2em] text-[8px]">
          Secure Console Handshake
        </p>
      </div>  
    </div>
  );
};

export default LoadingView;
