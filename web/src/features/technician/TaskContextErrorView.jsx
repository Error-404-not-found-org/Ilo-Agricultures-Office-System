import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function TaskContextErrorView({
  errorType = "missing_info",
  returnTo = "/technician/work-queue",
  title: customTitle = "",
  message: customMessage = ""
}) {
  const isUnavailable = errorType === "unavailable";
  const title = customTitle || (isUnavailable ? "Task target unavailable" : "Missing task information");
  const message = customMessage || (isUnavailable
    ? "The requested service workflow could not be opened."
    : "This task does not contain enough information to open the service form.");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center bg-base-200 text-base-content" role="alert" aria-live="assertive">
      <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-5 shadow-xs">
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      
      <h1 className="text-lg font-black uppercase tracking-tight mb-2">
        {title}
      </h1>
      
      <p className="text-sm text-base-content/65 max-w-sm mb-8 leading-relaxed font-medium">
        {message}
      </p>
      
      <Link
        to={returnTo}
        className="btn btn-primary min-h-11 px-6 font-black text-xs uppercase tracking-widest flex items-center gap-2 rounded-xl transition-all shadow-md cursor-pointer"
        aria-label="Return to work queue"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        <span>Return to Work Queue</span>
      </Link>
    </div>
  );
}
