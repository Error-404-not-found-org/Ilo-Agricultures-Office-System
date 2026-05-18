import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Download, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Activity, 
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import axiosInstance from "../lib/axios";
import LoadingView from "../components/LoadingView";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

// Note: These would need to be installed: npm install jspdf jspdf-autotable xlsx
// Fail-safe globals from index.html CDN
const { jsPDF } = window.jspdf || {};
const XLSX = window.XLSX;

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports", dateRange],
    queryFn: async () => {
      const res = await axiosInstance.get(`/admin/reports-data?start=${dateRange.start}&end=${dateRange.end}`);
      return res.data;
    }
  });

  if (isLoading) return <LoadingView message="Aggregating Oton Census Data..." />;

  const COLORS = ["#059669", "#0284c7", "#7c3aed", "#ea580c", "#dc2626"];

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Municipality of Oton - Livestock Growth Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 35);

    // Summary Table
    const summaryData = [
      ["Total Cattle Registered", data.summary.totalAnimals],
      ["New Registrations (Period)", data.summary.newAnimals],
      ["AI Procedures Performed", data.summary.totalAI],
      ["Confirmed Pregnancies", data.summary.totalPregnancies],
      ["AI Success Rate", data.summary.successRate],
      ["Health Cases Resolved", data.summary.resolvedHealth]
    ];

    doc.autoTable({
      startY: 45,
      head: [["Metric", "Value"]],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillStyle: '#059669' }
    });

    // Barangay Breakdown
    const brgyData = data.barangayStats.map(b => [b.name, b.animals, b.ai, b.health]);
    doc.text("Barangay Activity Breakdown", 14, doc.lastAutoTable.finalY + 15);
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 20,
      head: [["Barangay", "Cattle", "AI Sessions", "Health Cases"]],
      body: brgyData,
      theme: 'grid'
    });

    doc.save(`Oton_Livestock_Report_${dateRange.start}_${dateRange.end}.pdf`);
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.barangayStats);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barangay Stats");
    XLSX.writeFile(wb, `Oton_Livestock_Data_${dateRange.start}_${dateRange.end}.xlsx`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-base-content tracking-tight uppercase">
            Municipal <span className="text-emerald-600">Census Hub</span>
          </h1>
          <p className="text-base-content/40 font-bold text-[10px] uppercase tracking-widest mt-1">Official reporting and analytics for the Municipality of Oton.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-base-100 h-10 px-4 rounded-none border border-base-300 shadow-sm">
            <Calendar size={14} className="text-base-content/40" />
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className="text-[10px] font-bold bg-transparent border-none focus:ring-0 text-base-content uppercase tracking-widest outline-none"
            />
            <span className="text-base-content/30 mx-1 text-[10px] font-black uppercase">to</span>
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className="text-[10px] font-bold bg-transparent border-none focus:ring-0 text-base-content uppercase tracking-widest outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={exportPDF}
              className="h-10 px-6 rounded-none bg-base-content text-base-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-sm"
            >
              <FileText size={14} /> Export PDF
            </button>
            <button 
              onClick={exportExcel}
              className="h-10 px-6 rounded-none bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#074033] transition-all shadow-sm"
            >
              <Download size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          title="Census Growth" 
          value={data.summary.newAnimals} 
          subtitle="New Registrations"
          icon={<TrendingUp size={20} className="text-emerald-500" />}
          trend="+12% from last month"
        />
        <SummaryCard 
          title="Breeding Efficiency" 
          value={data.summary.successRate} 
          subtitle="AI Conception Rate"
          icon={<Activity size={20} className="text-blue-500" />}
          trend="Optimized"
        />
        <SummaryCard 
          title="Public Health" 
          value={data.summary.resolvedHealth} 
          subtitle="Cases Resolved"
          icon={<CheckCircle2 size={20} className="text-purple-500" />}
          trend="Status: Healthy"
        />
        <SummaryCard 
          title="Total Herd" 
          value={data.summary.totalAnimals} 
          subtitle="Registered Livestock"
          icon={<FileText size={20} className="text-slate-500" />}
          trend="Municipality-wide"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Breeding Stats Chart */}
        <div className="lg:col-span-2 bg-base-100 rounded-none border border-base-300 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-base-content tracking-tight uppercase">Barangay Activity</h3>
            <div className="p-2 bg-base-200 border border-base-300 rounded-none">
              <BarChart3 size={16} className="text-base-content/40" />
            </div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.barangayStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-base-300/50" />
                <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 700 }}
                    className="text-base-content/40 uppercase tracking-widest"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12, fontWeight: 700 }} className="text-base-content/40" />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '0', 
                    border: '1px solid var(--color-base-300)', 
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    backgroundColor: 'var(--color-base-100)',
                  }}
                  itemStyle={{ color: 'var(--color-base-content)', fontSize: '12px', fontWeight: 900 }}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }} />
                <Bar dataKey="animals" name="Assets" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="ai" name="AI Sessions" fill="#0284c7" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Species Distribution */}
        <div className="bg-base-100 rounded-none border border-base-300 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-base-content tracking-tight uppercase">Status Mix</h3>
            <div className="p-2 bg-base-200 border border-base-300 rounded-none">
              <PieChartIcon size={16} className="text-base-content/40" />
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.reproductiveStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.reproductiveStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '0', 
                    border: '1px solid var(--color-base-300)', 
                    backgroundColor: 'var(--color-base-100)'
                  }} 
                  itemStyle={{ color: 'var(--color-base-content)', fontWeight: 900, fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {data.reproductiveStats.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between border-b border-base-200/50 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-none" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-[10px] font-black text-base-content/60 uppercase tracking-widest">{item.name}</span>
                </div>
                <span className="text-xs font-black text-base-content">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, subtitle, icon, trend }) => (
  <div className="bg-base-100 rounded-none border border-base-300 p-6 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-base-200 border border-base-300 rounded-none">
        {icon}
      </div>
      <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-none">
        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">{trend}</span>
      </div>
    </div>
    <div>
      <p className="text-[10px] font-black text-base-content/40 uppercase tracking-[0.2em]">{title}</p>
      <h2 className="text-4xl font-black text-base-content mt-1 tracking-tighter uppercase">{value}</h2>
      <p className="text-[10px] font-bold text-base-content/60 mt-1 uppercase tracking-widest">{subtitle}</p>
    </div>
  </div>
);

const BarChart3 = ({ size, className }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

export default Reports;
