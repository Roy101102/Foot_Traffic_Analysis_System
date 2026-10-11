import { useState, useEffect } from "react";
import { CameraCard } from "../components/CameraCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Plus, Filter, Video, X, Layers, Sliders } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useDashboard } from "../context/DashboardContext";

interface CameraItem {
  id: string;
  name: string;
  location: string;
  liveCount: number;
  entryCount: number;
  exitCount: number;
  isOnline: boolean;
  isStreaming: boolean;
  ip: string;
  user?: string;
  pass?: string;
  channel?: string;
  lineY: number;
  streamUrl?: string;
}

export default function CamerasPage() {
  const { liveTraffic } = useDashboard();

  // Primary MR. DIY store cameras matching traffic_counter.py
  const [cameras, setCameras] = useState<CameraItem[]>([
    { 
      id: "cam_1", 
      name: "Zone 1: Main Entrance Gate", 
      location: "Main Floor - Entrance", 
      liveCount: 0, 
      entryCount: 0, 
      exitCount: 0, 
      isOnline: true, 
      isStreaming: true, 
      ip: "192.168.1.51",
      user: "admin",
      pass: "Group5Bayawan",
      channel: "102",
      lineY: 300,
      streamUrl: "http://127.0.0.1:8001/api/video_feed/cam_1"
    },
    { 
      id: "cam_2", 
      name: "Zone 2: Hardware & Tools Aisle", 
      location: "Main Floor - Aisle 1", 
      liveCount: 0, 
      entryCount: 0, 
      exitCount: 0, 
      isOnline: true, 
      isStreaming: true, 
      ip: "192.168.1.52",
      user: "admin",
      pass: "Group5Bayawan",
      channel: "102",
      lineY: 300,
      streamUrl: "http://127.0.0.1:8001/api/video_feed/cam_2"
    },
    { 
      id: "cam_3", 
      name: "Zone 3: Household & Electrical Aisle", 
      location: "Main Floor - Aisle 2", 
      liveCount: 0, 
      entryCount: 0, 
      exitCount: 0, 
      isOnline: true, 
      isStreaming: true, 
      ip: "192.168.1.53",
      user: "admin",
      pass: "Group5Bayawan",
      channel: "102",
      lineY: 300,
      streamUrl: "http://127.0.0.1:8001/api/video_feed/cam_3"
    },
  ]);

  // Sync telemetry from dashboard_api (Port 8000)
  useEffect(() => {
    if (!liveTraffic?.cameras || liveTraffic.cameras.length === 0) return;

    setCameras((prev) =>
      prev.map((cam) => {
        const matchedBackend = liveTraffic.cameras.find(
          (bCam: any) => bCam.id === cam.id || bCam.name === cam.name
        );

        if (matchedBackend) {
          return {
            ...cam,
            isOnline: matchedBackend.isOnline ?? matchedBackend.is_online ?? true,
            liveCount: matchedBackend.liveCount ?? matchedBackend.detected ?? cam.liveCount,
            entryCount: matchedBackend.entryCount ?? matchedBackend.entries ?? cam.entryCount,
            exitCount: matchedBackend.exitCount ?? matchedBackend.exits ?? cam.exitCount,
            streamUrl: matchedBackend.streamUrl || `http://127.0.0.1:8001/api/video_feed/${cam.id}`,
          };
        }
        return cam;
      })
    );
  }, [liveTraffic]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Practical Camera Form Fields
  const [camName, setCamName] = useState("");
  const [camIp, setCamIp] = useState("");
  const [camUser, setCamUser] = useState("admin");
  const [camPass, setCamPass] = useState("Group5Bayawan");
  const [camChannel, setCamChannel] = useState("102");
  const [camLineY, setCamLineY] = useState(300);
  const [formError, setFormError] = useState("");

  const handleAddCameraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!camName.trim() || !camIp.trim()) {
      setFormError("Camera Name and IP Address are required.");
      return;
    }

    const newId = `cam_${Date.now()}`;
    const newCam: CameraItem = {
      id: newId,
      name: camName.trim(),
      location: `Zone: ${camName.trim()}`,
      liveCount: 0,
      entryCount: 0,
      exitCount: 0,
      isOnline: true,
      isStreaming: true,
      ip: camIp.trim(),
      user: camUser,
      pass: camPass,
      channel: camChannel,
      lineY: Number(camLineY) || 300,
      streamUrl: `http://127.0.0.1:8001/api/video_feed/${newId}`,
    };

    setCameras([...cameras, newCam]);
    setIsModalOpen(false);
    setCamName("");
    setCamIp("");
  };

  const filteredCameras = cameras.filter((cam) => {
    const matchesSearch =
      cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cam.ip.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "online" && cam.isOnline) ||
      (statusFilter === "offline" && !cam.isOnline);

    return matchesSearch && matchesStatus;
  });

  const toggleCameraStream = (id: string) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isStreaming: !c.isStreaming } : c))
    );
  };

  const resetCameraCounts = (name: string) => {
    if (confirm(`Reset counter metrics for ${name}?`)) {
      setCameras((prev) =>
        prev.map((c) => (c.name === name ? { ...c, entryCount: 0, exitCount: 0, liveCount: 0 } : c))
      );
    }
  };

  const deleteCameraPipeline = (name: string) => {
    if (confirm(`Delete camera feed ${name}?`)) {
      setCameras((prev) => prev.filter((c) => c.name !== name));
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* PRACTICAL ADD CAMERA MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2 text-blue-400">
                <Video className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Add IP Camera</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCameraSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              {/* Camera Name */}
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Camera / Zone Label</label>
                <Input
                  placeholder="e.g. Zone 4: Garden Section"
                  value={camName}
                  onChange={(e) => setCamName(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                />
              </div>

              {/* IP Address & Channel */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-slate-300 font-medium">Camera IP Address</label>
                  <Input
                    placeholder="e.g. 192.168.1.54"
                    value={camIp}
                    onChange={(e) => setCamIp(e.target.value)}
                    className="bg-slate-950 border-slate-700 font-mono text-white text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">Substream</label>
                  <Input
                    placeholder="102"
                    value={camChannel}
                    onChange={(e) => setCamChannel(e.target.value)}
                    className="bg-slate-950 border-slate-700 font-mono text-white text-xs h-8"
                  />
                </div>
              </div>

              {/* RTSP Credentials */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">RTSP Username</label>
                  <Input
                    value={camUser}
                    onChange={(e) => setCamUser(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-medium">RTSP Password</label>
                  <Input
                    type="password"
                    value={camPass}
                    onChange={(e) => setCamPass(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                  />
                </div>
              </div>

              {/* Counting Line Y Offset */}
              <div className="space-y-1 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    Tripwire Line Y-Position
                  </label>
                  <span className="font-mono text-blue-400 font-bold">{camLineY} px</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="450"
                  step="10"
                  value={camLineY}
                  onChange={(e) => setCamLineY(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Defines the horizontal line height where person crossing triggers entry/exit count.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 text-xs h-8"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4">
                  Connect Camera
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Camera Streams</h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time YOLOv8 object tracking and foot traffic monitoring</p>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 font-medium text-white text-xs"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Camera
        </Button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search by zone name or IP address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700 text-white text-xs focus:border-blue-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-slate-800 border-slate-700 text-white text-xs">
            <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-white text-xs">
            <SelectItem value="all">All Cameras ({cameras.length})</SelectItem>
            <SelectItem value="online">Online ({cameras.filter(c => c.isOnline).length})</SelectItem>
            <SelectItem value="offline">Offline ({cameras.filter(c => !c.isOnline).length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCameras.map((camera) => (
          <CameraCard
            key={camera.id}
            id={camera.id}
            name={camera.name}
            location={camera.location}
            liveCount={camera.liveCount}
            entryCount={camera.entryCount}
            exitCount={camera.exitCount}
            isOnline={camera.isOnline}
            isStreaming={camera.isStreaming}
            streamUrl={camera.streamUrl}
            onToggleCamera={() => toggleCameraStream(camera.id)}
            onResetCounts={() => resetCameraCounts(camera.name)}
            onDelete={() => deleteCameraPipeline(camera.name)}
          />
        ))}
      </div>
    </div>
  );
}