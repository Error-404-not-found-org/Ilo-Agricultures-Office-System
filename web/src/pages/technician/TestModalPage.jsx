import React, { useState } from 'react';
import TaskActionModal from '../../components/modals/TaskActionModal';
import { Play, ClipboardList, HeartPulse, Zap } from 'lucide-react';

const TestModalPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  const demoTasks = [
    {
      id: "AI-2024-001",
      type: 'breeding',
      status: 'pending',
      farmer: 'Juan Dela Cruz',
      location: 'Brgy. San Jose, Iloilo',
      preferredDate: new Date().toISOString(),
      urgent: false,
      raw: {
        animalId: {
          earTag: 'TAG-8829',
          breed: 'Holstein Friesian',
          species: 'Cattle',
          imageUrl: null
        }
      }
    },
    {
      id: "HLT-2024-042",
      type: 'health',
      status: 'pending',
      farmer: 'Maria Santos',
      location: 'Brgy. Obrero, Lapaz',
      preferredDate: new Date().toISOString(),
      urgent: true,
      raw: {
        animalId: {
          earTag: 'TAG-1102',
          breed: 'Brahman',
          species: 'Cattle',
          imageUrl: null
        }
      }
    },
    {
      id: "DONE-772",
      type: 'breeding',
      status: 'done',
      farmer: 'Ricardo Dalisay',
      location: 'Brgy. Molo, Iloilo',
      preferredDate: new Date().toISOString(),
      urgent: false,
      raw: {
        animalId: {
          earTag: 'TAG-9901',
          breed: 'Angus',
          species: 'Cattle',
          imageUrl: null
        }
      }
    }
  ];

  const openTestModal = (task) => {
    setActiveTask(task);
    setModalOpen(true);
  };

  return (
    <div className="p-12 min-h-screen bg-slate-50 dark:bg-[#020617]">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="space-y-4">
          <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Modal <span className="text-emerald-500 underline decoration-emerald-500/20 underline-offset-8">Design Lab</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg">
            Testing the Technician Action Center modal interface with various state scenarios.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => openTestModal(demoTasks[0])}
            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-4xl text-left hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-2xl active:scale-95"
          >
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
              <ClipboardList size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Pending AI</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Normal Request</p>
            <div className="mt-8 flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Launch Prototype <Play size={10} fill="currentColor" />
            </div>
          </button>

          <button 
            onClick={() => openTestModal(demoTasks[1])}
            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-4xl text-left hover:border-rose-500/50 transition-all shadow-sm hover:shadow-2xl active:scale-95"
          >
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-600 mb-6 group-hover:scale-110 transition-transform">
              <HeartPulse size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Urgent Health</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Critical Alert</p>
            <div className="mt-8 flex items-center gap-2 text-rose-600 font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Launch Prototype <Play size={10} fill="currentColor" />
            </div>
          </button>

          <button 
            onClick={() => openTestModal(demoTasks[2])}
            className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-4xl text-left hover:border-blue-500/50 transition-all shadow-sm hover:shadow-2xl active:scale-95"
          >
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
              <Zap size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Archived Task</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Read-only View</p>
            <div className="mt-8 flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              Launch Prototype <Play size={10} fill="currentColor" />
            </div>
          </button>
        </div>

        <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
          <p className="text-xs font-black text-emerald-600 uppercase tracking-[0.3em]">System Diagnostics</p>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            The modal is fully responsive and supports Dark Mode. All actions in this lab are simulated.
          </p>
        </div>
      </div>

      <TaskActionModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        task={activeTask}
        onSuccess={() => console.log("Demo Success!")}
      />
    </div>
  );
};

export default TestModalPage;
