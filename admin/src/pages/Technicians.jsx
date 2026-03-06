import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "../lib/axios";

const Technicians = () => {
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

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
    <div className="p-6">
      <div className="flex justify-end items-center mb-6">
        <button className="btn btn-primary">+ Add Technician</button>
      </div>

      {!technicians ||
      !Array.isArray(technicians) ||
      technicians.length === 0 ? (
        <div className="text-center py-10 bg-base-100 rounded-lg shadow">
          <p className="text-gray-500">No technicians found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {technicians.map((tech) => (
            <div
              key={tech._id || Math.random()}
              className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-xl"
            >
              <figure className="px-6 pt-6">
                <div className="avatar">
                  <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                    <img
                      src={
                        tech.imageUrl ||
                        "https://ui-avatars.com/api/?name=" +
                          (tech.name || "Unknown")
                      }
                      alt={tech.name || "User"}
                    />
                  </div>
                </div>
              </figure>
              <div className="card-body items-center text-center">
                <h2 className="card-title text-xl font-bold">
                  {tech.name || "Unknown"}
                </h2>
                <div
                  className={`badge ${getStatusColor(tech.status)} badge-lg mb-2 capitalize`}
                >
                  {tech.status || "Unknown"}
                </div>

                <div className="space-y-1 w-full text-sm text-gray-600 mb-4">
                  <div className="flex justify-between border-b pb-1">
                    <span className="font-semibold">Email:</span>
                    <span className="truncate max-w-[150px]">
                      {tech.email || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="font-semibold">Phone:</span>
                    <span>{tech.phoneNumber || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="font-semibold">Address:</span>
                    <span className="truncate max-w-[150px]">
                      {(tech.address?.city || "N/A") +
                        (tech.address?.province
                          ? `, ${tech.address.province}`
                          : "")}
                    </span>
                  </div>
                </div>

                <div className="card-actions w-full justify-center gap-2">
                  <button className="btn btn-sm btn-outline btn-info">
                    View Profile
                  </button>
                  <button className="btn btn-sm btn-outline btn-warning">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Technicians;
