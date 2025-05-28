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
import { Users, FileText, Download, Edit, Trash2, UserCheck, UserX, LogOut, UserPlus, Plus } from "lucide-react";
import { generatePDFReport, downloadPDF } from "@/lib/pdf-generator";
import { generateExcelReport, downloadExcel } from "@/lib/excel-generator";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

export default function AdminDashboard() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [isViewReportModalOpen, setIsViewReportModalOpen] = useState(false);
  const [viewingSession, setViewingSession] = useState<any>(null);
  const [isEditResultModalOpen, setIsEditResultModalOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<any>(null);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addingToSession, setAddingToSession] = useState<any>(null);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [editSessionData, setEditSessionData] = useState({
    clientName: "",
    technicianName: "",
    testDate: "",
    address: "",
    siteContact: "",
    country: "australia" as "australia" | "newzealand",
  });
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "technician" as "technician" | "support_center" | "super_admin",
  });
  const [selectedTechnicianFilter, setSelectedTechnicianFilter] = useState<string>("all");
  const [editResultData, setEditResultData] = useState({
    itemName: "",
    location: "",
    classification: "class1" as any,
    result: "pass" as any,
    frequency: "twelvemonthly" as any,
    failureReason: null as any,
    actionTaken: null as any,
    notes: null as any,
  });
  const [newItemData, setNewItemData] = useState({
    itemName: "",
    location: "",
    assetNumber: "",
    classification: "class1" as any,
    result: "pass" as any,
    frequency: "twelvemonthly" as any,
    failureReason: null as any,
    actionTaken: null as any,
    visualInspection: true,
    electricalTest: true,
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

  // Filter sessions based on selected technician and sort by newest first
  const filteredSessions = sessions?.filter((session: any) => {
    if (selectedTechnicianFilter === "all") return true;
    return (session.technicianFullName || session.technicianName) === selectedTechnicianFilter;
  }).sort((a: any, b: any) => {
    // Sort by date descending (newest first)
    return new Date(b.testDate).getTime() - new Date(a.testDate).getTime();
  }) || [];

  // Get unique technician names for filter dropdown
  const uniqueTechnicians = sessions ? 
    [...new Set(sessions.map((session: any) => session.technicianFullName || session.technicianName))]
      .filter(Boolean)
      .sort() 
    : [];

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

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: number; data: any }) => {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update session");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      setIsEditSessionModalOpen(false);
      setEditingSession(null);
      toast({
        title: "Report updated successfully",
        description: "The test session has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update report.",
        variant: "destructive",
      });
    },
  });

  // Update test result mutation
  const updateResultMutation = useMutation({
    mutationFn: async ({ id, data, sessionId }: { id: number; data: any; sessionId: number }) => {
      const res = await fetch(`/api/sessions/${sessionId}/results/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update test result');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      if (viewingSession?.session?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/session", viewingSession.session.id] });
      }
      toast({
        title: "Success",
        description: "Test result updated successfully",
      });
      setIsEditResultModalOpen(false);
      setEditingResult(null);
      // Refresh the viewing session data
      if (viewingSession?.session?.id) {
        handleViewReport(viewingSession.session.id);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update test result",
        variant: "destructive",
      });
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: number; data: any }) => {
      const response = await fetch(`/api/sessions/${sessionId}/results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to add item");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      if (viewingSession?.session?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/session", viewingSession.session.id] });
        handleViewReport(viewingSession.session.id);
      }
      toast({
        title: "Success",
        description: "New item added successfully",
      });
      setIsAddItemModalOpen(false);
      setAddingToSession(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add new item",
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

  const handleViewReport = async (session: any) => {
    console.log('Session object:', session);
    
    // Handle both session object and direct session ID
    const sessionId = typeof session === 'object' ? session.id : session;
    console.log('Session ID:', sessionId);
    
    if (!sessionId) {
      toast({
        title: "Error loading report",
        description: "Invalid session ID",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/full`);
      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }
      const reportData = await response.json();
      setViewingSession(reportData);
      setIsViewReportModalOpen(true);
    } catch (error) {
      console.error('Error loading report:', error);
      toast({
        title: "Error loading report",
        description: "Failed to load the full report data",
        variant: "destructive",
      });
    }
  };

  const handleEditSession = (session: any) => {
    setEditingSession(session);
    setEditSessionData({
      clientName: session.clientName,
      technicianName: session.technicianName,
      testDate: session.testDate.split('T')[0], // Convert to YYYY-MM-DD format
      address: session.address,
      siteContact: session.siteContact,
      country: session.country,
    });
    setIsEditSessionModalOpen(true);
  };

  const handleUpdateSession = () => {
    if (!editSessionData.clientName || !editSessionData.technicianName || !editSessionData.testDate || !editSessionData.address || !editSessionData.siteContact) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    updateSessionMutation.mutate({
      sessionId: editingSession.id,
      data: editSessionData
    });
  };

  const handleEditResult = (result: any) => {
    setEditingResult(result);
    setEditResultData({
      itemName: result.itemType || "",
      location: result.location || "",
      classification: result.classification || "class1",
      result: result.result || "pass",
      frequency: result.frequency || "twelvemonthly",
      failureReason: result.failureReason,
      actionTaken: result.actionTaken,
      notes: result.notes,
    });
    setIsEditResultModalOpen(true);
  };

  const handleUpdateResult = () => {
    if (!editingResult || !viewingSession?.session?.id) return;

    updateResultMutation.mutate({
      id: editingResult.id,
      sessionId: viewingSession.session.id,
      data: {
        itemName: editResultData.itemName,
        location: editResultData.location,
        classification: editResultData.classification,
        result: editResultData.result,
        frequency: editResultData.frequency,
        failureReason: editResultData.failureReason,
        actionTaken: editResultData.actionTaken,
        notes: editResultData.notes,
      },
    });
  };

  const handleAddItem = (session: any) => {
    setAddingToSession(session);
    setNewItemData({
      itemName: "",
      location: "",
      assetNumber: "",
      classification: "class1",
      result: "pass",
      frequency: "twelvemonthly",
      failureReason: null,
      actionTaken: null,
      visualInspection: true,
      electricalTest: true,
    });
    setIsAddItemModalOpen(true);
  };

  const handleSaveNewItem = () => {
    if (!newItemData.itemName || !newItemData.location || !addingToSession) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      itemName: newItemData.itemName,
      itemType: newItemData.itemName,
      location: newItemData.location,
      assetNumber: newItemData.assetNumber || `${addingToSession.id}-${Date.now()}`,
      classification: newItemData.classification,
      result: newItemData.result,
      frequency: newItemData.frequency,
      failureReason: newItemData.result === "fail" ? newItemData.failureReason : null,
      actionTaken: newItemData.result === "fail" ? newItemData.actionTaken : null,
      visualInspection: newItemData.visualInspection,
      electricalTest: newItemData.electricalTest,
      notes: null,
      photoData: null,
    };

    addItemMutation.mutate({
      sessionId: addingToSession.id,
      data: itemData,
    });
  };

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
        <div className={`grid gap-6 mb-8 ${user?.role === 'technician' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-4'}`}>
          {/* Only show user stats for super admins and support center */}
          {(user?.role === 'super_admin' || user?.role === 'support_center') && (
            <>
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
            </>
          )}
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {user?.role === 'technician' ? 'My Reports' : 'Total Reports'}
              </CardTitle>
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
        <Tabs defaultValue={user?.role === 'technician' ? 'reports' : 'users'} className="space-y-4">
          <TabsList>
            {(user?.role === 'super_admin' || user?.role === 'support_center') && (
              <TabsTrigger value="users">User Management</TabsTrigger>
            )}
            <TabsTrigger value="reports">
              {user?.role === 'technician' ? 'My Reports' : 'All Reports'}
            </TabsTrigger>
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
                {/* Technician Filter - Only show for super admin and support center */}
                {(user?.role === "super_admin" || user?.role === "support_center") && (
                  <div className="mb-4">
                    <Label htmlFor="technicianFilter" className="text-sm font-medium">
                      Filter by Technician
                    </Label>
                    <Select
                      value={selectedTechnicianFilter}
                      onValueChange={setSelectedTechnicianFilter}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="All Technicians" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Technicians</SelectItem>
                        {uniqueTechnicians.map((technician) => (
                          <SelectItem key={technician} value={technician}>
                            {technician}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                        <TableHead>Items Tested</TableHead>
                        <TableHead>Failed Items</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">{session.clientName}</TableCell>
                          <TableCell>{session.technicianFullName || session.technicianName}</TableCell>
                          <TableCell>
                            {new Date(session.testDate).toLocaleDateString('en-AU')}
                          </TableCell>
                          <TableCell>{session.address}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              {session.totalItems || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {session.failedItems || 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReport(session)}
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSession(session)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
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
                              {/* Delete button - only visible for super admin and support center */}
                              {(user?.role === "super_admin" || user?.role === "support_center") && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteSessionMutation.mutate(session.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
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

      {/* Edit Session Modal */}
      <Modal
        isOpen={isEditSessionModalOpen}
        onClose={() => {
          setIsEditSessionModalOpen(false);
          setEditingSession(null);
        }}
        title="Edit Test Session"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editClientName">Client Name</Label>
            <Input
              id="editClientName"
              type="text"
              value={editSessionData.clientName}
              onChange={(e) => setEditSessionData(prev => ({ ...prev, clientName: e.target.value }))}
              placeholder="Enter client name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editTechnicianName">Technician Name</Label>
            <Input
              id="editTechnicianName"
              type="text"
              value={editSessionData.technicianName}
              onChange={(e) => setEditSessionData(prev => ({ ...prev, technicianName: e.target.value }))}
              placeholder="Enter technician name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editTestDate">Test Date</Label>
            <Input
              id="editTestDate"
              type="date"
              value={editSessionData.testDate}
              onChange={(e) => setEditSessionData(prev => ({ ...prev, testDate: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editAddress">Address</Label>
            <Input
              id="editAddress"
              type="text"
              value={editSessionData.address}
              onChange={(e) => setEditSessionData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editSiteContact">Site Contact</Label>
            <Input
              id="editSiteContact"
              type="text"
              value={editSessionData.siteContact}
              onChange={(e) => setEditSessionData(prev => ({ ...prev, siteContact: e.target.value }))}
              placeholder="Enter site contact"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editCountry">Country</Label>
            <Select
              value={editSessionData.country}
              onValueChange={(value: "australia" | "newzealand") => 
                setEditSessionData(prev => ({ ...prev, country: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="australia">Australia</SelectItem>
                <SelectItem value="newzealand">New Zealand</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditSessionModalOpen(false);
                setEditingSession(null);
              }}
              disabled={updateSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSession}
              disabled={updateSessionMutation.isPending}
            >
              {updateSessionMutation.isPending ? "Updating..." : "Update Session"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Report Modal */}
      <Modal
        isOpen={isViewReportModalOpen}
        onClose={() => {
          setIsViewReportModalOpen(false);
          setViewingSession(null);
        }}
        title="View & Edit Report"
        className="max-w-6xl"
      >
        {viewingSession && (
          <div className="space-y-6">
            {/* Session Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Test Session Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Client:</span> {viewingSession.session.clientName}
                </div>
                <div>
                  <span className="font-medium">Technician:</span> {viewingSession.session.technicianName}
                </div>
                <div>
                  <span className="font-medium">Date:</span> {new Date(viewingSession.session.testDate).toLocaleDateString('en-AU')}
                </div>
                <div>
                  <span className="font-medium">Location:</span> {viewingSession.session.address}
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div>
              <h3 className="font-semibold mb-4">Test Results ({viewingSession.results.length} items)</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset #</TableHead>
                      <TableHead>Item Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingSession.results.map((result: any) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-mono">{result.assetNumber}</TableCell>
                        <TableCell>{result.itemType}</TableCell>
                        <TableCell>{result.location || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {result.classification?.replace('class', 'Class ') || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {result.frequency?.replace('monthly', 'M').replace('yearly', 'Y') || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={result.result === 'pass' ? 'default' : 'destructive'}>
                            {result.result?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditResult(result)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">{viewingSession.results.length}</div>
                <div className="text-sm text-blue-600">Total Items</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {viewingSession.results.filter((r: any) => r.result === 'pass').length}
                </div>
                <div className="text-sm text-green-600">Passed</div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="text-2xl font-bold text-red-600">
                  {viewingSession.results.filter((r: any) => r.result === 'fail').length}
                </div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <Button
                variant="outline"
                onClick={() => handleAddItem(viewingSession.session)}
                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Item
              </Button>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownloadReport(viewingSession.session, 'pdf')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadReport(viewingSession.session, 'excel')}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Excel
                </Button>
                <Button
                  onClick={() => {
                    setIsViewReportModalOpen(false);
                    setViewingSession(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Result Modal */}
      <Modal
        isOpen={isEditResultModalOpen}
        onClose={() => {
          setIsEditResultModalOpen(false);
          setEditingResult(null);
        }}
        title="Edit Test Result"
        className="max-w-2xl"
      >
        {editingResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editItemName">Item Type</Label>
                <Input
                  id="editItemName"
                  type="text"
                  value={editResultData.itemName}
                  onChange={(e) => setEditResultData(prev => ({ ...prev, itemName: e.target.value }))}
                  placeholder="Enter item type"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editLocation">Location</Label>
                <Input
                  id="editLocation"
                  type="text"
                  value={editResultData.location}
                  onChange={(e) => setEditResultData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Enter location"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editClassification">Classification</Label>
                <Select
                  value={editResultData.classification}
                  onValueChange={(value) => setEditResultData(prev => ({ ...prev, classification: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class1">Class 1</SelectItem>
                    <SelectItem value="class2">Class 2</SelectItem>
                    <SelectItem value="epod">EPOD</SelectItem>
                    <SelectItem value="rcd">RCD</SelectItem>
                    <SelectItem value="3phase">3 Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editFrequency">Test Frequency</Label>
                <Select
                  value={editResultData.frequency}
                  onValueChange={(value) => setEditResultData(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threemonthly">3 Monthly</SelectItem>
                    <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                    <SelectItem value="twelvemonthly">12 Monthly</SelectItem>
                    <SelectItem value="twentyfourmonthly">24 Monthly</SelectItem>
                    <SelectItem value="fiveyearly">5 Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editResult">Test Result</Label>
              <Select
                value={editResultData.result}
                onValueChange={(value) => setEditResultData(prev => ({ ...prev, result: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pass">Pass</SelectItem>
                  <SelectItem value="fail">Fail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editResultData.result === 'fail' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editFailureReason">Failure Reason</Label>
                    <Select
                      value={editResultData.failureReason || ""}
                      onValueChange={(value) => setEditResultData(prev => ({ ...prev, failureReason: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select failure reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vision">Visual Inspection</SelectItem>
                        <SelectItem value="earth">Earth</SelectItem>
                        <SelectItem value="insulation">Insulation</SelectItem>
                        <SelectItem value="polarity">Polarity</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editActionTaken">Action Taken</Label>
                    <Select
                      value={editResultData.actionTaken || ""}
                      onValueChange={(value) => setEditResultData(prev => ({ ...prev, actionTaken: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action taken" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="given">Given to User</SelectItem>
                        <SelectItem value="removed">Removed from Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editNotes">Notes (Optional)</Label>
                  <Input
                    id="editNotes"
                    type="text"
                    value={editResultData.notes || ""}
                    onChange={(e) => setEditResultData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Enter any additional notes"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditResultModalOpen(false);
                  setEditingResult(null);
                }}
                disabled={updateResultMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateResult}
                disabled={updateResultMutation.isPending}
              >
                {updateResultMutation.isPending ? "Updating..." : "Update Result"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddItemModalOpen}
        onClose={() => {
          setIsAddItemModalOpen(false);
          setAddingToSession(null);
        }}
        title="Add New Item"
        className="max-w-2xl"
      >
        {addingToSession && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Adding item to:</h3>
              <div className="text-sm">
                <span className="font-medium">Client:</span> {addingToSession.clientName} | 
                <span className="font-medium"> Date:</span> {new Date(addingToSession.testDate).toLocaleDateString('en-AU')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newItemName">Item Type *</Label>
                <Input
                  id="newItemName"
                  type="text"
                  value={newItemData.itemName}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, itemName: e.target.value }))}
                  placeholder="Enter item type"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newLocation">Location *</Label>
                <Input
                  id="newLocation"
                  type="text"
                  value={newItemData.location}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Enter location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newAssetNumber">Asset Number</Label>
                <Input
                  id="newAssetNumber"
                  type="text"
                  value={newItemData.assetNumber}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, assetNumber: e.target.value }))}
                  placeholder="Auto-generated if empty"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newClassification">Classification</Label>
                <Select
                  value={newItemData.classification}
                  onValueChange={(value) => setNewItemData(prev => ({ ...prev, classification: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class1">Class 1</SelectItem>
                    <SelectItem value="class2">Class 2</SelectItem>
                    <SelectItem value="epod">EPOD</SelectItem>
                    <SelectItem value="rcd">RCD</SelectItem>
                    <SelectItem value="3phase">3 Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newResult">Test Result</Label>
                <Select
                  value={newItemData.result}
                  onValueChange={(value) => setNewItemData(prev => ({ ...prev, result: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pass">Pass</SelectItem>
                    <SelectItem value="fail">Fail</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newFrequency">Test Frequency</Label>
                <Select
                  value={newItemData.frequency}
                  onValueChange={(value) => setNewItemData(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threemonthly">3 Monthly</SelectItem>
                    <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                    <SelectItem value="twelvemonthly">12 Monthly</SelectItem>
                    <SelectItem value="twentyfourmonthly">24 Monthly</SelectItem>
                    <SelectItem value="fiveyearly">5 Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Visual Inspection and Electrical Test Checkboxes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newVisualInspection"
                  checked={newItemData.visualInspection}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, visualInspection: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <Label htmlFor="newVisualInspection" className="text-sm">Visual Inspection</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newElectricalTest"
                  checked={newItemData.electricalTest}
                  onChange={(e) => setNewItemData(prev => ({ ...prev, electricalTest: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <Label htmlFor="newElectricalTest" className="text-sm">Electrical Test</Label>
              </div>
            </div>

            {/* Failure Details (only show if result is fail) */}
            {newItemData.result === "fail" && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="newFailureReason">Failure Reason</Label>
                  <Select
                    value={newItemData.failureReason || ""}
                    onValueChange={(value) => setNewItemData(prev => ({ ...prev, failureReason: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select failure reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vision">Visual</SelectItem>
                      <SelectItem value="earth">Earth</SelectItem>
                      <SelectItem value="insulation">Insulation</SelectItem>
                      <SelectItem value="polarity">Polarity</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newActionTaken">Action Taken</Label>
                  <Select
                    value={newItemData.actionTaken || ""}
                    onValueChange={(value) => setNewItemData(prev => ({ ...prev, actionTaken: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action taken" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given">Given to User</SelectItem>
                      <SelectItem value="removed">Removed from Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddItemModalOpen(false);
                  setAddingToSession(null);
                }}
                disabled={addItemMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveNewItem}
                disabled={addItemMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}