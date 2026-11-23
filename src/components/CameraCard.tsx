import React, { useEffect, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Camera,
  ArrowUpRight,
  ArrowDownRight,
  Settings2,
  Eye,
  RefreshCw,
  Trash2,
  VideoOff,
  Activity,
  Play,
  Square,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface CameraCardProps {
  id?: string;
  name: string;
  liveCount: number;
  entryCount: number;
  exitCount: number;
  isOnline: boolean;
  isStreaming?: boolean;
  showMetrics?: boolean;
  location?: string;
  streamUrl?: string;
  onViewAnalytics?: () => void;
  onConfigure?: () => void;
  onToggleCamera?: () => void;
  onResetCounts?: () => void;
  onDelete?: () => void;
}

// Prefer direct localhost:8001 MJPEG stream (trusted by Chromium on HTTPS, zero tunnel buffering)
// and fall back to /streamer proxy if accessed from a remote device.
function resolveStreamUrls(url: string | undefined, id: string) {
  const localDirect = `http://127.0.0.1:8001/api/video_feed/${id}`;
  const proxied = `/streamer/api/video_feed/${id}`;

  if (!url) {
    return { primary: localDirect, fallback: proxied };
  }
  if (url.startsWith("/streamer/")) {
    return {
      primary: url.replace("/streamer/", "http://127.0.0.1:8001/"),
      fallback: url,
    };
  }
  if (url.startsWith("/api/")) {
    return {
      primary: `http://127.0.0.1:8001${url}`,
      fallback: `/streamer${url}`,
    };
  }
  return { primary: url, fallback: proxied };
}

export function CameraCard({
  id = "cam_1",
  name,
  liveCount,
  entryCount,
  exitCount,
  isOnline,
  isStreaming = true,
  showMetrics,
  location,
  streamUrl,
  onViewAnalytics,
  onConfigure,
  onToggleCamera,
  onResetCounts,
  onDelete,
}: CameraCardProps) {
  const [timestamp, setTimestamp] = useState<string>("");
  const [streamError, setStreamError] = useState<boolean>(false);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  const isFeedActive = isOnline && isStreaming;

  const shouldShowMetrics =
    showMetrics !== undefined
      ? showMetrics
      : id === "cam_1" || name.toLowerCase().includes("entrance");

  const { primary, fallback } = resolveStreamUrls(streamUrl, id);
  const baseStreamUrl = useFallback ? fallback : primary;

  const activeStreamUrl =
    retryKey > 0
      ? `${baseStreamUrl}${baseStreamUrl.includes("?") ? "&" : "?"}_t=${retryKey}`
      : baseStreamUrl;

  const isVideoFile =
    activeStreamUrl.toLowerCase().includes(".mp4") ||
    activeStreamUrl.toLowerCase().includes(".webm");

  useEffect(() => {
    setStreamError(false);
    setUseFallback(false);
  }, [streamUrl, id, isStreaming, isOnline]);

  useEffect(() => {
    if (!isFeedActive || !streamError) return;
    const timer = setInterval(() => {
      setStreamError(false);
      setUseFallback(false);
      setRetryKey((prev) => prev + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, [isFeedActive, streamError]);

  const handleStreamError = () => {
    if (!useFallback && fallback !== primary) {
      setUseFallback(true);
    } else {
      setStreamError(true);
    }
  };

  const handleRetryStream = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStreamError(false);
    setUseFallback(false);
    setRetryKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!isFeedActive) return;

    const updateClock = () => setTimestamp(new Date().toLocaleTimeString());
    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, [isFeedActive]);

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate" title={name}>
                  {name}
                </h3>

                <Badge
                  variant={isOnline ? "default" : "destructive"}
                  className={
                    isOnline
                      ? "bg-green-500/20 text-green-500 border-none shrink-0"
                      : "bg-red-500/20 text-red-500 border-none shrink-0"
                  }
                >
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
              {location && (
                <p className="text-sm text-slate-400 font-mono truncate">{location}</p>
              )}
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 shrink-0"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-slate-900 border-slate-700 text-slate-300"
              >
                <DropdownMenuItem
                  onClick={onViewAnalytics}
                  className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer"
                >
                  <Eye className="h-4 w-4 mr-2 text-blue-400" />
                  View Analytics
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onConfigure}
                  className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer"
                >
                  <Settings2 className="h-4 w-4 mr-2 text-slate-400" />
                  Configure
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onToggleCamera}
                  disabled={!isOnline}
                  className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer"
                >
                  {isStreaming ? (
                    <>
                      <Square className="h-4 w-4 mr-2 text-red-400" />
                      Stop Stream
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2 text-emerald-400" />
                      Start Stream
                    </>
                  )}
                </DropdownMenuItem>

                {shouldShowMetrics && (
                  <DropdownMenuItem
                    onClick={onResetCounts}
                    className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4 mr-2 text-teal-400" />
                    Reset Metrics
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="bg-slate-800" />

                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer font-medium"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Pipeline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Viewport Screen */}
          <div className="relative aspect-video bg-slate-950 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center">
            {/* Viewport Status Badge */}
            <div className="absolute top-2 left-2 z-20">
              {isFeedActive && !streamError ? (
                <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 backdrop-blur-md text-red-400 px-2 py-0.5 rounded text-[11px] font-semibold">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-700/80 backdrop-blur-md text-slate-400 px-2 py-0.5 rounded text-[11px] font-semibold">
                  <div className="h-2 w-2 rounded-full bg-slate-500" />
                  {isOnline ? "STANDBY" : "OFFLINE"}
                </div>
              )}
            </div>

            {/* Viewport Display States */}
            {!isOnline ? (
              <div className="flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <VideoOff className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-xs font-mono text-slate-400">CAMERA DISCONNECTED</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Signal connection lost</p>
              </div>
            ) : !isStreaming ? (
              <div className="flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Camera className="h-10 w-10 text-slate-600 mb-3" />
                <p className="text-xs font-mono text-slate-300 mb-2">STREAM STOPPED</p>
                {onToggleCamera && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCamera();
                    }}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs gap-1.5 h-7 px-3"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Start Camera
                  </Button>
                )}
              </div>
            ) : streamError ? (
              <div className="flex flex-col items-center justify-center text-center p-4 text-amber-400">
                <AlertCircle className="h-10 w-10 text-amber-500/80 mb-2" />
                <p className="text-xs font-mono text-amber-300">STREAM UNAVAILABLE</p>
                <p className="text-[10px] text-slate-400 mt-1 mb-3">
                  Reconnecting to backend feed...
                </p>
                <Button
                  onClick={handleRetryStream}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs h-7 px-3"
                >
                  <RefreshCw className="h-3 w-3 mr-1.5 text-slate-400" />
                  Retry Feed
                </Button>
              </div>
            ) : (
              <>
                {isVideoFile ? (
                  <video
                    key={`video-${id}-${useFallback}-${retryKey}`}
                    src={activeStreamUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    onError={handleStreamError}
                  />
                ) : (
                  <img
                    key={`stream-${id}-${useFallback}-${retryKey}`}
                    src={activeStreamUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={handleStreamError}
                  />
                )}

                <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700 z-10">
                  <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                  <span>30 FPS</span>
                </div>

                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-[10px] font-mono text-slate-300 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded border border-slate-800 z-10">
                  <span>{id.toUpperCase()}</span>
                  <span>{timestamp}</span>
                </div>
              </>
            )}
          </div>

          {/* Stats Metrics */}
          {shouldShowMetrics && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Live Count</p>
                <p className="text-xl font-bold text-white">{isFeedActive ? liveCount : 0}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  <p className="text-xs text-slate-400">Entry</p>
                </div>
                <p className="text-xl font-bold text-green-500">
                  {isFeedActive ? entryCount : 0}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowDownRight className="h-3 w-3 text-orange-500" />
                  <p className="text-xs text-slate-400">Exit</p>
                </div>
                <p className="text-xl font-bold text-orange-500">
                  {isFeedActive ? exitCount : 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 