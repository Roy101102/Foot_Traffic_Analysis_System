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
  Cpu,
  LogIn,
  Lock,
  Unlock,
  ArrowRightLeft
} from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

export type ZoneArea = "left-wing" | "right-wing" | "back-annex";

interface SectionConfig {
  id: string;
  section: string;
  camera: string;
  zoneArea: ZoneArea;
}

type TrafficLevel = "High Hotspot" | "Moderate Activity" | "Low Activity";

// MASTER AISLE CAMERA POOL (Camera #1 is reserved exclusively for Zone 1 Main Entrance)
const MASTER_CAMERA_LIST = [
  { id: "Camera #2 (192.168.1.52)", name: "Camera #2 (Hardware)" },
  { id: "Camera #3 (192.168.1.53)", name: "Camera #3 (Household)" },
];

const computeTrafficLevel = (share: number): TrafficLevel => {
  if (share >= 50) return "High Hotspot";
  if (share >= 25) return "Moderate Activity";
  return "Low Activity";
};

const findCameraData = (cameraString: string, camerasList: any[]) => {
  if (!camerasList || camerasList.length === 0) return null;
  const cleanCamStr = cameraString.toLowerCase();

  return camerasList.find((c: any) => {
    const idStr = String(c.id || c.camera_id || "").toLowerCase();
    const nameStr = String(c.name || "").toLowerCase();
    const locStr = String(c.location || c.location_ip || c.ip || "").toLowerCase();
    const combined = `${idStr} ${nameStr} ${locStr}`;

    if (cleanCamStr.includes("192.168.1.51") || cleanCamStr.includes("camera #1") || cleanCamStr.includes("cam_1")) {
      return combined.includes("51") || combined.includes("cam_1") || idStr === "1";
    }
    if (cleanCamStr.includes("192.168.1.52") || cleanCamStr.includes("camera #2") || cleanCamStr.includes("cam_2")) {
      return combined.includes("52") || combined.includes("cam_2") || idStr === "2";
    }
    if (cleanCamStr.includes("192.168.1.53") || cleanCamStr.includes("camera #3") || cleanCamStr.includes("cam_3")) {
      return combined.includes("53") || combined.includes("cam_3") || idStr === "3";
    }
    
    // Fallback: Match by IP address string
    const ipMatch = cleanCamStr.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    if (ipMatch && combined.includes(ipMatch[0])) {
      return true;
    }

    return false;
  });
};

const resolveCameraMetrics = (cameraString: string, camerasList: any[], totalSystemEntries: number) => {
  const matchedCam = findCameraData(cameraString, camerasList);

  let visitorsCount = 
    matchedCam?.entryCount ?? 
    matchedCam?.entry_count ?? 
    matchedCam?.entries ?? 
    matchedCam?.total_entries ?? 
    matchedCam?.visitors ?? 
    matchedCam?.count ?? 
    matchedCam?.liveCount ?? 
    0;

  let dwellTime = matchedCam?.dwellTime || matchedCam?.dwell_time || "2m 15s";

  if (!matchedCam) {
    if (cameraString.includes("192.168.1.51") || cameraString.includes("Camera #1")) {
      visitorsCount = totalSystemEntries;
      dwellTime = "0m 25s";
    } else if (cameraString.includes("192.168.1.52") || cameraString.includes("Camera #2")) {
      visitorsCount = Math.round(totalSystemEntries * 0.58);
      dwellTime = "4m 12s";
    } else if (cameraString.includes("192.168.1.53") || cameraString.includes("Camera #3")) {
      visitorsCount = Math.round(totalSystemEntries * 0.42);
      dwellTime = "3m 05s";
    } else {
      visitorsCount = Math.round(totalSystemEntries * 0.20);
      dwellTime = "2m 45s";
    }
  }

  const isEntrance = cameraString.includes("192.168.1.51") || cameraString.includes("Camera #1") || cameraString.toLowerCase().includes("entrance");
  const sharePercentage = totalSystemEntries > 0 
    ? Math.min(100, Math.round((visitorsCount / totalSystemEntries) * 100)) 
    : 0;
  const level = computeTrafficLevel(sharePercentage);

  return { sharePercentage, dwellTime, level, visitorsCount, isEntrance };
};

const getTrafficBadgeStyle = (level: TrafficLevel, isEntrance: boolean) => {
  if (isEntrance) {
    return { intensityBg: "bg-blue-500/20 text-blue-400 border-blue-500/40", heatBar: "bg-blue-500", tileBg: "bg-blue-500/10 border-blue-500/30" };
  }
  switch (level) {
    case "High Hotspot":
      return { intensityBg: "bg-red-500/20 text-red-400 border-red-500/40", heatBar: "bg-gradient-to-r from-orange-500 to-red-500", tileBg: "bg-red-500/20 border-red-500/40" };
    case "Moderate Activity":
      return { intensityBg: "bg-amber-500/20 text-amber-400 border-amber-500/40", heatBar: "bg-gradient-to-r from-yellow-500 to-amber-500", tileBg: "bg-amber-500/20 border-amber-500/40" };
    case "Low Activity":
    default:
      return { intensityBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", heatBar: "bg-emerald-500", tileBg: "bg-emerald-500/20 border-emerald-500/40" };
  }
};

const getFloorPlanHeatTheme = (level: TrafficLevel, visitorCount: number, isEntrance: boolean) => {
  if (isEntrance) {
    return { bg: "bg-blue-950/40", border: "border-blue-500/60", glow: "none", text: "text-blue-400", accent: "#3b82f6" };
  }
  if (visitorCount === 0) {
    return { bg: "bg-slate-900/60", border: "border-slate-800", glow: "none", text: "text-slate-500", accent: "#475569" };
  }
  switch (level) {
    case "High Hotspot":
      return { bg: "bg-red-950/50", border: "border-red-500/80", glow: "0 0 25px rgba(239, 68, 68, 0.4)", text: "text-red-400", accent: "#ef4444" };
    case "Moderate Activity":
      return { bg: "bg-amber-950/50", border: "border-amber-500/80", glow: "0 0 20px rgba(245, 158, 11, 0.3)", text: "text-amber-400", accent: "#f59e0b" };
    case "Low Activity":
    default:
      return { bg: "bg-emerald-950/50", border: "border-emerald-500/80", glow: "0 0 15px rgba(16, 185, 129, 0.25)", text: "text-emerald-400", accent: "#10b981" };
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

  // Edit Layout & Drag state
  const [isEditLayoutMode, setIsEditLayoutMode] = useState<boolean>(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);

  const totalEntries = liveTraffic?.summary?.total_entries ?? 0;
  const totalExits = liveTraffic?.summary?.total_exits ?? 0;
  const occupancy = liveTraffic?.summary?.current_occupancy ?? 0;

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

  // DYNAMIC CAMERA MAPPING
  const cameras = streamBackendCameras.length > 0
    ? streamBackendCameras.map((sCam: any) => {
        const matchedTraffic = liveTraffic?.cameras?.find(
          (tCam: any) => tCam.id === sCam.id || tCam.ip === sCam.ip || tCam.name === sCam.name
        );

        return {
          ...sCam,
          id: sCam.id || sCam.camera_id,
          name: sCam.name,
          location: sCam.ip,
          isOnline: sCam.isOnline ?? true,
          isStreaming: sCam.isStreaming ?? true,
          entryCount: matchedTraffic?.entries ?? matchedTraffic?.entryCount ?? sCam.entryCount ?? sCam.entry_count ?? 0,
          exitCount: matchedTraffic?.exits ?? matchedTraffic?.exitCount ?? sCam.exitCount ?? sCam.exit_count ?? 0,
          liveCount: matchedTraffic?.detected ?? matchedTraffic?.liveCount ?? sCam.liveCount ?? sCam.live_count ?? 0,
          streamUrl: sCam.streamUrl || `http://127.0.0.1:8001/api/video_feed/${sCam.id || sCam.camera_id}`,
        };
      })
    : liveTraffic?.cameras?.map((cam: any) => ({
        ...cam,
        isOnline: cam.isOnline ?? cam.is_online ?? true,
        isStreaming: cam.isStreaming ?? true,
        entryCount: cam.entryCount ?? cam.entry_count ?? cam.entries ?? cam.total_entries ?? cam.count ?? 0,
        exitCount: cam.exitCount ?? cam.exit_count ?? cam.exits ?? 0,
        liveCount: cam.liveCount ?? cam.live_count ?? cam.occupancy ?? cam.current_occupancy ?? 0,
        streamUrl: cam.streamUrl || `http://127.0.0.1:8001/api/video_feed/${cam.id}`,
      })) ?? [
        { 
          id: "cam_1", 
          name: "Zone 1: Main Entrance & Exit", 
          location: "192.168.1.51", 
          liveCount: occupancy, 
          entryCount: totalEntries, 
          exitCount: totalExits, 
          isOnline: true, 
          isStreaming: true,
          streamUrl: "http://127.0.0.1:8001/api/video_feed/cam_1" 
        },
        { 
          id: "cam_2", 
          name: "Zone 2: Aisle 1 (Hardware)", 
          location: "192.168.1.52", 
          liveCount: Math.round(occupancy * 0.55), 
          entryCount: Math.round(totalEntries * 0.58), 
          exitCount: Math.round(totalExits * 0.50), 
          isOnline: true, 
          isStreaming: true,
          streamUrl: "http://127.0.0.1:8001/api/video_feed/cam_2" 
        },
      ];

  const activeCameraCount = cameras.filter((c: any) => c.isOnline).length;
  const conversionRate = totalEntries > 0 ? parseFloat(((confirmedTransactions / totalEntries) * 100).toFixed(1)) : 0;
  const pendingConversionRate = totalEntries > 0 ? parseFloat(((pendingTransactions / totalEntries) * 100).toFixed(1)) : 0;

  // STORE SECTIONS CONFIGURATION
  const [sections, setSections] = useState<SectionConfig[]>([
    {
      id: "z2",
      section: "Zone 2: Aisle 1 (Hardware & Tools)",
      camera: "Camera #2 (192.168.1.52)",
      zoneArea: "left-wing",
    },
    {
      id: "z3",
      section: "Zone 3: Aisle 2 (Household & Electrical)",
      camera: "Camera #3 (192.168.1.53)",
      zoneArea: "right-wing",
    },
  ]);

  // AUTOMATIC SECTION SYNC: Adds a section entry for any newly connected camera if not present
  useEffect(() => {
    if (cameras.length === 0) return;

    setSections((prev) => {
      const updated = [...prev];
      let changed = false;

      cameras.forEach((cam: any) => {
        // Exclude entrance gate (Zone 1 / 192.168.1.51) as it's the fixed bottom access gateway
        if (cam.ip?.includes("51") || cam.id === "cam_1" || cam.name?.toLowerCase().includes("entrance")) {
          return;
        }

        const exists = updated.some((sec) => findCameraData(sec.camera, [cam]) !== null);

        if (!exists && cam.isOnline) {
          changed = true;
          updated.push({
            id: `sec_${cam.id || Date.now()}`,
            section: cam.name || `Zone: ${cam.ip}`,
            camera: `Camera (${cam.ip})`,
            zoneArea: updated.length % 2 === 0 ? "left-wing" : "right-wing",
          });
        }
      });

      return changed ? updated : prev;
    });
  }, [cameras]);

  // DYNAMIC SECTION FILTERING: Only display sections whose cameras are online
  const activeSections = sections.filter((sec) => {
    const camData = findCameraData(sec.camera, cameras);
    return camData ? camData.isOnline : false;
  });

  const [isAddSectionOpen, setIsAddSectionOpen] = useState<boolean>(false);
  const [newSectionName, setNewSectionName] = useState<string>("");
  const [newSectionCamera, setNewSectionCamera] = useState<string>("");
  const [sectionToDelete, setSectionToDelete] = useState<SectionConfig | null>(null);

  // FILTER UNUSED AISLE CAMERAS ONLY
  const availableCameras = MASTER_CAMERA_LIST.filter(
    (cam) => !sections.some((sec) => sec.camera === cam.id)
  );

  useEffect(() => {
    if (isAddSectionOpen) {
      if (availableCameras.length > 0) {
        if (!availableCameras.some((c) => c.id === newSectionCamera)) {
          setNewSectionCamera(availableCameras[0].id);
        }
      } else {
        setNewSectionCamera("");
      }
    }
  }, [isAddSectionOpen, sections]);

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim() || !newSectionCamera) return;

    const newSec: SectionConfig = {
      id: `z_${Date.now()}`,
      section: newSectionName.trim(),
      camera: newSectionCamera,
      zoneArea: "left-wing",
    };

    setSections((prev) => [...prev, newSec]);
    setNewSectionName("");
    setIsAddSectionOpen(false);
  };

  const handleConfirmDelete = () => {
    if (sectionToDelete) {
      setSections((prev) => prev.filter((s) => s.id !== sectionToDelete.id));
      setSectionToDelete(null);
    }
  };

  // DRAG & DROP WING RE-ASSIGNMENT
  const handleDragStart = (id: string) => {
    if (!isEditLayoutMode) return;
    setDraggedSectionId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditLayoutMode) return;
    e.preventDefault();
  };

  const handleDropOnZone = (targetArea: ZoneArea) => {
    if (!isEditLayoutMode || !draggedSectionId) return;

    setSections((prev) =>
      prev.map((sec) =>
        sec.id === draggedSectionId ? { ...sec, zoneArea: targetArea } : sec
      )
    );

    setDraggedSectionId(null);
  };

  const previewMetrics = resolveCameraMetrics(newSectionCamera, cameras, totalEntries);

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
    cumulativeOccupancy += (item.entries - item.exits);
    return {
      time: `${item.hour.toString().padStart(2, "0")}:00`,
      visitors: item.entries,
      occupancy: Math.max(0, cumulativeOccupancy)
    };
  });

  // DYNAMIC CONVERSION RATE TREND
  const dynamicConversionTrendData = hourlyTrends.length > 0
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
                  {resolveCameraMetrics(sectionToDelete.camera, cameras, totalEntries).sharePercentage}%
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
                <label className="block text-slate-300 font-medium mb-1">Assigned IP Camera Stream (Unused Only)</label>
                {availableCameras.length > 0 ? (
                  <select
                    value={newSectionCamera}
                    onChange={(e) => setNewSectionCamera(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {availableCameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>
                        {cam.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 font-medium text-xs">
                    ⚠️ All available aisle camera streams are currently assigned. Delete an existing section or mount a new IP camera.
                  </div>
                )}
              </div>

              {availableCameras.length > 0 && newSectionCamera && (
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

      {/* CHARTS ROW 2: CONVERSION RATE TREND & HEATMAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrafficChart title="Conversion Rate Trend" data={dynamicConversionTrendData} type="bar" dataKeys={[{ key: "rate", color: "#8b5cf6", name: "Conversion %" }]} />
        <HeatmapChart title="Peak Traffic Heatmap" data={dynamicHeatmapData} />
      </div>

      {/* COLLISION-FREE MULTI-ZONE STORE BLUEPRINT */}
      <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
              <h2 className="text-xl font-bold text-white">Interactive Collision-Free Floor Plan</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Drag aisle blocks to reassign them across active floor plan wings ({activeSections.length} Active Heat Zones)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditLayoutMode(!isEditLayoutMode)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all border ${
                isEditLayoutMode
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              {isEditLayoutMode ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-slate-400" />}
              {isEditLayoutMode ? "Done Adjusting" : "Adjust Layout"}
            </button>

            <button
              onClick={() => setIsAddSectionOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
        </div>

        {/* 2D ARCHITECTURAL CANVAS SCHEMATIC WITH MATCHED SIDEBAR HEIGHT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          <div className={`lg:col-span-2 bg-slate-950 p-5 rounded-2xl border transition-all min-h-[580px] flex flex-col justify-between relative overflow-hidden ${
            isEditLayoutMode ? "border-amber-500/60 ring-2 ring-amber-500/20" : "border-slate-800"
          }`}>
            {/* Grid Pattern */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle, ${isEditLayoutMode ? '#f59e0b' : '#3b82f6'} 1px, transparent 1px)`,
                backgroundSize: '24px 24px'
              }}
            />

            {/* Schematic Header Legend */}
            <div className="flex items-center justify-between relative z-10 mb-4 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="font-bold uppercase tracking-wider text-white">MR. DIY Spatial Floor Blueprint</span>
                {isEditLayoutMode && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded font-bold border border-amber-500/30 animate-pulse flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3" /> DRAG BLOCKS BETWEEN WINGS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Low</span>
                <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Moderate</span>
                <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> High</span>
              </div>
            </div>

            {/* COLLISION-FREE ZONED SCHEMATIC CANVAS */}
            <div className="relative z-10 grid grid-cols-12 gap-3 h-full my-auto">
              
              {/* LEFT WING DROP ZONE */}
              <div 
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnZone("left-wing")}
                className={`col-span-5 p-3 rounded-xl border-2 transition-all space-y-3 min-h-[380px] ${
                  isEditLayoutMode ? "border-amber-500/40 bg-amber-500/5 border-dashed" : "border-slate-800/80 bg-slate-900/20"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="font-bold uppercase text-slate-300">LEFT WING AISLES</span>
                  <span className="text-slate-500">
                    {activeSections.filter(s => s.zoneArea === "left-wing").length} Sections
                  </span>
                </div>

                {activeSections
                  .filter((sec) => sec.zoneArea === "left-wing" || (!sec.zoneArea && sec.camera.includes("192.168.1.52")))
                  .map((sec) => {
                    const metrics = resolveCameraMetrics(sec.camera, cameras, totalEntries);
                    const theme = getFloorPlanHeatTheme(metrics.level, metrics.visitorsCount, false);

                    return (
                      <div
                        key={`left_${sec.id}`}
                        draggable={isEditLayoutMode}
                        onDragStart={() => handleDragStart(sec.id)}
                        style={{ boxShadow: theme.glow }}
                        className={`p-3.5 rounded-xl border-2 transition-all duration-300 flex flex-col justify-between ${theme.bg} ${theme.border} relative overflow-hidden group ${
                          isEditLayoutMode ? "cursor-grab active:cursor-grabbing hover:scale-[1.02]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between relative z-10">
                          <div>
                            <h4 className="text-xs font-bold text-white">{sec.section}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">{sec.camera.split(" ")[0]}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${theme.text} bg-slate-900/80 border border-slate-700/80`}>
                            {metrics.visitorsCount} Visitors
                          </span>
                        </div>

                        <div className="my-2 space-y-1 opacity-60">
                          <div className="h-1.5 w-full bg-slate-700 rounded-full border border-slate-600" />
                          <div className="h-1.5 w-full bg-slate-700 rounded-full border border-slate-600" />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono relative z-10 pt-1 border-t border-slate-800/60">
                          <span className="text-slate-400">Share: <strong className="text-white">{metrics.sharePercentage}%</strong></span>
                          <span className={theme.text}>{metrics.level}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* MAIN WALKWAY (STATIC NON-DROPPABLE CORRIDOR) */}
              <div className="col-span-2 p-2 rounded-xl border-2 border-slate-800/80 bg-slate-900/10 flex flex-col items-center justify-center text-center min-h-[380px] relative overflow-hidden select-none">
                <div className="absolute inset-y-0 w-px border-r border-dashed border-slate-800/80 left-1/2 -translate-x-1/2 pointer-events-none" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest -rotate-90 whitespace-nowrap font-bold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 inline-block animate-pulse" />
                  Main Walkway Transit Corridor
                </span>
              </div>

              {/* RIGHT WING & BACK ANNEX DROP ZONE */}
              <div 
                onDragOver={handleDragOver}
                onDrop={() => handleDropOnZone("right-wing")}
                className={`col-span-5 p-3 rounded-xl border-2 transition-all space-y-3 min-h-[380px] ${
                  isEditLayoutMode ? "border-amber-500/40 bg-amber-500/5 border-dashed" : "border-slate-800/80 bg-slate-900/20"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="font-bold uppercase text-slate-300">RIGHT WING AISLES</span>
                  <span className="text-slate-500">
                    {activeSections.filter(s => s.zoneArea === "right-wing" || s.zoneArea === "back-annex").length} Sections
                  </span>
                </div>

                {activeSections
                  .filter((sec) => sec.zoneArea === "right-wing" || sec.zoneArea === "back-annex" || (!sec.zoneArea && sec.camera.includes("192.168.1.53")))
                  .map((sec) => {
                    const metrics = resolveCameraMetrics(sec.camera, cameras, totalEntries);
                    const theme = getFloorPlanHeatTheme(metrics.level, metrics.visitorsCount, false);

                    return (
                      <div
                        key={`right_${sec.id}`}
                        draggable={isEditLayoutMode}
                        onDragStart={() => handleDragStart(sec.id)}
                        style={{ boxShadow: theme.glow }}
                        className={`p-3.5 rounded-xl border-2 transition-all duration-300 flex flex-col justify-between ${theme.bg} ${theme.border} relative overflow-hidden group ${
                          isEditLayoutMode ? "cursor-grab active:cursor-grabbing hover:scale-[1.02]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between relative z-10">
                          <div>
                            <h4 className="text-xs font-bold text-white">{sec.section}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">{sec.camera.split(" ")[0]}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${theme.text} bg-slate-900/80 border border-slate-700/80`}>
                            {metrics.visitorsCount} Visitors
                          </span>
                        </div>

                        <div className="my-2 space-y-1 opacity-60">
                          <div className="h-1.5 w-full bg-slate-700 rounded-full border border-slate-600" />
                          <div className="h-1.5 w-full bg-slate-700 rounded-full border border-slate-600" />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono relative z-10 pt-1 border-t border-slate-800/60">
                          <span className="text-slate-400">Share: <strong className="text-white">{metrics.sharePercentage}%</strong></span>
                          <span className={theme.text}>{metrics.level}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Bottom Row: Main Entrance / Exit Gate & POS Checkout */}
              {(() => {
                const z1Sec = sections.find(s => s.camera.includes("192.168.1.51") || s.camera.includes("Camera #1"));
                const metrics = resolveCameraMetrics(z1Sec?.camera || "Camera #1", cameras, totalEntries);

                return (
                  <div className="col-span-12 mt-2 p-3.5 rounded-xl border-2 border-slate-800 bg-slate-900/50 flex items-center justify-between relative overflow-hidden">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs">
                        <LogIn className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{z1Sec?.section || "Zone 1: Main Entrance Gate"}</h4>
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-mono">
                            Access Gateway
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Total Entered: <span className="text-blue-400 font-bold">{metrics.visitorsCount}</span> | Current In-Store: <span className="text-emerald-400 font-bold">{occupancy}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-300">POS Registers Active</span>
                    </div>
                  </div>
                );
              })()}

            </div>

            <p className="text-[10px] text-slate-500 text-center mt-3 font-mono relative z-10">
              * Sections automatically auto-arrange inside dedicated floor zones to ensure zero card overlap or text collision.
            </p>
          </div>

          {/* SIDEBAR SECTION LIST FULLY MATCHED TO CANVAS HEIGHT */}
          <div className="lg:col-span-1 flex flex-col h-full">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col h-full min-h-0">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                <span>Active Store Zones</span>
                <span className="text-blue-400">{activeSections.length} Zones</span>
              </h3>

              {/* DYNAMIC FULL HEIGHT LIST */}
              <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar pt-2">
                {activeSections.map((sec) => {
                  const metrics = resolveCameraMetrics(sec.camera, cameras, totalEntries);
                  const styles = getTrafficBadgeStyle(metrics.level, metrics.isEntrance);

                  return (
                    <div 
                      key={sec.id} 
                      className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/80 space-y-2.5 hover:border-slate-700 transition-colors relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-white">{sec.section}</h4>
                          <p className="text-[10px] text-slate-400 font-mono">{sec.camera}</p>
                        </div>

                        <button
                          onClick={() => setSectionToDelete(sec)}
                          title="Delete Section"
                          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                        <span className="text-slate-300 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <strong className="text-white">{metrics.visitorsCount}</strong> detected
                        </span>
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {metrics.dwellTime}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-mono pt-1.5 border-t border-slate-800">
                        <span className={`px-2 py-0.5 rounded border ${styles.intensityBg}`}>
                          {metrics.level}
                        </span>
                        <span className="font-bold text-slate-300">{metrics.sharePercentage}% Aisle Share</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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