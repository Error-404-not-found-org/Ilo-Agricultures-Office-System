import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axiosInstance from '../../lib/axios';
import { 
    Image as ImageIcon, 
    Search, 
    Filter, 
    MapPin, 
    Calendar, 
    Phone, 
    Tag, 
    Syringe, 
    HeartPulse, 
    ChevronRight, 
    X,
    Maximize2,
    Eye,
    Trash2
} from 'lucide-react';

const FieldNotes = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedNote, setSelectedNote] = useState(null); // For fullscreen lightbox/modal

    // Fetch Field Notes (requests with images)
    const { data: notes = [], isLoading, refetch } = useQuery({
        queryKey: ['technician', 'field-notes'],
        queryFn: async () => {
            const res = await axiosInstance.get('/technician/field-notes');
            return res.data || [];
        }
    });

    const handleDeleteNote = async (id, type) => {
        if (!window.confirm("Are you sure you want to permanently delete this field note?")) {
            return;
        }

        try {
            await axiosInstance.delete(`/technician/field-notes/${id}?type=${type}`);
            setSelectedNote(null);
            refetch();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || "Failed to delete field note");
        }
    };

    // Filter logic
    const filteredNotes = notes.filter(n => {
        const matchesSearch = 
            n.farmer.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.animalTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.note.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (typeFilter === 'all') return matchesSearch;
        return matchesSearch && n.type === typeFilter;
    });

    const aiCount = notes.filter(n => n.type === 'insemination').length;
    const healthCount = notes.filter(n => n.type === 'health').length;
    const techNoteCount = notes.filter(n => n.type === 'technician-note').length;

    return (
        <div className="animate-fade-in space-y-6 pb-16">
            {/* PAGE HEADER */}
            <div className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-linear-to-r from-[#074033] to-emerald-800 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                                <ImageIcon size={14} className="text-emerald-300" />
                            </div>
                            <span className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">
                                Media Ledger & Repository
                            </span>
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Field Notes & Gallery</h1>
                        <p className="text-emerald-200/70 text-xs mt-0.5">Explore symptoms, photos, and specialized annotations submitted by farmers and field technicians</p>
                    </div>
                    <div className="flex gap-4 shrink-0 bg-black/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/5">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-emerald-300/40 uppercase tracking-widest mb-0.5 text-left">Total Attachments</p>
                            <p className="text-2xl font-black text-white text-left leading-none">{notes.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* QUICK STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-sm flex flex-row items-center justify-between">
                    <div>
                        <span className="text-[9px] font-black text-base-content/40 uppercase tracking-wider">Total Attachments</span>
                        <p className="text-2xl font-black text-base-content mt-0.5">{notes.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-base-content/60">
                        <ImageIcon size={20} />
                    </div>
                </div>
                <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-sm flex flex-row items-center justify-between">
                    <div>
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider">Artificial Insemination</span>
                        <p className="text-2xl font-black text-base-content mt-0.5">{aiCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <Syringe size={20} />
                    </div>
                </div>
                <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-sm flex flex-row items-center justify-between">
                    <div>
                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider">Medical Diagnostics</span>
                        <p className="text-2xl font-black text-base-content mt-0.5">{healthCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                        <HeartPulse size={20} />
                    </div>
                </div>
                <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-sm flex flex-row items-center justify-between">
                    <div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider">Technician Notes</span>
                        <p className="text-2xl font-black text-base-content mt-0.5">{techNoteCount}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <ImageIcon size={20} />
                    </div>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="join border border-base-300 rounded-xl overflow-hidden shrink-0">
                    {[
                        { val: 'all', label: 'ALL MEDIA' },
                        { val: 'insemination', label: 'AI REQUESTS' },
                        { val: 'health', label: 'HEALTH REQUESTS' },
                        { val: 'technician-note', label: 'TECHNICIAN NOTES' }
                    ].map(tab => (
                        <button key={tab.val} onClick={() => setTypeFilter(tab.val)}
                            className={`join-item btn btn-sm px-5 ${typeFilter === tab.val ? "btn-neutral" : "bg-base-100 border-none text-base-content/60"}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <label className="input input-sm bg-base-100 border-base-300 flex items-center gap-2 grow rounded-xl h-9 shadow-sm">
                    <Search size={14} className="text-base-content/40" />
                    <input type="text" placeholder="Search by farmer, ear tag, or symptoms..." className="grow text-xs font-bold"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    {searchQuery && <button onClick={() => setSearchQuery("")} className="text-base-content/40 hover:text-error transition-colors">✕</button>}
                </label>
                
                <span className="text-xs text-base-content/40 font-semibold shrink-0">{filteredNotes.length} media items matching</span>
            </div>

            {/* MAIN PINTEREST-STYLE GRID */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="card bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-hidden animate-pulse h-80">
                            <div className="bg-base-300 h-48 w-full" />
                            <div className="p-4 space-y-2">
                                <div className="h-4 bg-base-300 rounded w-2/3" />
                                <div className="h-3 bg-base-300 rounded w-1/2" />
                                <div className="h-3 bg-base-300 rounded w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredNotes.length === 0 ? (
                <div className="card bg-base-100 border border-base-300 rounded-2xl p-20 text-center shadow-sm">
                    <ImageIcon size={48} strokeWidth={1} className="mx-auto mb-3 text-base-content/20" />
                    <p className="text-xs font-black uppercase tracking-widest text-base-content/40">No Attached Media Found</p>
                    <p className="text-xs text-base-content/30 mt-1">Attachments will appear here once farmers or technicians upload photo notes</p>
                </div>
            ) : (
                <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-6 space-y-6">
                    {filteredNotes.map((note) => (
                        <div 
                            key={note.id} 
                            onClick={() => setSelectedNote(note)}
                            className="break-inside-avoid card bg-base-100 border border-base-300 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer border-t-4 border-t-transparent hover:border-t-emerald-600"
                        >
                            {/* IMAGE THUMBNAIL */}
                            <div className="relative overflow-hidden aspect-video sm:aspect-square bg-base-200">
                                <img 
                                    src={note.imageUrl} 
                                    alt={note.farmer} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = 'https://images.unsplash.com/photo-1547586696-ea22b4d4235d?auto=format&fit=crop&q=80&w=400';
                                    }}
                                />
                                <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider text-white flex items-center gap-1">
                                    {note.type === 'insemination' ? (
                                        <>
                                            <Syringe size={10} className="text-blue-400" />
                                            <span>AI Req</span>
                                        </>
                                    ) : note.type === 'health' ? (
                                        <>
                                            <HeartPulse size={10} className="text-rose-400" />
                                            <span>Health Req</span>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon size={10} className="text-emerald-400" />
                                            <span>Tech Note</span>
                                        </>
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button className="btn btn-circle btn-sm bg-white/20 hover:bg-white/40 text-white border-none">
                                        <Eye size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* CARD CONTENT */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-xs text-base-content leading-tight truncate">{note.farmer}</h3>
                                        <div className="badge badge-sm bg-base-200 text-base-content/60 font-black text-[9px] tracking-wide shrink-0">
                                            {note.animalTag && note.animalTag !== 'N/A' ? `#${note.animalTag.substring(0, 5)}` : 'Tech Note'}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-base-content/40 font-bold mt-0.5 flex items-center gap-1">
                                        <Tag size={9} /> {note.animalBreed && note.animalBreed !== 'N/A' ? `${note.animalBreed} · ${note.animalSpecies}` : `Logged by ${note.author || 'Technician'}`}
                                    </p>
                                </div>

                                <div className="bg-base-200/50 p-2.5 rounded-xl border border-base-300/40">
                                    <p className="text-xs text-base-content/80 font-medium leading-relaxed italic line-clamp-3">
                                        "{note.note}"
                                    </p>
                                </div>

                                <div className="flex items-center justify-between text-[9px] font-bold text-base-content/40 border-t border-base-300/40 pt-2.5">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={10} />
                                        {new Date(note.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className="flex items-center gap-1 text-emerald-600 font-extrabold uppercase tracking-widest">
                                        {note.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* LIGHTBOX DETAIL MODAL */}
            {selectedNote && (
                <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in" onClick={() => setSelectedNote(null)}>
                    <div 
                        className="card bg-base-100 border border-base-300 max-w-4xl w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh] animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* IMAGE PREVIEW */}
                        <div className="relative md:w-1/2 bg-black flex items-center justify-center overflow-hidden aspect-video md:aspect-auto">
                            <img 
                                src={selectedNote.imageUrl} 
                                alt={selectedNote.farmer} 
                                className="w-full h-full object-contain max-h-[40vh] md:max-h-none"
                                onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = 'https://images.unsplash.com/photo-1547586696-ea22b4d4235d?auto=format&fit=crop&q=80&w=400';
                                }}
                            />
                            <a 
                                href={selectedNote.imageUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="absolute bottom-4 right-4 btn btn-circle btn-sm bg-black/40 hover:bg-black/60 border-none text-white"
                                title="Open Original Image"
                            >
                                <Maximize2 size={14} />
                            </a>
                        </div>

                        {/* INFO PANEL */}
                        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
                            <div className="space-y-6">
                                {/* MODAL HEADER */}
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`badge badge-sm font-black text-[9px] uppercase tracking-wider ${
                                                selectedNote.type === 'insemination' ? 'bg-blue-500/10 text-blue-500' : 
                                                selectedNote.type === 'health' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                                            }`}>
                                                {selectedNote.type === 'insemination' ? 'Artificial Insemination' : 
                                                 selectedNote.type === 'health' ? 'Medical Diagnostics' : `Field Note by ${selectedNote.author || 'Technician'}`}
                                            </span>
                                            <span className="badge badge-sm bg-base-200 text-base-content/60 font-black text-[9px] tracking-wide">
                                                ID: {selectedNote.id.substring(0, 8).toUpperCase()}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-black text-base-content leading-tight">{selectedNote.farmer}</h2>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedNote(null)}
                                        className="btn btn-circle btn-sm btn-ghost text-base-content/40 hover:text-base-content hover:bg-base-200"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                <div className="divider my-0 opacity-40" />

                                {/* ANIMAL & FARMER INFO */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-base-200/40 p-3.5 rounded-xl border border-base-300/40">
                                        <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Animal Ear Tag</p>
                                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-500 mt-0.5">
                                            {selectedNote.animalTag && selectedNote.animalTag !== 'N/A' ? `#${selectedNote.animalTag}` : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-base-200/40 p-3.5 rounded-xl border border-base-300/40">
                                        <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Breed / Species</p>
                                        <p className="text-xs font-black text-base-content mt-0.5">
                                            {selectedNote.animalBreed && selectedNote.animalBreed !== 'N/A' ? `${selectedNote.animalBreed} (${selectedNote.animalSpecies})` : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-base-200/40 p-3.5 rounded-xl border border-base-300/40 col-span-2">
                                        <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Farmer Contact</p>
                                        <p className="text-xs font-black text-base-content mt-0.5 flex items-center gap-1.5">
                                            <Phone size={11} className="text-base-content/40" />
                                            {selectedNote.farmerPhone || 'N/A'}
                                        </p>
                                    </div>
                                    {selectedNote.latitude && selectedNote.longitude && (
                                        <div className="bg-base-200/40 p-3.5 rounded-xl border border-base-300/40 col-span-2">
                                            <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">GPS Coordinates</p>
                                            <p className="text-xs font-black text-base-content mt-0.5 flex items-center gap-1.5">
                                                <MapPin size={11} className="text-emerald-600" />
                                                {selectedNote.latitude}°, {selectedNote.longitude}° (Oton, Iloilo)
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* FARMER NOTES */}
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-base-content/30 uppercase tracking-widest">Attached Field Notes</p>
                                    <div className="bg-base-200/50 p-4 rounded-xl border border-base-300/40 min-h-[80px]">
                                        <p className="text-xs text-base-content/80 font-semibold leading-relaxed italic">
                                            "{selectedNote.note}"
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="mt-8 pt-4 border-t border-base-300/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[10px] font-bold text-base-content/40">
                                <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    Submitted {new Date(selectedNote.date).toLocaleString()}
                                </span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => handleDeleteNote(selectedNote.id, selectedNote.type)}
                                        className="btn btn-xs btn-error btn-outline flex items-center gap-1.5 rounded-lg border border-red-500/20 py-1 px-2.5 h-auto min-h-0 text-[10px] font-black uppercase tracking-wider transition-all hover:bg-error hover:text-white"
                                    >
                                        <Trash2 size={11} />
                                        <span>Delete Note</span>
                                    </button>
                                    <span className="flex items-center gap-1.5 uppercase font-black tracking-widest text-emerald-600">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        {selectedNote.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FieldNotes;
