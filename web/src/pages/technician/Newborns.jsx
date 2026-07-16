import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import axiosInstance from "../../lib/axios";
import {
  Search,
  Download,
  Sparkles,
  HeartPulse,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
  User,
  Calendar,
  Baby,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";
import { toast } from "sonner";

export default function NewbornsLog() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const role = user?.publicMetadata?.role || "Field Officer";
  const normalizedRole = String(role).toLowerCase();

  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [easeFilter, setEaseFilter] = useState("");
  const [seenFilter, setSeenFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const itemsPerPage = 8;

  const [calfEdits, setCalfEdits] = useState({});
  const [savingCalfId, setSavingCalfId] = useState(null);

  const handleSaveCalfDetails = async (calfId) => {
    const edits = calfEdits[calfId];
    if (!edits || (!edits.color?.trim() && !edits.brand?.trim())) {
      toast.error("Please fill in at least one field.");
      return;
    }
    setSavingCalfId(calfId);
    try {
      const payload = {
        color: edits.color?.trim() || undefined,
        brand: edits.brand?.trim() || undefined,
      };
      await axiosInstance.put(`/animals/wizard/${calfId}`, payload);
      toast.success("Calf details updated successfully!");

      setSelectedLog(prev => {
        if (!prev) return null;
        const updatedCalves = prev.calves.map(c => {
          const id = c.animalId?._id || c.animalId;
          if (id === calfId) {
            return {
              ...c,
              animalId: {
                ...c.animalId,
                color: edits.color?.trim() || c.animalId?.color || "Not Provided",
                brand: edits.brand?.trim() || c.animalId?.brand || ""
              }
            };
          }
          return c;
        });
        return { ...prev, calves: updatedCalves };
      });

      setCalfEdits(prev => {
        const copy = { ...prev };
        delete copy[calfId];
        return copy;
      });

      queryClient.invalidateQueries({ queryKey: ["technician", "calvings-list-isolated"] });
    } catch (err) {
      toast.error("Failed to save calf details: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingCalfId(null);
    }
  };

  // ---- FETCH REAL DATA ----
  const endpoint = normalizedRole === "admin" ? "/admin/calvings" : "/technician/calvings";
  const { data: calvingPage = {}, isLoading } = useQuery({
    queryKey: ["technician", "calvings-list-isolated", normalizedRole, currentPage, searchQuery, speciesFilter, easeFilter, seenFilter],
    queryFn: async () => {
      const res = await axiosInstance.get(endpoint, {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery || undefined,
          species: speciesFilter || undefined,
          calvingEase: easeFilter || undefined,
          seen: seenFilter || undefined,
        },
      });
      return res.data || {};
    },
    keepPreviousData: true,
  });
  const calvings = useMemo(() => calvingPage.data || calvingPage.calvings || [], [calvingPage]);

  // ---- MARK SEEN MUTATION ----
  const markSeenMutation = useMutation({
    mutationFn: async (id) => {
      return await axiosInstance.patch(`/technician/calvings/${id}/seen`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technician", "calvings-list-isolated"] });
      queryClient.invalidateQueries({ queryKey: ["calvings-badge"] });
    }
  });

  // ---- DYNAMIC DATA PROCESSING AND MAPPING ----
  const processedLogs = useMemo(() => {
    return calvings.map(c => {
      const birthDate = c.date || c.createdAt;
      const calfList = Array.isArray(c.calves) ? c.calves : [];
      const calvesInfo = calfList.map(calf => `Tag #${calf.earTag} (${calf.sex === 'M' ? 'Male' : 'Female'})`).join(", ");
      
      return {
        id: c._id,
        date: new Date(birthDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: new Date(birthDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        rawDate: birthDate,
        motherTag: c.animalId?.earTag || "N/A",
        motherSpecies: c.animalId?.species || "Cattle",
        motherBreed: c.animalId?.breed || "N/A",
        farmer: c.farmerId?.name || "N/A",
        farmerPhone: c.farmerId?.phoneNumber || "N/A",
        farmerEmail: c.farmerId?.email || "N/A",
        numberOfCalves: c.numberOfCalves || calfList.length || 1,
        calves: calfList,
        calvesSummary: calvesInfo || "N/A",
        calvingEase: c.calvingEase || "Natural",
        technicianNote: c.technicianNote || "",
        isSeen: c.isSeen || false,
      };
    });
  }, [calvings]);

  // ---- FILTER ENGINE ----
  const filteredLogs = useMemo(() => {
    return processedLogs;
  }, [processedLogs]);

  // ---- PAGINATION COMPUTATION ----
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs;
  const totalPages = calvingPage.totalPages || calvingPage.pagination?.totalPages || Math.ceil((calvingPage.total || calvingPage.pagination?.total || filteredLogs.length) / itemsPerPage) || 1;

  // ---- CSV EXPORTER ----
  const handleExportCSV = () => {
    const headers = [
      "Record ID",
      "Birth Date",
      "Birth Time",
      "Mother Tag",
      "Mother Species",
      "Mother Breed",
      "Farmer Client",
      "Number of Calves",
      "Calves Summary",
      "Calving Ease",
      "Comments / Observations"
    ];
    
    const rows = filteredLogs.map((l) => [
      l.id,
      l.date,
      l.time,
      l.motherTag,
      l.motherSpecies,
      l.motherBreed,
      l.farmer,
      l.numberOfCalves,
      l.calvesSummary,
      l.calvingEase,
      l.technicianNote
    ]);
    
    const csvContent =
      headers.join(",") +
      "\n" +
      rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BreedSmart_Newborn_Logs_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInspectLog = (log) => {
    setSelectedLog(log);
    if (!log.isSeen) {
      markSeenMutation.mutate(log.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Newborns Log"
        subtitle="Registers of new calving events, newborn specifications, and parturition ease audits"
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Metric widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <Baby size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : processedLogs.length}</div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Total Calving Events
              </div>
            </div>
          </div>

          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-amber-500 bg-amber-500/10">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : processedLogs.filter((l) => !l.isSeen).length}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Unseen Calving Reports
              </div>
            </div>
          </div>

          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-rose-500 bg-rose-500/10">
              <HeartPulse size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : processedLogs.filter((l) => l.calvingEase === "Difficult" || l.calvingEase === "Cesarean").length}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Assisted / Difficult Births
              </div>
            </div>
          </div>
        </div>

        {/* List of Newborns */}
        <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Actions Row */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="relative w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none flex items-center justify-center">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search tag, breed, farmer..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content placeholder-base-content/40 focus:ring-1 focus:ring-primary outline-none transition-all duration-200"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={isLoading || filteredLogs.length === 0}
                className="btn btn-sm btn-primary disabled:opacity-50 text-white border-none text-xs font-bold gap-1.5 rounded-xl px-4 cursor-pointer"
              >
                <Download size={13} /> Export CSV
              </button>
              <span className="text-xs text-base-content/40 font-semibold border-l border-base-300 pl-2.5 whitespace-nowrap">
                {isLoading ? "Fetching entries..." : `${filteredLogs.length} event${filteredLogs.length !== 1 ? "s" : ""} matched`}
              </span>
            </div>
          </div>

          {/* Filter Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-base-200 border border-base-300 p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-base-content/40 font-bold uppercase tracking-wide px-1">
              <Filter size={13} />
              <span>Filters:</span>
            </div>
            
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
              value={speciesFilter}
              onChange={(e) => {
                setSpeciesFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Species</option>
              <option value="Beef Cattle">Beef Cattle</option>
              <option value="Dairy Cattle">Dairy Cattle</option>
              <option value="Cattle">Generic Cattle</option>
              <option value="Carabao">Carabao</option>
            </select>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
              value={easeFilter}
              onChange={(e) => {
                setEaseFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Birth Eases</option>
              <option value="Natural">Natural</option>
              <option value="Normal">Normal</option>
              <option value="Difficult">Difficult</option>
              <option value="Cesarean">Cesarean</option>
              <option value="Abortion">Abortion</option>
              <option value="Stillbirth">Stillbirth</option>
            </select>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
              value={seenFilter}
              onChange={(e) => {
                setSeenFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Notifications</option>
              <option value="unseen">Unread / Unseen</option>
              <option value="seen">Read / Seen</option>
            </select>

            {(speciesFilter || easeFilter || seenFilter || searchQuery) && (
              <button
                onClick={() => {
                  setSpeciesFilter("");
                  setEaseFilter("");
                  setSeenFilter("");
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="btn btn-sm btn-ghost text-xs text-rose-600 font-bold gap-1 rounded-lg cursor-pointer"
              >
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="p-3.5 pl-5">Status</th>
                  <th className="p-3.5">Birth Date & Time</th>
                  <th className="p-3.5">Mother Tag</th>
                  <th className="p-3.5">Farmer Client</th>
                  <th className="p-3.5">Species / Breed</th>
                  <th className="p-3.5 text-center">Calves Summary</th>
                  <th className="p-3.5 text-center">Calving Ease</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={8}>
                        <div className="grid grid-cols-[.8fr_1.2fr_.8fr_1.2fr_1.2fr_1.2fr_.8fr_.8fr] gap-5 py-1">
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-12 text-base-content/40 font-medium">
                      No calving records registered yet.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((l) => {
                    const rowGlowClass = !l.isSeen
                      ? "bg-primary/10 hover:bg-primary/15! shadow-[inset_4px_0_0_0_#10b981] transition-all animate-pulse duration-[2000ms]"
                      : "hover:bg-base-200 transition-colors";

                    return (
                      <tr
                        key={l.id}
                        className={`${rowGlowClass} cursor-pointer`}
                        onClick={() => handleInspectLog(l)}
                      >
                        <td className="p-3.5 pl-5 font-bold">
                          {!l.isSeen ? (
                            <span className="flex items-center gap-1.5 text-primary animate-pulse">
                              <span className="h-2 w-2 rounded-full bg-primary"></span>
                              <span className="text-[9px] uppercase tracking-widest font-black">New</span>
                            </span>
                          ) : (
                            <span className="text-base-content/40 text-[9px] uppercase tracking-widest font-semibold">Seen</span>
                          )}
                        </td>
                        <td className="p-3.5 font-medium">
                          <div className="font-extrabold">{l.date}</div>
                          <div className="text-[10px] text-base-content/40 mt-0.5">{l.time}</div>
                        </td>
                        <td className="p-3.5 font-extrabold text-primary">
                          {l.motherTag}
                        </td>
                        <td className="p-3.5 font-bold">{l.farmer}</td>
                        <td className="p-3.5 font-medium">
                          <div>{l.motherSpecies}</div>
                          <div className="text-[10px] text-base-content/40 mt-0.5">{l.motherBreed}</div>
                        </td>
                        <td className="p-3.5 text-center font-bold text-base-content/85">
                          {l.numberOfCalves} Calf/Calves
                          <div className="text-[10px] font-medium text-base-content/40 mt-0.5 truncate max-w-[180px]">
                            {l.calvesSummary}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                              l.calvingEase === "Difficult" || l.calvingEase === "Cesarean"
                                ? "bg-rose-500/10 text-rose-600 border-rose-200/50"
                                : l.calvingEase === "Natural" || l.calvingEase === "Normal"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-blue-500/10 text-blue-600 border-blue-200/50"
                            }`}
                          >
                            {l.calvingEase}
                          </span>
                        </td>
                        <td
                          className="p-3.5 pr-5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleInspectLog(l)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-base-300 hover:border-primary hover:text-primary items-center gap-1 bg-base-100 text-base-content/70 transition-all cursor-pointer inline-flex"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-4 border-t border-base-300 flex items-center justify-between mt-3">
              <span className="text-[11px] font-medium text-base-content/40">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length} calving events
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-primary text-white shadow-xs"
                        : "border border-base-300 text-base-content/60 hover:bg-base-200"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                  className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Inspector Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-100 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="card w-full max-w-lg bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Baby size={18} />
                <h3 className="text-sm font-black uppercase tracking-tight text-base-content">
                  Newborn Calving Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-xs btn-ghost btn-circle text-base-content/40 hover:text-rose-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Mother specs */}
              <div className="bg-base-200 border border-base-300 p-4 rounded-xl space-y-3">
                <h4 className="text-[10px] font-black uppercase text-primary tracking-wider border-b border-base-300 pb-1 flex items-center gap-1.5">
                  <Activity size={12} /> Dam (Mother) Profile
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-base-content/40 font-semibold">Ear Tag</span>
                    <span className="font-extrabold text-primary">{selectedLog.motherTag}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/40 font-semibold">Species</span>
                    <span className="font-bold">{selectedLog.motherSpecies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/40 font-semibold">Breed</span>
                    <span className="font-bold">{selectedLog.motherBreed}</span>
                  </div>
                </div>
              </div>

              {/* Owner specs */}
              <div className="bg-base-200 border border-base-300 p-4 rounded-xl space-y-3">
                <h4 className="text-[10px] font-black uppercase text-primary tracking-wider border-b border-base-300 pb-1 flex items-center gap-1.5">
                  <User size={12} /> Owner Details
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-base-content/40 font-semibold">Farmer Name</span>
                    <span className="font-bold">{selectedLog.farmer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/40 font-semibold">Contact #</span>
                    <span className="font-bold">{selectedLog.farmerPhone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-base-content/40 font-semibold">Email</span>
                    <span className="font-bold truncate max-w-[130px]">{selectedLog.farmerEmail}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Birth Event parameters */}
            <div className="bg-base-200 border border-base-300 p-4 rounded-xl text-xs space-y-3">
              <h4 className="text-[10px] font-black uppercase text-primary tracking-wider border-b border-base-300 pb-1 flex items-center gap-1.5">
                <Calendar size={12} /> Delivery Parameters
              </h4>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                <div className="flex justify-between">
                  <span className="text-base-content/40 font-semibold">Birth Date</span>
                  <span className="font-bold">{selectedLog.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/40 font-semibold">Birth Time</span>
                  <span className="font-bold">{selectedLog.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/40 font-semibold">Calving Ease</span>
                  <span className={`font-black uppercase ${selectedLog.calvingEase === 'Difficult' || selectedLog.calvingEase === 'Cesarean' ? 'text-rose-500' : 'text-emerald-500'}`}>{selectedLog.calvingEase}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/40 font-semibold">Offspring Count</span>
                  <span className="font-bold">{selectedLog.numberOfCalves} Calf/Calves</span>
                </div>
              </div>
            </div>

            {/* Calves list detail cards */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-base-content/40 tracking-wider">
                Born Offspring Specifications
              </h4>
              <div className="space-y-2">
                {selectedLog.calves && selectedLog.calves.length > 0 ? (
                  selectedLog.calves.map((calf, index) => {
                    const calfId = calf.animalId?._id || calf.animalId;
                    const cColor = calf.animalId?.color || "";
                    const cBrand = calf.animalId?.brand || "";
                    
                    const isColorEmpty = !cColor || cColor === "Not Provided";
                    const isBrandEmpty = !cBrand;

                    return (
                      <div
                        key={index}
                        className="flex flex-col p-3.5 border border-base-300 bg-base-100 rounded-2xl text-xs gap-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-extrabold text-base-content">
                                Tag #{calf.earTag || "No tag yet"}
                              </div>
                              <div className="text-[10px] text-base-content/40 mt-0.5">
                                Gender: {calf.sex === "M" ? "Male ♂" : "Female ♀"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Color and Brand values / inline edits */}
                        <div className="bg-base-200 p-2.5 rounded-xl border border-base-300 space-y-2 text-[11px]">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-base-content/40 font-semibold shrink-0">Color:</span>
                            {!isColorEmpty ? (
                              <span className="font-bold text-base-content/90 text-right truncate">{cColor}</span>
                            ) : (
                              <input
                                type="text"
                                placeholder="Fill color (e.g. Red)..."
                                className="input input-xs bg-base-300 text-xs rounded-lg px-2.5 py-1 focus:outline-emerald-500 focus:border-emerald-500 border border-base-300 w-36 font-bold"
                                value={calfEdits[calfId]?.color ?? ""}
                                onChange={(e) => {
                                  setCalfEdits(prev => ({
                                    ...prev,
                                    [calfId]: {
                                      ...prev[calfId],
                                      color: e.target.value
                                    }
                                  }));
                                }}
                              />
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-base-content/40 font-semibold shrink-0">Markings (Brand):</span>
                            {!isBrandEmpty ? (
                              <span className="font-bold text-base-content/90 text-right truncate">{cBrand}</span>
                            ) : (
                              <input
                                type="text"
                                placeholder="Fill brand (e.g. Left Hip)..."
                                className="input input-xs bg-base-300 text-xs rounded-lg px-2.5 py-1 focus:outline-emerald-500 focus:border-emerald-500 border border-base-300 w-36 font-bold"
                                value={calfEdits[calfId]?.brand ?? ""}
                                onChange={(e) => {
                                  setCalfEdits(prev => ({
                                    ...prev,
                                    [calfId]: {
                                      ...prev[calfId],
                                      brand: e.target.value
                                    }
                                  }));
                                }}
                              />
                            )}
                          </div>

                          {(isColorEmpty || isBrandEmpty) && calfId && (
                            <div className="flex justify-end pt-1">
                              <button
                                disabled={savingCalfId === calfId || (!calfEdits[calfId]?.color?.trim() && !calfEdits[calfId]?.brand?.trim())}
                                onClick={() => handleSaveCalfDetails(calfId)}
                                className="btn btn-xs btn-primary disabled:opacity-40 text-white border-none rounded-lg px-3 font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                              >
                                {savingCalfId === calfId ? "Saving..." : "Save Details"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 border border-dashed border-base-300 rounded-xl text-center text-xs text-base-content/40 italic">
                    No calf records embedded.
                  </div>
                )}
              </div>
            </div>

            {/* Observations / Notes */}
            {selectedLog.technicianNote && (
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl text-xs space-y-2">
                <h5 className="font-extrabold text-primary">
                  Technician observations & Remarks
                </h5>
                <p className="italic text-base-content/70">
                  "{selectedLog.technicianNote}"
                </p>
              </div>
            )}

            <button
              onClick={() => setSelectedLog(null)}
              className="btn btn-sm w-full btn-primary border-none text-white rounded-xl text-xs font-bold mt-2 cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
