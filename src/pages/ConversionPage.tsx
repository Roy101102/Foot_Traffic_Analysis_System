import { ConversionCard } from "../components/ConversionCard";
import { TrafficChart } from "../components/TrafficChart";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Download, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";
import { useDashboard } from "../context/DashboardContext";
import { useState } from "react";

export default function ConversionPage() {
  // Read live centralized metrics from context
  const { data } = useDashboard();

  // Track currently active tab: 'hourly' | 'weekly' | 'comparison'
  const [activeTab, setActiveTab] = useState<string>("hourly");

  // 📥 TAB-SPECIFIC EXPORT FUNCTIONALITY
  const handleExport = () => {
    const formattedDate = new Date().toISOString().split("T")[0];
    let csvRows: string[] = [];

    if (activeTab === "hourly") {
      // --- HOURLY EXPORT ---
      csvRows.push(`Hourly Conversion Report - ${formattedDate}`);
      csvRows.push("");
      csvRows.push("Time Slot,Visitors,Customers,Conversion Rate (%)");
      data.hourlyConversionData.forEach((row) => {
        csvRows.push(`${row.time},${row.visitors},${row.customers},${row.conversionRate}%`);
      });

    } else if (activeTab === "weekly") {
      // --- WEEKLY EXPORT ---
      csvRows.push(`Weekly Conversion Performance Report - ${formattedDate}`);
      csvRows.push("");
      csvRows.push("Day,Visitors,Customers,Conversion Rate (%),Total Sales ($)");
      data.weeklyConversionData.forEach((day) => {
        const rate = ((day.customers / day.visitors) * 100).toFixed(1);
        csvRows.push(`${day.time},${day.visitors},${day.customers},${rate}%,${day.sales}`);
      });

    } else if (activeTab === "comparison") {
      // --- SALES VS TRAFFIC EXPORT ---
      csvRows.push(`Sales vs Traffic Report - ${formattedDate}`);
      csvRows.push("");
      csvRows.push("Performance Insights");
      csvRows.push(`Best Performing Hour,${data.bestHour.time},${data.bestHour.rate}%,$${data.bestHour.revenue}`);
      csvRows.push(`Lowest Performing Hour,${data.worstHour.time},${data.worstHour.rate}%,$${data.worstHour.revenue}`);
      csvRows.push(`Weekly Average Conversion,${data.weeklyAvg.rate}%,$${data.weeklyAvg.dailyRevenue} Avg Daily Rev,${data.weeklyAvg.totalCustomers} Total Customers`);
      csvRows.push("");
      csvRows.push("Daily Breakdown (Sales Value vs Visitors)");
      csvRows.push("Date/Label,Visitors,Sales Value ($)");
      data.salesVsTrafficData.forEach((row) => {
        csvRows.push(`${row.time},${row.visitors},${row.salesValue}`);
      });
    }

    // Trigger standard browser download
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `conversion_${activeTab}_report_${formattedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Conversion Analytics</h1>
          <p className="text-slate-400">Track visitor-to-customer conversion rates and sales performance</p>
        </div>
        {/* Dynamic Export Button */}
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
          <Download className="h-4 w-4 mr-2" />
          Export {activeTab === "hourly" ? "Hourly" : activeTab === "weekly" ? "Weekly" : "Sales vs Traffic"} Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Today's Conversion</p>
                <p className="text-2xl font-bold text-white">{data.conversionRate.toFixed(1)}%</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">+2.1%</span>
                </div>
              </div>
              <ShoppingCart className="h-10 w-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Total Sales Today</p>
                <p className="text-2xl font-bold text-white">${data.totalSalesToday.toLocaleString()}</p>
                <p className="text-sm text-slate-400 mt-2">{data.customersToday} transactions</p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div>
              <p className="text-slate-400 text-sm mb-1">Avg. Transaction</p>
              <p className="text-2xl font-bold text-white">${data.avgTransaction.toFixed(2)}</p>
              <p className="text-sm text-slate-400 mt-2">Per customer</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div>
              <p className="text-slate-400 text-sm mb-1">Revenue per Visitor</p>
              <p className="text-2xl font-bold text-white">${data.revenuePerVisitor.toFixed(2)}</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">+8.2%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Conversion Card */}
      <ConversionCard
        visitors={data.visitorsToday}
        customers={data.customersToday}
        conversionRate={data.conversionRate}
      />

      {/* Tabs View with onValueChange */}
      <Tabs defaultValue="hourly" onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="hourly" className="data-[state=active]:bg-blue-600">
            Hourly
          </TabsTrigger>
          <TabsTrigger value="weekly" className="data-[state=active]:bg-blue-600">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-blue-600">
            Sales vs Traffic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hourly" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrafficChart
              title="Hourly Conversion Rate"
              data={data.hourlyConversionData}
              type="line"
              dataKeys={[{ key: "conversionRate", color: "#8b5cf6", name: "Conversion Rate %" }]}
            />
            <TrafficChart
              title="Visitors vs Customers"
              data={data.hourlyConversionData}
              type="bar"
              dataKeys={[
                { key: "visitors", color: "#3b82f6", name: "Visitors" },
                { key: "customers", color: "#10b981", name: "Customers" },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-6">
          <TrafficChart
            title="Weekly Conversion Performance"
            data={data.weeklyConversionData}
            type="bar"
            dataKeys={[
              { key: "visitors", color: "#3b82f6", name: "Visitors" },
              { key: "customers", color: "#10b981", name: "Customers" },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
            {data.weeklyConversionData.map((day) => {
              const rate = ((day.customers / day.visitors) * 100).toFixed(1);
              return (
                <Card key={day.time} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <h3 className="text-white font-semibold mb-3">{day.time}</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Visitors</p>
                        <p className="text-lg font-bold text-blue-500">{day.visitors.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Customers</p>
                        <p className="text-lg font-bold text-green-500">{day.customers}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Rate</p>
                        <p className="text-lg font-bold text-purple-500">{rate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Sales</p>
                        <p className="text-sm font-semibold text-white">${day.sales.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <TrafficChart
            title="Daily Sales Value vs Traffic"
            data={data.salesVsTrafficData}
            type="line"
            dataKeys={[
              { key: "visitors", color: "#3b82f6", name: "Visitors" },
              { key: "salesValue", color: "#10b981", name: "Sales Value ($)" },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Best Performing Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Time</p>
                    <p className="text-2xl font-bold text-white">{data.bestHour.time}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Conversion Rate</p>
                    <p className="text-2xl font-bold text-green-500">{data.bestHour.rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Revenue</p>
                    <p className="text-xl font-bold text-white">${data.bestHour.revenue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Lowest Performing Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Time</p>
                    <p className="text-2xl font-bold text-white">{data.worstHour.time}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Conversion Rate</p>
                    <p className="text-2xl font-bold text-red-500">{data.worstHour.rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Revenue</p>
                    <p className="text-xl font-bold text-white">${data.worstHour.revenue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Weekly Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Avg Conversion</p>
                    <p className="text-2xl font-bold text-white">{data.weeklyAvg.rate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Avg Daily Revenue</p>
                    <p className="text-2xl font-bold text-green-500">${data.weeklyAvg.dailyRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Total Customers</p>
                    <p className="text-xl font-bold text-white">{data.weeklyAvg.totalCustomers.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}