import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, FileText, Download, CheckCircle2 } from 'lucide-react';

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
      <div className="fixed inset-0 z-100 flex items-center justify-center p-4 print:p-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm print:hidden"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:max-h-none print:static print:rounded-none"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl items-center justify-center flex">
                <FileText size={20} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Daily Accomplishment Report</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-200"
              >
                <Printer size={16} />
                Print Report
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible bg-slate-50/50 dark:bg-slate-950/50">
            <div id="printable-report" className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 print:border-none print:shadow-none">
              
              {/* Report Letterhead (Visible in Print) */}
              <div className="text-center mb-10 pb-6 border-b-2 border-slate-900">
                <h1 className="text-2xl font-black uppercase tracking-tighter">Municipal Agriculture Office</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Livestock & Breeding Division</p>
                <div className="mt-4 flex justify-between items-end">
                   <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Date</p>
                      <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Technician Name</p>
                      <p className="text-sm font-bold uppercase tracking-tight">Active Field Officer</p>
                   </div>
                </div>
              </div>

              <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                Daily Summary
              </h2>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Assigned</p>
                  <p className="text-3xl font-black text-slate-900">{agendaItems.length}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Completed</p>
                  <p className="text-3xl font-black text-emerald-700">{completedTasks.length}</p>
                </div>
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Completion Rate</p>
                  <p className="text-3xl font-black text-rose-700">
                    {agendaItems.length > 0 ? Math.round((completedTasks.length / agendaItems.length) * 100) : 0}%
                  </p>
                </div>
              </div>

              {/* Task Table */}
              <div className="mb-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Work Log Details</h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Time</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Service Task</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Farmer</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Location</th>
                      <th className="py-3 px-2 text-[10px] font-black uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendaItems.length > 0 ? agendaItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-4 px-2 text-xs font-bold text-blue-600">{item.time}</td>
                        <td className="py-4 px-2">
                          <p className="text-xs font-black text-slate-900">{item.task}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">ID: {item.id.toString().substring(0,8)}</p>
                        </td>
                        <td className="py-4 px-2 text-xs font-bold text-slate-700">{item.farmer}</td>
                        <td className="py-4 px-2 text-xs text-slate-500">{item.location}</td>
                        <td className="py-4 px-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${item.status === 'done' || item.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                            {item.status === 'done' || item.status === 'resolved' ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 text-xs font-bold uppercase">No tasks recorded for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signature Section */}
              <div className="mt-20 flex justify-between items-start">
                <div className="w-48 text-center border-t border-slate-900 pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest">Prepared By</p>
                  <p className="text-xs font-bold mt-1">Field Technician</p>
                </div>
                <div className="w-48 text-center border-t border-slate-900 pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest">Verified By</p>
                  <p className="text-xs font-bold mt-1">Municipal Agriculturist</p>
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
            background: white;
            color: black;
          }
          .print\\:hidden { display: none !important; }
        }
      ` }} />
    </AnimatePresence>
  );
};

export default DailyReportModal;
