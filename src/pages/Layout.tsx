import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { useCurrentUser } from "../auth";

export default function Layout() {
  const user = useCurrentUser();

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar userRole={user?.role ?? "viewer"} />
      <main className="lg:pl-72">
        <div className="p-6 lg:p-8 pt-20 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}