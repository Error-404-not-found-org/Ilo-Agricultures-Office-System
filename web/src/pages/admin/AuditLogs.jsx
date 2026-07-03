import { useQuery } from "@tanstack/react-query";
import { FileClock, Search } from "lucide-react";
import { useState } from "react";
import Topbar from "../../components/ui/Topbar";
import axiosInstance from "../../lib/axios";

const ENTITY_TYPES = ["all", "User", "Animal", "HealthRequest", "AIRequest", "Insemination"];

export default function AuditLogs() {
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "audit-logs", entityType, action],
    queryFn: async () => {
      const res = await axiosInstance.get("/audit-logs", {
        params: { entityType, action: action || undefined, limit: 50 },
      });
      return res.data || {};
    },
  });

  const logs = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      <Topbar title="Audit Logs" subtitle="Administrative and workflow activity recorded by Backend 2.0" />

      <main className="p-6 space-y-5">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit entries</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{isLoading ? "..." : data?.total || 0}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold">
              {ENTITY_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filter action..." className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold outline-none" />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Failed to load audit logs.</p>
            <button onClick={() => refetch()} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold">Retry</button>
          </div>
        )}

        <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <p className="p-5 text-sm text-slate-400">Loading audit trail...</p>
            ) : logs.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-400">No audit records match this view.</p>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="p-5 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <FileClock size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{log.action}</p>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-[10px] font-black uppercase text-slate-500">{log.entityType}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Actor: {log.actorId?.name || "System"} · {new Date(log.createdAt).toLocaleString()}
                    </p>
                    {(log.before || log.after) && (
                      <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 text-[11px] text-slate-500 dark:text-slate-400">
                        {JSON.stringify({ before: log.before, after: log.after }, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
