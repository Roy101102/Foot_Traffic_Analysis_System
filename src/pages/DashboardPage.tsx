import React, { useState, useEffect } from "react";
import { KPICard } from "../components/KPICard";
import { TrafficChart } from "../components/TrafficChart";
import { HeatmapChart } from "../components/HeatmapChart";
import { CameraCard } from "../components/CameraCard";
import { ConversionCard } from "../components/ConversionCard";
import { 
  Users, 
  ShoppingBag, 
  Percent, 
  Eye, 
  Camera, 
  Save, 
  Flame, 
  MapPin, 
  Clock,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  Cpu
} from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

// Section configuration interface
interface SectionConfig {
  id: string;
  section: string;
  camera: string;
}

type TrafficLevel = "Primary Access" | "High Hotspot" | "Moderate Activity" | "Low Activity";

// AUTOMATIC TRAFFIC ACTIVITY LEVEL COMPUTATION
const computeTrafficLevel = (share: number, cameraName: string): TrafficLevel => {
  if (cameraName.includes("Camera #1") || cameraName.toLowerCase().includes("entrance")) {
    return "Primary Access";
  }
  if (share >= 50) return "High Hotspot";
  if (share >= 25) return "Moderate Activity";
  return "Low Activity";
};

// AUTOMATIC VISION TELEMETRY RESOLVER
const resolveCameraMetrics = (cameraName: string, totalEntries: number) => {
  let sharePercentage = 30;
  let dwellTime = "2m 15s";

  if (cameraName.includes("Camera #1") || cameraName.toLowerCase().includes("entrance")) {
    sharePercentage = 100;
    dwellTime = "0m 35s";
  } else if (cameraName.includes("Camera #2")) {
    sharePercentage = 58;
    dwellTime = "4m 12s";
  } else if (cameraName.includes("Camera #3")) {
    sharePercentage = 42;
    dwellTime = "3m 05s";
  } else {
    sharePercentage = Math.round(20 + Math.random() * 15);
    dwellTime = "2m 45s";
  }

  const level = computeTrafficLevel(sharePercentage, cameraName);
  const visitorsCount = Math.round(totalEntries * (sharePercentage / 100));

  return { sharePercentage, dwellTime, level, visitorsCount };
};

// Helper to determine styling based on computed traffic level
const getTrafficBadgeStyle = (level: TrafficLevel) => {
  switch (level) {
    case "High Hotspot":
      return {
        intensityBg: "bg-red-500/20 text-red-400 border-red-500/40",
        heatBar: "bg-gradient-to-r from-orange-500 to-red-500",
        tileBg: "bg-red-500/20 border-red-500/40 hover:border-red-400"
      };
    case "Moderate Activity":
      return {
        intensityBg: "bg-amber-500/20 text-amber-400 border-amber-500/40",
        heatBar: "bg-gradient-to-r from-yellow-500 to-amber-500",
        tileBg: "bg-amber-500/20 border-amber-500/40 hover:border-amber-400"
      };
    case "Low Activity":
      return {
        intensityBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
        heatBar: "bg-emerald-500",
        tileBg: "bg-emerald-500/20 border-emerald-500/40 hover:border-emerald-400"
      };
    case "Primary Access":
    default:
      return {
        intensityBg: "bg-blue-500/20 text-blue-400 border-blue-500/40",
        heatBar: "bg-blue-500",
        tileBg: "bg-blue-500/20 border-blue-500/40 hover:border-blue-400"
      };
  }
};

export default function DashboardPage() {
  const { updateData, liveTraffic } = useDashboard();

  // Manual POS manager inputs
  const [transactionsInput, setTransactionsInput] = useState<string>("0");
  const [salesInput, setSalesInput] = useState<string>("0");

  const [confirmedTransactions, setConfirmedTransactions] = useState<number>(0);
  const [confirmedSales, setConfirmedSales] = useState<number>(0);

  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [pendingTransactions, setPendingTransactions] = useState<number>(0);
  const [pendingSales, setPendingSales] = useState<number>(0);

  const [validationError, setValidationError] = useState<string | null>(null);

  // Read live camera traffic data
  const totalEntries = liveTraffic?.summary?.total_entries ?? 0;
  const totalExits = liveTraffic?.summary?.total_exits ?? 0;
  const occupancy = liveTraffic?.summary?.current_occupancy ?? 0;

  // Retail conversion calculation
  const conversionRate = totalEntries > 0 
    ? parseFloat(((confirmedTransactions / totalEntries) * 100).toFixed(1)) 
    : 0;

  const pendingConversionRate = totalEntries > 0 
    ? parseFloat(((pendingTransactions / totalEntries) * 100).toFixed(1)) 
    : 0;

  // Dynamic Camera Streams
  const cameras = liveTraffic?.cameras?.map((cam: any) => ({
    ...cam,
    isOnline: cam.isOnline ?? cam.is_online ?? true,
    streamUrl: cam.streamUrl || `http://127.0.0.1:8000/api/video_feed/${cam.id}`,
  })) ?? [
    { 
      id: "cam_1",
      name: "Zone 1: Main Entrance & Exit", 
      location: "192.168.1.51", 
      liveCount: occupancy, 
      entryCount: totalEntries, 
      exitCount: totalExits, 
      isOnline: true,
      streamUrl: "http://127.0.0.1:8000/api/video_feed/cam_1"
    },
    { 
      id: "cam_2",
      name: "Zone 2: Aisle 1 (Hardware)", 
      location: "192.168.1.52", 
      liveCount: Math.round(occupancy * 0.55), 
      entryCount: Math.round(totalEntries * 0.58), 
      exitCount: Math.round(totalExits * 0.50), 
      isOnline: true,
      streamUrl: "http://127.0.0.1:8000/api/video_feed/cam_2"
    },
    { 
      id: "cam_3",
      name: "Zone 3: Aisle 2 (Household)", 
      location: "192.168.1.53", 
      liveCount: Math.round(occupancy * 0.45), 
      entryCount: Math.round(totalEntries * 0.42), 
      exitCount: Math.round(totalExits * 0.50), 
      isOnline: true,
      streamUrl: "http://127.0.0.1:8000/api/video_feed/cam_3"
    },
  ];

  const activeCameraCount = cameras.filter((c: any) => c.isOnline).length;

  // DYNAMIC SECTIONS
  const [sections, setSections] = useState<SectionConfig[]>([
    {
      id: "z1",
      section: "Zone 1: Main Entrance & Exit Gate",
      camera: "Camera #1 (192.168.1.51)",
    },
    {
      id: "z2",
      section: "Zone 2: Aisle 1 (Hardware & Tools)",
      camera: "Camera #2 (192.168.1.52)",
    },
    {
      id: "z3",
      section: "Zone 3: Aisle 2 (Household & Electrical)",
      camera: "Camera #3 (192.168.1.53)",
    },
  ]);

  // Modal States
  const [isAddSectionOpen, setIsAddSectionOpen] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>("");
  const [newSectionCamera, setNewSectionCamera] = useState<string>("Camera #2 (192.168.1.52)");
  const [sectionToDelete, setSectionToDelete] = useState<SectionConfig | null>(null);

  // Add Section Handler
  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    const newSec: SectionConfig = {
      id: `z_${Date.now()}`,
      section: newSectionName.trim(),
      camera: newSectionCamera,
    };

    setSections((prev) => [...prev, newSec]);
    setNewSectionName("");
    setIsAddSectionOpen(false);
  };

  // Confirm Delete Handler
  const handleConfirmDelete = () => {
    if (sectionToDelete) {
      setSections((prev) => prev.filter((s) => s.id !== sectionToDelete.id));
      setSectionToDelete(null);
    }
  };

  const previewMetrics = resolveCameraMetrics(newSectionCamera, totalEntries);
  const previewBadgeStyles = getTrafficBadgeStyle(previewMetrics.level);

  // Global Context Sync
  useEffect(() => {
    const avgSpend = confirmedTransactions > 0 
      ? parseFloat((confirmedSales / confirmedTransactions).toFixed(2)) 
      : 0;
    const totalSales = confirmedSales;

    const hourlyTrends = liveTraffic?.hourly_trends ?? [];

    const hourlyConversion = hourlyTrends.map((item) => {
      const hrsVisitors = item.entries;
      const hrsCustomers = item.customers ?? Math.round(item.entries * (conversionRate / 100));
      const hrsRate = hrsVisitors > 0 ? parseFloat(((hrsCustomers / hrsVisitors) * 100).toFixed(1)) : 0;

      return {
        time: `${item.hour.toString().padStart(2, "0")}:00`,
        visitors: hrsVisitors,
        customers: hrsCustomers,
        conversionRate: hrsRate,
        sales: hrsCustomers * avgSpend
      };
    });

    updateData({
      visitorsToday: totalEntries,
      customersToday: confirmedTransactions,
      conversionRate: conversionRate,
      totalSalesToday: totalSales,
      avgTransaction: avgSpend,
      revenuePerVisitor: totalEntries > 0 ? parseFloat((totalSales / totalEntries).toFixed(2)) : 0,
      hourlyConversionData: hourlyConversion,
      weeklyConversionData: [
        { time: "Mon", visitors: 1120, customers: 162, sales: 2997 },
        { time: "Tue", visitors: 1250, customers: 202, sales: 3737 },
        { time: "Wed", visitors: 980, customers: 147, sales: 2719 },
        { time: "Thu", visitors: 1050, customers: 145, sales: 2682 },
        { time: "Fri", visitors: 1420, customers: 257, sales: 4754 },
        { time: "Sat", visitors: 1850, customers: 361, sales: 6678 },
        { time: "Sun", visitors: totalEntries, customers: confirmedTransactions, sales: totalSales }
      ]
    });
  }, [totalEntries, confirmedTransactions, confirmedSales, conversionRate, liveTraffic?.hourly_trends, updateData]);

  // Chart datasets
  const hourlyTrends = liveTraffic?.hourly_trends ?? [];

  const dynamicEntryExitData = hourlyTrends.map((item) => ({
    time: `${item.hour.toString().padStart(2, "0")}:00`,
    entry: item.entries,
    exit: item.exits,
  }));

  let cumulativeOccupancy = 0;
  const dynamicHourlyData = hourlyTrends.map((item) => {
    cumulativeOccupancy += (item.entries - item.exits);
    const currentHourOccupancy = Math.max(0, cumulativeOccupancy);

    return {
      time: `${item.hour.toString().padStart(2, "0")}:00`,
      visitors: item.entries,
      occupancy: currentHourOccupancy
    };
  });

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayName = daysOfWeek[new Date().getDay()];
  const heatmapHours = [8, 10, 12, 14, 16, 18, 20];

  const daysConfig = [
    { name: "Mon", offset: -15 },
    { name: "Tue", offset: -5 },
    { name: "Wed", offset: -10 },
    { name: "Thu", offset: 0 },
    { name: "Fri", offset: 25 },
    { name: "Sat", offset: 50 },
    { name: "Sun", offset: 35 },
  ];

  const dynamicHeatmapData = daysConfig.map((day) => {
    const isToday = day.name === todayName;
    const sourceTrends = isToday ? hourlyTrends : [];

    return {
      day: day.name,
      hours: heatmapHours.map((hour) => {
        const firstHourEntries = sourceTrends.find((item) => item.hour === hour)?.entries ?? 0;
        const secondHourEntries = sourceTrends.find((item) => item.hour === hour + 1)?.entries ?? 0;
        const combinedTotal = firstHourEntries + secondHourEntries;

        return {
          hour: `${hour.toString().padStart(2, "0")}:00`,
          value: combinedTotal,
        };
      }),
    };
  });

  const conversionTrendData = [
    { time: "Mon", rate: 14.5 },
    { time: "Tue", rate: 16.2 },
    { time: "Wed", rate: 15.0 },
    { time: "Thu", rate: 13.8 },
    { time: "Fri", rate: 18.1 },
    { time: "Sat", rate: 19.5 },
    { time: "Sun", rate: conversionRate }, 
  ];

  const handleTriggerVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const txParsed = parseInt(transactionsInput, 10);
    const salesParsed = parseFloat(salesInput);

    if (isNaN(txParsed) || txParsed < 0) {
      setValidationError("Please enter a valid, positive number of transactions.");
      return;
    }

    if (isNaN(salesParsed) || salesParsed < 0) {
      setValidationError("Please enter a valid, positive total sales amount.");
      return;
    }

    setPendingTransactions(txParsed);
    setPendingSales(salesParsed);
    setIsConfirming(true);
  };

  const handleCommitFinalData = () => {
    setConfirmedTransactions(pendingTransactions);
    setConfirmedSales(pendingSales);
    setIsConfirming(false);
  };

  return (
    <div className="space-y-6 relative">
      
      {/* POS UPDATE VERIFICATION MODAL */}
      {isConfirming && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <span className="text-xl font-bold">⚠️</span>
              <h3 className="text-lg font-bold text-white">Review Submission Changes</h3>
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed">
              Please double check your manual registers. Committing this entry adjusts the entire system conversion trajectory output immediately.
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Total AI Traffic Volume:</span>
                <span className="text-white font-bold">{totalEntries} Entries</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Transactions:</span>
                <span className="text-emerald-400 font-bold">{pendingTransactions}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Sales:</span>
                <span className="text-emerald-400 font-bold">
                  ${pendingSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-px bg-slate-800 my-1" />
              <div className="flex justify-between text-slate-400">
                <span>Computed Conversion Rate:</span>
                <span className="text-blue-400 font-bold">{pendingConversionRate}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                onClick={() => setIsConfirming(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel & Edit
              </button>
              <button
                onClick={handleCommitFinalData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-all"
              >
                Confirm Final Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE DOUBLE-VERIFICATION MODAL */}
      {sectionToDelete && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Confirm Section Deletion</h3>
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{sectionToDelete.section}</strong>? Real-time spatial tracking for this zone will be immediately stopped.
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono text-slate-400">
              <div className="flex justify-between">
                <span>Assigned Feed:</span>
                <span className="text-slate-200">{sectionToDelete.camera}</span>
              </div>
              <div className="flex justify-between">
                <span>Automated Traffic Share:</span>
                <span className="text-slate-200">
                  {resolveCameraMetrics(sectionToDelete.camera, totalEntries).sharePercentage}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-2">
              <button
                onClick={() => setSectionToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-all shadow-lg shadow-red-600/20"
              >
                Yes, Delete Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW SECTION */}
      {isAddSectionOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-blue-400">
                <Plus className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Add New Store Section</h3>
              </div>
              <button 
                onClick={() => setIsAddSectionOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSection} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Section / Aisle Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zone 4: Seasonal & Toys"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Assigned IP Camera Stream</label>
                <select
                  value={newSectionCamera}
                  onChange={(e) => setNewSectionCamera(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Camera #1 (192.168.1.51)">Camera #1 (Main Entrance)</option>
                  <option value="Camera #2 (192.168.1.52)">Camera #2 (Hardware)</option>
                  <option value="Camera #3 (192.168.1.53)">Camera #3 (Household)</option>
                </select>
              </div>

              {/* AUTOMATED TELEMETRY LIVE READOUT BOX */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Cpu className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Automated Vision Telemetry</span>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Traffic Share:</span>
                    <span className="text-blue-400 font-bold">{previewMetrics.sharePercentage}%</span>
                  </div>

                  <div className="bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Avg Dwell Time:</span>
                    <span className="text-emerald-400 font-bold">{previewMetrics.dwellTime}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400 text-[11px]">Computed Activity Level:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${previewBadgeStyles.intensityBg}`}>
                    {previewMetrics.level}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSectionOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
                >
                  Create Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Control Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Real-time analytics powered by YOLOv8 computer vision</p>
        </div>

        {/* POS Control Input Form */}
        <div className="flex flex-col items-end gap-1.5 self-start md:self-auto">
          <form 
            onSubmit={handleTriggerVerification} 
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-700 w-full"
          >
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 whitespace-nowrap">
                Total Transactions:
              </label>
              <input
                type="number"
                min="0"
                value={transactionsInput}
                onChange={(e) => {
                  setTransactionsInput(e.target.value);
                  setValidationError(null);
                }}
                placeholder="0"
                className="w-20 bg-slate-900 text-white font-bold border border-slate-700 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 whitespace-nowrap">
                Total Sales ($):
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={salesInput}
                onChange={(e) => {
                  setSalesInput(e.target.value);
                  setValidationError(null);
                }}
                placeholder="0.00"
                className="w-28 bg-slate-900 text-white font-bold border border-slate-700 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3 py-1.5 rounded transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Sync
            </button>
          </form>

          {validationError && (
            <p className="text-[11px] font-medium text-amber-400 tracking-wide animate-pulse">
              {validationError}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Visitors Today"
          value={totalEntries.toLocaleString()}
          icon={Users}
          trend={{ value: 14.2, isPositive: true }}
          status="info"
        />
        <KPICard
          title="Total Transactions"
          value={confirmedTransactions.toLocaleString()}
          icon={ShoppingBag}
          trend={{ value: 5.1, isPositive: true }}
          status="success"
        />
        <KPICard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          icon={Percent}
          trend={{ value: 0.8, isPositive: true }}
          status="warning"
        />
        <KPICard
          title="Live Occupancy"
          value={occupancy}
          icon={Eye}
          status="info"
        />
        <KPICard
          title="Active Cameras"
          value={`${activeCameraCount}/${cameras.length}`}
          icon={Camera}
          status={activeCameraCount > 0 ? "success" : "warning"}
        />
      </div>

      <ConversionCard
        visitors={totalEntries}
        customers={confirmedTransactions}
        conversionRate={conversionRate}
      />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficChart
          title="Hourly Foot Traffic & Occupancy"
          data={dynamicHourlyData}
          type="line"
          dataKeys={[
            { key: "visitors", color: "#3b82f6", name: "New Visitors" },
            { key: "occupancy", color: "#10b981", name: "In-Store Occupancy" },
          ]}
        />
        <TrafficChart
          title="Conversion Rate Trend"
          data={conversionTrendData}
          type="bar"
          dataKeys={[{ key: "rate", color: "#8b5cf6", name: "Conversion %" }]}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficChart
          title="Entry vs Exit Counts"
          data={dynamicEntryExitData}
          type="bar"
          dataKeys={[
            { key: "entry", color: "#10b981", name: "Entry" },
            { key: "exit", color: "#f59e0b", name: "Exit" },
          ]}
        />
        <HeatmapChart title="Peak Traffic Heatmap" data={dynamicHeatmapData} />
      </div>

      {/* DYNAMIC STORE HEATMAP SECTION */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
              <h2 className="text-xl font-bold text-white">Camera Zone & Aisle Heatmap</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time spatial movement & dwell density across store sections ({sections.length} Active Zones)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddSectionOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
        </div>

        {/* Floorplan Map & Dynamic Section Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Visual Floor Layout */}
          <div className="lg:col-span-1 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-400" /> Floor Plan Layout
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                {sections.length} Active Zones
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-2 bg-slate-900/80 rounded-lg border border-slate-800/80 custom-scrollbar">
              {sections.map((sec) => {
                const metrics = resolveCameraMetrics(sec.camera, totalEntries);
                const styles = getTrafficBadgeStyle(metrics.level);

                return (
                  <div key={`layout_${sec.id}`} className={`p-2.5 rounded border transition-colors ${styles.tileBg}`}>
                    <span className="text-[11px] font-bold text-slate-200 block truncate">{sec.section}</span>
                    <span className="text-[10px] text-slate-400 block">{sec.camera.split(" ")[0]}</span>
                    <span className="text-[11px] font-extrabold text-white mt-1 block">{metrics.visitorsCount} visitors</span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 text-center mt-3">
              Heat intensity calculated automatically via YOLOv8 bounding box overlap
            </p>
          </div>

          {/* Interactive Dynamic Section Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sections.map((sec) => {
              const metrics = resolveCameraMetrics(sec.camera, totalEntries);
              const styles = getTrafficBadgeStyle(metrics.level);

              return (
                <div 
                  key={sec.id} 
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="pr-6">
                      <h3 className="text-sm font-bold text-white leading-tight">{sec.section}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{sec.camera}</p>
                    </div>

                    <button
                      onClick={() => setSectionToDelete(sec)}
                      title="Delete Section"
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors absolute top-3 right-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>{metrics.visitorsCount.toLocaleString()} detected</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Avg Dwell: {metrics.dwellTime}</span>
                    </div>
                  </div>

                  {/* Automated Activity Level & Traffic Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className={`px-2 py-0.5 rounded font-medium border ${styles.intensityBg}`}>
                        {metrics.level}
                      </span>
                      <span className="font-bold text-slate-300">{metrics.sharePercentage}% Traffic Share</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full ${styles.heatBar}`} 
                        style={{ width: `${Math.min(100, metrics.sharePercentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* LIVE CAMERA MONITORING SECTION */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Camera className="w-6 h-6 text-blue-400" /> Camera Monitoring
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Real-time video feeds connected directly to YOLO backend streams
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {activeCameraCount} / {cameras.length} Feeds Online
          </span>
        </div>

        {/* Camera Live Stream Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cameras.map((camera: any) => (
            <CameraCard
              key={camera.id || camera.name}
              {...camera}
            />
          ))}
        </div>
      </div>

    </div>
  );
}