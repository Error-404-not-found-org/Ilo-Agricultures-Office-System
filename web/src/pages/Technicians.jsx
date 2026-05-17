import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "../lib/axios";
import AddTechnicianModal from "../components/AddTechnicianModal";
import EditTechnicianModal from "../components/EditTechnicianModal";

import LoadingView from "../components/LoadingView";

const Technicians = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState(null);

  const {
    data: technicians,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["technicians"], // Changed key for clarity
    queryFn: async () => {
      const response = await axios.get("/user?role=technician");
      return response.data;
    },
  });

  if (isLoading) return <LoadingView message="Listing Technicians..." />;

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error.message}</span>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "badge-success text-white";
      case "on-site":
        return "badge-warning text-white";
      case "on-leave":
        return "badge-error text-white";
      default:
        return "badge-ghost";
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-black text-base-content tracking-tight uppercase">Fleet Roster</h1>
            <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">Active Personnel Registry</p>
        </div>
        <button
          className="h-10 px-6 rounded-none bg-[#074033] hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
          onClick={() => setIsModalOpen(true)}
        >
          <span>+</span> Add Technician
        </button>
      </div>

      {!technicians ||
      !Array.isArray(technicians) ||
      technicians.length === 0 ? (
        <div className="text-center py-10 bg-base-100 border border-base-300 rounded-none shadow-sm">
          <p className="text-base-content/40 font-black uppercase tracking-widest text-[10px]">No technicians found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {technicians.map((tech) => (
            <div
              key={tech._id || Math.random()}
              className="card bg-base-100 shadow-sm border border-base-300 hover:border-emerald-500/30 transition-all duration-300 rounded-none group overflow-hidden"
            >
              <figure className="px-6 pt-6">
                <div className="avatar">
                  <div className="w-24 h-24 rounded-none border border-base-300 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
                    <img
                      src={
                        tech.imageUrl ||
                        "https://ui-avatars.com/api/?name=" +
                          (tech.name || "Unknown")
                      }
                      alt={tech.name || "User"}
                      className="w-full h-full object-cover grayscale-[0.2]"
                    />
                  </div>
                </div>
              </figure>
              <div className="card-body items-center text-center p-6">
                <h2 className="text-sm font-black text-base-content uppercase tracking-widest">
                  {tech.name || "Unknown"}
                </h2>
                <div
                  className={`border rounded-none text-[8px] font-black uppercase tracking-widest px-3 py-1 mb-2 ${
                    tech.status?.toLowerCase() === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                    tech.status?.toLowerCase() === 'on-site' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' :
                    tech.status?.toLowerCase() === 'on-leave' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' :
                    'bg-base-200 border-base-300 text-base-content/60'
                  }`}
                >
                  {tech.status || "Unknown"}
                </div>

                <div className="space-y-1 w-full text-[10px] text-base-content/60 mb-4 uppercase tracking-widest font-bold">
                  <div className="flex justify-between border-b border-base-200 pb-1">
                    <span className="opacity-50">Email</span>
                    <span className="truncate max-w-[120px] text-base-content">
                      {tech.email || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-base-200 pb-1">
                    <span className="opacity-50">Phone</span>
                    <span className="text-base-content">{tech.phoneNumber || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-1 mt-2">
                    <span className="opacity-50 text-[9px]">Location</span>
                    <span className="truncate max-w-[120px] text-[9px] text-base-content">
                      {(tech.address?.city || "N/A") +
                        (tech.address?.province
                          ? `, ${tech.address.province}`
                          : "")}
                    </span>
                  </div>
                </div>

                <div className="card-actions w-full justify-center gap-2 mt-4 flex-nowrap">
                  <Link
                    to={`/admin/technicians/${tech._id}`}
                    className="h-8 px-4 rounded-none text-[9px] font-black uppercase tracking-widest bg-base-200 text-base-content/60 hover:bg-[#074033] hover:text-white transition-all flex-1 flex items-center justify-center border border-base-300 hover:border-[#074033]"
                  >
                    Profile
                  </Link>
                  <button
                    className="h-8 px-4 rounded-none text-[9px] font-black uppercase tracking-widest bg-base-100 text-base-content/60 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all flex-1 flex items-center justify-center border border-base-300"
                    onClick={() => setSelectedTechnician(tech)}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTechnicianModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <EditTechnicianModal
        isOpen={!!selectedTechnician}
        onClose={() => setSelectedTechnician(null)}
        technician={selectedTechnician}
      />
    </div>
  );
};

export default Technicians;
