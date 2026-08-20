import React, { createContext, useContext, useEffect, useState } from "react";

interface DashboardData {
  visitorsToday: number;
  customersToday: number;
  totalSalesToday: number;
  conversionRate: number;
  avgTransaction: number;
  revenuePerVisitor: number;
  hourlyConversionData: Array<{
    time: string;
    visitors: number;
    customers: number;
    conversionRate: number;
  }>;
  weeklyConversionData: Array<{
    time: string;
    visitors: number;
    customers: number;
    sales: number;
  }>;
  salesVsTrafficData: Array<{
    time: string;
    visitors: number;
    salesValue: number;
  }>;
  bestHour: {
    time: string;
    rate: number;
    revenue: number;
  };
  worstHour: {
    time: string;
    rate: number;
    revenue: number;
  };
  weeklyAvg: {
    rate: number;
    dailyRevenue: number;
    totalCustomers: number;
  };
}

interface LiveTrafficData {
  summary: {
    total_entries: number;
    total_exits: number;
    current_occupancy: number;
  };

  hourly_trends: Array<{
    hour: number;
    entries: number;
    exits: number;
  }>;
}

interface DashboardContextType {
  data: DashboardData;
  liveTraffic: LiveTrafficData;
  updateData: (newData: Partial<DashboardData>) => void;
}
const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

const defaultData: DashboardData = {
  visitorsToday: 0,
  customersToday: 0,
  totalSalesToday: 0,
  conversionRate: 0,
  avgTransaction: 18.5,
  revenuePerVisitor: 0,

  hourlyConversionData: [],

  weeklyConversionData: [],

  salesVsTrafficData: [],

  bestHour: {
    time: "--",
    rate: 0,
    revenue: 0,
  },

  worstHour: {
    time: "--",
    rate: 0,
    revenue: 0,
  },

  weeklyAvg: {
    rate: 0,
    dailyRevenue: 0,
    totalCustomers: 0,
  },
};

export const DashboardProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [data, setData] = useState<DashboardData>(defaultData);

  const [liveTraffic, setLiveTraffic] = useState<LiveTrafficData>({
  summary: {
    total_entries: 0,
    total_exits: 0,
    current_occupancy: 0,
  },

  hourly_trends: [],
});

  const updateData = (newData: Partial<DashboardData>) => {
    setData((prev) => ({
      ...prev,
      ...newData,
    }));
  };

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/api/dashboard-stats"
        );

        const result = await response.json();

        console.log("API RESULT:", result);


        if (result.status !== "success") return;


        setLiveTraffic({
          summary: result.summary,
          hourly_trends: result.hourly_trends,
        });

        const visitors = result.summary.total_entries;

        const hourly = result.hourly_trends.map((item: any) => ({
          time: `${item.hour.toString().padStart(2, "0")}:00`,
          visitors: item.entries,
          customers: 0,
          conversionRate: 0,
        }));

        setData((prev) => ({
          ...prev,

          visitorsToday: visitors,

          hourlyConversionData: hourly,

          weeklyConversionData: [],

          salesVsTrafficData: result.hourly_trends.map((item: any) => ({
            time: `${item.hour.toString().padStart(2, "0")}:00`,
            visitors: item.entries,
            salesValue: 0,
          })),

          weeklyAvg: {
            rate: 0,
            dailyRevenue: 0,
            totalCustomers: visitors,
          },

          bestHour: {
            time: "--",
            rate: 0,
            revenue: 0,
          },

          worstHour: {
            time: "--",
            rate: 0,
            revenue: 0,
          },
        }));
      } catch (err) {
        console.error(err);
      }
    }

    fetchDashboard();

    const interval = setInterval(fetchDashboard, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        data,
        liveTraffic,
        updateData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);

  if (!context)
    throw new Error(
      "useDashboard must be used inside DashboardProvider."
    );

  return context;
};