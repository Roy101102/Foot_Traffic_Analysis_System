import { TrafficChart } from "../components/TrafficChart";
import { HeatmapChart } from "../components/HeatmapChart";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Calendar } from "../components/ui/calendar";
import { Button } from "../components/ui/button";
import { Download, TrendingUp, TrendingDown, Users, Activity, Clock } from "lucide-react";
import { useState } from "react";
import { useDashboard } from "../context/DashboardContext";

export default function TrafficPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  // Track currently active tab: 'daily' | 'weekly' | 'monthly'
  const [activeTab, setActiveTab] = useState<string>("daily");
  
  // Read directly from shared context
  const { data } = useDashboard();

  // Helper to format date with a 3-letter month (e.g., "Nov 15, 2026")
  const formatShortDate = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      month: "short", // Produces 3-letter month: Jan, Feb, Mar, Nov, etc.
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

  // Dynamic export button label with 3-letter month (e.g. "Export Nov 15, 2026 Report")
  const getExportButtonLabel = () => {
    if (activeTab === "daily") {
      if (date) {
        return `Export ${formatShortDate(date)} Report`;
      }
      return "Export Daily Report";
    }
    return `Export ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`;
  };

  // 📥 TAB-SPECIFIC & DATE-AWARE EXPORT FUNCTIONALITY
  const handleExport = () => {
    const formattedDate = date ? date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    let csvRows: string[] = [];

    if (activeTab === "daily") {
      // --- DAILY EXPORT ---
      csvRows.push(`Daily Traffic Report - ${date ? formatShortDate(date) : formattedDate}`);
      csvRows.push("");
      csvRows.push("Metric,Value");
      csvRows.push(`Total Visitors,${data.visitorsToday}`);
      csvRows.push(`Total Customers,${data.customersToday}`);
      csvRows.push(`Conversion Rate,${data.conversionRate}%`);
      csvRows.push(`Peak Occupancy Hour,17:00 - 18:00`);
      csvRows.push("");
      csvRows.push("Time Slot,Visitors,Entries,Exits,Avg Dwell Time (min)");
      hourlyData.forEach((row, idx) => {
        const entry = entryExitData[idx]?.entry || 0;
        const exit = entryExitData[idx]?.exit || 0;
        csvRows.push(`${row.time},${row.visitors},${entry},${exit},${row.avgDwellTime}`);
      });

    } else if (activeTab === "weekly") {
      // --- WEEKLY EXPORT ---
      csvRows.push(`Weekly Traffic Report - ${formattedDate}`);
      csvRows.push("");
      csvRows.push("Day,Total Visitors,Peak Hour Count");
      weeklyData.forEach((row) => {
        csvRows.push(`${row.time},${row.visitors},${row.peakHour}`);
      });
      csvRows.push("");
      csvRows.push("Heatmap Sample Summary (Mon-Sun)");
      heatmapData.forEach((dayGroup) => {
        const totalHeatVal = dayGroup.hours.reduce((acc, curr) => acc + curr.value, 0);
        csvRows.push(`${dayGroup.day},${totalHeatVal} total estimated index value`);
      });

    } else if (activeTab === "monthly") {
      // --- MONTHLY EXPORT ---
      csvRows.push(`Monthly Traffic Trend Report - ${formattedDate}`);
      csvRows.push("");
      csvRows.push("Time Period,Daily Visitors");
      monthlyData.forEach((row) => {
        csvRows.push(`${row.time},${row.visitors}`);
      });
    }

    // Trigger standard browser download
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `traffic_${activeTab}_report_${formattedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Traffic Analytics</h1>
          <p className="text-slate-400">Detailed foot traffic analysis and occupancy patterns</p>
        </div>
        {/* Dynamic Date-Aware Export Button */}
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
          <Download className="h-4 w-4 mr-2" />
          {getExportButtonLabel()}
        </Button>
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
          <TabsTrigger value="daily" className="data-[state=active]:bg-blue-600">
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly" className="data-[state=active]:bg-blue-600">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-blue-600">
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
              <CardHeader>
                <CardTitle className="text-white">Select Date</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={{ after: new Date() }}
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