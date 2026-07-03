import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Tractor,
  Database,
  HeartPulse,
  Tag,
  ExternalLink,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { } from "framer-motion";
import axiosInstance from "../../lib/axios";
import { } from "../../constants/barangays";

export default function FarmerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  // ---- BACKEND RECOVERY PIPELINES ----
  const {
    data: farmer,
    isLoading: isFarmerLoading,
    error: farmerError,
  } = useQuery({
    queryKey: ["technician", "farmer", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/user/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: animals = [], isLoading: isAnimalsLoading } = useQuery({
    queryKey: ["animals"],
    queryFn: async () => {
      const res = await axiosInstance.get("/animals/all");
      return res.data || [];
    },
  });

  const isLoading = isFarmerLoading || isAnimalsLoading;

  // ---- DYNAMIC CROSS-REFERENCE FILTER MATRIX ----
  const ownedAnimals = useMemo(() => {
    if (!Array.isArray(animals) || !id) return [];
    return animals.filter((animal) => {
      const fId =
        typeof animal.farmerId === "object"
          ? animal.farmerId?._id
          : animal.farmerId;
      return fId === id;
    });
  }, [animals, id]);

  const stats = useMemo(() => {
    return {
      totalHerd: ownedAnimals.length,
      cattleCount: ownedAnimals.filter(
        (a) =>
          a.species?.toLowerCase() === "cattle" ||
          a.type?.toLowerCase() === "cattle",
      ).length,
      otherCount: ownedAnimals.filter(
        (a) =>
          a.species?.toLowerCase() !== "cattle" &&
          a.type?.toLowerCase() !== "cattle",
      ).length,
    };
  }, [ownedAnimals]);



  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-slate-50 dark:bg-slate-900 justify-center items-center">
        <div className="flex flex-col items-center gap-3 select-none">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#00643b] dark:border-slate-800 dark:border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">
            Syncing Profile...
          </span>
        </div>
      </div>
    );
  }

  if (farmerError || !farmer) {
    return (
      <div className="flex-1 flex flex-col h-screen bg-slate-50 dark:bg-slate-900 justify-center items-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle size={40} className="text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
            Profile Access Failure
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
            Could not locate or parse the target farmer database ledger file
            inside this municipal instance cluster.
          </p>
          <button
            onClick={() => navigate("/technician/farmers")}
            className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] text-white rounded-xl text-xs font-bold gap-1.5 px-4"
          >
            <ArrowLeft size={14} /> Return to Registry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      {/* Sticky Header Bar */}
      <header className="bg-white/90 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 h-16 flex items-center justify-between shrink-0 current-row sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate("/technician/farmers")}
            className="btn btn-sm btn-circle btn-ghost text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
              {farmer.name || "Farmer Account Dossier"}
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">
              System Reference &bull; UID-{farmer._id?.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>

        <div>
          <span
            className={`badge badge-sm border font-black text-[9px] uppercase tracking-wider px-2.5 h-6 rounded-md ${
              farmer.isVerified
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
            }`}
          >
            {farmer.isVerified ? "Verified Partner" : "Manual File"}
          </span>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col min-h-0 space-y-6">
        {/* Dynamic Metric Layout Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-xl shrink-0 bg-emerald-50 dark:bg-emerald-950/20 text-[#00643b] dark:text-emerald-400 border border-emerald-500/10">
              <Tractor size={16} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {stats.totalHerd}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Total Herd Headcount
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-xl shrink-0 bg-blue-50 dark:bg-blue-950/20 text-blue-600 border border-blue-500/10">
              <Database size={16} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {stats.cattleCount}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Registered Cattle
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center gap-3.5 shadow-sm">
            <div className="p-2.5 rounded-xl shrink-0 bg-purple-50 dark:bg-purple-950/20 text-purple-600 border border-purple-500/10">
              <HeartPulse size={16} />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {stats.otherCount}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                Other Specie Units
              </div>
            </div>
          </div>
        </div>

        {/* Unified Layout Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1">
          {/* COLUMN 1: Profile Summary Side Card */}
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-5">
            <div className="flex flex-col items-center text-center pt-2">
              <div className="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-2xl text-slate-400 overflow-hidden shadow-2xs mb-3">
                {farmer.imageUrl ? (
                  <img
                    src={farmer.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={32} strokeWidth={1.5} />
                )}
              </div>
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100 leading-tight">
                {farmer.name}
              </h3>
              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">
                {farmer.publicMetadata?.role || "Livestock Owner"}
              </p>
            </div>

            {/* Actions Access Triggers */}
            <div className="flex items-center gap-2 pt-1">
              <a
                href={`tel:${farmer.phoneNumber}`}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 hover:border-[#00643b] dark:hover:border-emerald-500 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl px-4 flex-1 h-9 flex items-center justify-center"
              >
                <Phone size={13} className="mr-1" /> Call Partner
              </a>
            </div>

            <div className="divider my-0 opacity-40 dark:border-slate-800" />

            {/* Communication Details */}
            <div className="space-y-4 text-xs font-semibold">
              <div className="flex items-center gap-3.5">
                <MapPin
                  size={14}
                  className="text-slate-400 dark:text-slate-500 shrink-0"
                />
                <div>
                  <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Barangay Sector
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {farmer.address?.barangay || "Oton Region"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <Phone
                  size={14}
                  className="text-slate-400 dark:text-slate-500 shrink-0"
                />
                <div>
                  <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Mobile Line Contact
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 mt-0.5 block font-mono">
                    {farmer.phoneNumber || "No active cellular endpoint"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <Mail
                  size={14}
                  className="text-slate-400 dark:text-slate-500 shrink-0"
                />
                <div>
                  <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Email Gateway
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 truncate max-w-[180px] mt-0.5">
                    {farmer.email || "No digital address linked"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <Calendar
                  size={14}
                  className="text-slate-400 dark:text-slate-500 shrink-0"
                />
                <div>
                  <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                    Registry Activation Date
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                    {farmer.createdAt
                      ? new Date(farmer.createdAt).toLocaleDateString(
                          undefined,
                          { dateStyle: "long" },
                        )
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNS 2 & 3: Farm Holdings Asset Ledger View */}
          <div className="lg:col-span-2 card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800/80 pb-3 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet size={13} className="text-slate-400" />{" "}
                  Associated Farm Herd Asset Registry
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                  Biological ownership holdings tracked inside the active
                  BreedSmart network infrastructure
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 text-[10.5px] font-bold uppercase tracking-wider select-none">
                    <th className="p-3 pl-4">System Tag</th>
                    <th className="p-3">Species Classification</th>
                    <th className="p-3">Breed Structure</th>
                    <th className="p-3">Biological Sex</th>
                    <th className="p-3 pr-4 text-right">Action Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                  {ownedAnimals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium italic"
                      >
                        No distinct livestock assets or animal registries tied
                        to this holder account configuration.
                      </td>
                    </tr>
                  ) : (
                    ownedAnimals.map((animal) => (
                      <tr
                        key={animal._id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors"
                      >
                        <td className="p-3 pl-4 font-black text-[#00643b] dark:text-emerald-400 flex items-center gap-1.5">
                          <Tag size={12} className="opacity-40" /> #
                          {animal.earTag || "UN-TAGGED"}
                        </td>
                        <td className="p-3 font-bold text-slate-700 dark:text-slate-300 capitalize">
                          {animal.type || animal.species || "Cattle"}
                        </td>
                        <td className="p-3 font-medium text-slate-500">
                          {animal.breed || "Crossbreed Standard"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                              animal.gender?.toLowerCase() === "male"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50"
                                : "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/50"
                            }`}
                          >
                            {animal.gender || "Female"}
                          </span>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <button
                            onClick={() => navigate(`/technician/animals`)}
                            className="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-[#00643b] dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-center cursor-pointer transition-colors"
                            title="Audit Animal Core Metrics File"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
