import { useState, useEffect, useMemo } from "react";
import {
  Image as ImageIcon,
  Syringe,
  HeartPulse,
  FileText,
  X,
  Trash2,
  Grid3X3,
  Calendar,
  AlertCircle,
  Tag,
  Phone,
  User,
  Activity,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";
import UploadNoteModal from "../../components/modals/UploadNoteModal";
import { useToast } from "../../contexts/ToastContext";

export default function FieldNotesGallery() {
  const toast = useToast();

  // ---- APPLICATION STATES ----
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedNote, setSelectedNote] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  // ---- DATA FETCHING PIPELINE ----
  const fetchFieldNotes = async () => {
    try {
      setIsLoading(true);
      const res = await axiosInstance.get("/technician/field-notes");
      setNotes(res.data || []);
    } catch (error) {
      console.error("Failed to recover field media resources:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchFieldNotes());
  }, []);

  // ---- LIVE METRIC COMPUTATION ENGINE ----
  const stats = useMemo(() => {
    return {
      total: notes.filter((n) => !n.isArchived).length,
      ai: notes.filter((n) => !n.isArchived && n.type === "insemination").length,
      health: notes.filter((n) => !n.isArchived && n.type === "health").length,
      tech: notes.filter((n) => !n.isArchived && n.type === "technician-note").length,
    };
  }, [notes]);

  // ---- DYNAMIC FILTER PIPELINE ----
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const q = searchQuery.toLowerCase();
      const farmerName = n.farmer || "";
      const noteText = n.note || "";
      const tagNum = n.animalTag || "";

      const matchesSearch = [farmerName, noteText, tagNum]
        .join(" ")
        .toLowerCase()
        .includes(q);

      if (activeTab === "archived") {
        return matchesSearch && n.isArchived;
      }
      return matchesSearch && !n.isArchived && (activeTab === "all" || n.type === activeTab);
    });
  }, [searchQuery, activeTab, notes]);

  // ---- ACTION ROUTINES ----
  const handleDeleteNote = (id, type, e) => {
    if (e) e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: "Delete Field Note",
      message: "Choose whether to temporarily hide/archive this note or permanently erase it from the system.",
      onConfirm: async (permanent) => {
        try {
          await axiosInstance.delete(`/technician/field-notes/${id}?type=${type}&permanent=${permanent}`);
          setSelectedNote(null);
          toast.success(permanent ? "Field note permanently deleted." : "Field note archived successfully.");
          fetchFieldNotes();
        } catch (error) {
          console.error(error);
          toast.error(
            error.response?.data?.message || "Failed to complete delete request.",
          );
        }
      },
    });
  };

  const handleRestoreNote = async (id, type) => {
    try {
      await axiosInstance.delete(`/technician/field-notes/${id}?type=${type}&restore=true`);
      setSelectedNote(null);
      toast.success("Field note restored successfully.");
      fetchFieldNotes();
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message || "Failed to restore field note.",
      );
    }
  };

  const handleDeletePermanentlyDirect = (id, type) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Permanently",
      message: "Are you sure you want to permanently erase this note from the system database? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/technician/field-notes/${id}?type=${type}&permanent=true`);
          setSelectedNote(null);
          toast.success("Field note permanently deleted.");
          fetchFieldNotes();
        } catch (error) {
          console.error(error);
          toast.error(
            error.response?.data?.message || "Failed to permanently delete field note.",
          );
        }
      },
    });
  };

  const getBadgeConfig = (type) => {
    switch (type) {
      case "insemination":
        return {
          label: "AI Req",
          style:
            "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
        };
      case "health":
        return {
          label: "Health Call",
          style:
            "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400",
        };
      default:
        return {
          label: "Tech Note",
          style:
            "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Field Notes & Gallery"
        subtitle="Media Ledger — explore symptoms, photos, and specialized annotations from the field"
        searchPlaceholder="Search farmer, tag, symptoms..."
        searchValue={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
      >
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="btn btn-primary btn-sm text-white font-bold gap-1.5 rounded-xl px-4"
        >
          <ImageIcon size={13} /> Upload Note
        </button>
      </Topbar>

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Metric Overview Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: "Total Media",
              val: stats.total,
              color: "text-amber-600 bg-amber-500/10",
              icon: <ImageIcon size={16} />,
            },
            {
              label: "AI Requests",
              val: stats.ai,
              color: "text-blue-600 bg-blue-500/10",
              icon: <Syringe size={16} />,
            },
            {
              label: "Health Calls",
              val: stats.health,
              color: "text-rose-600 bg-rose-500/10",
              icon: <HeartPulse size={16} />,
            },
            {
              label: "Tech Notes",
              val: stats.tech,
              color: "text-emerald-600 bg-emerald-500/10",
              icon: <FileText size={16} />,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs hover:shadow-md transition-shadow"
            >
              <div className={`p-2.5 rounded-xl shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <div className="text-xl font-black tracking-tight">
                  {isLoading ? "..." : stat.val}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters Interactive Tab Ribbon */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="bg-base-100 border border-base-300 p-1 rounded-xl flex gap-1 shadow-xs">
            {[
              { id: "all", label: "All Media" },
              { id: "insemination", label: "AI Requests" },
              { id: "health", label: "Health Calls" },
              { id: "technician-note", label: "Tech Notes" },
              { id: "archived", label: "Archived Notes" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-white shadow-xs"
                    : "text-base-content/60 hover:bg-base-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-base-content/40 font-semibold flex items-center gap-1.5">
            <Grid3X3 size={13} /> {filteredNotes.length} media items matching
          </span>
        </div>

        {/* Responsive Field Grid Layout */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="card bg-base-100 border border-base-300 rounded-2xl shadow-xs overflow-hidden animate-pulse h-72"
                >
                  <div className="bg-base-300 h-44 w-full" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-base-300 rounded w-1/2" />
                    <div className="h-3 bg-base-300 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="card bg-base-100 border border-base-300 p-12 text-center text-base-content/40 rounded-2xl flex flex-col items-center justify-center gap-2">
              <AlertCircle size={24} className="text-base-content/30" />
              <span className="font-medium">
                No diagnostic field notes or items located matching selection
                metrics.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
              {filteredNotes.map((note) => {
                const badge = getBadgeConfig(note.type);
                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="card bg-base-100 border border-base-300 rounded-2xl shadow-2xs hover:shadow-md hover:border-primary transition-all duration-200 overflow-hidden cursor-pointer flex flex-col group"
                  >
                    <div className="w-full h-44 bg-base-200 relative overflow-hidden">
                      <img
                        src={note.imageUrl}
                        alt="Livestock case documentation"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            "https://images.unsplash.com/photo-1547586696-ea22b4d4235d?auto=format&fit=crop&q=80&w=400";
                        }}
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-bold text-base-content/40 tracking-wide">
                            {note.animalTag && note.animalTag !== "N/A"
                              ? `#${note.animalTag.substring(0, 7)}`
                              : "Tech File"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-base-content truncate">
                          {note.farmer || "Unknown Case"}
                        </h4>
                        <p className="text-xs text-base-content/75 font-medium line-clamp-2 leading-relaxed">
                          "{note.note || "No custom annotations provided."}"
                        </p>
                      </div>
                      <div className="pt-2.5 border-t border-base-300 flex justify-between items-center text-[10.5px] font-bold text-base-content/40">
                        <span className="flex items-center gap-0.5">
                          <Calendar size={11} />{" "}
                          {note.date
                            ? new Date(note.date).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "N/A"}
                        </span>
                        <span className="text-primary uppercase tracking-wider">
                          {note.status || "Completed"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ---- DUAL SCREEN LIGHTBOX INSPECTION MODAL ---- */}
      {selectedNote && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedNote(null)}
        >
          <div
            className="w-full max-w-5xl bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Frame Display Panel */}
            <div className="flex-[1.3] bg-black flex items-center justify-center relative p-2 min-h-[35vh] md:min-h-[50vh]">
              <img
                src={selectedNote.imageUrl}
                alt="Enlarged field report reference visual documentation"
                className="max-h-[50vh] md:max-h-[80vh] w-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src =
                    "https://images.unsplash.com/photo-1547586696-ea22b4d4235d?auto=format&fit=crop&q=80&w=400";
                }}
              />
              <button
                onClick={() => setSelectedNote(null)}
                className="absolute top-4 right-4 bg-black/60  text-white rounded-full p-1.5 transition-colors flex items-center justify-center cursor-pointer hover:bg-gray-600 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Right Frame Details Processing Panel */}
            <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[55vh] md:max-h-[85vh] bg-base-100">
              <div className="space-y-5">
                {/* Status Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${getBadgeConfig(selectedNote.type).style}`}
                    >
                      {selectedNote.type === "insemination"
                        ? "AI REQUEST"
                        : selectedNote.type === "health"
                          ? "HEALTH CALL"
                          : "TECHNICIAN NOTE"}
                    </span>
                    <span className="bg-base-200 text-base-content border border-base-300 text-[10px] font-black px-2 py-0.5 rounded-md">
                      {selectedNote.id
                        ? `REF-${selectedNote.id.substring(0, 6).toUpperCase()}`
                        : "LOG-FILE"}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                    {selectedNote.status || "Completed"}
                  </span>
                </div>

                {/* Primary Information */}
                <div className="space-y-1">
                  <div className="text-[9px] font-black text-base-content/40 uppercase tracking-widest">
                    Stakeholder Identity
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-base-content flex items-center gap-2">
                    <User size={18} className="text-base-content/40" />{" "}
                    {selectedNote.farmer || "Anonymous Entry"}
                  </h2>
                  <p className="text-xs text-base-content/40 font-medium flex items-center gap-1 pt-0.5">
                    <Phone size={12} className="text-base-content/40" /> Registry
                    Line:{" "}
                    <span className="font-mono font-bold text-base-content/70">
                      {selectedNote.phone || "N/A"}
                    </span>
                  </p>
                </div>

                <div className="divider my-0 opacity-40 border-base-300" />

                {/* DETAILED LIVESTOCK PROFILE ATRIBUTES */}
                <div className="space-y-2">
                  <div className="text-[9px] font-black text-base-content/40 uppercase tracking-widest flex items-center gap-1">
                    <Activity size={10} /> Livestock Resource Spec Sheets
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-base-200 border border-base-300 p-3 rounded-xl">
                      <div className="text-[9px] font-black text-base-content/40 uppercase tracking-wide">
                        System Ear Tag
                      </div>
                      <p className="text-xs font-black text-primary mt-0.5 flex items-center gap-1">
                        <Tag size={11} />{" "}
                        {selectedNote.animalTag &&
                        selectedNote.animalTag !== "N/A"
                          ? `#${selectedNote.animalTag}`
                          : "Unassigned Tag"}
                      </p>
                    </div>
                    <div className="bg-base-200 border border-base-300 p-3 rounded-xl">
                      <div className="text-[9px] font-black text-base-content/40 uppercase tracking-wide">
                        Breed Registry
                      </div>
                      <p className="text-xs font-bold text-base-content mt-0.5 truncate">
                        {selectedNote.animalBreed &&
                        selectedNote.animalBreed !== "N/A"
                          ? selectedNote.animalBreed
                          : "N/A"}
                      </p>
                    </div>
                    <div className="bg-base-200 border border-base-300 p-3 rounded-xl col-span-2">
                      <div className="text-[9px] font-black text-base-content/40 uppercase tracking-wide">
                        Biological Species
                      </div>
                      <p className="text-xs font-bold text-base-content mt-0.5">
                        {selectedNote.animalSpecies &&
                        selectedNote.animalSpecies !== "N/A"
                          ? selectedNote.animalSpecies
                          : "General Technical Entry"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ANNOTATION BLOCK */}
                <div className="bg-base-200 border border-base-300 p-4 rounded-xl space-y-1">
                  <span className="text-[9px] font-black tracking-wider uppercase text-base-content/40 block">
                    Annotation Case Notes
                  </span>
                  <p className="text-xs text-base-content/75 font-semibold italic leading-relaxed">
                    "
                    {selectedNote.note ||
                      "No annotations captured for this record entry."}
                    "
                  </p>
                </div>
              </div>

              {/* Modal Footer actions summary layout */}
              <div className="pt-4 mt-6 border-t border-base-300 flex items-center justify-between gap-2">
                <div className="text-[11px] text-base-content/40 font-medium">
                  Deployed Log:{" "}
                  <span className="font-bold text-base-content/70">
                    {selectedNote.date
                      ? new Date(selectedNote.date).toLocaleDateString(
                          undefined,
                          { dateStyle: "long" },
                        )
                      : "N/A"}
                  </span>
                </div>
                {selectedNote.isArchived ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreNote(selectedNote.id, selectedNote.type);
                      }}
                      className="btn btn-sm btn-outline border-emerald-500/30 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold gap-1 px-4 transition-all flex items-center cursor-pointer"
                    >
                      Restore Note
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePermanentlyDirect(selectedNote.id, selectedNote.type);
                      }}
                      className="btn btn-sm text-white bg-rose-600 hover:bg-rose-700 border-none rounded-xl text-xs font-bold gap-1 px-4 transition-all flex items-center cursor-pointer"
                    >
                      <Trash2 size={12} /> Erase
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) =>
                      handleDeleteNote(selectedNote.id, selectedNote.type, e)
                    }
                    className="btn btn-sm btn-outline border-rose-500/30 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold gap-1 px-4 transition-all flex items-center cursor-pointer"
                  >
                    <Trash2 size={12} /> Delete Note
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Upload Note Modal */}
      <UploadNoteModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={fetchFieldNotes}
      />

      {/* Confirmation Dialog Overlay */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-100 flex items-center justify-center p-4 animate-fade-in">
          <div className="card w-full max-w-sm bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-base-content/40 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Action"}</span>
            </div>
            <p className="text-xs text-base-content/70 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex flex-col gap-2 pt-2 border-t border-base-300">
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm(false);
                  setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
                }}
                className="btn btn-sm text-white border-none rounded-xl px-5 text-xs font-black cursor-pointer bg-slate-600 hover:bg-slate-700 w-full"
              >
                Hide / Archive Note
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm(true);
                  setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
                }}
                className="btn btn-sm text-white border-none rounded-xl px-5 text-xs font-black cursor-pointer bg-rose-600 hover:bg-rose-700 w-full"
              >
                Delete Permanently (Erase)
              </button>
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
                className="btn btn-sm btn-outline border-base-300 rounded-xl px-4 text-xs font-bold cursor-pointer text-base-content/60 mt-1 w-full"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
