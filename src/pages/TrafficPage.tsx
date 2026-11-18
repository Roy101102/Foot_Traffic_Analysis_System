import { TrafficChart } from "../components/TrafficChart";
import { HeatmapChart } from "../components/HeatmapChart";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Calendar } from "../components/ui/calendar";
import { Button } from "../components/ui/button";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Clock,
  Calendar as CalendarIcon,
  X,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useDashboard } from "../context/DashboardContext";

interface DailyExportRow {
  isoDate: string;
  displayDate: string;
  dayName: string;
  visitors: number;
  entries: number;
  exits: number;
  customers: number;
  conversionRate: number;
  peakHourCount: number;
  avgDwellTime: number;
}

// Local-timezone-safe helpers to avoid UTC off-by-one shifts
const toLocalISODate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalISODate = (iso: string): Date | undefined => {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const startOfLocalDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function TrafficPage() {
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const [date, setDate] = useState<Date | undefined>(today);

  // Track currently active tab: 'daily' | 'weekly' | 'monthly'
  const [activeTab, setActiveTab] = useState<string>("daily");

  // Date-range export state (defaults to Last 7 Days up to today)
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportFromDate, setExportFromDate] = useState<Date | undefined>(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return start;
  });
  const [exportToDate, setExportToDate] = useState<Date | undefined>(today);
  const [includeHourlyDetails, setIncludeHourlyDetails] = useState<boolean>(true);

  // Read directly from shared context
  const { data } = useDashboard();

  // Helper to format date with a 3-letter month (e.g., "Nov 18, 2026")
  const formatShortDate = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Map shared context data to TrafficPage format
  const hourlyData = data.hourlyConversionData.map((item) => ({
    time: item.time,
    visitors: item.visitors,
    avgDwellTime: Math.max(5, Math.floor(item.visitors * 0.15)),
  }));

  const weeklyData = data.weeklyConversionData.map((item) => ({
    time: item.time,
    visitors: item.visitors,
    peakHour: Math.floor(item.visitors * 0.2),
  }));

  const heatmapData = [
    { day: "Mon", hours: Array.from({ length: 7 }, (_, i) => ({ hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`, value: 35 })) },
    { day: "Tue", hours: Array.from({ length: 7 }, (_, i) => ({ hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`, value: 45 })) },
    { day: "Wed", hours: Array.from({ length: 7 }, (_, i) => ({ hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`, value: 40 })) },
    { day: "Thu", hours: Array.from({ length: 7 }, (_, i) => ({ hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`, value: 50 })) },
    { day: "Fri", hours: Array.from({ length: 7 }, (_, i) => ({ hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`, value: 75 })) },
    { day: "Sat", hours: Array.from({ length: 7 }, (_, i) => ({ hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`, value: 90 })) },
    {
      day: "Sun",
      hours: Array.from({ length: 7 }, (_, i) => ({
        hour: `${(i * 2 + 8).toString().padStart(2, "0")}:00`,
        value: Math.round(data.visitorsToday / 7),
      })),
    },
  ];

  const entryExitData = data.hourlyConversionData.map((item) => ({
    time: item.time,
    entry: item.visitors,
    exit: Math.max(0, Math.round(item.visitors * 0.85)),
  }));

  const monthlyData = [
    { time: "Day 1", visitors: 1100 },
    { time: "Day 5", visitors: 1450 },
    { time: "Day 10", visitors: 1200 },
    { time: "Day 15", visitors: 1600 },
    { time: "Day 20", visitors: 1350 },
    { time: "Today", visitors: data.visitorsToday },
  ];

  // Apply quick range presets
  const applyPresetRange = (preset: "today" | "7d" | "14d" | "30d" | "month") => {
    const end = startOfLocalDay(new Date());
    const start = new Date(end);

    if (preset === "7d") start.setDate(end.getDate() - 6);
    if (preset === "14d") start.setDate(end.getDate() - 13);
    if (preset === "30d") start.setDate(end.getDate() - 29);
    if (preset === "month") start.setDate(1);

    setExportFromDate(start);
    setExportToDate(end);
  };

  // Handle manual "From" input change
  const handleFromInputChange = (value: string) => {
    const parsed = parseLocalISODate(value);
    if (!parsed) return;
    setExportFromDate(parsed);
    if (exportToDate && parsed > exportToDate) {
      setExportToDate(parsed);
    }
  };

  // Handle manual "To" input change
  const handleToInputChange = (value: string) => {
    const parsed = parseLocalISODate(value);
    if (!parsed) return;
    setExportToDate(parsed);
    if (exportFromDate && parsed < exportFromDate) {
      setExportFromDate(parsed);
    }
  };

  // Build day-by-day dataset across the chosen [exportFromDate, exportToDate] range
  const rangeExportRows = useMemo<DailyExportRow[]>(() => {
    if (!exportFromDate || !exportToDate) return [];

    const start = startOfLocalDay(exportFromDate);
    const end = startOfLocalDay(exportToDate);
    if (start > end) return [];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const rows: DailyExportRow[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const current = new Date(cursor);
      const dayName = dayNames[current.getDay()];
      const isToday = isSameLocalDay(current, today);

      if (isToday) {
        const visitors = data.visitorsToday;
        const customers = data.customersToday;
        const conv =
          visitors > 0 ? parseFloat(((customers / visitors) * 100).toFixed(1)) : data.conversionRate;
        const avgDwell =
          hourlyData.length > 0
            ? Math.round(
                hourlyData.reduce((acc, h) => acc + h.avgDwellTime, 0) / hourlyData.length
              )
            : Math.max(5, Math.floor(visitors * 0.15));

        rows.push({
          isoDate: toLocalISODate(current),
          displayDate: formatShortDate(current),
          dayName,
          visitors,
          entries: visitors,
          exits: Math.max(0, Math.round(visitors * 0.85)),
          customers,
          conversionRate: conv,
          peakHourCount: Math.floor(visitors * 0.2),
          avgDwellTime: avgDwell,
        });
      } else {
        const matchedDay = data.weeklyConversionData.find((w) => w.time === dayName);
        const visitors = matchedDay?.visitors ?? 0;
        const customers = matchedDay?.customers ?? 0;
        const conv = visitors > 0 ? parseFloat(((customers / visitors) * 100).toFixed(1)) : 0;

        rows.push({
          isoDate: toLocalISODate(current),
          displayDate: formatShortDate(current),
          dayName,
          visitors,
          entries: visitors,
          exits: Math.max(0, Math.round(visitors * 0.88)),
          customers,
          conversionRate: conv,
          peakHourCount: Math.floor(visitors * 0.2),
          avgDwellTime: Math.max(5, Math.floor((visitors / 12) * 0.15)),
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return rows;
  }, [exportFromDate, exportToDate, today, data, hourlyData]);

  // Aggregated summary for the selected date range
  const rangeSummary = useMemo(() => {
    const totalVisitors = rangeExportRows.reduce((sum, r) => sum + r.visitors, 0);
    const totalCustomers = rangeExportRows.reduce((sum, r) => sum + r.customers, 0);
    const avgConversion =
      totalVisitors > 0 ? parseFloat(((totalCustomers / totalVisitors) * 100).toFixed(1)) : 0;
    const busiestDay = rangeExportRows.reduce<DailyExportRow | null>(
      (best, curr) => (!best || curr.visitors > best.visitors ? curr : best),
      null
    );

    return {
      dayCount: rangeExportRows.length,
      totalVisitors,
      totalCustomers,
      avgConversion,
      busiestDay,
    };
  }, [rangeExportRows]);

  // Export CSV for the selected From -> To date range
  const handleRangeExport = () => {
    if (!exportFromDate || !exportToDate || rangeExportRows.length === 0) return;

    const fromISO = toLocalISODate(exportFromDate);
    const toISO = toLocalISODate(exportToDate);
    const csvRows: string[] = [];

    csvRows.push(
      `Foot Traffic Analytics Report (${formatShortDate(exportFromDate)} to ${formatShortDate(exportToDate)})`
    );
    csvRows.push(`Generated On,${formatShortDate(new Date())}`);
    csvRows.push(`Active View Tab,${activeTab.toUpperCase()}`);
    csvRows.push("");

    // Summary block
    csvRows.push("Range Summary,Value");
    csvRows.push(`From Date,${fromISO}`);
    csvRows.push(`To Date,${toISO}`);
    csvRows.push(`Total Days Exported,${rangeSummary.dayCount}`);
    csvRows.push(`Total Visitors,${rangeSummary.totalVisitors}`);
    csvRows.push(`Total Customers,${rangeSummary.totalCustomers}`);
    csvRows.push(`Overall Conversion Rate,${rangeSummary.avgConversion}%`);
    if (rangeSummary.busiestDay) {
      csvRows.push(
        `Busiest Day,${rangeSummary.busiestDay.displayDate} (${rangeSummary.busiestDay.visitors} visitors)`
      );
    }
    csvRows.push("");

    // Daily breakdown across selected date range
    csvRows.push(
      "Date,Day,Total Visitors,Entries,Exits,Total Customers,Conversion Rate (%),Peak Hour Visitors,Avg Dwell Time (min)"
    );
    rangeExportRows.forEach((row) => {
      csvRows.push(
        `${row.isoDate},${row.dayName},${row.visitors},${row.entries},${row.exits},${row.customers},${row.conversionRate}%,${row.peakHourCount},${row.avgDwellTime}`
      );
    });

    // Include today's hourly breakdown if enabled and today falls within the exported range
    const includesToday = rangeExportRows.some((r) => r.isoDate === toLocalISODate(today));
    if (includeHourlyDetails && includesToday && hourlyData.length > 0) {
      csvRows.push("");
      csvRows.push(`Hourly Breakdown (${formatShortDate(today)})`);
      csvRows.push("Time Slot,Visitors,Entries,Exits,Avg Dwell Time (min)");
      hourlyData.forEach((row, idx) => {
        const entry = entryExitData[idx]?.entry ?? 0;
        const exit = entryExitData[idx]?.exit ?? 0;
        csvRows.push(`${row.time},${row.visitors},${entry},${exit},${row.avgDwellTime}`);
      });
    }

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `traffic_report_${fromISO}_to_${toISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
  };

  return (
    <div className="space-y-6 relative">
      {/* CUSTOM DATE RANGE EXPORT MODAL */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Export Traffic Report by Date Range</h3>
                  <p className="text-xs text-slate-400">
                    Choose the start date and end date to export analytics as CSV
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
                  Quick Range:
                </span>
                {[
                  { id: "today", label: "Today" },
                  { id: "7d", label: "Last 7 Days" },
                  { id: "14d", label: "Last 14 Days" },
                  { id: "30d", label: "Last 30 Days" },
                  { id: "month", label: "This Month" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      applyPresetRange(preset.id as "today" | "7d" | "14d" | "30d" | "month")
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/40 text-slate-300 border border-slate-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* From Date & To Date Inputs + Range Calendar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column: Exact Date Inputs & Range Summary */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={exportFromDate ? toLocalISODate(exportFromDate) : ""}
                        max={toLocalISODate(today)}
                        onChange={(e) => handleFromInputChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={exportToDate ? toLocalISODate(exportToDate) : ""}
                        min={exportFromDate ? toLocalISODate(exportFromDate) : undefined}
                        max={toLocalISODate(today)}
                        onChange={(e) => handleToInputChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Preview Card */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Export Preview
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {rangeSummary.dayCount} {rangeSummary.dayCount === 1 ? "Day" : "Days"}
                      </span>
                    </div>

                    {exportFromDate && exportToDate ? (
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between text-slate-400">
                          <span>Selected Period:</span>
                          <span className="text-white font-semibold">
                            {formatShortDate(exportFromDate)} – {formatShortDate(exportToDate)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Total Visitors:</span>
                          <span className="text-blue-400 font-bold">
                            {rangeSummary.totalVisitors.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Total Customers:</span>
                          <span className="text-emerald-400 font-bold">
                            {rangeSummary.totalCustomers.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Avg Conversion Rate:</span>
                          <span className="text-purple-400 font-bold">
                            {rangeSummary.avgConversion}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-400">
                        Please select both a start date and an end date to preview the export.
                      </p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeHourlyDetails}
                      onChange={(e) => setIncludeHourlyDetails(e.target.checked)}
                      className="accent-blue-500 rounded"
                    />
                    Include hourly breakdown when today is in range
                  </label>
                </div>

                {/* Right Column: Interactive Range Calendar */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                  <span className="text-[11px] text-slate-400 mb-2">
                    Or click start &amp; end dates on the calendar
                  </span>
                  <Calendar
                    mode="range"
                    selected={{ from: exportFromDate, to: exportToDate }}
                    onSelect={(range: { from?: Date; to?: Date } | undefined) => {
                      setExportFromDate(range?.from);
                      setExportToDate(range?.to);
                    }}
                    disabled={{ after: today }}
                    className="rounded-md border border-slate-800 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/60">
              <span className="text-xs text-slate-400 font-mono truncate">
                {exportFromDate && exportToDate
                  ? `traffic_report_${toLocalISODate(exportFromDate)}_to_${toLocalISODate(exportToDate)}.csv`
                  : "Select a valid date range"}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsExportModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!exportFromDate || !exportToDate || rangeExportRows.length === 0}
                  onClick={handleRangeExport}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white cursor-pointer"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV ({rangeSummary.dayCount} {rangeSummary.dayCount === 1 ? "Day" : "Days"})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Traffic Analytics</h1>
          <p className="text-slate-400">Detailed foot traffic analysis and occupancy patterns</p>
        </div>

        {/* Date Range Selector & Export Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            title="Choose custom From and To dates for export"
          >
            <CalendarIcon className="h-4 w-4 text-blue-400" />
            <span>
              {exportFromDate ? formatShortDate(exportFromDate) : "Start Date"}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            <span>
              {exportToDate ? formatShortDate(exportToDate) : "End Date"}
            </span>
          </button>

          <Button
            onClick={() => setIsExportModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Range Report
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Today's Visitors</p>
                <p className="text-2xl font-bold text-white">{data.visitorsToday.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">+12.5% vs yesterday</span>
                </div>
              </div>
              <Users className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-white">{data.customersToday.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">+5.4% active</span>
                </div>
              </div>
              <Activity className="h-10 w-10 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Conversion Rate</p>
                <p className="text-2xl font-bold text-white">{data.conversionRate}%</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500">-0.8% overall</span>
                </div>
              </div>
              <Clock className="h-10 w-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div>
              <p className="text-slate-400 text-sm mb-1">Peak Occupancy Hour</p>
              <p className="text-2xl font-bold text-white">17:00 - 18:00</p>
              <p className="text-sm text-slate-400 mt-2">140 peak entries</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Time Periods with onValueChange */}
      <Tabs defaultValue="daily" onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger
            value="daily"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white cursor-pointer"
          >
            Daily
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white cursor-pointer"
          >
            Weekly
          </TabsTrigger>
          <TabsTrigger
            value="monthly"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white cursor-pointer"
          >
            Monthly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TrafficChart
                title={`Hourly Foot Traffic - ${date ? formatShortDate(date) : "Today"}`}
                data={hourlyData}
                type="line"
                dataKeys={[
                  { key: "visitors", color: "#3b82f6", name: "Visitors" },
                  { key: "avgDwellTime", color: "#8b5cf6", name: "Avg Dwell Time (min)" },
                ]}
              />
            </div>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-white">Select Date</CardTitle>
                {date && (
                  <button
                    type="button"
                    onClick={() => {
                      setExportFromDate(date);
                      setExportToDate(date);
                      setIsExportModalOpen(true);
                    }}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    Export this day →
                  </button>
                )}
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={{ after: today }}
                  className="rounded-md border border-slate-700 text-white"
                />
              </CardContent>
            </Card>
          </div>

          <TrafficChart
            title={`Entry vs Exit Pattern - ${date ? formatShortDate(date) : "Today"}`}
            data={entryExitData}
            type="bar"
            dataKeys={[
              { key: "entry", color: "#10b981", name: "Entry" },
              { key: "exit", color: "#f59e0b", name: "Exit" },
            ]}
          />
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          <TrafficChart
            title="Weekly Foot Traffic Comparison"
            data={weeklyData}
            type="bar"
            dataKeys={[
              { key: "visitors", color: "#3b82f6", name: "Total Visitors" },
              { key: "peakHour", color: "#f59e0b", name: "Peak Hour Count" },
            ]}
          />
          <HeatmapChart title="Weekly Traffic Heatmap" data={heatmapData} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <TrafficChart 
            title="Monthly Traffic Trend"
            data={monthlyData}
            type="line"
            dataKeys={[{ key: "visitors", color: "#3b82f6", name: "Daily Visitors" }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}