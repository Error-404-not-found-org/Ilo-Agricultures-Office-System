import { useUser } from "@clerk/clerk-react";

export default function TechnicianProfile() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-8 animate-fade-in">
        <div className="relative flex items-center justify-center">
          <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[3.5] opacity-20"></span>
          <span className="loading loading-ring loading-lg text-[#074033] dark:text-emerald-500 scale-[2.5] absolute"></span>
          <div className="absolute inset-0 blur-2xl bg-emerald-500/10 rounded-full animate-pulse"></div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[#074033] dark:text-emerald-500 font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">
            Establishing Link...
          </p>
          <p className="text-base-content/20 font-black uppercase tracking-[0.2em] text-[8px]">
            Personal Terminal Protocol
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-4 min-h-[60vh]">
      <h1 className="text-3xl font-black text-base-content tracking-tighter uppercase leading-none mb-6">
        My Profile
      </h1>

      <div className="bg-base-100 rounded-3xl shadow-xl border border-base-300 p-10 flex flex-col items-center sm:flex-row sm:items-start gap-10">
        <div className="avatar">
          <div className="w-40 rounded-full ring-4 ring-[#074033] dark:ring-emerald-500 ring-offset-base-100 ring-offset-4 shadow-2xl overflow-hidden">
            <img
              src={user?.imageUrl || "https://ui-avatars.com/api/?name=Tech"}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex-1 space-y-6 text-center sm:text-left pt-2">
          <div>
            <h2 className="text-4xl font-black text-base-content tracking-tight">
              {user?.fullName || "Technician Name"}
            </h2>
            <p className="text-blue-600 dark:text-emerald-500 font-black uppercase tracking-widest text-xs mt-2">
              Certified Technician
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 border-t border-base-300">
            <div>
              <p className="text-[10px] font-black text-base-content/30 uppercase tracking-[0.2em] mb-1">
                Email Address
              </p>
              <p className="text-base-content font-bold">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-base-content/30 uppercase tracking-[0.2em] mb-1">
                Security Role
              </p>
              <p className="text-base-content font-bold capitalize">
                {user?.publicMetadata?.role}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black text-base-content/30 uppercase tracking-[0.2em] mb-1">
                Account Status
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <p className="text-emerald-600 dark:text-emerald-500 font-black uppercase tracking-widest text-[10px]">
                  Verified & Active
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
