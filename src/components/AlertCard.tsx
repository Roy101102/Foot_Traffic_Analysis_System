import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { AlertTriangle, Camera, TrendingUp, AlertCircle, X } from "lucide-react";
import { Button } from "./ui/button";

interface AlertCardProps {
  type: "camera_offline" | "traffic_spike" | "system_error" | "warning";
  title: string;
  message: string;
  timestamp: string;
  severity: "critical" | "warning" | "info";
  onDismiss?: () => void;
}

export function AlertCard({ type, title, message, timestamp, severity, onDismiss }: AlertCardProps) {
  const iconMap = {
    camera_offline: Camera,
    traffic_spike: TrendingUp,
    system_error: AlertCircle,
    warning: AlertTriangle,
  };

  const severityColors = {
    critical: "bg-red-500/10 border-red-500/50 text-red-500",
    warning: "bg-yellow-500/10 border-yellow-500/50 text-yellow-500",
    info: "bg-blue-500/10 border-blue-500/50 text-blue-500",
  };

  const Icon = iconMap[type];

  return (
    <Card className={`${severityColors[severity]} border`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-slate-800/50">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-white">{title}</h4>
                <Badge variant="outline" className="text-xs">
                  {severity}
                </Badge>
              </div>
              <p className="text-sm text-slate-300">{message}</p>
              <p className="text-xs text-slate-500">{timestamp}</p>
            </div>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-slate-400 hover:text-white h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
