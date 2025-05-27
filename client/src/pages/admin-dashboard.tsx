import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Users, FileText, Download, Edit, Trash2, UserCheck, UserX, LogOut, UserPlus } from "lucide-react";
import { generatePDFReport, downloadPDF } from "@/lib/pdf-generator";
import { generateExcelReport, downloadExcel } from "@/lib/excel-generator";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

export default function AdminDashboard() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "technician" as "technician" | "support_center" | "super_admin",
  });

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  // Fetch all test sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/admin/sessions"],
    retry: false,
  });

  // Update user status mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error("Failed to update user status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User status updated",
        description: "The user's status has been successfully changed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      toast({
        title: "Report deleted",
        description: "The test report has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete report.",
        variant: "destructive",
      });
    },
  });

  // Create user mutation
  const createUser = useMutation({
    mutationFn: async (userData: typeof newUserData) => {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateUserModalOpen(false);
      setNewUserData({
        username: "",
        password: "",
        fullName: "",
        role: "technician",
      });
      toast({
        title: "User created successfully",
        description: "The new user account has been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.message || "Failed to create user account",
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = () => {
    if (!newUserData.username || !newUserData.password || !newUserData.fullName) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createUser.mutate(newUserData);
  };

  const handleDownloadReport = async (session: any, format: 'pdf' | 'excel') => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/report`);
      if (!response.ok) throw new Error("Failed to fetch report data");
      
      const reportData = await response.json();
      const filename = `${session.clientName}-${session.testDate}`;
      
      if (format === 'pdf') {
        await downloadPDF(reportData, filename);
      } else {
        downloadExcel(reportData, filename);
      }
      
      toast({
        title: "Download started",
        description: `${format.toUpperCase()} report is being downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the report.",
        variant: "destructive",
      });
    }
  };

  const stats = {
    totalUsers: users?.length || 0,
    activeUsers: users?.filter((u: any) => u.isActive).length || 0,
    totalReports: sessions?.length || 0,
    recentReports: sessions?.filter((s: any) => {
      const sessionDate = new Date(s.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return sessionDate > weekAgo;
    }).length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <img src={logoPath} alt="The Local Guys" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.fullName}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? "Signing out..." : "Sign out"}</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReports}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentReports}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="reports">All Reports</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Technicians</CardTitle>
                    <CardDescription>
                      Manage user accounts and permissions
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setIsCreateUserModalOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.fullName}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? 'default' : 'destructive'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={user.isActive}
                                onCheckedChange={(checked) =>
                                  updateUserStatusMutation.mutate({
                                    userId: user.id,
                                    isActive: checked,
                                  })
                                }
                                disabled={user.role === 'admin'}
                              />
                              <span className="text-sm text-gray-600">
                                {user.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Test Reports</CardTitle>
                <CardDescription>
                  View, download, and manage all test and tag reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions?.map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">{session.clientName}</TableCell>
                          <TableCell>{session.technicianFullName || session.technicianName}</TableCell>
                          <TableCell>
                            {new Date(session.testDate).toLocaleDateString('en-AU')}
                          </TableCell>
                          <TableCell>{session.address}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {session.country === 'australia' ? 'AU' : 'NZ'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadReport(session, 'pdf')}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadReport(session, 'excel')}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Excel
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteSessionMutation.mutate(session.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        title="Create New User Account"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={newUserData.fullName}
              onChange={(e) => setNewUserData(prev => ({ ...prev, fullName: e.target.value }))}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={newUserData.username}
              onChange={(e) => setNewUserData(prev => ({ ...prev, username: e.target.value }))}
              placeholder="Enter username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={newUserData.password}
              onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Access Level</Label>
            <Select
              value={newUserData.role}
              onValueChange={(value: "technician" | "support_center" | "super_admin") => 
                setNewUserData(prev => ({ ...prev, role: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select access level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="support_center">Support Center Staff</SelectItem>
                {user?.role === "super_admin" && (
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600">
              {newUserData.role === "super_admin" 
                ? "Highest level access - full system control (Jarrad151 only)"
                : newUserData.role === "support_center"
                ? "Can view/edit all reports, manage technician users"
                : "Can view/edit own reports only"
              }
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreateUserModalOpen(false)}
              disabled={createUser.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUser.isPending}
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}