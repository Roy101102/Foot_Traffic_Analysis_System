import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: "success" | "warning" | "danger" | "info";
}

export function KPICard({ title, value, icon: Icon, trend, status = "info" }: KPICardProps) {
  const statusColors = {
    success: "text-green-500 bg-green-500/10",
    warning: "text-yellow-500 bg-yellow-500/10",
    danger: "text-red-500 bg-red-500/10",
    info: "text-blue-500 bg-blue-500/10",
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-slate-400 text-sm">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {trend && (
              <div className="flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm ${trend.isPositive ? "text-green-500" : "text-red-500"}`}>
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-slate-400 text-sm">vs yesterday</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${statusColors[status]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
