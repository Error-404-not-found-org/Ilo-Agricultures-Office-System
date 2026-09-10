import { useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/layout/Topbar";

export default function Settings() {
  const toast = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await axiosInstance.get("/admin/backup", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `BreedSmart_Backup_${new Date().toISOString().split("T")[0]}.json`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("System data export downloaded.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export system data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="System Settings"
        subtitle="Export BreedSmart system data for authorized administrative use"
        searchPlaceholder=""
        searchValue=""
        onSearchChange={() => {}}
      />

      <main className="p-6 max-w-3xl w-full mx-auto flex-1">
        <section className="card card-border bg-base-100">
          <div className="card-body gap-4">
            <div className="flex items-start gap-3">
              <div
                className="rounded-lg bg-primary/10 p-2.5 text-primary"
                aria-hidden="true"
              >
                <Database size={20} />
              </div>
              <div className="space-y-1">
                <h2 className="card-title text-base">System Data Export</h2>
                <p className="max-w-xl text-sm leading-6 text-base-content/65">
                  Download the existing system data export as a JSON file.
                  Handle the file securely because it contains protected
                  BreedSmart records.
                </p>
              </div>
            </div>

            <div className="card-actions justify-end border-t border-base-300 pt-4">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="btn btn-primary btn-sm"
              >
                <RefreshCw
                  size={14}
                  className={isExporting ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                {isExporting ? "Preparing export..." : "Export System Data"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
