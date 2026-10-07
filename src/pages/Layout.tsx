import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar userRole="admin" />
      <main className="lg:pl-72">
        <div className="p-6 lg:p-8 pt-20 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}