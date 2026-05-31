import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register Chart.js elements
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Reusable, responsive Chart wrapper that automatically configures
 * global Chart.js settings with Outfit typography, responsive scaling, and color options.
 */
export default function DashboardChart({
  type = 'line', // 'line' or 'bar'
  labels = [],
  datasets = [],
  height = 300,
  darkTheme = false,
}) {
  
  // Set font defaults to match the Outfit font family
  const fontConfig = {
    family: "'Outfit', sans-serif",
    size: 11,
    weight: '500',
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: darkTheme ? '#94a3b8' : '#64748b',
          font: fontConfig,
          boxWidth: 12,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: darkTheme ? '#0f172a' : '#ffffff',
        titleColor: darkTheme ? '#ffffff' : '#0f172a',
        bodyColor: darkTheme ? '#cbd5e1' : '#475569',
        borderColor: darkTheme ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        titleFont: {
          family: "'Outfit', sans-serif",
          size: 12,
          weight: '700',
        },
        bodyFont: fontConfig,
        cornerRadius: 8,
        displayColors: true,
        usePointStyle: true,
      },
    },
    scales: {
      y: {
        grid: {
          color: darkTheme ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)',
        },
        ticks: {
          color: darkTheme ? '#94a3b8' : '#64748b',
          font: fontConfig,
        },
        beginAtZero: true,
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: darkTheme ? '#94a3b8' : '#64748b',
          font: fontConfig,
        },
      },
    },
  };

  const chartData = {
    labels,
    datasets: datasets.map(ds => ({
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      fill: ds.fill !== undefined ? ds.fill : true,
      ...ds
    })),
  };

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {type === 'bar' ? (
        <Bar data={chartData} options={chartOptions} />
      ) : (
        <Line data={chartData} options={chartOptions} />
      )}
    </div>
  );
}
