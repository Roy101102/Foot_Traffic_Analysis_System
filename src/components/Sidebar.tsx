import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  TrendingUp,
  ShoppingCart,
  FileText,
  Bell,
  Users,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useState } from "react";
import { cn } from "./ui/utils";
import { logout } from "../auth";

interface SidebarProps {
  userRole?: "admin" | "manager" | "viewer";
  alertCount?: number;
}

export function Sidebar({ userRole = "admin", alertCount = 0 }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Retrieve user email from localStorage
  const userEmail = localStorage.getItem("userEmail") || "admin@company.com";

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Live Cameras", href: "/cameras", icon: Camera },
    { name: "Traffic Analytics", href: "/traffic", icon: TrendingUp },
    { name: "Conversion Analytics", href: "/conversion", icon: ShoppingCart },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Alerts", href: "/alerts", icon: Bell, badge: alertCount },
    ...(userRole === "admin" ? [{ name: "User Management", href: "/users", icon: Users }] : []),
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Confirmed Logout Handler
  const handleConfirmLogout = () => {
    localStorage.removeItem("userEmail"); // Clean up stored email
    logout();                            // Auth cleanup
    navigate("/login");                  // Redirect to login page
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="h-15 w-15 rounded-lg flex items-center justify-center">
            <img 
              src="images/Logo_DIY.png" 
              alt="logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">FootTraffic AI</h1>
            <p className="text-xs text-slate-400">YOLOv8 Analytics</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group",
                isActive
                  ? "bg-blue-500/20 text-blue-500"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1">{item.name}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {item.badge}
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile & Logout Section */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white uppercase text-sm flex-shrink-0">
            {userEmail.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            {/* Shows full logged-in Email */}
            <p className="text-sm font-medium text-white truncate" title={userEmail}>
              {userEmail}
            </p>
            {/* Shows Role (e.g. Admin / Manager / Viewer) */}
            <p className="text-xs text-slate-400 capitalize">
              {userRole}
            </p>
          </div>
        </div>

        <Button 
          onClick={() => setShowLogoutConfirm(true)} 
          variant="ghost" 
          className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 text-white hover:bg-slate-800"
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-700 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 border-r border-slate-700 fixed left-0 top-0 bottom-0">
        <SidebarContent />
      </aside>

      {/* Logout Confirmation Modal */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="bg-slate-900 border-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-white">Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to log out? You will need to sign in again to access the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel 
              onClick={() => setShowLogoutConfirm(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}