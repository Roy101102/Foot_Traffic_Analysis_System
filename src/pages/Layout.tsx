import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

// Explicit type export for child route pages using outlet context
export interface LayoutContextType {
  alertCount: number;
  setAlertCount: React.Dispatch<React.SetStateAction<number>>;
}

export default function Layout() {
  // Shared state initialized to 5
  const [alertCount, setAlertCount] = useState<number>(5);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar now reflects the dynamic state */}
      <Sidebar alertCount={alertCount} userRole="admin" />
      <main className="lg:pl-72">
        <div className="p-6 lg:p-8 pt-20 lg:pt-8">
          {/* Share alert state context with child route pages like AlertsPage */}
          <Outlet context={{ alertCount, setAlertCount }} />
        </div>
      </main>
    </div>
  );
}