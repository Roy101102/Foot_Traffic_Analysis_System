import { useEffect, useState } from "react";
import { useCurrentUser, UserRole } from "../auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  CheckCircle2,
  Bell,
  Building2,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Save,
  Users,
  UserPlus,
  Trash2,
  Shield,
  UserCheck,
  Lock,
  FileText,
  History,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

export interface AlertItem {
  id: number;
  title: string;
  message: string;
  timestamp: string;
  severity: "critical" | "warning" | "info";
}

export interface StoreUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: number;
  added_by: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  action: "ADDED" | "PASSWORD_RESET" | "DELETED";
  target_user: string;
  performed_by: string;
  reason?: string | null;
  timestamp: string;
}

export default function SettingsPage() {
  const activeUser = useCurrentUser();
  const currentAdmin = activeUser
    ? `${activeUser.name} (${activeUser.email})`
    : "System Admin";

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Business Profile State
  const [storeInfo, setStoreInfo] = useState({
    storeName: "Mr. DIY - Main Branch",
    managerEmail: "manager@store.com",
    openingTime: "09:00",
    closingTime: "21:00",
    maxOccupancy: "150",
  });

  // Real SQLite Users & Audit Logs State
  const [users, setUsers] = useState<StoreUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Add User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager" as UserRole,
  });

  // Direct Password Reset Modal State
  const [userToReset, setUserToReset] = useState<StoreUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Deletion Confirmation Modal State
  const [userToDelete, setUserToDelete] = useState<StoreUser | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Notification Rules State
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    occupancySpike: true,
    cameraOffline: true,
    dailySummary: true,
  });

  // Active Alerts State
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: 1,
      title: "Store Near Capacity",
      message: "Visitor count reached 85% of maximum occupancy limit.",
      timestamp: "10 minutes ago",
      severity: "warning",
    },
    {
      id: 2,
      title: "Camera Disconnected",
      message: "Entrance Cam #2 lost connection.",
      timestamp: "1 hour ago",
      severity: "critical",
    },
    {
      id: 3,
      title: "Daily Report Ready",
      message: "Yesterday's foot-traffic summary has been generated.",
      timestamp: "8 hours ago",
      severity: "info",
    },
  ]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastType(type);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;
    async function loadUsersAndLogs() {
      try {
        const res = await fetch("/api/auth/admin/users", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setUsers(data.users || []);
          setAuditLogs(data.audit_logs || []);
        }
      } catch {
        // Ignore transient network errors
      } finally {
        if (isMounted) setIsLoadingUsers(false);
      }
    }
    loadUsersAndLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismissAlert = (id: number) => {
    setAlerts((prev) => prev.filter((item) => item.id !== id));
    showToast("Alert dismissed");
  };

  const handleSaveStoreInfo = (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Store profile saved successfully");
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim() || newUser.password.length < 8) {
      showToast("Password must be at least 8 characters", "error");
      return;
    }

    setIsSubmittingUser(true);
    try {
      const res = await fetch("/api/auth/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Failed to create account", "error");
        return;
      }

      setUsers(data.users || []);
      setAuditLogs(data.audit_logs || []);
      setNewUser({ name: "", email: "", password: "", role: "manager" });
      setShowAddUser(false);
      showToast(`Created account for ${data.user.name}`);
    } catch {
      showToast("Network error while creating account", "error");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDirectPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    if (resetPasswordValue.length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch(`/api/auth/admin/users/${userToReset.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ new_password: resetPasswordValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Failed to reset password", "error");
        return;
      }

      if (data.audit_logs) {
        setAuditLogs(data.audit_logs);
      }
      showToast(`Password updated for ${userToReset.email}`);
      setUserToReset(null);
      setResetPasswordValue("");
      setShowResetPassword(false);
    } catch {
      showToast("Network error while resetting password", "error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const confirmDeleteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToDelete) return;

    setIsDeletingUser(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/auth/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reason: deleteReason,
          admin_password: adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.detail || "Failed to revoke user");
        return;
      }

      setUsers(data.users || []);
      setAuditLogs(data.audit_logs || []);
      showToast(`Removed user ${userToDelete.name}`);
      setUserToDelete(null);
      setDeleteReason("");
      setAdminPassword("");
      setDeleteError(null);
    } catch {
      setDeleteError("Network error while revoking user");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const getSeverityBadge = (severity: AlertItem["severity"]) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>;
      case "warning":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Warning</Badge>;
      case "info":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Info</Badge>;
    }
  };

  const getSeverityIcon = (severity: AlertItem["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 relative max-w-5xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 text-white px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-3 ${
            toastType === "error" ? "bg-red-600" : "bg-blue-600"
          }`}
        >
          {toastType === "error" ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Direct Password Reset Modal */}
      {userToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Reset User Password</h3>
                <p className="text-xs text-slate-400">
                  Assign a new login password for{" "}
                  <span className="text-white font-semibold">{userToReset.name}</span> ({userToReset.email}).
                </p>
              </div>
            </div>

            <form onSubmit={handleDirectPasswordReset} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="directResetPassword" className="text-xs text-slate-300">
                  New Password (Minimum 8 characters)
                </Label>
                <div className="relative">
                  <Input
                    id="directResetPassword"
                    type={showResetPassword ? "text" : "password"}
                    minLength={8}
                    placeholder="Enter new password"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white text-sm pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs text-slate-400">
                Any active sessions for <span className="text-slate-200">{userToReset.email}</span> will be signed out immediately so they must log in with the new password.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setUserToReset(null);
                    setResetPasswordValue("");
                    setShowResetPassword(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResettingPassword}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isResettingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm User Revocation</h3>
                <p className="text-xs text-slate-400">
                  You are revoking access for <span className="text-white font-semibold">{userToDelete.name}</span>.
                </p>
              </div>
            </div>

            <form onSubmit={confirmDeleteUser} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reason" className="text-xs text-slate-300 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-slate-400" /> Reason for Removal (Required)
                </Label>
                <Input
                  id="reason"
                  placeholder="e.g. Resigned, Role transferred, Access cleanup"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminPassword" className="text-xs text-slate-300 flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-slate-400" /> Confirm Your Admin Password
                </Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="Enter your current login password"
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setDeleteError(null);
                  }}
                  className={`bg-slate-900 border text-white text-sm ${
                    deleteError ? "border-red-500" : "border-slate-700"
                  }`}
                  required
                />
                {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60 text-xs text-slate-400 space-y-1">
                <p><span className="text-slate-300 font-medium">Responsible Admin:</span> {currentAdmin}</p>
                <p className="text-[11px] text-slate-500">This action and reason will be permanently recorded in the system audit log.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setUserToDelete(null);
                    setAdminPassword("");
                    setDeleteError(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isDeletingUser}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeletingUser ? "Removing..." : "Confirm & Delete"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings & Preferences</h1>
        <p className="text-slate-400 text-sm">
          Manage store details, team access, occupancy limits, and notification alerts
        </p>
      </div>

      <Tabs defaultValue="store" className="space-y-6">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger
            value="store"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            Store Profile
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            User Management
            <Badge variant="secondary" className="ml-1 bg-slate-700 text-slate-200 text-xs px-1.5 py-0.2">
              {users.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <Bell className="h-4 w-4" />
            Alerts & Notifications
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-1 bg-blue-500/30 text-white text-xs px-1.5 py-0.2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="text-slate-300 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            Data & Retention
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: STORE PROFILE */}
        <TabsContent value="store">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Store Configuration</CardTitle>
              <CardDescription className="text-slate-400">
                Set basic operational details used for analytics reports and capacity tracking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveStoreInfo} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName" className="text-slate-300">Store / Branch Name</Label>
                    <Input
                      id="storeName"
                      value={storeInfo.storeName}
                      onChange={(e) => setStoreInfo({ ...storeInfo, storeName: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="managerEmail" className="text-slate-300">Manager Contact Email</Label>
                    <Input
                      id="managerEmail"
                      type="email"
                      value={storeInfo.managerEmail}
                      onChange={(e) => setStoreInfo({ ...storeInfo, managerEmail: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openingTime" className="text-slate-300">Opening Time</Label>
                    <Input
                      id="openingTime"
                      type="time"
                      value={storeInfo.openingTime}
                      onChange={(e) => setStoreInfo({ ...storeInfo, openingTime: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closingTime" className="text-slate-300">Closing Time</Label>
                    <Input
                      id="closingTime"
                      type="time"
                      value={storeInfo.closingTime}
                      onChange={(e) => setStoreInfo({ ...storeInfo, closingTime: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="maxOccupancy" className="text-slate-300">Maximum Store Capacity (People)</Label>
                    <Input
                      id="maxOccupancy"
                      type="number"
                      value={storeInfo.maxOccupancy}
                      onChange={(e) => setStoreInfo({ ...storeInfo, maxOccupancy: e.target.value })}
                      className="bg-slate-900/50 border-slate-700 text-white max-w-xs"
                    />
                    <p className="text-xs text-slate-400">Used to trigger capacity alerts when visitor traffic is high.</p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <Save className="h-4 w-4" />
                    Save Store Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: USER MANAGEMENT */}
        <TabsContent value="users" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg">Store Administrators & Managers</CardTitle>
                <CardDescription className="text-slate-400">
                  Manage internal accounts, assign passwords, and control system roles
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddUser(!showAddUser)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {showAddUser ? "Cancel" : "Add User"}
              </Button>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Add User Drawer */}
              {showAddUser && (
                <form
                  onSubmit={handleAddUser}
                  className="p-4 bg-slate-900/80 rounded-lg border border-slate-700/80 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-blue-400" /> New Account Details
                    </h4>
                    <span className="text-xs text-slate-400">
                      Creating as: <strong className="text-slate-200">{currentAdmin}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="userName" className="text-xs text-slate-300">Full Name</Label>
                      <Input
                        id="userName"
                        placeholder="Jane Doe"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white mt-1 h-9"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="userEmail" className="text-xs text-slate-300">Email Address</Label>
                      <Input
                        id="userEmail"
                        type="email"
                        placeholder="jane@store.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        className="bg-slate-800 border-slate-700 text-white mt-1 h-9"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="userPassword" className="text-xs text-slate-300">Initial Password</Label>
                      <div className="relative mt-1">
                        <Input
                          id="userPassword"
                          type={showNewUserPassword ? "text" : "password"}
                          minLength={8}
                          placeholder="Min. 8 characters"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="bg-slate-800 border-slate-700 text-white h-9 pr-8"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                        >
                          {showNewUserPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="userRole" className="text-xs text-slate-300">System Role</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(val: UserRole) => setNewUser({ ...newUser, role: val })}
                      >
                        <SelectTrigger id="userRole" className="bg-slate-800 border-slate-700 text-white mt-1 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          <SelectItem value="admin">Admin (Full Access)</SelectItem>
                          <SelectItem value="manager">Manager (Operations)</SelectItem>
                          <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingUser}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSubmittingUser ? "Creating..." : "Create Account"}
                    </Button>
                  </div>
                </form>
              )}

              {/* User Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase bg-slate-900/60 text-slate-400 border-b border-slate-700/80">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Added By</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                          Loading accounts...
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-white flex items-center gap-2">
                              {user.name}
                              {activeUser?.id === user.id && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{user.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            {user.role === "admin" ? (
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 gap-1 font-normal capitalize">
                                <Shield className="h-3 w-3" /> {user.role}
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-700 text-slate-300 border-slate-600 font-normal capitalize">
                                {user.role}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-slate-300">{user.added_by}</div>
                            <div className="text-[11px] text-slate-500">{formatTimestamp(user.created_at)}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                              <UserCheck className="h-3.5 w-3.5" /> Active
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setUserToReset(user);
                                  setResetPasswordValue("");
                                  setShowResetPassword(false);
                                }}
                                className="text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 h-8 w-8"
                                title="Reset User Password"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setUserToDelete(user)}
                                disabled={users.length <= 1 || activeUser?.id === user.id}
                                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                                title={
                                  activeUser?.id === user.id
                                    ? "Cannot delete your own account"
                                    : "Revoke User Access"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Separator className="bg-slate-700/60" />

              {/* Administrative Audit Log */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <History className="h-4 w-4 text-blue-400" /> Administrative Audit Trail
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500">No administrative account actions recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-900/40 rounded-lg border border-slate-700/50 flex items-start justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                log.action === "ADDED"
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : log.action === "PASSWORD_RESET"
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }
                            >
                              {log.action}
                            </Badge>
                            <span className="text-slate-200 font-medium">{log.target_user}</span>
                          </div>
                          {log.reason && (
                            <p className="text-slate-400 text-[11px]">Reason: "{log.reason}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-slate-300 font-medium block">{log.performed_by}</span>
                          <span className="text-slate-500 text-[10px]">{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: ALERTS & NOTIFICATIONS */}
        <TabsContent value="alerts" className="space-y-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white text-lg">Active System Alerts</CardTitle>
                <CardDescription className="text-slate-400">Current warnings and operational notifications</CardDescription>
              </div>
              {alerts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAlerts([]);
                    showToast("All alerts cleared");
                  }}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Clear All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-sm">No active alerts. All systems running normally.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-3.5 bg-slate-900/60 rounded-lg border border-slate-700/60"
                    >
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(item.severity)}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-white">{item.title}</h4>
                            {getSeverityBadge(item.severity)}
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">{item.message}</p>
                          <span className="text-[11px] text-slate-500 mt-1 block">{item.timestamp}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDismissAlert(item.id)}
                        className="text-slate-400 hover:text-white h-7 w-7"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Notification Triggers</CardTitle>
              <CardDescription className="text-slate-400">Select when the system should notify management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg">
                <div>
                  <Label className="text-white font-medium">Capacity Spike Warning</Label>
                  <p className="text-xs text-slate-400">Notify when store visitor count exceeds 80% capacity</p>
                </div>
                <Switch
                  checked={notifications.occupancySpike}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, occupancySpike: checked });
                    showToast(`Capacity alerts ${checked ? "enabled" : "disabled"}`);
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg">
                <div>
                  <Label className="text-white font-medium">Camera Offline Warning</Label>
                  <p className="text-xs text-slate-400">Alert immediately if a video stream loses connection</p>
                </div>
                <Switch
                  checked={notifications.cameraOffline}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, cameraOffline: checked });
                    showToast(`Offline alerts ${checked ? "enabled" : "disabled"}`);
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg">
                <div>
                  <Label className="text-white font-medium">Email Alerts</Label>
                  <p className="text-xs text-slate-400">Send critical warning summaries to manager email</p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, emailAlerts: checked });
                    showToast(`Email notifications ${checked ? "enabled" : "disabled"}`);
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg">
                <div>
                  <Label className="text-white font-medium">End-of-Day Summary Email</Label>
                  <p className="text-xs text-slate-400">Receive a daily traffic overview after store closing time</p>
                </div>
                <Switch
                  checked={notifications.dailySummary}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, dailySummary: checked });
                    showToast(`Daily reports ${checked ? "enabled" : "disabled"}`);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DATA & PRIVACY */}
        <TabsContent value="privacy">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Data Storage & Analytics Retention</CardTitle>
              <CardDescription className="text-slate-400">
                Configure data retention compliance and historical analytics storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-sm">
                <Label className="text-slate-300">Foot-Traffic Log Retention</Label>
                <Select defaultValue="30">
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days (Standard)</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  Historical visitor counts older than this period are automatically archived.
                </p>
              </div>

              <Separator className="bg-slate-700 my-4" />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Customer Privacy Mode</h4>
                  <p className="text-xs text-slate-400">
                    Store aggregate count metrics only. No raw footage or faces are recorded or saved.
                  </p>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Active (Compliant)
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}