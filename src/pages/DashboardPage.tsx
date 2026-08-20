import { useState, useEffect } from "react";
import { KPICard } from "../components/KPICard";
import { TrafficChart } from "../components/TrafficChart";
import { HeatmapChart } from "../components/HeatmapChart";
import { CameraCard } from "../components/CameraCard";
import { ConversionCard } from "../components/ConversionCard";
import { Users, ShoppingBag, Percent, Eye, Camera, Save } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

// ==========================================
// 🟢 GLOBAL DATA MANAGEMENT (TOP-LEVEL LEVEL)
// ==========================================

// 📊 BASELINE PROFILE: Represents a realistic distribution across a standard MR.DIY business day
/*
export const BUSINESS_DAY_MOCK_TRENDS = [
  { hour: 8, entries: 14, exits: 4, customers: 1 },
  { hour: 9, entries: 32, exits: 18, customers: 5 },
  { hour: 10, entries: 45, exits: 28, customers: 9 },
  { hour: 11, entries: 68, exits: 42, customers: 14 },
  { hour: 12, entries: 95, exits: 70, customers: 18 },
  { hour: 13, entries: 110, exits: 85, customers: 22 },
  { hour: 14, entries: 78, exits: 90, customers: 15 },
  { hour: 15, entries: 64, exits: 55, customers: 12 },
  { hour: 16, entries: 88, exits: 60, customers: 20 },
  { hour: 17, entries: 125, exits: 95, customers: 31 }, // Peak hours
  { hour: 18, entries: 140, exits: 110, customers: 38 }, // Peak hours
  { hour: 19, entries: 90, exits: 120, customers: 24 },
  { hour: 20, entries: 45, exits: 65, customers: 10 },
  { hour: 21, entries: 15, exits: 35, customers: 3 }
];

// 🧮 PRE-CALCULATED BASES: Aggregating totals for initial display
const INITIAL_TOTAL_ENTRIES = BUSINESS_DAY_MOCK_TRENDS.reduce((sum, item) => sum + item.entries, 0);
const INITIAL_TOTAL_EXITS = BUSINESS_DAY_MOCK_TRENDS.reduce((sum, item) => sum + item.exits, 0);
const INITIAL_TOTAL_CUSTOMERS = BUSINESS_DAY_MOCK_TRENDS.reduce((sum, item) => sum + (item.customers ?? 0), 0);
*/

// ==========================================
// 🔵 MAIN INTERFACE VIEW LAYER
// ==========================================
export default function DashboardPage() {
  const { updateData, liveTraffic } = useDashboard();

  // Track manual manager POS entries safely - starting with our mock customer count
  const [salesInput, setSalesInput] = useState("0");
  const [confirmedCustomers, setConfirmedCustomers] = useState(0);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [pendingValue, setPendingValue] = useState<number>(0);
  
  // Validation error feedback tracker
  const [validationError, setValidationError] = useState<string | null>(null);

  // Read data values cleanly without optional chaining checks
  const totalEntries = liveTraffic.summary.total_entries;
  const totalExits = liveTraffic.summary.total_exits;
  const occupancy = liveTraffic.summary.current_occupancy;

  // 🧮 TRUE RETAIL MATHEMATICS: Compute conversion accurately relative to manual POS logs
  const conversionRate = totalEntries > 0 
    ? parseFloat(((confirmedCustomers / totalEntries) * 100).toFixed(1)) 
    : 0;

  const pendingConversionRate = totalEntries > 0 
    ? parseFloat(((pendingValue / totalEntries) * 100).toFixed(1)) 
    : 0;

  // 🔄 SYNC TO GLOBAL CONTEXT Whenever totals, customers, or hourly stats change
  useEffect(() => {
    const avgSpend = 18.5; // Average transaction value baseline
    const totalSales = confirmedCustomers * avgSpend;

    const hourlyConversion = liveTraffic.hourly_trends.map((item) => {
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
      customersToday: confirmedCustomers,
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
        { time: "Sun", visitors: totalEntries, customers: confirmedCustomers, sales: totalSales }
      ]
    });
  }, [totalEntries, confirmedCustomers, conversionRate, liveTraffic.hourly_trends, updateData]);

  // Transform baseline hourly arrays cleanly for the Entry/Exit chart
  const dynamicEntryExitData = liveTraffic.hourly_trends.map((item) => ({
    time: `${item.hour.toString().padStart(2, "0")}:00`,
    entry: item.entries,
    exit: item.exits,
  }));

  // OPTION 2 CALCULATION: Compute dynamic in-store occupancy trend line based on camera traffic flow
  let cumulativeOccupancy = 0;
  const dynamicHourlyData = liveTraffic.hourly_trends.map((item) => {
    cumulativeOccupancy += (item.entries - item.exits);
    const currentHourOccupancy = Math.max(0, cumulativeOccupancy);

    return {
      time: `${item.hour.toString().padStart(2, "0")}:00`,
      visitors: item.entries,          // Blue Line: Hourly incoming foot traffic
      occupancy: currentHourOccupancy  // Green Line: Total active souls inside the store
    };
  });

  // ⚡ DYNAMIC HEATMAP GENERATION: Build dynamic matrix based on store operating hours
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayName = daysOfWeek[new Date().getDay()];

  // Only generate blocks for operating hours: 08:00 to 22:00 (7 blocks of 2 hours)
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

  const sourceTrends = isToday
    ? liveTraffic.hourly_trends
    : [];

  return {
    day: day.name,
    hours: heatmapHours.map((hour) => {
      const firstHourEntries =
        sourceTrends.find((item) => item.hour === hour)?.entries ?? 0;

      const secondHourEntries =
        sourceTrends.find((item) => item.hour === hour + 1)?.entries ?? 0;

      const combinedTotal = firstHourEntries + secondHourEntries;

      return {
        hour: `${hour.toString().padStart(2, "0")}:00`,
        value: combinedTotal,
      };
    }),
  };
});

  // FIXED STABLE HISTORICAL CONVERSION: Past days are locked down completely, today calculates dynamically
  const conversionTrendData = [
    { time: "Mon", rate: 14.5 },
    { time: "Tue", rate: 16.2 },
    { time: "Wed", rate: 15.0 },
    { time: "Thu", rate: 13.8 },
    { time: "Fri", rate: 18.1 },
    { time: "Sat", rate: 19.5 },
    { time: "Sun", rate: conversionRate }, 
  ];

  const cameras = [
    { name: "Front Entrance", location: "Main Floor", liveCount: occupancy, entryCount: totalEntries, exitCount: totalExits, isOnline: true },
    { name: "Back Entrance", location: "Main Floor", liveCount: 0, entryCount: 0, exitCount: 0, isOnline: true },
    { name: "West Wing", location: "2nd Floor", liveCount: 0, entryCount: 0, exitCount: 0, isOnline: true },
    { name: "East Wing", location: "2nd Floor", liveCount: 0, entryCount: 0, exitCount: 0, isOnline: false },
  ];

  const handleTriggerVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const valueParsed = parseInt(salesInput, 10);
    if (isNaN(valueParsed) || valueParsed < 0) {
      setValidationError("Please enter a valid, positive sales count.");
      return;
    }

    if (valueParsed > totalEntries) {
      setValidationError(`Input rejected. Maximum value allowed is ${totalEntries}.`);
      return;
    }

    setPendingValue(valueParsed);
    setIsConfirming(true);
  };

  const handleCommitFinalData = () => {
    setConfirmedCustomers(pendingValue);
    setIsConfirming(false);
  };

  return (
    <div className="space-y-6 relative">
      
      {/* ⚠️ SAFETY DOUBLE-CHECK POPUP MODAL OVERLAY */}
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
                <span>Target Sales Figures:</span>
                <span className="text-emerald-400 font-bold">{pendingValue} Transactions</span>
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

      {/* Upper Control Bar Layout Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Real-time analytics powered by YOLOv8 computer vision</p>
        </div>

        {/* 📑 CONTROL INTERFACE FORM */}
        <div className="flex flex-col items-end gap-1.5 self-start md:self-auto">
          <form onSubmit={handleTriggerVerification} className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-700 w-full justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              POS Sales Entries:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={totalEntries}
                value={salesInput}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  if (inputValue === "") {
                    setSalesInput("");
                    return;
                  }
                  
                  const parsedInt = parseInt(inputValue, 10);
                  if (!isNaN(parsedInt)) {
                    const cappedValue = Math.min(parsedInt, totalEntries);
                    setSalesInput(cappedValue.toString());
                    
                    if (parsedInt > totalEntries) {
                      setValidationError(`Capped at total visitors (${totalEntries})`);
                    } else {
                      setValidationError(null);
                    }
                  }
                }}
                className="w-20 bg-slate-900 text-white font-bold border border-slate-700 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3 py-1.5 rounded transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Sync
              </button>
            </div>
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
          title="Total Customers"
          value={confirmedCustomers.toLocaleString()}
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
          value={`3/4`}
          icon={Camera}
          status="success"
        />
      </div>

      {/* Conversion Overview */}
      <ConversionCard
        visitors={totalEntries}
        customers={confirmedCustomers}
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
        {/* Heatmap uses dynamic data variables calculated inside the render */}
        <HeatmapChart title="Peak Traffic Heatmap" data={dynamicHeatmapData} />
      </div>

      {/* Camera Monitoring */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Camera Monitoring</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cameras.map((camera) => (
            <CameraCard key={camera.name} {...camera} />
          ))}
        </div>
      </div>
    </div>
  );
}