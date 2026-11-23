import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  TrendingUp,
  ShoppingCart,
  FileText,
  Settings,
  Menu,
  LogOut,
  QrCode,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
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
import { useEffect, useState } from "react";
import { cn } from "./ui/utils";
import { logout, useCurrentUser, UserRole } from "../auth";
import { CustomerQrModal } from "./CustomerQrModal";

interface SidebarProps {
  userRole?: UserRole;
  alertCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({
  userRole = "viewer",
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });

  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  useEffect(() => {
    try {
      localStorage.setItem("sidebarCollapsed", String(isCollapsed));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(
      new CustomEvent("sidebar-collapse-change", { detail: { collapsed: isCollapsed } })
    );
  }, [isCollapsed]);

  const handleToggleCollapse = () => {
    const next = !isCollapsed;
    if (onToggleCollapse) {
      onToggleCollapse(next);
    } else {
      setInternalCollapsed(next);
    }
  };

  const user = useCurrentUser();
  const effectiveRole: UserRole = user?.role ?? userRole;
  const displayName = user?.name || user?.email || "User";
  const displayEmail = user?.email || "";

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "manager", "viewer"] },
    { name: "Live Cameras", href: "/cameras", icon: Camera, roles: ["admin", "manager", "viewer"] },
    { name: "Traffic Analytics", href: "/traffic", icon: TrendingUp, roles: ["admin", "manager", "viewer"] },
    { name: "Conversion Analytics", href: "/conversion", icon: ShoppingCart, roles: ["admin", "manager", "viewer"] },
    { name: "Reports", href: "/reports", icon: FileText, roles: ["admin", "manager", "viewer"] },
    { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
  ];

  const visibleNavigation = navigation.filter((item) =>
    item.roles.includes(effectiveRole)
  );

  const handleConfirmLogout = async () => {
    localStorage.removeItem("userEmail");
    await logout();
    navigate("/login", { replace: true });
  };

  const SidebarContent = ({ compact = false }: { compact?: boolean }) => (
    <>
      {/* Brand Header */}
      <div
        className={cn(
          "border-b border-slate-700 flex items-center",
          compact ? "p-4 justify-center" : "p-6 justify-between gap-2"
        )}
      >
        <div className={cn("flex items-center", compact ? "justify-center" : "gap-3 min-w-0")}>
          <div className={cn("rounded-lg flex items-center justify-center shrink-0", compact ? "h-10 w-10" : "h-12 w-12")}>
            <img
              src="images/Logo_DIY.png"
              alt="logo"
              className="h-full w-full object-contain"
            />
          </div>
          {!compact && (
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">FootTraffic AI</h1>
              <p className="text-xs text-slate-400 truncate">YOLOv8 Analytics</p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Button (when expanded) */}
        {!compact && (
          <button
            type="button"
            onClick={handleToggleCollapse}
            title="Collapse sidebar"
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Expand Button Bar (when collapsed on desktop) */}
      {compact && (
        <div className="hidden lg:flex justify-center pt-3 px-2">
          <button
            type="button"
            onClick={handleToggleCollapse}
            title="Expand sidebar"
            className="w-full flex items-center justify-center py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className={cn("flex-1 space-y-1", compact ? "p-2.5" : "p-4")}>
        {visibleNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            onClick={() => setIsMobileOpen(false)}
            title={compact ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-lg transition-colors group",
                compact ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                isActive
                  ? "bg-blue-500/20 text-blue-500"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!compact && <span className="flex-1 truncate">{item.name}</span>}
          </NavLink>
        ))}

        {/* Customer QR Trigger */}
        <div className="pt-3 mt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              setIsMobileOpen(false);
              setShowQrModal(true);
            }}
            title={compact ? "Customer QR" : undefined}
            className={cn(
              "w-full flex items-center rounded-lg transition-colors text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer",
              compact ? "justify-center px-2 py-3" : "gap-3 px-4 py-3"
            )}
          >
            <QrCode className="h-5 w-5 text-blue-400 shrink-0" />
            {!compact && <span className="flex-1 text-left truncate">Customer QR</span>}
          </button>
        </div>
      </nav>

      {/* User Profile & Logout Section */}
      <div className={cn("border-t border-slate-700", compact ? "p-2.5" : "p-4")}>
        <div
          title={compact ? `${displayName} (${effectiveRole})` : undefined}
          className={cn(
            "flex items-center mb-2",
            compact ? "justify-center py-2" : "gap-3 px-4 py-3"
          )}
        >
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white uppercase text-sm flex-shrink-0">
            {displayName.charAt(0)}
          </div>
          {!compact && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate" title={displayEmail || displayName}>
                {displayName}
              </p>
              <p className="text-xs text-slate-400 truncate" title={displayEmail}>
                {displayEmail ? `${displayEmail} • ` : ""}
                <span className="capitalize">{effectiveRole}</span>
              </p>
            </div>
          )}
        </div>

        <Button
          onClick={() => setShowLogoutConfirm(true)}
          variant="ghost"
          title={compact ? "Logout" : undefined}
          className={cn(
            "w-full text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer",
            compact ? "justify-center px-2" : "justify-start"
          )}
        >
          <LogOut className={cn("h-4 w-4 shrink-0", !compact && "mr-3")} />
          {!compact && "Logout"}
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

      {/* Mobile Sidebar (always expanded inside drawer) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 border-r border-slate-700 flex flex-col">
            <SidebarContent compact={false} />
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-slate-900 border-r border-slate-700 fixed left-0 top-0 bottom-0 z-30 transition-all duration-300",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        <SidebarContent compact={isCollapsed} />
      </aside>

      {/* Customer QR Modal */}
      <CustomerQrModal open={showQrModal} onClose={() => setShowQrModal(false)} />

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