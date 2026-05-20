import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, FileText } from 'lucide-react';

const DailyReportModal = ({ isOpen, onClose, agendaItems, stats }) => {
  const printRef = useRef(null);

  if (!isOpen) return null;

  const completedTasks = agendaItems.filter(item => item.status === 'done' || item.status === 'resolved');
  const pendingTasks = agendaItems.filter(item => item.status !== 'done' && item.status !== 'resolved');

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md print:p-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-base-100 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col border border-base-300 print:shadow-none print:border-none print:max-h-none print:static print:rounded-none"
        >
          {/* Header */}
          <div className="p-6 border-b border-base-300 flex justify-between items-center print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl items-center justify-center flex">
                <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-base-content leading-none uppercase">Daily Accomplishment Report</h3>
                <p className="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-1.5 leading-none">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#074033] hover:bg-[#0d5948] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
              >
                <Printer size={16} />
                Print Report
              </button>
              <button onClick={onClose} className="p-2.5 hover:bg-base-200 text-base-content/40 hover:text-base-content rounded-full transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible bg-base-200/30">
            <div id="printable-report" className="bg-base-100 p-8 rounded-2xl shadow-sm border border-base-300 print:border-none print:shadow-none">
              
              {/* Report Letterhead (Visible in Print) */}
              <div className="text-center mb-10 pb-6 border-b-2 border-base-content">
                <h1 className="text-2xl font-black uppercase tracking-tighter text-base-content">Municipal Agriculture Office</h1>
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mt-1">Livestock & Breeding Division</p>
                <div className="mt-6 flex justify-between items-end">
                   <div className="text-left">
                      <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">Report Date</p>
                      <p className="text-sm font-bold text-base-content">{new Date().toLocaleDateString()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">Technician Name</p>
                      <p className="text-sm font-bold uppercase tracking-tight text-base-content">Active Field Officer</p>
                   </div>
                </div>
              </div>

              <h2 className="text-xl font-black mb-6 text-base-content uppercase tracking-tight">
                Daily Summary
              </h2>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-base-200/40 p-5 rounded-2xl border border-base-300 text-center">
                  <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-1.5">Total Assigned</p>
                  <p className="text-3xl font-black text-base-content uppercase">{agendaItems.length}</p>
                </div>
                <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20 text-center">
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5">Completed</p>
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 uppercase">{completedTasks.length}</p>
                </div>
                <div className="bg-rose-500/10 p-5 rounded-2xl border border-rose-500/20 text-center">
                  <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1.5">Completion Rate</p>
                  <p className="text-3xl font-black text-rose-600 dark:text-rose-400 uppercase">
                    {agendaItems.length > 0 ? Math.round((completedTasks.length / agendaItems.length) * 100) : 0}%
                  </p>
                </div>
              </div>

              {/* Task Table */}
              <div className="mb-10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-4 ml-1">Work Log Details</h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-base-300 text-base-content/50">
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Time</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Service Task</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Farmer</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Location</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendaItems.length > 0 ? agendaItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-base-200 text-base-content/80 hover:bg-base-200/20">
                        <td className="py-4 px-2 text-xs font-bold text-blue-600">{item.time}</td>
                        <td className="py-4 px-2">
                          <p className="text-xs font-black text-base-content uppercase">{item.task}</p>
                          <p className="text-[9px] text-base-content/30 font-bold uppercase">ID: {item.id.toString().substring(0,8)}</p>
                        </td>
                        <td className="py-4 px-2 text-xs font-bold text-base-content/75 uppercase">{item.farmer}</td>
                        <td className="py-4 px-2 text-xs text-base-content/50 uppercase">{item.location}</td>
                        <td className="py-4 px-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded-md ${item.status === 'done' || item.status === 'resolved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-base-300 bg-base-200 text-base-content/40'}`}>
                            {item.status === 'done' || item.status === 'resolved' ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-base-content/30 text-xs font-bold uppercase">No tasks recorded for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signature Section */}
              <div className="mt-20 flex justify-between items-start text-base-content">
                <div className="w-48 text-center border-t border-base-content pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Prepared By</p>
                  <p className="text-xs font-bold mt-1 uppercase">Field Technician</p>
                </div>
                <div className="w-48 text-center border-t border-base-content pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Verified By</p>
                  <p className="text-xs font-bold mt-1 uppercase">Municipal Agriculturist</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Global CSS for Print Overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            margin: 0;
            background: white !important;
            color: black !important;
          }
          .print\\:hidden { display: none !important; }
        }
      ` }} />
    </AnimatePresence>
  );
};

export default DailyReportModal;
