import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download, FileText, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { useState, useEffect, useRef } from "react";
import { useDashboard } from "../context/DashboardContext";

interface ReportItem {
  id: number;
  name: string;
  type: string;
  date: string;
  size: string;
  status: string;
  dataContent?: string;
}

export default function ReportsPage() {
  const { data } = useDashboard();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const autoDownloadedRef = useRef(false);

  // --- RECENT REPORTS STATE ---
  const [reportsList, setReportsList] = useState<ReportItem[]>([
    {
      id: 1,
      name: "Daily Traffic Report - Today",
      type: "Traffic",
      date: "Today",
      size: "2.4 KB",
      status: "Ready",
    },
    {
      id: 2,
      name: "Weekly Conversion Report - Week 10",
      type: "Conversion",
      date: "Yesterday",
      size: "4.1 KB",
      status: "Ready",
    },
    {
      id: 3,
      name: "Monthly Analytics Overview",
      type: "Combined",
      date: "Mar 1, 2026",
      size: "12.3 KB",
      status: "Ready",
    },
    {
      id: 4,
      name: "Camera Performance Report - Q1 2026",
      type: "System",
      date: "Mar 5, 2026",
      size: "6.7 KB",
      status: "Ready",
    },
    {
      id: 5,
      name: "Peak Hours Analysis",
      type: "Analytics",
      date: "Mar 3, 2026",
      size: "3.2 KB",
      status: "Ready",
    },
  ]);

  // Static list for Scheduled Reports
  const scheduledReports = [
    {
      id: 1,
      title: "Daily Traffic Summary",
      schedule: "Generated every day at 11:59 PM",
      type: "daily",
    },
    {
      id: 2,
      title: "Weekly Conversion Report",
      schedule: "Generated every Sunday at 11:59 PM",
      type: "weekly",
    },
    {
      id: 3,
      title: "Monthly Analytics",
      schedule: "Generated on the 1st of each month",
      type: "monthly",
    },
  ];

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper: Trigger browser CSV download
  const triggerCsvDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper: Generate report content by type
  const generateReportContent = (type: string, title: string) => {
    const dateStr = new Date().toISOString().split("T")[0];
    let csvRows: string[] = [];

    if (type === "daily") {
      csvRows.push(`Auto-Scheduled Daily Traffic Summary - ${dateStr}`);
      csvRows.push("");
      csvRows.push(`Total Visitors,${data.visitorsToday}`);
      csvRows.push(`Total Customers,${data.customersToday}`);
      csvRows.push(`Conversion Rate,${data.conversionRate}%`);
      csvRows.push("");
      csvRows.push("Time Slot,Visitors,Customers");
      data.hourlyConversionData.forEach((row) => {
        csvRows.push(`${row.time},${row.visitors},${row.customers}`);
      });
    } else if (type === "weekly") {
      csvRows.push(`Auto-Scheduled Weekly Conversion Report - ${dateStr}`);
      csvRows.push("");
      csvRows.push("Day,Visitors,Customers");
      data.weeklyConversionData.forEach((row) => {
        csvRows.push(`${row.time},${row.visitors},${row.customers}`);
      });
    } else {
      csvRows.push(`Auto-Scheduled Monthly Analytics Report - ${dateStr}`);
      csvRows.push("");
      csvRows.push(`Date,${dateStr}`);
      csvRows.push(`Visitors,${data.visitorsToday}`);
      csvRows.push(`Conversion Rate,${data.conversionRate}%`);
    }

    return csvRows.join("\n");
  };

  // AUTOMATIC SCHEDULED DOWNLOAD CHECK
  useEffect(() => {
    if (autoDownloadedRef.current) return;

    const now = new Date();
    const isDayEnd = now.getHours() === 23 && now.getMinutes() >= 58;
    const isSunday = now.getDay() === 0;
    const isFirstOfMonth = now.getDate() === 1;

    scheduledReports.forEach((item) => {
      let shouldTrigger = false;

      if (item.type === "daily" && isDayEnd) shouldTrigger = true;
      if (item.type === "weekly" && isSunday && isDayEnd) shouldTrigger = true;
      if (item.type === "monthly" && isFirstOfMonth) shouldTrigger = true;

      if (shouldTrigger) {
        const content = generateReportContent(item.type, item.title);
        const filename = `${item.title.toLowerCase().replace(/ /g, "_")}_${now.toISOString().split("T")[0]}.csv`;
        
        triggerCsvDownload(filename, content);
        
        // Append automatically to Recent Reports
        setReportsList((prev) => [
          {
            id: Date.now() + Math.random(),
            name: `${item.title} (Auto-Scheduled)`,
            type: item.type === "daily" ? "Traffic" : item.type === "weekly" ? "Conversion" : "Combined",
            date: "Just now",
            size: `${(content.length / 1024).toFixed(1)} KB`,
            status: "Ready",
            dataContent: content,
          },
          ...prev,
        ]);

        showNotification(`Auto-downloaded scheduled report: ${item.title}`);
      }
    });

    autoDownloadedRef.current = true;
  }, []);

  // QUICK REPORTS GENERATOR
  const handleGenerateQuickReport = (type: "today" | "weekly" | "monthly") => {
    const todayStr = new Date().toISOString().split("T")[0];
    let reportName = "";
    let reportType = "";
    let csvData = "";

    if (type === "today") {
      reportName = `Daily Summary - ${todayStr}`;
      reportType = "Traffic";
      csvData = generateReportContent("daily", reportName);
    } else if (type === "weekly") {
      reportName = `Weekly Trends - ${todayStr}`;
      reportType = "Conversion";
      csvData = generateReportContent("weekly", reportName);
    } else {
      reportName = `Monthly Overview - ${todayStr}`;
      reportType = "Combined";
      csvData = generateReportContent("monthly", reportName);
    }

    triggerCsvDownload(`${reportName.toLowerCase().replace(/ /g, "_")}.csv`, csvData);

    setReportsList((prev) => [
      {
        id: Date.now(),
        name: reportName,
        type: reportType,
        date: "Just now",
        size: `${(csvData.length / 1024).toFixed(1)} KB`,
        status: "Ready",
        dataContent: csvData,
      },
      ...prev,
    ]);
    showNotification(`Generated and downloaded: ${reportName}`);
  };

  // DOWNLOAD RECENT REPORT ITEM
  const handleDownloadReportItem = (report: ReportItem) => {
    const content = report.dataContent || generateReportContent("daily", report.name);
    triggerCsvDownload(`${report.name.toLowerCase().replace(/ /g, "_")}.csv`, content);
    showNotification(`Downloaded ${report.name}`);
  };

  const quickReports = [
    {
      title: "Today's Summary",
      description: "Quick overview of today's performance",
      icon: Calendar,
      color: "blue",
      actionKey: "today" as const,
    },
    {
      title: "Weekly Analysis",
      description: "7-day traffic and conversion trends",
      icon: TrendingUp,
      color: "purple",
      actionKey: "weekly" as const,
    },
    {
      title: "Monthly Report",
      description: "Comprehensive monthly analytics",
      icon: FileText,
      color: "green",
      actionKey: "monthly" as const,
    },
  ];

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg transition-all animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reports</h1>
        <p className="text-slate-400">Generate and download analytics reports</p>
      </div>

      {/* Quick Reports */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Quick Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickReports.map((report) => {
            const Icon = report.icon;
            const colorClasses = {
              blue: "bg-blue-500/10 text-blue-500 border-blue-500/50",
              purple: "bg-purple-500/10 text-purple-500 border-purple-500/50",
              green: "bg-green-500/10 text-green-500 border-green-500/50",
            };
            return (
              <Card key={report.title} className={`${colorClasses[report.color as keyof typeof colorClasses]} border`}>
                <CardContent className="p-6">
                  <Icon className="h-10 w-10 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">{report.title}</h3>
                  <p className="text-sm text-slate-400 mb-4">{report.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateQuickReport(report.actionKey)}
                    className="border-slate-700 hover:bg-slate-800 text-black w-full cursor-pointer"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Reports Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-slate-800/50">
                <TableHead className="text-slate-300">Report Name</TableHead>
                <TableHead className="text-slate-300">Type</TableHead>
                <TableHead className="text-slate-300">Date</TableHead>
                <TableHead className="text-slate-300">Size</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportsList.map((report) => (
                <TableRow key={report.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-white font-medium">{report.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 text-slate-300">
                      {report.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">{report.date}</TableCell>
                  <TableCell className="text-slate-300">{report.size}</TableCell>
                  <TableCell>
                    <Badge className="bg-green-500/20 text-green-500">{report.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownloadReportItem(report)}
                      className="text-blue-400 hover:text-blue-300 hover:bg-slate-800 cursor-pointer"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scheduled Reports */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Scheduled Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheduledReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                <div>
                  <h4 className="text-white font-medium">{report.title}</h4>
                  <p className="text-sm text-slate-400">{report.schedule}</p>
                </div>
                <Badge className="bg-blue-500/20 text-blue-500">Active</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}