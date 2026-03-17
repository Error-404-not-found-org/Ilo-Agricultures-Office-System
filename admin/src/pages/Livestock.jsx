import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "../lib/axios";

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
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[500px]">
        <span className="loading loading-spinner text-primary loading-lg"></span>
      </div>
    );
  }

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
        <div className="text-center py-10 bg-base-100 rounded-lg shadow">
          <p className="text-gray-500">No livestock found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {animals.map((animal) => (
            <div
              key={animal._id || Math.random()}
              className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-xl"
            >
              <figure className="px-6 pt-6">
                <div className="avatar">
                  <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
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
                <h2 className="card-title text-xl font-bold">
                  Tag: {animal.earTag || "Unknown"}
                </h2>
                <div className="badge badge-info badge-lg mb-2 capitalize">
                  {animal.species || "Unknown"}
                </div>

                <div className="space-y-1 w-full text-sm text-gray-600 mb-4">
                  <div className="flex justify-between border-b pb-1">
                    <span className="font-semibold">Breed:</span>
                    <span>{animal.breed || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="font-semibold">Color:</span>
                    <span>{animal.color || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-1 mt-2">
                    <span className="font-semibold text-xs text-gray-400">
                      Owner:
                    </span>
                    <span className="text-xs truncate max-w-[120px]">
                      {animal.farmerId?.name || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="card-actions w-full justify-center mt-2">
                  <Link
                    to={`/admin/livestock/${animal._id}`}
                    className="btn btn-sm btn-outline btn-primary w-full"
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
