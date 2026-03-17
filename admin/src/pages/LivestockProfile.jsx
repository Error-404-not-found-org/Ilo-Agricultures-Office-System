import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "../lib/axios";
import EditInseminationModal from "../components/EditInseminationModal";

const LivestockProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedInsemination, setSelectedInsemination] = useState(null);

  const {
    data: animal,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["animal", id],
    queryFn: async () => {
      const response = await axios.get(`/animals/${id}`);
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

  if (error || !animal) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Error loading profile: {error?.message || "Not found"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn btn-sm btn-ghost">
          ← Back
        </button>
        <h1 className="text-3xl font-bold">Livestock Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Animal and Farmer Details */}
        <div className="col-span-1 space-y-6">
          <div className="card bg-base-100 shadow-xl border border-base-200">
            <figure className="px-10 pt-10">
              <div className="avatar">
                <div className="w-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img
                    src={
                      animal.imageUrl ||
                      `https://ui-avatars.com/api/?name=${animal.earTag || "Tag"}&size=128`
                    }
                    alt={animal.earTag || "Animal"}
                  />
                </div>
              </div>
            </figure>
            <div className="card-body items-center text-center">
              <h2 className="card-title text-2xl font-bold">
                Tag: {animal.earTag}
              </h2>
              <div className="badge badge-info badge-lg mb-4 capitalize">
                {animal.species}
              </div>

              <div className="w-full space-y-3 text-left mt-2 border-t pt-4">
                <div>
                  <span className="text-sm text-gray-500 block">Breed</span>
                  <span className="font-medium">{animal.breed || "N/A"}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block">Color</span>
                  <span className="font-medium">{animal.color || "N/A"}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 block">
                    Registered On
                  </span>
                  <span className="font-medium">
                    {new Date(animal.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-200">
            <div className="card-body">
              <h3 className="text-xl font-bold mb-2">Owner (Farmer)</h3>
              {animal.farmerId ? (
                <div className="flex items-center gap-4">
                  <div className="avatar">
                    <div className="w-12 rounded-full">
                      <img
                        src={
                          animal.farmerId.imageUrl ||
                          `https://ui-avatars.com/api/?name=${animal.farmerId.name}`
                        }
                        alt={animal.farmerId.name}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold">{animal.farmerId.name}</p>
                    <p className="text-sm text-gray-500">
                      {animal.farmerId.phoneNumber || animal.farmerId.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No owner details available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Inseminations and Calvings */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
            <div className="card-body p-0">
              <h2 className="card-title px-6 pt-6 pb-2 text-xl border-b border-base-200">
                Insemination History
              </h2>

              {!animal.inseminations || animal.inseminations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No insemination records found for this animal.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Attempt</th>
                        <th>Date</th>
                        <th>Sire Info</th>
                        <th>Status</th>
                        <th>Technician</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {animal.inseminations.map((ins) => (
                        <tr key={ins._id}>
                          <td>#{ins.attemptNumber}</td>
                          <td>
                            <div className="font-bold">
                              {new Date(
                                ins.inseminationDate,
                              ).toLocaleDateString()}
                            </div>
                            <div className="text-xs opacity-50">
                              {ins.estrus}
                            </div>
                          </td>
                          <td>
                            {ins.sireBreed}
                            <br />
                            <span className="badge badge-ghost badge-sm">
                              {ins.sireCode}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                ins.status === "approved"
                                  ? "badge-success"
                                  : ins.status === "pending"
                                    ? "badge-warning"
                                    : ins.status === "done"
                                      ? "badge-info"
                                      : "badge-error"
                              } text-white capitalize`}
                            >
                              {ins.status}
                            </span>
                          </td>
                          <td>
                            {ins.approvedBy ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  {ins.approvedBy.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                Self-reported / None
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => setSelectedInsemination(ins)}
                              className="btn btn-xs btn-outline btn-warning"
                            >
                              Edit Data
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
            <div className="card-body p-0">
              <h2 className="card-title px-6 pt-6 pb-2 text-xl border-b border-base-200">
                Calving Records
              </h2>

              {!animal.calvings || animal.calvings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No calving records found for this animal.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Calving Ease</th>
                        <th>Calf Sex</th>
                        <th>Calves Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {animal.calvings.map((calving) => (
                        <tr key={calving._id}>
                          <td>
                            {calving.date
                              ? new Date(calving.date).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                calving.calvingEase === "Normal"
                                  ? "badge-success text-white"
                                  : "badge-warning"
                              }`}
                            >
                              {calving.calvingEase || "Unknown"}
                            </span>
                          </td>
                          <td>{calving.calfSex || "N/A"}</td>
                          <td>{calving.numberOfCalves || "1"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <EditInseminationModal
        isOpen={!!selectedInsemination}
        onClose={() => setSelectedInsemination(null)}
        insemination={selectedInsemination}
        animalId={id}
      />
    </div>
  );
};

export default LivestockProfile;
