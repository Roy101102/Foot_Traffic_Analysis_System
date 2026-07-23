import React, { createContext, useContext, useState } from "react";

// Define the shape of our shared context
interface DashboardData {
  visitorsToday: number;
  customersToday: number;
  totalSalesToday: number;
  conversionRate: number;
  avgTransaction: number;
  revenuePerVisitor: number;
  hourlyConversionData: Array<{ time: string; visitors: number; customers: number; conversionRate: number }>;
  weeklyConversionData: Array<{ time: string; visitors: number; customers: number; sales: number }>;
  salesVsTrafficData: Array<{ time: string; visitors: number; salesValue: number }>;
  bestHour: { time: string; rate: number; revenue: number };
  worstHour: { time: string; rate: number; revenue: number };
  weeklyAvg: { rate: number; dailyRevenue: number; totalCustomers: number };
}

interface DashboardContextType {
  data: DashboardData;
  updateData: (newData: Partial<DashboardData>) => void;
}

const defaultData: DashboardData = {
  visitorsToday: 2847,
  customersToday: 428,
  totalSalesToday: 12450,
  conversionRate: 15.0,
  avgTransaction: 29.08,
  revenuePerVisitor: 4.37,
  hourlyConversionData: Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 2}:00`,
    visitors: Math.floor(Math.random() * 200) + 50,
    customers: Math.floor(Math.random() * 50) + 10,
    conversionRate: Math.floor(Math.random() * 15) + 10,
  })),
  weeklyConversionData: Array.from({ length: 7 }, (_, i) => ({
    time: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    visitors: Math.floor(Math.random() * 2000) + 1000,
    customers: Math.floor(Math.random() * 400) + 100,
    sales: Math.floor(Math.random() * 5000) + 2000,
  })),
  salesVsTrafficData: Array.from({ length: 12 }, (_, i) => ({
    time: `${i * 2}:00`,
    visitors: Math.floor(Math.random() * 200) + 50,
    salesValue: Math.floor(Math.random() * 1000) + 200,
  })),
  bestHour: { time: "14:00 - 15:00", rate: 24.8, revenue: 1847 },
  worstHour: { time: "09:00 - 10:00", rate: 8.2, revenue: 342 },
  weeklyAvg: { rate: 14.2, dailyRevenue: 11240, totalCustomers: 2847 },
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<DashboardData>(defaultData);

  const updateData = (newData: Partial<DashboardData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  return (
    <DashboardContext.Provider value={{ data, updateData }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};