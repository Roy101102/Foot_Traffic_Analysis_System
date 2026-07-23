import { useState } from "react";
import { CameraCard } from "../components/CameraCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Plus, Filter, Video, X, Layers, Settings2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

interface CameraItem {
  name: string;
  location: string;
  liveCount: number;
  entryCount: number;
  exitCount: number;
  isOnline: boolean;
  streamSource: string;
  connectionType: string;
  modelWeight: string;
}

export default function CamerasPage() {
  // 1. Move static data into local state so we can mutate it upon form submission
  const [cameras, setCameras] = useState<CameraItem[]>([
    { name: "Front Entrance", location: "Main Floor - Zone A", liveCount: 12, entryCount: 234, exitCount: 198, isOnline: true, streamSource: "rtsp://192.168.1.50/stream1", connectionType: "RTSP", modelWeight: "yolov8n.pt" },
    { name: "Back Entrance", location: "Main Floor - Zone B", liveCount: 5, entryCount: 89, exitCount: 76, isOnline: true, streamSource: "rtsp://192.168.1.51/stream1", connectionType: "RTSP", modelWeight: "yolov8n.pt" },
    { name: "West Wing", location: "2nd Floor - Zone C", liveCount: 8, entryCount: 156, exitCount: 142, isOnline: true, streamSource: "rtsp://192.168.1.52/stream1", connectionType: "RTSP", modelWeight: "yolov8s.pt" },
    { name: "East Wing", location: "2nd Floor - Zone D", liveCount: 3, entryCount: 67, exitCount: 71, isOnline: false, streamSource: "rtsp://192.168.1.53/stream1", connectionType: "RTSP", modelWeight: "yolov8n.pt" },
    { name: "North Corridor", location: "Main Floor - Zone E", liveCount: 6, entryCount: 124, exitCount: 118, isOnline: true, streamSource: "0", connectionType: "Webcam", modelWeight: "yolov8n.pt" },
    { name: "South Corridor", location: "Main Floor - Zone F", liveCount: 9, entryCount: 178, exitCount: 165, isOnline: true, streamSource: "videos/south.mp4", connectionType: "File", modelWeight: "yolov8m.pt" },
    { name: "Parking Entrance", location: "Ground Floor - Zone G", liveCount: 15, entryCount: 298, exitCount: 276, isOnline: true, streamSource: "rtsp://192.168.1.55/stream1", connectionType: "RTSP", modelWeight: "yolov8s.pt" },
    { name: "Emergency Exit", location: "Ground Floor - Zone H", liveCount: 0, entryCount: 12, exitCount: 14, isOnline: false, streamSource: "rtsp://192.168.1.56/stream1", connectionType: "RTSP", modelWeight: "yolov8n.pt" },
  ]);

  // Modal Dialog and Input States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all-zones");

  // Form Field Tracking States
  const [newCamName, setNewCamName] = useState("");
  const [newCamLocation, setNewCamLocation] = useState("");
  const [connectionType, setConnectionType] = useState("RTSP");
  const [streamSource, setStreamSource] = useState("");
  const [modelWeight, setModelWeight] = useState("yolov8n.pt");
  const [formError, setFormError] = useState("");

  // Handle Form Submission
  const handleAddCameraSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newCamName.trim() || !newCamLocation.trim() || !streamSource.trim()) {
      setFormError("All fields are strictly required to register a video channel pipeline.");
      return;
    }

    // Check duplicate names
    if (cameras.some(c => c.name.toLowerCase() === newCamName.trim().toLowerCase())) {
      setFormError("A camera channel with this specific name is already registered.");
      return;
    }

    const uniqueNewCamera: CameraItem = {
      name: newCamName.trim(),
      location: newCamLocation.trim(),
      liveCount: 0,
      entryCount: 0,
      exitCount: 0,
      isOnline: true, // Defaults true for illustration; the Python stream verification engine flags actual status
      streamSource: streamSource.trim(),
      connectionType,
      modelWeight
    };

    // Append to array state and clear inputs
    setCameras([...cameras, uniqueNewCamera]);
    setIsModalOpen(false);
    setNewCamName("");
    setNewCamLocation("");
    setStreamSource("");
    setConnectionType("RTSP");
    setModelWeight("yolov8n.pt");
  };

  // Live filter computation logic
  const filteredCameras = cameras.filter((cam) => {
    const matchesSearch = cam.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cam.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "online" && cam.isOnline) || 
                          (statusFilter === "offline" && !cam.isOnline);
    
    let matchesZone = true;
    if (zoneFilter === "main") matchesZone = cam.location.toLowerCase().includes("main floor");
    if (zoneFilter === "2nd") matchesZone = cam.location.toLowerCase().includes("2nd floor");
    if (zoneFilter === "ground") matchesZone = cam.location.toLowerCase().includes("ground floor");

    return matchesSearch && matchesStatus && matchesZone;
  });
  
  // 🟢 Function 1: Toggle Online/Offline State
  const toggleCameraStatus = (cameraName: string) => {
    setCameras(prev => prev.map(cam => 
      cam.name === cameraName ? { ...cam, isOnline: !cam.isOnline, liveCount: 0 } : cam
    ));
  };

  // 🟢 Function 2: Zero-out counts
  const resetCameraCounts = (cameraName: string) => {
    if (confirm(`Are you sure you want to reset entry/exit metrics for ${cameraName}?`)) {
      setCameras(prev => prev.map(cam => 
        cam.name === cameraName ? { ...cam, entryCount: 0, exitCount: 0, liveCount: 0 } : cam
      ));
    }
  };

  // 🟢 Function 3: Delete camera out of state completely
  const deleteCameraPipeline = (cameraName: string) => {
    if (confirm(`Permanently drop tracking pipeline for ${cameraName}?`)) {
      setCameras(prev => prev.filter(cam => cam.name !== cameraName));
    }
  };   
  return (
    <div className="space-y-6 relative">
      
      {/* 🛠️ ADD CAMERA MODAL POPUP DIALOG */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2.5 text-blue-400">
                <Video className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Provision New YOLOv8 Video Pipeline</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCameraSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold">
                  ⚠️ {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Camera Label Name</label>
                  <Input 
                    placeholder="e.g., Warehouse Loading Dock" 
                    value={newCamName}
                    onChange={(e) => setNewCamName(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Location / Functional Zone</label>
                  <Input 
                    placeholder="e.g., Ground Floor - Zone J" 
                    value={newCamLocation}
                    onChange={(e) => setNewCamLocation(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Connection Protocol</label>
                  <Select value={connectionType} onValueChange={setConnectionType}>
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="RTSP">IP Stream (RTSP Link)</SelectItem>
                      <SelectItem value="Webcam">Hardware Device Index (USB)</SelectItem>
                      <SelectItem value="File">Local Testing File Path</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Inference Model Weight</label>
                  <Select value={modelWeight} onValueChange={setModelWeight}>
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="yolov8n.pt">YOLOv8 Nano (Ultra Fast, Lightweight)</SelectItem>
                      <SelectItem value="yolov8s.pt">YOLOv8 Small (Balanced Accuracy)</SelectItem>
                      <SelectItem value="yolov8m.pt">YOLOv8 Medium (High Precision, Heavy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  {connectionType === "RTSP" && "Target Stream URL Address"}
                  {connectionType === "Webcam" && "System Hardware Hardware Index Target"}
                  {connectionType === "File" && "Storage Server Video File Destination String"}
                </label>
                <Input 
                  placeholder={
                    connectionType === "RTSP" ? "rtsp://username:secretpass@192.168.1.100:554/h264" :
                    connectionType === "Webcam" ? "0 (Default Device Camera)" : "videos/checkout_lane_test.mp4"
                  }
                  value={streamSource}
                  onChange={(e) => setStreamSource(e.target.value)}
                  className="bg-slate-950 border-slate-700 font-mono text-white text-sm"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex gap-3 text-xs text-slate-400 leading-normal">
                <Settings2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Pipeline Registration Hook Notice:</strong> Submitting passes parameters down to your backend service daemon dynamically. Ensure target endpoints are firewall-whitelisted.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Establish Feed Pipe
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Live Camera Monitoring</h1>
          <p className="text-slate-400">Real-time monitoring of all security cameras with YOLOv8 detection</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 font-medium text-white shadow-lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Camera
        </Button>
      </div>

      {/* Filters and Search Container Interface */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search cameras by label or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white focus:border-blue-500"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700 text-white">
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-white">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online Channels</SelectItem>
            <SelectItem value="offline">Offline Channels</SelectItem>
          </SelectContent>
        </Select>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-slate-800 border-slate-700 text-white">
            <Layers className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Filter by zone" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-white">
            <SelectItem value="all-zones">All Facility Zones</SelectItem>
            <SelectItem value="main">Main Floor Level</SelectItem>
            <SelectItem value="2nd">2nd Floor Level</SelectItem>
            <SelectItem value="ground">Ground Floor Level</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Camera Performance Summary Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Total Streams Registered</p>
          <p className="text-2xl font-bold text-white">{cameras.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-green-500/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Online Pipeline Nodes</p>
          <p className="text-2xl font-bold text-green-500">{cameras.filter(c => c.isOnline).length}</p>
        </div>
        <div className="bg-slate-800/50 border border-red-500/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Offline Nodes</p>
          <p className="text-2xl font-bold text-red-500">{cameras.filter(c => !c.isOnline).length}</p>
        </div>
        <div className="bg-slate-800/50 border border-blue-500/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-1">Combined Live Occupancy Count</p>
          <p className="text-2xl font-bold text-blue-500">{cameras.reduce((sum, c) => sum + c.liveCount, 0)}</p>
        </div>
      </div>

      {/* Live Active Rendering Grid View */}
      {filteredCameras.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCameras.map((camera) => (
            <CameraCard
              key={camera.name}
              {...camera}
              onViewAnalytics={() => console.log("View analytics for", camera.name)}
              onConfigure={() => console.log("Configure", camera.name)}
              onToggleCamera={() => console.log("Toggle", camera.name)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-slate-800 bg-slate-900/10 rounded-xl">
          <p className="text-slate-400 text-sm">No cameras match the selected search criteria or zone filters.</p>
        </div>
      )}
    </div>
  );
}