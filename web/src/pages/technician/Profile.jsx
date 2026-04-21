import { useUser } from "@clerk/clerk-react";

export default function TechnicianProfile() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center flex-col min-h-[60vh] gap-4">
        <span className="loading loading-infinity loading-lg text-[#074033] scale-150"></span>
        <p className="text-[#074033] font-medium tracking-wide animate-pulse">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-center sm:flex-row sm:items-start gap-8">
        <div className="avatar">
          <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
            <img src={user?.imageUrl || "https://ui-avatars.com/api/?name=Tech"} alt="Profile" />
          </div>
        </div>
        
        <div className="flex-1 space-y-4 text-center sm:text-left">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{user?.fullName || "Technician Name"}</h2>
            <p className="text-primary font-medium mt-1">Certified Technician</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-500">Email Address</p>
              <p className="text-gray-800">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Role</p>
              <p className="text-gray-800 capitalize">{user?.publicMetadata?.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Account Status</p>
              <p className="text-emerald-600 font-medium">Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
