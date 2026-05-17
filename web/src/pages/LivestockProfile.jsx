import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "../lib/axios";
import EditInseminationModal from "../components/EditInseminationModal";
import AddMedicalRecordModal from "../components/modals/AddMedicalRecordModal";
import ActivityDetailsModal from "../components/modals/ActivityDetailsModal";
import {
  Stethoscope,
  Syringe,
  Activity,
  Scale,
  Plus,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  Calendar as CalendarIcon,
  Baby,
  Clock,
  ShieldCheck,
  User,
  Info,
  MapPin,
} from "lucide-react";

import LoadingView from "../components/LoadingView";
import BreedingTimeline from "../components/BreedingTimeline";
import VaccinationProtocol from "../components/VaccinationProtocol";

const LivestockProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedInsemination, setSelectedInsemination] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // Fetch Medical History
  const { data: medicalHistory } = useQuery({
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

  if (isLoading) return <LoadingView message="Syncing Registry Data..." />;

  if (error || !animal) {
    return (
      <div className="p-6 h-screen flex items-center justify-center">
        <div className="bg-rose-500/10 border border-rose-500/20 p-8 text-center rounded-none max-w-md">
           <AlertCircle size={48} className="text-rose-500 mx-auto mb-4" />
           <h3 className="text-xl font-black text-rose-600 uppercase tracking-tighter">Profile Access Denied</h3>
           <p className="text-sm font-medium text-rose-500 mt-2">Error loading asset profile: {error?.message || "Record Not Found"}</p>
           <button onClick={() => navigate(-1)} className="mt-6 px-6 py-3 bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest rounded-none">Return to Registry</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "dashboard", label: "Asset Overview", icon: <Activity size={16} /> },
    { id: "reproduction", label: "Breeding Ledger", icon: <Syringe size={16} /> },
    { id: "clinical", label: "Medical Records", icon: <Stethoscope size={16} /> },
    { id: "bio", label: "Technical Bio", icon: <Info size={16} /> },
  ];

  return (
    <div className="bg-slate-50 dark:bg-[#0A1015] min-h-screen">
      {/* STEALTH HEADER */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-[#0A1015]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-none hover:bg-slate-200 transition-all"
          >
            <ChevronRight className="rotate-180 text-slate-400" size={18} />
          </button>
          <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none flex items-center gap-3">
              Asset <span className="text-emerald-500">#{animal.earTag}</span>
              <span className={`px-2 py-0.5 rounded-none border text-[9px] font-black uppercase tracking-widest ${
                animal.reproductiveStatus === 'Pregnant' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
              }`}>
                {animal.reproductiveStatus || 'Normal'}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <button className="h-11 px-6 bg-slate-100 dark:bg-white/5 rounded-none text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-500 transition-all">
             Audit Export
           </button>
           <button className="h-11 px-6 bg-[#074033] rounded-none text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-900/20 hover:bg-[#0a5242]">
             Field Action
           </button>
        </div>
      </div>

      <div className="p-8 max-w-[1600px] mx-auto">
        {/* HERO SECTION - COMPACT STRIP */}
        <div className="bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-none p-8 mb-8 flex flex-col xl:flex-row gap-12 items-center">
          <div className="w-48 h-48 rounded-none bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden relative group shrink-0">
             <img
                src={animal.imageUrl || `https://ui-avatars.com/api/?name=${animal.earTag}&size=200&background=074033&color=fff`}
                alt={animal.earTag}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
             />
             <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-12 w-full">
             <MetricBox label="Registry Breed" value={animal.breed} subValue={animal.species} />
             <MetricBox label="Reproduction State" value={animal.reproductiveStatus || "Normal"} subValue="Lifecycle Phase" highlight />
             <MetricBox label="Assigned Owner" value={animal.farmerId?.name || "Unknown"} subValue={animal.farmerId?.phoneNumber || "Contact Missing"} />
             <MetricBox label="Registration Date" value={new Date(animal.createdAt).toLocaleDateString()} subValue="Municipal Ledger" />
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="inline-flex items-center gap-1 mb-8 bg-slate-100 dark:bg-white/5 p-1 rounded-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all rounded-none ${
                activeTab === tab.id 
                  ? 'bg-white dark:bg-white/10 text-emerald-600 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="min-h-[60vh]">
          {activeTab === "dashboard" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <BreedingTimeline 
                  history={animal.inseminations?.map((i) => ({ ...i, eventType: "Insemination" })) || []} 
                  reproductiveStatus={animal.reproductiveStatus}
                  onStepClick={(rawData) => {
                    let type = "Insemination";
                    let title = `AI Service - ${rawData.sireBreed || 'N/A'}`;
                    let iconType = "Syringe";
                    if (rawData.pregnancyDiagnosis) { type = "Pregnancy Check"; title = "Pregnancy Diagnosis"; iconType = "HeartPulse"; }
                    else if (rawData.numberOfCalves) { type = "Calving"; title = "Calving Event"; iconType = "CheckCircle2"; }
                    setSelectedActivity({ ...rawData, type, title, description: rawData.technicianNote || "Technical lifecycle event recorded.", date: rawData.inseminationDate || rawData.date || rawData.createdAt, status: rawData.status || "Done", iconType,
                      details: { sireBreed: rawData.sireBreed, sireCode: rawData.sireCode, attemptNumber: rawData.attemptNumber, result: rawData.pregnancyDiagnosis?.result, targetCalvingDate: rawData.targetCalvingDate, numberOfCalves: rawData.numberOfCalves, calvingEase: rawData.calvingEase }
                    });
                  }}
               />

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 p-8 rounded-none">
                     <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Active Alerts</h3>
                     <div className="space-y-4">
                        {animal.reproductiveStatus === "Pregnant" && (
                          <div className="flex items-start gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20">
                             <AlertCircle className="text-emerald-500 shrink-0" size={18} />
                             <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Animal is confirmed PREGNANT. Ensure high-protein feed allocation and monitoring.</p>
                          </div>
                        )}
                        <div className="flex items-start gap-4 p-4 bg-blue-500/5 border border-blue-500/20">
                           <ShieldCheck className="text-blue-500 shrink-0" size={18} />
                           <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Vaccination schedule is current. No immediate procedures required.</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === "reproduction" && (
            <div className="bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-none overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
               <table className="table w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/80">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">
                      <th className="px-8 py-5">Attempt #</th>
                      <th>Sire Genetics</th>
                      <th>Outcome</th>
                      <th className="text-right px-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {animal.inseminations?.map((ins) => (
                      <tr key={ins._id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-6">
                           <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">Attempt {ins.attemptNumber}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(ins.inseminationDate).toLocaleDateString()}</p>
                        </td>
                        <td>
                           <p className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase">{ins.sireBreed}</p>
                           <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{ins.sireCode}</p>
                        </td>
                        <td>
                           <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${
                             ins.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                           }`}>
                             {ins.status}
                           </span>
                        </td>
                        <td className="text-right px-8">
                           <button onClick={() => setSelectedInsemination(ins)} className="p-3 bg-slate-100 dark:bg-white/5 rounded-none opacity-0 group-hover:opacity-100 transition-all">
                              <ChevronRight size={16} />
                           </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}

          {activeTab === "clinical" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="xl:col-span-2 bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-none overflow-hidden">
                  <table className="table w-full text-left">
                     <thead className="bg-slate-50 dark:bg-slate-800/80">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-white/5">
                           <th className="px-8 py-5">Date</th>
                           <th>Type</th>
                           <th>Technical Diagnosis</th>
                           <th className="px-8 text-right">Officer</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {medicalHistory?.map((record) => (
                           <tr key={record._id} onClick={() => setSelectedActivity({...record, type: "Health", title: `Medical: ${record.type?.toUpperCase()}`, description: record.note || record.details?.diagnosis || "Procedure logged.", date: record.date, status: "Done", iconType: "HeartPulse", technicianName: record.technicianId?.name, details: { diagnosis: record.details?.diagnosis, medicine: record.details?.medicineName, requestType: record.type } })} className="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-all group">
                              <td className="px-8 py-6">
                                 <p className="text-sm font-black text-slate-800 dark:text-white uppercase leading-none">{new Date(record.date).toLocaleDateString()}</p>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{new Date(record.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </td>
                              <td>
                                 <span className="text-[9px] font-black text-emerald-500 border border-emerald-500/20 px-2 py-1 uppercase tracking-widest">{record.type}</span>
                              </td>
                              <td>
                                 <p className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase line-clamp-1">{record.details?.diagnosis || record.details?.medicineName || "Routine Procedure"}</p>
                              </td>
                              <td className="px-8 text-right">
                                 <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase">{record.technicianId?.name}</p>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               <VaccinationProtocol medicalHistory={medicalHistory || []} />
            </div>
          )}

          {activeTab === "bio" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <BioCard label="Registry Gender" value={animal.gender || "Female"} icon={<User size={20} />} />
               <BioCard label="Asset Coloration" value={animal.color || "Not Logged"} icon={<ClipboardList size={20} />} />
               <BioCard label="Ear Tag ID" value={animal.earTag} icon={<Activity size={20} />} />
               <BioCard label="Ownership" value={animal.farmerId?.name || "Unassigned"} icon={<MapPin size={20} />} />
            </div>
          )}
        </div>
      </div>

      <EditInseminationModal
        isOpen={!!selectedInsemination}
        onClose={() => setSelectedInsemination(null)}
        insemination={selectedInsemination}
        animalId={id}
      />

      <ActivityDetailsModal 
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
      />
    </div>
  );
};

function MetricBox({ label, value, subValue, highlight = false }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-black uppercase tracking-tighter leading-none ${highlight ? 'text-emerald-500' : 'text-slate-800 dark:text-white'}`}>
        {value}
      </p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">{subValue}</p>
    </div>
  );
}

function BioCard({ label, value, icon }) {
  return (
    <div className="bg-white dark:bg-white/2 border border-slate-200 dark:border-white/5 p-8 rounded-none">
       <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 mb-6">
          {icon}
       </div>
       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">{value}</p>
    </div>
  );
}

export default LivestockProfile;
