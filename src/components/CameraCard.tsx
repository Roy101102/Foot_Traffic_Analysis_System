import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Camera, ArrowUpRight, ArrowDownRight, Settings2, Eye, RefreshCw, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface CameraCardProps {
  name: string;
  liveCount: number;
  entryCount: number;
  exitCount: number;
  isOnline: boolean;
  location?: string;
  onViewAnalytics?: () => void;
  onConfigure?: () => void;
  onToggleCamera?: () => void;
  onResetCounts?: () => void; // 🟢 Added
  onDelete?: () => void;      // 🟢 Added
}

export function CameraCard({
  name,
  liveCount,
  entryCount,
  exitCount,
  isOnline,
  location,
  onViewAnalytics,
  onConfigure,
  onToggleCamera,
  onResetCounts,
  onDelete,
}: CameraCardProps) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
      <CardContent className="p-5">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{name}</h3>
                <Badge
                  variant={isOnline ? "default" : "destructive"}
                  className={isOnline ? "bg-green-500/20 text-green-500 border-none" : "bg-red-500/20 text-red-500 border-none"}
                >
                  {isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
              {location && <p className="text-sm text-slate-400">{location}</p>}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* Fixed the hover text color class to slate-200 so it looks nice on slate backgrounds */}
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-300">
                <DropdownMenuItem onClick={onViewAnalytics} className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
                  <Eye className="h-4 w-4 mr-2 text-blue-400" />
                  View Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onConfigure} className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
                  <Settings2 className="h-4 w-4 mr-2 text-slate-400" />
                  Configure
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleCamera} className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
                  <Camera className="h-4 w-4 mr-2 text-amber-400" />
                  {isOnline ? "Disable Feed" : "Enable Feed"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onResetCounts} className="hover:bg-slate-800 focus:bg-slate-800 cursor-pointer">
                  <RefreshCw className="h-4 w-4 mr-2 text-teal-400" />
                  Reset Metrics
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="bg-slate-800" />
                
                <DropdownMenuItem onClick={onDelete} className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer font-medium">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Pipeline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Camera Preview Placeholder */}
          <div className="relative aspect-video bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="h-12 w-12 text-slate-600" />
            </div>
            {isOnline && (
              <div className="absolute top-2 left-2">
                <div className="flex items-center gap-1 bg-red-500/20 text-red-500 px-2 py-1 rounded text-xs font-medium">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Live Count</p>
              <p className="text-xl font-bold text-white">{liveCount}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center gap-1 mb-1">
                <ArrowUpRight className="h-3 w-3 text-green-500" />
                <p className="text-xs text-slate-400">Entry</p>
              </div>
              <p className="text-xl font-bold text-green-500">{entryCount}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center gap-1 mb-1">
                <ArrowDownRight className="h-3 w-3 text-orange-500" />
                <p className="text-xs text-slate-400">Exit</p>
              </div>
              <p className="text-xl font-bold text-orange-500">{exitCount}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}