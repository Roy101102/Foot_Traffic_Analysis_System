import React, { useState, useEffect, useMemo, useRef } from "react";
import { KPICard } from "../components/KPICard";
import { TrafficChart } from "../components/TrafficChart";
import { HeatmapChart } from "../components/HeatmapChart";
import { CameraCard } from "../components/CameraCard";
import { ConversionCard } from "../components/ConversionCard";
import { StoreHeatmap } from "../components/StoreHeatmap";
import {
  Users,
  ShoppingBag,
  Percent,
  Eye,
  Camera,
  Save,
  Flame,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  Cpu,
  LogIn,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

interface SectionConfig {
  id: string;
  section: string;
  cameraId: string; // matches the camera "id" returned by the streaming server (cam_2, cam_3, ...)
}

type TrafficLevel = "High Hotspot" | "Moderate Activity" | "Low Activity";

// Live people thresholds per zone (tune these to your store size)
const HIGH_PEOPLE = 6;
const MODERATE_PEOPLE = 3;

const computeTrafficLevel = (peopleNow: number): TrafficLevel => {
  if (peopleNow >= HIGH_PEOPLE) return "High Hotspot";
  if (peopleNow >= MODERATE_PEOPLE) return "Moderate Activity";
  return "Low Activity";
};

// Camera #1 (192.168.1.51) is the entrance gate, not an aisle zone
const isEntranceCam = (cam: any) =>
  cam?.id === "cam_1" ||
  String(cam?.ip || "").trim() === "192.168.1.51" ||
  String(cam?.name || "").toLowerCase().includes("entrance");

const getTrafficBadgeStyle = (level: TrafficLevel) => {
  switch (level) {
    case "High Hotspot":
      return "bg-red-500/20 text-red-400 border-red-500/40";
    case "Moderate Activity":
      return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    case "Low Activity":
    default:
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  }
};

export default function DashboardPage() {
  const { updateData, liveTraffic } = useDashboard();

  const [transactionsInput, setTransactionsInput] = useState<string>("0");
  const [salesInput, setSalesInput] = useState<string>("0");
  const [confirmedTransactions, setConfirmedTransactions] = useState<number>(0);
  const [confirmedSales, setConfirmedSales] = useState<number>(0);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [pendingTransactions, setPendingTransactions] = useState<number>(0);
  const [pendingSales, setPendingSales] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Heatmap demo toggle (simulated people, useful when cameras aren't available)
  const [heatmapDemo, setHeatmapDemo] = useState<boolean>(false);

  // Expanded camera state for the Camera Monitoring section
  const [expandedCameraId, setExpandedCameraId] = useState<string | null>(null);
  const cameraSectionRef = useRef<HTMLDivElement | null>(null);

  const totalEntries = liveTraffic?.summary?.total_entries ?? 0;
  const totalExits = liveTraffic?.summary?.total_exits ?? 0;
  const occupancy = liveTraffic?.summary?.current_occupancy ?? 0;

  // Allow pressing Escape to collapse the expanded camera feed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpandedCameraId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // FETCH REAL-TIME CAMERA STREAMS DIRECTLY FROM STREAMING SERVER (PORT 8001)
  const [streamBackendCameras, setStreamBackendCameras] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchBackendCameras = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8001/api/cameras");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setStreamBackendCameras(data);
          }
        }
      } catch (err) {
        console.warn("Could not fetch cameras from Port 8001 backend", err);
      }
    };

    fetchBackendCameras();
    const interval = setInterval(fetchBackendCameras, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // DYNAMIC CAMERA MAPPING (memoized so effects depending on it don't re-run every render)
  const cameras = useMemo(() => {
    if (streamBackendCameras.length > 0) {
      return streamBackendCameras.map((sCam: any) => {
        const camId = sCam.id || sCam.camera_id;
        const matchedTraffic = liveTraffic?.cameras?.find(
          (tCam: any) => tCam.id === camId || tCam.ip === sCam.ip || tCam.name === sCam.name
        );

        return {
          ...sCam,
          id: camId,
          name: sCam.name,
          location: sCam.ip,
          isOnline: sCam.isOnline ?? true,
          isStreaming: sCam.isStreaming ?? true,
          entryCount: matchedTraffic?.entries ?? matchedTraffic?.entryCount ?? sCam.entryCount ?? sCam.entry_count ?? 0,
          exitCount: matchedTraffic?.exits ?? matchedTraffic?.exitCount ?? sCam.exitCount ?? sCam.exit_count ?? 0,
          liveCount: sCam.peopleDetected ?? sCam.liveCount ?? sCam.live_count ?? 0,
          peopleNow: sCam.peopleDetected ?? 0, // people currently visible (from the heatmap tracker)
          streamUrl: sCam.streamUrl || `http://127.0.0.1:8001/api/video_feed/${camId}`,
        };
      });
    }

    // Streaming server unreachable: fall back to what the stats API (port 8000) reports.
    return (
      liveTraffic?.cameras?.map((cam: any) => ({
        ...cam,
        isOnline: cam.isOnline ?? cam.is_online ?? false,
        isStreaming: cam.isStreaming ?? false,
        entryCount: cam.entryCount ?? cam.entry_count ?? cam.entries ?? 0,
        exitCount: cam.exitCount ?? cam.exit_count ?? cam.exits ?? 0,
        liveCount: cam.liveCount ?? cam.live_count ?? 0,
        peopleNow: 0,
        streamUrl: cam.streamUrl || `http://127.0.0.1:8001/api/video_feed/${cam.id}`,
      })) ?? []
    );
  }, [streamBackendCameras, liveTraffic?.cameras]);

  const activeCameraCount = cameras.filter((c: any) => c.isOnline).length;
  const conversionRate = totalEntries > 0 ? parseFloat(((confirmedTransactions / totalEntries) * 100).toFixed(1)) : 0;
  const pendingConversionRate = totalEntries > 0 ? parseFloat(((pendingTransactions / totalEntries) * 100).toFixed(1)) : 0;

  // STORE ZONES (one per aisle camera)
  const [sections, setSections] = useState<SectionConfig[]>([
    { id: "z2", section: "Zone 2: Aisle 1 (Hardware & Tools)", cameraId: "cam_2" },
    { id: "z3", section: "Zone 3: Aisle 2 (Household & Electrical)", cameraId: "cam_3" },
  ]);

  // Cameras whose zone the user deleted; the auto-sync must not re-create them
  const [dismissedCameraIds, setDismissedCameraIds] = useState<string[]>([]);

  // AUTOMATIC SECTION SYNC: adds a zone for any newly connected aisle camera
  useEffect(() => {
    if (cameras.length === 0) return;

    setSections((prev) => {
      const updated = [...prev];
      let changed = false;

      cameras.forEach((cam: any) => {
        if (isEntranceCam(cam)) return;
        if (dismissedCameraIds.includes(cam.id)) return;

        const exists = updated.some((sec) => sec.cameraId === cam.id);
        if (!exists && cam.isOnline) {
          changed = true;
          updated.push({
            id: `sec_${cam.id}`,
            section: cam.name || `Zone: ${cam.ip}`,
            cameraId: cam.id,
          });
        }
      });

      return changed ? updated : prev;
    });
  }, [cameras, dismissedCameraIds]);

  // Resolve the zone label assigned to a given camera
  const getCameraZoneLabel = (cam: any) => {
    if (isEntranceCam(cam)) return "Zone 1: Main Entrance Gate";
    const matchedSection = sections.find((sec) => sec.cameraId === cam.id);
    return matchedSection ? matchedSection.section : cam.name || cam.id;
  };

  // Expand a zone's live camera feed and optionally scroll to the monitoring section
  const handleSelectZoneCamera = (cameraId: string, shouldScroll = false) => {
    setExpandedCameraId((prev) => (shouldScroll ? cameraId : prev === cameraId ? null : cameraId));
    if (shouldScroll && cameraSectionRef.current) {
      cameraSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const expandedCamera = useMemo(
    () => cameras.find((cam: any) => (cam.id || cam.name) === expandedCameraId) ?? null,
    [cameras, expandedCameraId]
  );

  const entranceCamera = useMemo(
    () => cameras.find((cam: any) => isEntranceCam(cam)) ?? null,
    [cameras]
  );

  // Only show zones whose camera is online
  const activeSections = sections.filter((sec) => {
    const cam = cameras.find((c: any) => c.id === sec.cameraId);
    return cam ? cam.isOnline : false;
  });

  // Total people currently visible across all aisle zones (for the "share" percentage)
  const aislePeopleTotal = activeSections.reduce((sum, sec) => {
    const cam = cameras.find((c: any) => c.id === sec.cameraId);
    return sum + (cam?.peopleNow ?? 0);
  }, 0);

  const getZoneMetrics = (cameraId: string) => {
    const cam = cameras.find((c: any) => c.id === cameraId);
    const peopleNow = cam?.peopleNow ?? 0;
    const share = aislePeopleTotal > 0 ? Math.round((peopleNow / aislePeopleTotal) * 100) : 0;
    const level = computeTrafficLevel(peopleNow);
    return { peopleNow, share, level, cam };
  };

  const [isAddSectionOpen, setIsAddSectionOpen] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>("");
  const [newSectionCamera, setNewSectionCamera] = useState<string>("");
  const [sectionToDelete, setSectionToDelete] = useState<SectionConfig | null>(null);

  // Aisle cameras that don't have a zone yet (built from the real camera list)
  const availableCameras = cameras.filter(
    (cam: any) => !isEntranceCam(cam) && !sections.some((sec) => sec.cameraId === cam.id)
  );

  useEffect(() => {
    if (isAddSectionOpen) {
      if (availableCameras.length > 0) {
        if (!availableCameras.some((c: any) => c.id === newSectionCamera)) {
          setNewSectionCamera(availableCameras[0].id);
        }
      } else {
        setNewSectionCamera("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddSectionOpen, sections, cameras]);

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim() || !newSectionCamera) return;

    setSections((prev) => [
      ...prev,
      { id: `z_${Date.now()}`, section: newSectionName.trim(), cameraId: newSectionCamera },
    ]);
    setDismissedCameraIds((prev) => prev.filter((id) => id !== newSectionCamera));
    setNewSectionName("");
    setIsAddSectionOpen(false);
  };

  const handleConfirmDelete = () => {
    if (sectionToDelete) {
      setSections((prev) => prev.filter((s) => s.id !== sectionToDelete.id));
      setDismissedCameraIds((prev) =>
        prev.includes(sectionToDelete.cameraId) ? prev : [...prev, sectionToDelete.cameraId]
      );
      setSectionToDelete(null);
    }
  };

  const previewMetrics = newSectionCamera ? getZoneMetrics(newSectionCamera) : null;

  useEffect(() => {
    const avgSpend = confirmedTransactions > 0 ? parseFloat((confirmedSales / confirmedTransactions).toFixed(2)) : 0;
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
        sales: hrsCustomers * avgSpend,
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
        { time: "Sun", visitors: totalEntries, customers: confirmedTransactions, sales: totalSales },
      ],
    });
  }, [totalEntries, confirmedTransactions, confirmedSales, conversionRate, liveTraffic?.hourly_trends, updateData]);

  const hourlyTrends = liveTraffic?.hourly_trends ?? [];

  // DYNAMIC ENTRY VS EXIT DATA
  const dynamicEntryExitData = hourlyTrends.map((item) => ({
    time: `${item.hour.toString().padStart(2, "0")}:00`,
    entry: item.entries,
    exit: item.exits,
  }));

  // DYNAMIC HOURLY FOOT TRAFFIC & OCCUPANCY
  let cumulativeOccupancy = 0;
  const dynamicHourlyData = hourlyTrends.map((item) => {
    cumulativeOccupancy += item.entries - item.exits;
    return {
      time: `${item.hour.toString().padStart(2, "0")}:00`,
      visitors: item.entries,
      occupancy: Math.max(0, cumulativeOccupancy),
    };
  });

  // DYNAMIC CONVERSION RATE TREND
  const dynamicConversionTrendData =
    hourlyTrends.length > 0
      ? hourlyTrends.map((item) => {
          const hrsVisitors = item.entries;
          const hrsCustomers = item.customers ?? Math.round(item.entries * (conversionRate / 100));
          const hrsRate = hrsVisitors > 0 ? parseFloat(((hrsCustomers / hrsVisitors) * 100).toFixed(1)) : 0;
          return {
            time: `${item.hour.toString().padStart(2, "0")}:00`,
            rate: hrsRate,
          };
        })
      : [
          { time: "08:00", rate: conversionRate > 0 ? Math.max(0, parseFloat((conversionRate * 0.85).toFixed(1))) : 0 },
          { time: "10:00", rate: conversionRate > 0 ? Math.max(0, parseFloat((conversionRate * 0.95).toFixed(1))) : 0 },
          { time: "12:00", rate: conversionRate },
          { time: "14:00", rate: conversionRate > 0 ? Math.max(0, parseFloat((conversionRate * 1.08).toFixed(1))) : 0 },
          { time: "16:00", rate: conversionRate > 0 ? Math.max(0, parseFloat((conversionRate * 0.92).toFixed(1))) : 0 },
          { time: "18:00", rate: conversionRate },
        ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayName = daysOfWeek[new Date().getDay()];
  const heatmapHours = [8, 10, 12, 14, 16, 18, 20];
  const daysConfig = [
    { name: "Mon", offset: -15 }, { name: "Tue", offset: -5 }, { name: "Wed", offset: -10 },
    { name: "Thu", offset: 0 }, { name: "Fri", offset: 25 }, { name: "Sat", offset: 50 }, { name: "Sun", offset: 35 },
  ];

  const dynamicHeatmapData = daysConfig.map((day) => {
    const isToday = day.name === todayName;
    const sourceTrends = isToday ? hourlyTrends : [];

    return {
      day: day.name,
      hours: heatmapHours.map((hour) => {
        const firstHourEntries = sourceTrends.find((item) => item.hour === hour)?.entries ?? 0;
        const secondHourEntries = sourceTrends.find((item) => item.hour === hour + 1)?.entries ?? 0;
        return {
          hour: `${hour.toString().padStart(2, "0")}:00`,
          value: firstHourEntries + secondHourEntries,
        };
      }),
    };
  });

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
                  ₱{pendingSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              Are you sure you want to remove <strong className="text-white">{sectionToDelete.section}</strong> from the dashboard? The camera keeps running, but this zone will no longer be listed.
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono text-slate-400">
              <div className="flex justify-between">
                <span>Assigned Feed:</span>
                <span className="text-slate-200">{sectionToDelete.cameraId}</span>
              </div>
              <div className="flex justify-between">
                <span>People Detected Now:</span>
                <span className="text-slate-200">{getZoneMetrics(sectionToDelete.cameraId).peopleNow}</span>
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
                <label className="block text-slate-300 font-medium mb-1">Assigned IP Camera Stream (Unused Only)</label>
                {availableCameras.length > 0 ? (
                  <select
                    value={newSectionCamera}
                    onChange={(e) => setNewSectionCamera(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {availableCameras.map((cam: any) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name} {cam.ip ? `(${cam.ip})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-xs">
                    ⚠️ All available aisle camera streams are currently assigned. Delete an existing section or mount a new IP camera.
                  </div>
                )}
              </div>

              {availableCameras.length > 0 && previewMetrics && (
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold text-[11px] uppercase tracking-wider">
                    <Cpu className="w-4 h-4 animate-spin text-blue-400" />
                    <span>Automated Vision Telemetry</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">People Detected Now:</span>
                      <span className="text-blue-400 font-bold">{previewMetrics.peopleNow}</span>
                    </div>

                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Activity Level:</span>
                      <span className="text-emerald-400 font-bold">{previewMetrics.level}</span>
                    </div>
                  </div>
                </div>
              )}

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
                  disabled={availableCameras.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-medium transition-all"
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
                Total Sales (₱):
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
        <KPICard title="Total Visitors Today" value={totalEntries.toLocaleString()} icon={Users} trend={{ value: 14.2, isPositive: true }} status="info" />
        <KPICard title="Total Transactions" value={confirmedTransactions.toLocaleString()} icon={ShoppingBag} trend={{ value: 5.1, isPositive: true }} status="success" />
        <KPICard title="Conversion Rate" value={`${conversionRate}%`} icon={Percent} trend={{ value: 0.8, isPositive: true }} status="warning" />
        <KPICard title="Live Occupancy" value={occupancy} icon={Eye} status="info" />
        <KPICard title="Active Cameras" value={`${activeCameraCount}/${cameras.length}`} icon={Camera} status={activeCameraCount > 0 ? "success" : "warning"} />
      </div>

      <ConversionCard visitors={totalEntries} customers={confirmedTransactions} conversionRate={conversionRate} />

      {/* CHARTS ROW 1: FOOT TRAFFIC & ENTRY VS EXIT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficChart title="Hourly Foot Traffic & Occupancy" data={dynamicHourlyData} type="line" dataKeys={[{ key: "visitors", color: "#3b82f6", name: "New Visitors" }, { key: "occupancy", color: "#10b981", name: "In-Store Occupancy" }]} />
        <TrafficChart title="Entry vs Exit Counts" data={dynamicEntryExitData} type="bar" dataKeys={[{ key: "entry", color: "#10b981", name: "Entry" }, { key: "exit", color: "#f59e0b", name: "Exit" }]} />
      </div>

      {/* CHARTS ROW 2: CONVERSION RATE TREND & PEAK-HOUR HEATMAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficChart title="Conversion Rate Trend" data={dynamicConversionTrendData} type="bar" dataKeys={[{ key: "rate", color: "#8b5cf6", name: "Conversion %" }]} />
        <HeatmapChart title="Peak Traffic Heatmap" data={dynamicHeatmapData} />
      </div>

      {/* LIVE IN-STORE HEATMAP (camera-based, positions of people on the floor plan) */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
              <h2 className="text-xl font-bold text-white">Live In-Store Heatmap</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Built from where the cameras detect customers standing and walking ({activeSections.length} active aisle zones)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={heatmapDemo}
                onChange={(e) => setHeatmapDemo(e.target.checked)}
                className="accent-blue-500"
              />
              Demo simulation
            </label>
            <button
              onClick={() => setIsAddSectionOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* THE HEATMAP */}
          <div className="lg:col-span-2">
            <StoreHeatmap demoMode={heatmapDemo} />
          </div>

          {/* ACTIVE ZONES SIDEBAR */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <span>Active Store Zones</span>
                <span className="text-blue-400">{activeSections.length} Zones</span>
              </h3>

              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1 pt-2">
                {activeSections.length === 0 && (
                  <p className="text-[11px] text-slate-500 font-mono py-4 text-center">
                    No aisle cameras online yet.
                  </p>
                )}

                {activeSections.map((sec) => {
                  const metrics = getZoneMetrics(sec.cameraId);
                  const badge = getTrafficBadgeStyle(metrics.level);
                  const isSelected = expandedCameraId === sec.cameraId;

                  return (
                    <div
                      key={sec.id}
                      onClick={() => handleSelectZoneCamera(sec.cameraId, true)}
                      title="Click to expand live camera feed"
                      className={`bg-slate-900/80 p-3.5 rounded-xl border space-y-2.5 transition-all relative cursor-pointer ${
                        isSelected
                          ? "border-blue-500 ring-1 ring-blue-500/40 bg-slate-900"
                          : "border-slate-800/80 hover:border-blue-500/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{sec.section}</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {metrics.cam?.name ? `${sec.cameraId} · ${metrics.cam.ip ?? ""}` : sec.cameraId}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 hover:text-blue-400 p-1">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionToDelete(sec);
                            }}
                            title="Delete Section"
                            className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                        <span className="text-slate-300 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <strong className="text-white">{metrics.peopleNow}</strong> in view now
                        </span>
                        <span className="text-[10px] text-blue-400">Expand feed →</span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono pt-1.5 border-t border-slate-800">
                        <span className={`px-2 py-0.5 rounded border ${badge}`}>{metrics.level}</span>
                        <span className="font-bold text-slate-300">{metrics.share}% of aisle traffic</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ENTRANCE GATE SUMMARY */}
            <div
              onClick={() => entranceCamera && handleSelectZoneCamera(entranceCamera.id, true)}
              title={entranceCamera ? "Click to expand entrance live camera feed" : undefined}
              className={`bg-slate-950 p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                entranceCamera ? "cursor-pointer hover:border-blue-500/50" : ""
              } ${
                entranceCamera && expandedCameraId === entranceCamera.id
                  ? "border-blue-500 ring-1 ring-blue-500/40"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Zone 1: Main Entrance Gate</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Entered: <span className="text-blue-400 font-bold">{totalEntries}</span> | In-store:{" "}
                    <span className="text-emerald-400 font-bold">{occupancy}</span>
                  </p>
                </div>
              </div>
              {entranceCamera && <Maximize2 className="w-4 h-4 text-slate-400 shrink-0" />}
            </div>
          </div>
        </div>
      </div>

      {/* LIVE CAMERA MONITORING SECTION */}
      <div
        ref={cameraSectionRef}
        className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4 scroll-mt-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Camera className="w-6 h-6 text-blue-400" /> Camera Monitoring
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Click any zone below to expand its live video feed
            </p>
          </div>
          <div className="flex items-center gap-2">
            {expandedCamera && (
              <button
                onClick={() => setExpandedCameraId(null)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <Minimize2 className="w-3.5 h-3.5" /> Collapse Expanded View
              </button>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeCameraCount} / {cameras.length} Feeds Online
            </span>
          </div>
        </div>

        {/* EXPANDED SPOTLIGHT VIEW FOR SELECTED ZONE */}
        {expandedCamera && (
          <div className="bg-slate-950 rounded-2xl border-2 border-blue-500/60 overflow-hidden shadow-2xl shadow-blue-950/30 transition-all">
            {/* Expanded Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      expandedCamera.isOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                    }`}
                  />
                  {getCameraZoneLabel(expandedCamera)}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {expandedCamera.name}
                  {expandedCamera.ip ? ` · ${expandedCamera.ip}` : ""}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-300">
                    In View: <strong className="text-blue-400">{expandedCamera.peopleNow ?? expandedCamera.liveCount ?? 0}</strong>
                  </span>
                  {isEntranceCam(expandedCamera) && (
                    <>
                      <span className="text-slate-300">
                        Entries: <strong className="text-emerald-400">{expandedCamera.entryCount ?? totalEntries}</strong>
                      </span>
                      <span className="text-slate-300">
                        Exits: <strong className="text-amber-400">{expandedCamera.exitCount ?? totalExits}</strong>
                      </span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setExpandedCameraId(null)}
                  title="Collapse Live Feed (Esc)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Collapse</span>
                </button>
              </div>
            </div>

            {/* Expanded Live Video Feed */}
            <div className="relative w-full bg-black flex items-center justify-center aspect-video max-h-[540px]">
              {expandedCamera.isOnline ? (
                <img
                  src={expandedCamera.streamUrl}
                  alt={`${getCameraZoneLabel(expandedCamera)} Live Feed`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 py-16 gap-2">
                  <Camera className="w-10 h-10 opacity-40" />
                  <p className="text-sm font-medium">Camera feed is currently offline</p>
                </div>
              )}

              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded bg-black/75 backdrop-blur-sm border border-slate-700/80 text-[11px] font-mono text-slate-300">
                LIVE YOLOv8 STREAM · Press <kbd className="text-white font-semibold">ESC</kbd> to collapse
              </div>
            </div>
          </div>
        )}

        {/* Camera Live Stream Grid (excludes the currently expanded camera so only 1 MJPEG connection runs per feed) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cameras
            .filter((camera: any) => (camera.id || camera.name) !== expandedCameraId)
            .map((camera: any) => {
              const camKey = camera.id || camera.name;
              const zoneLabel = getCameraZoneLabel(camera);

              return (
                <div
                  key={camKey}
                  onClick={() => handleSelectZoneCamera(camKey, false)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectZoneCamera(camKey, false);
                    }
                  }}
                  title={`Click to expand ${zoneLabel}`}
                  className="group relative rounded-xl border border-slate-800 hover:border-blue-500/70 bg-slate-950/60 overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-950/30"
                >
                  {/* Zone Header Bar */}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-900/90 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                      {zoneLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 shrink-0">
                      <Maximize2 className="w-3.5 h-3.5" /> Expand
                    </span>
                  </div>

                  {/* Existing CameraCard */}
                  <CameraCard {...camera} />
                </div>
              );
            })}
        </div>
      </div>

    </div>
  );
}   