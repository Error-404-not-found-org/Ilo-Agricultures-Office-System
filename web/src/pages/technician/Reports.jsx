import React, { useState } from 'react';
import { Calendar, Download, FileText, Filter, Printer, Table, ChevronRight, CheckCircle2, ClipboardList, Database, ArrowUpRight, Activity, Syringe } from 'lucide-react';
import axiosInstance from '../../lib/axios';
import { toast } from 'sonner';

const TechnicianReports = () => {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const formatAddress = (addr) => {
    if (!addr) return "No Address";
    if (typeof addr === "string") return addr;
    if (Array.isArray(addr) && addr.length > 0) {
      const first = addr[0];
      return `${first.barangay || ""}, ${first.city || ""}`.replace(/^,|,$/g, "").trim() || "No Address";
    }
    if (typeof addr === "object") {
      return `${addr.barangay || ""}, ${addr.city || ""}`.replace(/^,|,$/g, "").trim() || "No Address";
    }
    return "No Address";
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/reports/monthly-accomplishment?month=${selectedMonth}&year=${selectedYear}`);
      setReportData(res.data);
      if (res.data.length === 0) {
        toast.info("No records found for the selected period.");
      }
    } catch (error) {
      toast.error("Failed to fetch report data.");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return toast.error("No data to export.");

    const headers = [
      "Type", "AI Date", "Animal ID", "Ear Tag", "Species", "Breed", "Color", "Farmer", "Address",
      "AI Attempt", "Estrus", "Sire Breed", "Sire Code",
      "PD Date", "PD Result",
      "CD Date", "Calf Count", "Calf Drop Ease"
    ];

    const rows = reportData.map(item => [
      item.type,
      item.ai ? new Date(item.date).toLocaleDateString() : '',
      `"${item.animal?.animalId || ''}"`,
      `"${item.animal?.earTag || ''}"`,
      item.animal?.species || '',
      item.animal?.breed || '',
      item.animal?.color || '',
      item.farmer?.name || '',
      `"${formatAddress(item.farmer?.address)}"`,
      item.ai?.attempt || '',
      item.ai?.estrus || '',
      item.ai?.sireBreed || '',
      item.ai?.sireCode || '',
      item.pd?.date ? new Date(item.pd.date).toLocaleDateString() : '',
      item.pd?.result || '',
      item.cd ? new Date(item.date).toLocaleDateString() : '',
      item.cd?.count || '',
      item.cd?.ease || ''
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Monthly_Accomplishment_${selectedMonth}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report exported successfully!");
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
              <ClipboardList size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Administrative Hub</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
            Registry <span className="text-emerald-600 dark:text-emerald-500">Reports</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
             <Database size={12} /> Local Government Unit Data Repository
          </p>
        </div>
        
        <div className="w-full md:w-auto bg-white dark:bg-slate-900/50 backdrop-blur-xl p-3 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-none flex flex-col md:flex-row items-center gap-4">
          <div className="flex flex-col px-4 border-r border-slate-100 dark:border-slate-800">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Month</label>
             <select className="text-sm font-black bg-transparent outline-none cursor-pointer text-slate-900 dark:text-white" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
               {Array.from({length: 12}, (_, i) => (<option key={i+1} value={i+1} className="dark:bg-slate-900">{new Date(0, i).toLocaleString('en-US', {month: 'long'})}</option>))}
             </select>
          </div>
          <div className="flex flex-col px-4">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Year</label>
             <select className="text-sm font-black bg-transparent outline-none cursor-pointer text-slate-900 dark:text-white" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
               {[2024, 2025, 2026].map(y => (<option key={y} value={y} className="dark:bg-slate-900">{y}</option>))}
             </select>
          </div>
          <button onClick={fetchReport} disabled={loading} className="w-full md:w-auto px-8 py-3 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3">
            {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Filter size={16} />}
            Generate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 space-y-6">
           <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-slate-900 dark:bg-emerald-950/40 rounded-3xl p-6 text-white shadow-xl flex items-center justify-between">
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">Total Records</p>
                    <p className="text-4xl font-black mt-1">{reportData.length}</p>
                 </div>
                 <button onClick={exportToCSV} disabled={reportData.length === 0} className="px-6 py-3 bg-white text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2">
                    <Download size={16} /> Export to Excel (CSV)
                 </button>
              </div>
              <div className="flex gap-4">
                 <div className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center min-w-[120px]">
                    <p className="text-[9px] font-black text-blue-500 uppercase">AI Tasks</p>
                    <p className="text-2xl font-black dark:text-white">{reportData.filter(d => d.type.includes('AI')).length}</p>
                 </div>
                 <div className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center min-w-[120px]">
                    <p className="text-[9px] font-black text-purple-500 uppercase">PD Checks</p>
                    <p className="text-2xl font-black dark:text-white">{reportData.filter(d => d.type.includes('PD')).length}</p>
                 </div>
                 <div className="bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center min-w-[120px]">
                    <p className="text-[9px] font-black text-orange-500 uppercase">Births</p>
                    <p className="text-2xl font-black dark:text-white">{reportData.filter(d => d.type.includes('CD')).length}</p>
                 </div>
              </div>
           </div>

           {/* WIDE PREVIEW TABLE */}
           <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-4xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto custom-scrollbar">
                 {reportData.length > 0 ? (
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-slate-50/50 dark:bg-slate-800/30 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                         <th className="px-6 py-4 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Animal Info</th>
                         <th className="px-6 py-4">Farmer</th>
                         <th className="px-6 py-4 bg-blue-50/30 dark:bg-blue-900/10">Insemination (AI)</th>
                         <th className="px-6 py-4 bg-purple-50/30 dark:bg-purple-900/10">Pregnancy (PD)</th>
                         <th className="px-6 py-4 bg-orange-50/30 dark:bg-orange-900/10">Calf Drop (CD)</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                       {reportData.map((row, i) => (
                         <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                           <td className="px-6 py-4 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-100 dark:border-slate-800">
                              <p className="text-xs font-black text-slate-900 dark:text-white">#{row.animal?.earTag || row.animal?.animalId}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{row.animal?.species} · {row.animal?.breed}</p>
                              {row.animal?.color && <p className="text-[9px] text-emerald-500 font-black uppercase mt-0.5">{row.animal.color}</p>}
                           </td>
                           <td className="px-6 py-4">
                              <p className="text-xs font-black text-slate-700 dark:text-slate-300">{row.farmer?.name}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[120px]">{formatAddress(row.farmer?.address)}</p>
                           </td>
                           <td className="px-6 py-4 bg-blue-50/20 dark:bg-blue-900/5">
                              {row.ai ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">{new Date(row.date).toLocaleDateString()}</p>
                                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Attempt #{row.ai.attempt} · {row.ai.estrus}</p>
                                  <p className="text-[9px] text-slate-400 uppercase">{row.ai.sireBreed} [{row.ai.sireCode}]</p>
                                </div>
                              ) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                           </td>
                           <td className="px-6 py-4 bg-purple-50/20 dark:bg-purple-900/5">
                              {row.pd ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase">{row.pd.date ? new Date(row.pd.date).toLocaleDateString() : '—'}</p>
                                  <p className={`text-[10px] font-black uppercase ${row.pd.result === 'Pregnant' ? 'text-emerald-600' : 'text-rose-600'}`}>{row.pd.result}</p>
                                </div>
                              ) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                           </td>
                           <td className="px-6 py-4 bg-orange-50/20 dark:bg-orange-900/5">
                              {row.cd ? (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase">{new Date(row.date).toLocaleDateString()}</p>
                                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Count: {row.cd.count} · Ease: {row.cd.ease}</p>
                                </div>
                              ) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 ) : (
                   <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
                      <Database size={48} className="opacity-10" />
                      <p className="font-black text-xs uppercase tracking-widest">No data for selected period</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
      ` }} />
    </div>
  );
};

export default TechnicianReports;
