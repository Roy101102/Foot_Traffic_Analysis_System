import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface HeatmapChartProps {
  title: string;
  data: {
    day: string;
    hours: { hour: string; value: number }[];
  }[];
}

export function HeatmapChart({ title, data }: HeatmapChartProps) {
  // 📐 DYNAMIC COLUMN RESOLUTION: Safely determine the total grid columns from the source dataset
  const columnCount = data[0]?.hours.length ?? 7;

  // 🎨 STRETCH GRID CONFIGURATION: Ensures blocks stretch to fill 100% of the container beautifully
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
    gap: "6px", // Equivalent to Tailwind's gap-1.5
  };

  const getColor = (value: number) => {
    if (value > 180) return "bg-red-500";
    if (value > 140) return "bg-orange-500";
    if (value > 100) return "bg-yellow-500";
    if (value > 60) return "bg-green-500";
    return "bg-blue-500";
  };

  const getOpacity = (value: number) => {
    // Clamps opacity smoothly between 0.15 and 1.0 based on a max ceiling of 250 visitors
    return Math.min(1, Math.max(0.15, value / 250));
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            
            {/* 🏷️ PERFECTLY ALIGNED HEADER ROW */}
            <div className="grid grid-cols-[80px_1fr] gap-3 items-center">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Day
              </div>
              <div style={gridStyle}>
                {data[0]?.hours.map((hourObj) => {
                  // Dynamically extract and display clean labels (e.g. "08:00" -> "8h")
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

            {/* 🗺️ HEATMAP ROW GRID */}
            {data.map((dayData) => (
              <div 
                key={dayData.day} 
                className="grid grid-cols-[80px_1fr] gap-3 items-center"
              >
                <div className="text-sm font-medium text-slate-300">
                  {dayData.day}
                </div>
                <div style={gridStyle}>
                  {dayData.hours.map((hour) => (
                    <div
                      key={hour.hour}
                      className={`${getColor(hour.value)} rounded-md aspect-square transition-all duration-300 hover:scale-110 hover:shadow-xl cursor-help`}
                      style={{ opacity: getOpacity(hour.value) }}
                      title={`${dayData.day} at ${hour.hour}: ${hour.value} visitors`}
                    />
                  ))}
                </div>
              </div>
            ))}
            
          </div>
        </CardContent>
      </div>

      {/* 📊 INTERACTIVE LEGEND */}
      <CardContent className="pt-0">
        <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-700/40">
          <span className="text-xs text-slate-400 font-medium">Less Traffic</span>
          <div className="flex gap-1.5">
            {[20, 60, 100, 140, 180, 240].map((val) => (
              <div
                key={val}
                className={`h-4 w-4 rounded ${getColor(val)}`}
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