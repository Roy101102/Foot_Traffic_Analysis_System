import React, { createContext, useContext, useState } from "react";

// Generate fixed/shared mock data once so all pages read the exact same values
const initialHourlyData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  visitors: Math.floor(Math.random() * 200) + 50,
  avgDwellTime: Math.floor(Math.random() * 20) + 5,
}));

const initialWeeklyData = Array.from({ length: 7 }, (_, i) => ({
  time: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  visitors: Math.floor(Math.random() * 2000) + 1000,
  peakHour: Math.floor(Math.random() * 300) + 100,
}));

const initialMonthlyData = Array.from({ length: 30 }, (_, i) => ({
  time: `Day ${i + 1}`,
  visitors: Math.floor(Math.random() * 2500) + 1000,
}));

const initialHeatmapData = [
  { day: "Mon", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
  { day: "Tue", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
  { day: "Wed", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
  { day: "Thu", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
  { day: "Fri", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
  { day: "Sat", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
  { day: "Sun", hours: Array.from({ length: 12 }, (_, i) => ({ hour: `${i * 2}:00`, value: Math.floor(Math.random() * 100) })) },
];

const initialEntryExitData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  entry: Math.floor(Math.random() * 150) + 50,
  exit: Math.floor(Math.random() * 150) + 50,
}));

const initialMetrics = {
  todayVisitors: "2,847",
  currentOccupancy: "342",
  avgDwellTime: "12.4 min",
  peakHour: "14:00 - 15:00",
  peakVisitors: "387 visitors",
};

interface AnalyticsContextType {
  metrics: typeof initialMetrics;
  hourlyData: typeof initialHourlyData;
  weeklyData: typeof initialWeeklyData;
  monthlyData: typeof initialMonthlyData;
  heatmapData: typeof initialHeatmapData;
  entryExitData: typeof initialEntryExitData;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [metrics] = useState(initialMetrics);
  const [hourlyData] = useState(initialHourlyData);
  const [weeklyData] = useState(initialWeeklyData);
  const [monthlyData] = useState(initialMonthlyData);
  const [heatmapData] = useState(initialHeatmapData);
  const [entryExitData] = useState(initialEntryExitData);

  return (
    <AnalyticsContext.Provider
      value={{
        metrics,
        hourlyData,
        weeklyData,
        monthlyData,
        heatmapData,
        entryExitData,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
}