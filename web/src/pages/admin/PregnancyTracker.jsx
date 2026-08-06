import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Plus,
  Calendar,
  CheckCircle2,
  Dna,
  Heart,
  ChevronRight,
  X,
} from "lucide-react";
import AnimalImageFallback from "../../components/technician/AnimalImageFallback";

export default function PregnancyTracker() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Mock Animal Pregnancy Data
  const animal = {
    id: id || "BS-2456",
    name: "Bella",
    earTag: "78459",
    animalId: "BS-2456",
    species: "Holstein Friesian",
    gender: "Female",
    age: "4 Years",
    status: "In Calf",
    sire: "Maximus (HF-1023)",
    dam: "Daisy (HF-5567)",
    breedingDate: "Apr 18, 2024",
    dueDate: "Jan 25, 2025",
    currentWeek: 31,
    totalWeeks: 40,
    progressPercent: 77,
    weeksRemaining: 8,
  };

  const timelineSteps = [
    {
      id: 1,
      title: "Breeding Confirmed",
      date: "Apr 18, 2024",
      subtext: "AI Breeding • Sire: Maximus (HF-1023)",
      completed: true,
    },
    {
      id: 2,
      title: "Pregnancy Confirmed",
      date: "May 18, 2024 (Week 4)",
      subtext: "Confirmed by vet (Ultrasound diagnosis)",
      completed: true,
    },
    {
      id: 3,
      title: "Mid Pregnancy Check",
      date: "Jul 18, 2024 (Week 14)",
      subtext: "Completed (Fetal heartbeat & growth normal)",
      completed: true,
    },
    {
      id: 4,
      title: "Pre-Calving Check",
      date: "Dec 28, 2024 (Week 36)",
      subtext: "Upcoming (Scheduled physical evaluation)",
      completed: false,
    },
    {
      id: 5,
      title: "Expected Calving",
      date: "Jan 25, 2025 (Week 40)",
      subtext: "Upcoming (Estimated due date)",
      completed: false,
    },
  ];

  return (
    <div className="min-h-screen flex-1 overflow-y-auto bg-base-200 text-base-content font-sans">
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-success shadow-lg text-white font-bold text-xs rounded-2xl flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-base-300 bg-base-100/95 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-base-content tracking-tight">
              Pregnancy Tracker
            </h1>
            <p className="text-xs text-base-content/60 font-medium truncate flex items-center gap-1.5">
              <span>Home</span>
              <span>&rsaquo;</span>
              <span>Pregnancy Tracker</span>
              <span>&rsaquo;</span>
              <span className="font-bold text-primary">{animal.name}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary btn-sm rounded-xl gap-2 font-extrabold shadow-sm px-4"
        >
          <Plus size={16} /> Add Pregnancy Record
        </button>
      </header>

      {/* ── Compact Main Page Layout ── */}
      <main className="p-4 sm:p-6 lg:p-8 space-y-5 flex-1 w-full">
        {/* ── CARD 1: Animal Overview & Reproduction Specs ── */}
        <div className="bg-base-100 rounded-3xl border border-base-300 p-5 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left: Animal Details */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
            <div className="size-20 rounded-2xl overflow-hidden shrink-0 bg-base-200 border border-base-300 relative shadow-xs">
              <AnimalImageFallback
                tag={animal.earTag}
                className="w-full h-full object-cover"
                iconSize={32}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-black text-base-content tracking-tight">
                  {animal.name}
                </h2>
                <span className="badge badge-success font-extrabold text-[11px] px-3 py-1.5 gap-1 rounded-full text-emerald-950 dark:text-emerald-100">
                  <CheckCircle2 size={13} />
                  {animal.status}
                </span>
              </div>
              <p className="text-xs font-semibold text-base-content/60">
                {animal.species} &bull; {animal.gender} &bull; {animal.age}
              </p>
              <p className="text-xs font-mono font-bold text-base-content/70">
                Animal ID: <span className="text-base-content">{animal.animalId}</span> &bull; Tag ID:{" "}
                <span className="text-base-content">{animal.earTag}</span>
              </p>
            </div>
          </div>

          {/* Right: Sire, Dam, Breeding & Due Dates Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto bg-base-200/60 p-3.5 rounded-2xl border border-base-200 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shrink-0">
                <Dna size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-base-content/60 uppercase">Sire</p>
                <p className="text-xs font-black text-base-content truncate">{animal.sire}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shrink-0">
                <Heart size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-base-content/60 uppercase">Dam</p>
                <p className="text-xs font-black text-base-content truncate">{animal.dam}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shrink-0">
                <Calendar size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-base-content/60 uppercase">Breeding Date</p>
                <p className="text-xs font-black text-base-content truncate">{animal.breedingDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shrink-0">
                <Calendar size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-base-content/60 uppercase">Due Date (Est.)</p>
                <p className="text-xs font-black text-base-content truncate">{animal.dueDate}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── CARD 2: Compact Pregnancy Progress ── */}
        <div className="bg-base-100 rounded-3xl border border-base-300 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-base-content tracking-tight">
              Pregnancy Progress
            </h3>
            <span className="text-sm font-black text-primary">
              {animal.progressPercent}%
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-base-content/70 gap-1">
            <span>Week {animal.currentWeek} of {animal.totalWeeks}</span>
            <span>Due in {animal.weeksRemaining} weeks ({animal.dueDate})</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-base-200 rounded-full h-3.5 overflow-hidden p-0.5 border border-base-300">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${animal.progressPercent}%` }}
            />
          </div>

          {/* Advice Alert Banner */}
          <div className="alert bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5 py-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold">{animal.name} is progressing well.</span> Monitor her nutrition and ensure regular exercise for a healthy pregnancy.
            </div>
          </div>
        </div>

        {/* ── CARD 3: Compact Full-Width Pregnancy Timeline ── */}
        <div className="bg-base-100 rounded-3xl border border-base-300 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-base-200 pb-3">
            <h3 className="text-base font-extrabold text-base-content tracking-tight">
              Pregnancy Timeline
            </h3>
            <span className="text-xs font-semibold text-base-content/60">
              5 Total Milestones
            </span>
          </div>

          {/* Vertical Stepper */}
          <div className="space-y-4 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-base-200">
            {timelineSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-4 relative group">
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 border ${
                    step.completed
                      ? "bg-primary text-primary-content border-primary"
                      : "bg-base-100 text-base-content/40 border-base-300"
                  }`}
                >
                  {step.completed ? <CheckCircle2 size={15} /> : step.id}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-sm font-extrabold text-base-content">
                      {step.title}
                    </h4>
                    <span className="text-xs font-semibold text-base-content/60">
                      {step.date}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-base-content/60 mt-0.5">
                    {step.subtext}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-base-200 pt-3 text-center">
            <button
              type="button"
              onClick={() => showToast("Viewing full timeline history")}
              className="btn btn-ghost btn-sm text-xs font-bold text-primary gap-1 hover:bg-primary/10 rounded-xl"
            >
              View full timeline <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </main>

      {/* ── UI Modal: Add Pregnancy Record ── */}
      {isAddModalOpen && (
        <div className="modal modal-open backdrop-blur-xs">
          <div className="modal-box bg-base-100 border border-base-300 rounded-3xl p-6 max-w-lg shadow-2xl">
            <div className="flex items-center justify-between border-b border-base-200 pb-3 mb-4">
              <h3 className="text-lg font-black text-base-content flex items-center gap-2">
                <Plus size={18} className="text-primary" />
                Add Pregnancy Record
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-ghost btn-sm btn-square rounded-xl"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsAddModalOpen(false);
                showToast("New pregnancy record saved successfully!");
              }}
              className="space-y-4 text-xs font-semibold"
            >
              <div>
                <label className="block text-base-content/70 mb-1">Record Type</label>
                <select className="select select-bordered select-sm w-full rounded-xl bg-base-200">
                  <option>Pregnancy Diagnosis (Ultrasound)</option>
                  <option>Palpation Check</option>
                  <option>Mid-Term Health Evaluation</option>
                  <option>Pre-Calving Preparation</option>
                </select>
              </div>

              <div>
                <label className="block text-base-content/70 mb-1">Check Date</label>
                <input
                  type="date"
                  defaultValue="2024-05-18"
                  className="input input-bordered input-sm w-full rounded-xl bg-base-200"
                />
              </div>

              <div>
                <label className="block text-base-content/70 mb-1">Fetal Health Status</label>
                <select className="select select-bordered select-sm w-full rounded-xl bg-base-200">
                  <option>Healthy &amp; Normal Growth</option>
                  <option>Requires Nutrition Supplement</option>
                  <option>High Risk / Monitoring Needed</option>
                </select>
              </div>

              <div>
                <label className="block text-base-content/70 mb-1">Notes / Observations</label>
                <textarea
                  rows={3}
                  placeholder="Enter veterinarian findings or observation notes..."
                  className="textarea textarea-bordered w-full rounded-xl bg-base-200 text-xs"
                />
              </div>

              <div className="modal-action border-t border-base-200 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn btn-ghost btn-sm rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm rounded-xl font-extrabold px-5 text-white"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
