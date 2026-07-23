import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Bell, BellOff, Settings2, CheckCircle2, History, Trash2, RotateCcw, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import type { LayoutContextType } from "../layouts/Layout"; // Adjust import path if needed

// Type definitions
export type AlertType = "camera_offline" | "traffic_spike" | "system_error" | "warning";
export type SeverityType = "critical" | "warning" | "info";

export interface AlertItem {
  id: number;
  type: AlertType;
  title: string;
  message: string;
  timestamp: string;
  severity: SeverityType;
  archivedAt?: string;
}

// Inline Sub-component: AlertCard with dynamic severity colors for the type badge beside the title
function LocalAlertCard({
  title,
  message,
  timestamp,
  severity,
  onDismiss,
}: AlertItem & { onDismiss?: () => void }) {
  // Styles depending on severity level
  const styles = {
    critical: {
      border: "border-red-500/30 bg-red-950/10 hover:border-red-500/50",
      badge: "bg-red-500/20 text-red-400 border-red-500/30",
      icon: <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />,
    },
    warning: {
      border: "border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50",
      badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
    },
    info: {
      border: "border-blue-500/30 bg-blue-950/10 hover:border-blue-500/50",
      badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      icon: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
    },
  }[severity];

  return (
    <Card className={`border transition-all duration-200 ${styles.border}`}>
      <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {styles.icon}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              {/* Type Badge: Styled dynamically based on severity */}
              <Badge variant="outline" className={`text-xs capitalize ${styles.badge}`}>
                {severity}
              </Badge>
            </div>
            <p className="text-sm text-slate-300 mb-2">{message}</p>
            <span className="text-xs text-slate-400">{timestamp}</span>
          </div>
        </div>

        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 cursor-pointer -mr-1 -mt-1"
            title="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const settingsRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Layout outlet context to control sidebar badge count
  const { setAlertCount } = useOutletContext<LayoutContextType>();

  // --- SETTINGS STATE ---
  const [settings, setSettings] = useState({
    cameraOffline: true,
    trafficSpike: true,
    systemError: true,
    emailNotifications: false,
  });

  // --- ACTIVE ALERTS STATE ---
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 1,
      type: "camera_offline",
      title: "Camera Offline",
      message: "East Wing camera has been offline for 15 minutes",
      timestamp: "2 minutes ago",
      severity: "critical",
    },
    {
      id: 2,
      type: "traffic_spike",
      title: "Abnormal Traffic Spike",
      message: "Front Entrance showing 300% increase in visitor count",
      timestamp: "10 minutes ago",
      severity: "warning",
    },
    {
      id: 3,
      type: "system_error",
      title: "System Error",
      message: "YOLOv8 detection service restarted automatically",
      timestamp: "1 hour ago",
      severity: "info",
    },
    {
      id: 4,
      type: "camera_offline",
      title: "Camera Connection Lost",
      message: "Emergency Exit camera disconnected",
      timestamp: "2 hours ago",
      severity: "critical",
    },
    {
      id: 5,
      type: "warning",
      title: "Low Detection Accuracy",
      message: "Parking Entrance camera showing reduced detection accuracy",
      timestamp: "3 hours ago",
      severity: "warning",
    },
  ]);

  // --- HISTORY / ARCHIVE STATE ---
  const [history, setHistory] = useState<AlertItem[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Move single item to history
  const handleDismiss = (id: number) => {
    const itemToMove = alerts.find((a) => a.id === id);
    if (!itemToMove) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setAlerts((prev) => {
      const updated = prev.filter((alert) => alert.id !== id);
      setAlertCount(updated.length);
      return updated;
    });

    setHistory((prev) => [{ ...itemToMove, archivedAt: `Archived today at ${timestamp}` }, ...prev]);
    showToast("Alert moved to history");
  };

  // Move ALL active items to history
  const handleMarkAllRead = () => {
    if (alerts.length === 0) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const archivedItems = alerts.map((a) => ({ ...a, archivedAt: `Archived today at ${timestamp}` }));

    setHistory((prev) => [...archivedItems, ...prev]);
    setAlerts([]);
    setAlertCount(0);
    showToast("All alerts moved to history");
  };

  // Restore item from history back to active
  const handleRestore = (item: AlertItem) => {
    setHistory((prev) => prev.filter((a) => a.id !== item.id));
    setAlerts((prev) => {
      const updated = [item, ...prev];
      setAlertCount(updated.length);
      return updated;
    });
    showToast("Alert restored to active list");
  };

  // Permanent deletion of history
  const handleClearHistory = () => {
    setHistory([]);
    showToast("Alert history permanently cleared");
  };

  const scrollToSettings = () => {
    settingsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      const friendlyName = key.replace(/([A-Z])/g, " $1");
      showToast(`${friendlyName.charAt(0).toUpperCase() + friendlyName.slice(1)} set to ${updated[key] ? "Enabled" : "Disabled"}`);
      return updated;
    });
  };

  // Dynamic filter based on active toggle settings
  const filteredAlerts = alerts.filter((alert) => {
    if (alert.type === "camera_offline" && !settings.cameraOffline) return false;
    if (alert.type === "traffic_spike" && !settings.trafficSpike) return false;
    if (alert.type === "system_error" && !settings.systemError) return false;
    return true;
  });

  const criticalAlerts = filteredAlerts.filter((a) => a.severity === "critical");
  const warningAlerts = filteredAlerts.filter((a) => a.severity === "warning");
  const infoAlerts = filteredAlerts.filter((a) => a.severity === "info");

  // Reusable active list renderer
  const AlertList = ({ list, emptyText }: { list: AlertItem[]; emptyText: string }) => {
    if (list.length === 0) {
      return (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">{emptyText}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {list.map((alert) => (
          <LocalAlertCard key={alert.id} {...alert} onDismiss={() => handleDismiss(alert.id)} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Alerts & Notifications</h1>
          <p className="text-slate-400">Monitor system alerts and camera status notifications</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleMarkAllRead}
            disabled={alerts.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer text-white"
          >
            <BellOff className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button
            onClick={scrollToSettings}
            className="bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Alert Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-500/10 border-red-500/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Critical Alerts</p>
                <p className="text-3xl font-bold text-red-500">{criticalAlerts.length}</p>
              </div>
              <Bell className="h-10 w-10 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Warnings</p>
                <p className="text-3xl font-bold text-yellow-500">{warningAlerts.length}</p>
              </div>
              <Bell className="h-10 w-10 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Info</p>
                <p className="text-3xl font-bold text-blue-500">{infoAlerts.length}</p>
              </div>
              <Bell className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700 w-full justify-start overflow-x-auto">
          {/* All Active Tab */}
          <TabsTrigger value="all" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white font-medium">
            All Active
            <Badge variant="secondary" className="ml-2 bg-slate-700 text-white border border-slate-600 font-semibold px-2 py-0.5">
              {filteredAlerts.length}
            </Badge>
          </TabsTrigger>

          {/* Critical Tab */}
          <TabsTrigger value="critical" className="data-[state=active]:bg-slate-900 data-[state=active]:text-red-500 font-medium">
            Critical
            <Badge variant="secondary" className="ml-2 bg-red-600 text-white border border-red-500 font-semibold px-2 py-0.5">
              {criticalAlerts.length}
            </Badge>
          </TabsTrigger>

          {/* Warnings Tab */}
          <TabsTrigger value="warning" className="data-[state=active]:bg-slate-900 data-[state=active]:text-amber-500 font-medium">
            Warnings
            <Badge variant="secondary" className="ml-2 bg-amber-600 text-white border border-amber-500 font-semibold px-2 py-0.5">
              {warningAlerts.length}
            </Badge>
          </TabsTrigger>

          {/* Info Tab */}
          <TabsTrigger value="info" className="data-[state=active]:bg-slate-900 data-[state=active]:text-blue-500 font-medium">
            Info
            <Badge variant="secondary" className="ml-2 bg-blue-600 text-white border border-blue-500 font-semibold px-2 py-0.5">
              {infoAlerts.length}
            </Badge>
          </TabsTrigger>

          {/* History Tab Trigger */}
          <TabsTrigger value="history" className="ml-auto data-[state=active]:bg-slate-900 data-[state=active]:text-white font-medium">
            <History className="h-4 w-4 mr-1.5" />
            History
            <Badge variant="secondary" className="ml-2 bg-slate-700 text-white border border-slate-600 font-semibold px-2 py-0.5">
              {history.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AlertList list={filteredAlerts} emptyText="No active alerts at this time" />
        </TabsContent>

        <TabsContent value="critical">
          <AlertList list={criticalAlerts} emptyText="No critical alerts" />
        </TabsContent>

        <TabsContent value="warning">
          <AlertList list={warningAlerts} emptyText="No warnings" />
        </TabsContent>

        <TabsContent value="info">
          <AlertList list={infoAlerts} emptyText="No info alerts" />
        </TabsContent>

        {/* History Tab View */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-12 text-center">
                <History className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No archived alerts yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Dismissed or marked-as-read notifications will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-slate-400">Archived and past notifications</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Clear History
                </Button>
              </div>

              <div className="space-y-4">
                {history.map((alert) => (
                  <div key={alert.id} className="relative group opacity-80 hover:opacity-100 transition-opacity">
                    <LocalAlertCard {...alert} />
                    <div className="absolute top-4 right-12 flex items-center gap-2">
                      <span className="text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                        {alert.archivedAt}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestore(alert)}
                        className="text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer text-xs h-7 px-2"
                        title="Restore to active alerts"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Alert Configuration Section */}
      <div ref={settingsRef}>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Alert Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  key: "cameraOffline" as const,
                  title: "Camera Offline Notifications",
                  desc: "Get notified when a camera goes offline",
                },
                {
                  key: "trafficSpike" as const,
                  title: "Traffic Spike Alerts",
                  desc: "Alert on abnormal traffic patterns",
                },
                {
                  key: "systemError" as const,
                  title: "System Error Notifications",
                  desc: "Get notified of system errors and issues",
                },
                {
                  key: "emailNotifications" as const,
                  title: "Email Notifications",
                  desc: "Receive alerts via email",
                },
              ].map(({ key, title, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                  <div>
                    <h4 className="text-white font-medium">{title}</h4>
                    <p className="text-sm text-slate-400">{desc}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => toggleSetting(key)}
                    className={
                      settings[key]
                        ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600 cursor-pointer"
                    }
                  >
                    {settings[key] ? "Enabled" : "Disabled"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}