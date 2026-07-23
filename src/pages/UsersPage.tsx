import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { UserPlus, Search, MoreVertical, Edit, Shield, Activity, Power } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";

interface User {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Viewer";
  status: "Active" | "Inactive";
  lastActive: string;
  initials: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([
    {
      id: 1,
      name: "John Smith",
      email: "john.smith@company.com",
      role: "Admin",
      status: "Active",
      lastActive: "2 minutes ago",
      initials: "JS",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      email: "sarah.j@company.com",
      role: "Manager",
      status: "Active",
      lastActive: "5 minutes ago",
      initials: "SJ",
    },
    {
      id: 3,
      name: "Michael Brown",
      email: "m.brown@company.com",
      role: "Viewer",
      status: "Active",
      lastActive: "1 hour ago",
      initials: "MB",
    },
    {
      id: 4,
      name: "Emily Davis",
      email: "emily.davis@company.com",
      role: "Manager",
      status: "Active",
      lastActive: "3 hours ago",
      initials: "ED",
    },
    {
      id: 5,
      name: "Robert Wilson",
      email: "r.wilson@company.com",
      role: "Viewer",
      status: "Inactive",
      lastActive: "2 days ago",
      initials: "RW",
    },
  ]);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Selected User State for Actions
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form States for Add/Edit
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "Viewer" as "Admin" | "Manager" | "Viewer",
  });

  // Helper to get Initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // --- Handlers ---

  // 1. Add User
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    const newUser: User = {
      id: Date.now(),
      name: formData.name,
      email: formData.email,
      role: formData.role,
      status: "Active",
      lastActive: "Just now",
      initials: getInitials(formData.name),
    };

    setUsers([newUser, ...users]);
    setFormData({ name: "", email: "", role: "Viewer" });
    setIsAddOpen(false);
  };

  // 2. Edit User Details
  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({ name: user.name, email: user.email, role: user.role });
    setIsEditOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setUsers(
      users.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              name: formData.name,
              email: formData.email,
              role: formData.role,
              initials: getInitials(formData.name),
            }
          : u
      )
    );
    setIsEditOpen(false);
    setSelectedUser(null);
  };

  // 3. Change Role
  const handleOpenRole = (user: User) => {
    setSelectedUser(user);
    setFormData((prev) => ({ ...prev, role: user.role }));
    setIsRoleOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setUsers(
      users.map((u) => (u.id === selectedUser.id ? { ...u, role: formData.role } : u))
    );
    setIsRoleOpen(false);
    setSelectedUser(null);
  };

  // 4. Toggle Activate / Deactivate
  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === "Active" ? "Inactive" : "Active";
    setUsers(
      users.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
  };

  // 5. View Activity
  const handleOpenActivity = (user: User) => {
    setSelectedUser(user);
    setIsActivityOpen(true);
  };

  // Filtered Users List
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
      case "Manager":
        return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
      case "Viewer":
        return "bg-green-500/20 text-green-400 border border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">Manage user accounts and permissions</p>
        </div>
        <Button
          onClick={() => {
            setFormData({ name: "", email: "", role: "Viewer" });
            setIsAddOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm mb-1">Total Users</p>
            <p className="text-3xl font-bold text-white">{users.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm mb-1">Admins</p>
            <p className="text-3xl font-bold text-purple-400">
              {users.filter((u) => u.role === "Admin").length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm mb-1">Managers</p>
            <p className="text-3xl font-bold text-blue-400">
              {users.filter((u) => u.role === "Manager").length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <p className="text-slate-400 text-sm mb-1">Viewers</p>
            <p className="text-3xl font-bold text-green-400">
              {users.filter((u) => u.role === "Viewer").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Users Table */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-slate-800/50">
                <TableHead className="text-slate-300">User</TableHead>
                <TableHead className="text-slate-300">Email</TableHead>
                <TableHead className="text-slate-300">Role</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Last Active</TableHead>
                <TableHead className="text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow className="border-slate-700">
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No users found matching "{searchQuery}"
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-white font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.status === "Active"
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                        }
                      >
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">{user.lastActive}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(user)}
                            className="text-slate-300 hover:text-white cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2" /> Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenRole(user)}
                            className="text-slate-300 hover:text-white cursor-pointer"
                          >
                            <Shield className="h-4 w-4 mr-2" /> Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleOpenActivity(user)}
                            className="text-slate-300 hover:text-white cursor-pointer"
                          >
                            <Activity className="h-4 w-4 mr-2" /> View Activity
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(user)}
                            className={
                              user.status === "Active"
                                ? "text-red-400 hover:text-red-300 cursor-pointer"
                                : "text-green-400 hover:text-green-300 cursor-pointer"
                            }
                          >
                            <Power className="h-4 w-4 mr-2" />
                            {user.status === "Active" ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Permissions Section */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <h4 className="text-white font-semibold mb-2">Admin</h4>
              <p className="text-sm text-slate-300 mb-3">Full system access and control</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Manage all users and permissions</li>
                <li>• Configure cameras and settings</li>
                <li>• View all analytics and reports</li>
                <li>• Access activity logs</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h4 className="text-white font-semibold mb-2">Manager</h4>
              <p className="text-sm text-slate-300 mb-3">Manage analytics and reports</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• View all analytics and reports</li>
                <li>• Monitor camera feeds</li>
                <li>• Generate custom reports</li>
                <li>• Configure alerts</li>
              </ul>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <h4 className="text-white font-semibold mb-2">Viewer</h4>
              <p className="text-sm text-slate-300 mb-3">Read-only access to analytics</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• View dashboard and analytics</li>
                <li>• View camera feeds</li>
                <li>• Download reports</li>
                <li>• View alerts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- MODALS & DIALOGS --- */}

      {/* 1. Add User Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Full Name</Label>
              <Input
                placeholder="e.g. Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email Address</Label>
              <Input
                type="email"
                placeholder="jane.doe@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(val: "Admin" | "Manager" | "Viewer") =>
                  setFormData({ ...formData, role: val })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Edit User Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Full Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email Address</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(val: "Admin" | "Manager" | "Viewer") =>
                  setFormData({ ...formData, role: val })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Change Role Modal */}
      <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveRole} className="space-y-4 mt-2">
            <p className="text-sm text-slate-400">
              Update access privileges for <span className="text-white font-medium">{selectedUser?.name}</span>.
            </p>
            <div className="space-y-2">
              <Label className="text-slate-300">New Role</Label>
              <Select
                value={formData.role}
                onValueChange={(val: "Admin" | "Manager" | "Viewer") =>
                  setFormData({ ...formData, role: val })
                }
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsRoleOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Update Role
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Activity Modal */}
      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Recent Activity — {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="p-3 bg-slate-800 rounded-lg text-sm flex justify-between items-center">
              <div>
                <p className="text-white font-medium">Logged into system</p>
                <p className="text-xs text-slate-400">IP: 192.168.1.45</p>
              </div>
              <span className="text-xs text-slate-400">{selectedUser?.lastActive}</span>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg text-sm flex justify-between items-center">
              <div>
                <p className="text-white font-medium">Exported Monthly Traffic Report</p>
                <p className="text-xs text-slate-400">PDF Format</p>
              </div>
              <span className="text-xs text-slate-400">Yesterday</span>
            </div>
            <div className="p-3 bg-slate-800 rounded-lg text-sm flex justify-between items-center">
              <div>
                <p className="text-white font-medium">Updated Camera #3 Settings</p>
                <p className="text-xs text-slate-400">Framerate adjusted to 30fps</p>
              </div>
              <span className="text-xs text-slate-400">3 days ago</span>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => setIsActivityOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}