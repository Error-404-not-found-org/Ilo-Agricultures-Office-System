import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "../lib/axios";
import LoadingView from "../components/LoadingView";

const Livestock = () => {
  const {
    data: animals,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const res = await axios.get("/animals/all");
      return res.data;
    },
  });

  if (isLoading) return <LoadingView message="Scanning Livestock Database..." />;

  if (error) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Error loading livestock: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {!animals || !Array.isArray(animals) || animals.length === 0 ? (
        <div className="text-center py-10 bg-base-100 rounded-3xl border border-base-300 shadow-inner">
          <p className="text-base-content/40 font-bold uppercase tracking-widest text-xs">No livestock found in the official registry.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {animals.map((animal) => (
            <div
              key={animal._id || Math.random()}
              className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl border border-base-300 group"
            >
              <figure className="px-6 pt-6">
                <div className="avatar">
                  <div className="w-24 rounded-full ring ring-[#074033] dark:ring-emerald-500 ring-offset-base-100 ring-offset-4 shadow-lg group-hover:scale-105 transition-transform">
                    <img
                      src={
                        animal.imageUrl ||
                        `https://ui-avatars.com/api/?name=${animal.earTag || "Tag"}`
                      }
                      alt={animal.earTag || "Animal"}
                    />
                  </div>
                </div>
              </figure>
              <div className="card-body items-center text-center">
                <h2 className="card-title text-xl font-black text-base-content uppercase tracking-tighter">
                  Tag: {animal.earTag || "Unknown"}
                </h2>
                <div className="badge bg-[#074033] dark:bg-emerald-600 border-none text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 mb-2">
                  {animal.species || "Unknown"}
                </div>

                <div className="space-y-1 w-full text-[13px] text-base-content/60 mb-4">
                  <div className="flex justify-between border-b border-base-200 pb-1">
                    <span className="font-bold uppercase tracking-tighter opacity-50">Breed</span>
                    <span className="font-bold text-base-content">{animal.breed || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-base-200 pb-1">
                    <span className="font-bold uppercase tracking-tighter opacity-50">Color</span>
                    <span className="font-bold text-base-content">{animal.color || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-1 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-30">
                      Owner
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-emerald-500 truncate max-w-[120px]">
                      {animal.farmerId?.name || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="card-actions w-full justify-center mt-2">
                  <Link
                    to={`/admin/livestock/${animal._id}`}
                    className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-base-200 text-base-content hover:bg-[#074033] hover:text-white dark:hover:bg-emerald-600 transition-all w-full flex items-center justify-center border-none shadow-sm"
                  >
                    View Full Profile
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Livestock;
