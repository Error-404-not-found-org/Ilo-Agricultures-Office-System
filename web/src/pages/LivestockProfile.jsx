import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "../lib/axios";
import EditInseminationModal from "../components/EditInseminationModal";
import AddMedicalRecordModal from "../components/modals/AddMedicalRecordModal";
import { 
  Stethoscope, 
  Syringe, 
  Activity, 
  Scale, 
  Plus, 
  ChevronRight,
  ClipboardList
} from 'lucide-react';

import LoadingView from "../components/LoadingView";

const LivestockProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedInsemination, setSelectedInsemination] = useState(null);
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);

  // Fetch Medical History
  const { data: medicalHistory, refetch: refetchMedical } = useQuery({
    queryKey: ["medical", id],
    queryFn: async () => {
      const response = await axios.get(`/medical/${id}`);
      return response.data;
    },
  });

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

  if (isLoading) return <LoadingView message="Fetching Animal Profile..." />;
  

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
                        <th>Outcome</th>
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
                            {ins.pregnancy ? (
                              <div className="space-y-1">
                                <div className={`badge badge-sm text-white font-bold ${ins.pregnancy.pregnancyDiagnosis?.result === 'Pregnant' ? 'bg-emerald-500 border-none' : 'bg-rose-500 border-none'}`}>
                                  {ins.pregnancy.pregnancyDiagnosis?.result || "Pending"}
                                </div>
                                {ins.pregnancy.pregnancyDiagnosis?.date && (
                                  <div className="text-[10px] text-gray-500 whitespace-nowrap font-bold">
                                    Checked: {new Date(ins.pregnancy.pregnancyDiagnosis.date).toLocaleDateString()}
                                  </div>
                                )}
                                {ins.pregnancy.targetCalvingDate && (
                                  <div className="text-[10px] text-emerald-600 font-bold whitespace-nowrap">
                                    Due: {new Date(ins.pregnancy.targetCalvingDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic font-bold">Not Diagnosed</span>
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

          {/* Medical & Vaccination Records */}
          <div className="card bg-base-100 shadow-xl border border-base-200 overflow-hidden">
            <div className="card-body p-0">
              <div className="px-6 pt-6 pb-2 flex justify-between items-center border-b border-base-200">
                <div className="flex items-center gap-2">
                  <Stethoscope className="text-emerald-600" size={20} />
                  <h2 className="text-xl font-bold tracking-tight">Medical History</h2>
                </div>
                <button 
                  onClick={() => setIsMedicalModalOpen(true)}
                  className="btn btn-sm btn-primary bg-[#074033] hover:bg-black border-none rounded-xl flex items-center gap-2"
                >
                  <Plus size={16} /> Add Record
                </button>
              </div>

              {!medicalHistory || medicalHistory.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <ClipboardList size={32} />
                  </div>
                  <p className="text-slate-400 font-bold text-sm">No medical records found.</p>
                  <p className="text-slate-300 text-xs mt-1">Vaccinations and treatments will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead className="bg-slate-50">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6">Date</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Technician</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {medicalHistory.map((record) => (
                        <tr key={record._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-700">
                              {new Date(record.date).toLocaleDateString()}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                              {new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </td>
                          <td>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${
                              record.type === 'Vaccination' ? 'bg-emerald-50 text-emerald-600' :
                              record.type === 'Deworming' ? 'bg-blue-50 text-blue-600' :
                              record.type === 'Treatment' ? 'bg-amber-50 text-amber-600' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {record.type}
                            </span>
                          </td>
                          <td>
                            <p className="text-[13px] font-bold text-slate-800">
                              {record.details?.medicineName || record.details?.diagnosis || (record.type === 'Weight Log' ? `${record.details?.weight} kg` : 'Check-up')}
                            </p>
                            {record.note && <p className="text-xs text-slate-400 line-clamp-1">{record.note}</p>}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                                {(record.technicianId?.name || 'U').charAt(0)}
                              </div>
                              <span className="text-xs font-bold text-slate-600">{record.technicianId?.name}</span>
                            </div>
                          </td>
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

      <AddMedicalRecordModal 
        isOpen={isMedicalModalOpen}
        onClose={() => setIsMedicalModalOpen(false)}
        animalId={id}
        animalTag={animal.earTag}
        onSuccess={() => refetchMedical()}
      />
    </div>
  );
};

export default LivestockProfile;
