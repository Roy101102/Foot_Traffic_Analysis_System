import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface HeatmapChartProps {
  title: string;
  data: {
    day: string;
    hours: { hour: string; value: number }[];
  }[];
}

export function HeatmapChart({ title, data }: HeatmapChartProps) {
  const columnCount = data[0]?.hours.length ?? 7;

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    gap: "6px",
  };

  const getColor = (value: number) => {
    if (value > 180) return "bg-red-500";
    if (value > 140) return "bg-orange-500";
    if (value > 100) return "bg-yellow-500";
    if (value > 60) return "bg-green-500";
    return "bg-blue-500";
  };

  const getOpacity = (value: number) => {
    return Math.min(1, Math.max(0.15, value / 250));
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="space-y-1.5">
          {/* Header Row */}
          <div className="grid grid-cols-[60px_1fr] gap-2 items-center mb-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Day
            </div>
            <div style={gridStyle}>
              {data[0]?.hours.map((hourObj) => {
                const cleanHourLabel = `${parseInt(hourObj.hour.split(":")[0], 10)}h`;
                return (
                  <div 
                    key={hourObj.hour} 
                    className="text-[11px] font-bold text-slate-400 text-center tracking-wide"
                  >
                    {cleanHourLabel}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid Rows */}
          {data.map((dayData) => (
            <div 
              key={dayData.day} 
              className="grid grid-cols-[60px_1fr] gap-2 items-center"
            >
              <div className="text-xs font-medium text-slate-300">
                {dayData.day}
              </div>
              <div style={gridStyle}>
                {dayData.hours.map((hour) => (
                  <div
                    key={hour.hour}
                    className={`${getColor(hour.value)} rounded-md h-7 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-help`}
                    style={{ opacity: getOpacity(hour.value) }}
                    title={`${dayData.day} at ${hour.hour}: ${hour.value} visitors`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-slate-700/40">
          <span className="text-xs text-slate-400 font-medium">Less Traffic</span>
          <div className="flex gap-1.5">
            {[20, 60, 100, 140, 180, 240].map((val) => (
              <div
                key={val}
                className={`h-3.5 w-3.5 rounded ${getColor(val)}`}
                style={{ opacity: getOpacity(val) }}
                title={`Traffic level context: ${val}`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-400 font-medium">More Traffic</span>
        </div>
      </CardContent>
    </Card>
  );
}