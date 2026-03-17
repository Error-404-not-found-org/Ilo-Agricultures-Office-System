import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axios from "../lib/axios";
import EditInseminationModal from "../components/EditInseminationModal";

const Inseminations = () => {
  const [selectedInsemination, setSelectedInsemination] = useState(null);

  const {
    data: inseminations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inseminations", "all"],
    queryFn: async () => {
      const response = await axios.get("/insemination/all");
      return response.data;
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
          <span>Error loading inseminations: {error.message}</span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "badge-success";
      case "pending":
        return "badge-warning";
      case "rejected":
        return "badge-error";
      case "done":
        return "badge-info";
      default:
        return "badge-ghost";
    }
  };

  return (
    <div className="p-6">
      <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
        <div className="card-body p-0">
          {!inseminations || inseminations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No insemination records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra table-pin-rows w-full">
                <thead>
                  <tr className="bg-base-200 text-base-content">
                    <th>Date & Estrus</th>
                    <th>Status & Attempt</th>
                    <th>Animal Details</th>
                    <th>Owner (Farmer)</th>
                    <th>Technician</th>
                    <th>Sire Info</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inseminations.map((ins) => (
                    <tr key={ins._id} className="hover">
                      {/* Date & Estrus */}
                      <td className="whitespace-nowrap">
                        <div className="font-bold">
                          {new Date(ins.inseminationDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm opacity-70 mt-1">
                          {ins.estrus || "Natural"}
                        </div>
                      </td>

                      {/* Status & Attempt Number */}
                      <td>
                        <div
                          className={`badge ${getStatusBadge(ins.status)} text-white capitalize`}
                        >
                          {ins.status || "Pending"}
                        </div>
                        <div className="text-xs font-semibold text-gray-500 mt-1">
                          Attempt #{ins.attemptNumber || 1}
                        </div>
                      </td>

                      {/* Animal Details */}
                      <td>
                        {ins.animalId ? (
                          <Link
                            to={`/admin/livestock/${ins.animalId._id}`}
                            className="text-primary font-semibold hover:underline"
                          >
                            <div className="flex items-center gap-2">
                              <span>TAG: {ins.animalId.earTag}</span>
                              <span className="badge badge-sm badge-outline">
                                {ins.animalId.species}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {ins.animalId.breed} • {ins.animalId.color}
                            </div>
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic">Unknown</span>
                        )}
                      </td>

                      {/* Owner Details */}
                      <td>
                        {ins.farmerId ? (
                          <div>
                            <div className="font-medium">
                              {ins.farmerId.name}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {ins.farmerId.phoneNumber || ins.farmerId.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unknown</span>
                        )}
                      </td>

                      {/* Technician */}
                      <td>
                        {ins.approvedBy ? (
                          <Link
                            to={`/admin/technicians/${ins.approvedBy._id}`}
                            className="font-medium text-info hover:underline"
                          >
                            {ins.approvedBy.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400 italic text-sm">
                            Self / Unassigned
                          </span>
                        )}
                      </td>

                      {/* Sire Info */}
                      <td>
                        <div className="font-medium">{ins.sireBreed}</div>
                        <div className="badge badge-ghost badge-sm mt-1">
                          {ins.sireCode}
                        </div>
                      </td>

                      {/* Actions */}
                      <th>
                        <button
                          className="btn btn-sm btn-outline btn-warning"
                          onClick={() => setSelectedInsemination(ins)}
                        >
                          Edit
                        </button>
                      </th>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <EditInseminationModal
        isOpen={!!selectedInsemination}
        onClose={() => setSelectedInsemination(null)}
        insemination={selectedInsemination}
        animalId={selectedInsemination?.animalId?._id}
      />
    </div>
  );
};

export default Inseminations;
