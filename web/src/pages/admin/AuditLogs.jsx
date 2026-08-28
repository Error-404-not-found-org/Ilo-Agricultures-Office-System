import { useQuery } from "@tanstack/react-query";
import { FileClock, Search } from "lucide-react";
import { useState } from "react";
import Topbar from "../../components/layout/Topbar";
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
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content">
      <Topbar title="Audit Logs" subtitle="Administrative and workflow activity recorded by Backend 2.0" />

      <main className="p-6 space-y-5">
        <div className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 ">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-base-content/50">Audit entries</p>
            <p className="text-2xl font-black text-base-content">{isLoading ? "..." : data?.total || 0}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="px-3 py-2 rounded-xl border border-base-300 bg-base-200 text-xs font-bold">
              {ENTITY_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" />
              <input aria-label="Filter audit actions" value={action} onChange={(event) => setAction(event.target.value)} placeholder="Filter action..." className="pl-9 pr-3 py-2 rounded-xl border border-base-300 bg-base-200 text-xs font-bold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="alert alert-error alert-soft">
            <p className="text-sm font-semibold text-error">Failed to load audit logs.</p>
            <button onClick={() => refetch()} className="btn btn-error btn-sm">Retry</button>
          </div>
        )}

        <section className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden ">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <p className="p-5 text-sm text-base-content/50">Loading audit trail...</p>
            ) : logs.length === 0 ? (
              <p className="p-10 text-center text-sm text-base-content/50">No audit records match this view.</p>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="p-5 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileClock size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-base-content">{log.action}</p>
                      <span className="px-2 py-0.5 rounded-md bg-base-200 text-[10px] font-black uppercase text-base-content/60">{log.entityType}</span>
                    </div>
                    <p className="text-xs text-base-content/60 mt-1">
                      Actor: {log.actorId?.name || "System"} · {new Date(log.createdAt).toLocaleString()}
                    </p>
                    {(log.before || log.after) && (
                      <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-base-200 border border-base-300 p-3 text-[11px] text-base-content/60">
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
