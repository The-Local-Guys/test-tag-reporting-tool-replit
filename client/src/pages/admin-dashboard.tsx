import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  Users,
  FileText,
  Download,
  Edit,
  Trash2,
  UserCheck,
  UserX,

  UserPlus,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { generatePDFReport, downloadPDF } from "@/lib/pdf-generator";
import { generateExcelReport, downloadExcel } from "@/lib/excel-generator";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";

/**
 * Administrative dashboard for managing users, sessions, and system oversight
 * Provides user management, session editing, data export, and system monitoring
 * Restricted to super_admin and support_center roles
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: 'super_admin' | 'support_center' | 'technician'; id?: number } | undefined;
  
  // Role-based access control
  const hasAdminAccess = typedUser && (typedUser.role === 'super_admin' || typedUser.role === 'support_center');
  const isTechnician = typedUser && typedUser.role === 'technician';
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
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [editUserData, setEditUserData] = useState({
    username: "",
    fullName: "",
    role: "technician" as "technician" | "support_center" | "super_admin",
    newPassword: "",
    confirmPassword: "",
  });
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
  const [selectedTechnicianFilter, setSelectedTechnicianFilter] =
    useState<string>("all");

  // Pagination states
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Asset number calculation states
  const [monthlyAssetCount, setMonthlyAssetCount] = useState(0);
  const [fiveYearlyAssetCount, setFiveYearlyAssetCount] = useState(0);
  
  const [editResultData, setEditResultData] = useState({
    itemName: "",
    location: "",
    assetNumber: "",
    classification: "class1" as any,
    result: "pass" as any,
    frequency: "twelvemonthly" as any,
    failureReason: null as any,
    actionTaken: null as any,
    notes: null as any,
  });

  const [assetNumberError, setAssetNumberError] = useState<string>("");
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

  const [newItemAssetNumberError, setNewItemAssetNumberError] = useState<string>("");
  
  // Delete result state
  const [deletingResult, setDeletingResult] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
  });

  // Fetch all test sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/admin/sessions"],
    retry: false,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
  });

  // Force refresh data when component mounts or when navigating to admin
  useEffect(() => {
    console.log('Admin dashboard mounted, refreshing data...');
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
  }, [queryClient]);

  // Filter sessions based on selected technician and sort by newest first
  const filteredSessions = Array.isArray(sessions)
    ? sessions
        .filter((session: any) => {
          if (selectedTechnicianFilter === "all") return true;
          return (
            (session.technicianFullName || session.technicianName) ===
            selectedTechnicianFilter
          );
        })
        .sort((a: any, b: any) => {
          // Sort by creation timestamp descending (newest first), fall back to test date
          const dateA = new Date(a.createdAt || a.testDate);
          const dateB = new Date(b.createdAt || b.testDate);
          return dateB.getTime() - dateA.getTime();
        })
    : [];

  // Get unique technician names for filter dropdown
  const uniqueTechnicians = Array.isArray(sessions)
    ? [
        ...Array.from(new Set(
          sessions.map(
            (session: any) =>
              session.technicianFullName || session.technicianName,
          ),
        )),
      ]
        .filter(Boolean)
        .sort()
    : [];

  // Update user status mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: number;
      isActive: boolean;
    }) => {
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
      const response = await fetch(`/api/sessions/${sessionId}`, {
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
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: number;
      data: any;
    }) => {
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
    mutationFn: async ({
      id,
      data,
      sessionId,
    }: {
      id: number;
      data: any;
      sessionId: number;
    }) => {
      const res = await fetch(`/api/sessions/${sessionId}/results/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update test result");
      return res.json();
    },
    onSuccess: (updatedResult) => {
      // Update the local viewing session state immediately for real-time UI updates
      if (viewingSession && editingResult) {
        console.log('Updating local state with:', updatedResult);
        const updatedResults = viewingSession.results.map((result: any) => 
          result.id === editingResult.id ? { 
            ...result, 
            ...updatedResult,
            // Ensure itemType is updated from the response
            itemType: updatedResult.itemName || updatedResult.itemType || result.itemType,
            assetNumber: updatedResult.assetNumber || result.assetNumber
          } : result
        );
        
        console.log('Updated results array:', updatedResults);
        
        // Sort results by asset number for proper display order
        const sortedResults = sortAssetNumbers(updatedResults);
        
        // Recalculate asset counts after the update for future calculations
        calculateAssetCounts(sortedResults);
        
        // Update the viewing session with new results
        setViewingSession({
          ...viewingSession,
          results: sortedResults
        });
        
        console.log('Local viewing session updated');
      }
      
      // Also invalidate queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      if (viewingSession?.session?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/sessions", viewingSession.session.id, "full"],
        });
      }
      
      toast({
        title: "Success",
        description: "Test result updated successfully",
      });
      setIsEditResultModalOpen(false);
      setEditingResult(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update test result",
        variant: "destructive",
      });
    },
  });

  // Delete test result mutation
  const deleteResultMutation = useMutation({
    mutationFn: async ({ sessionId, resultId }: { sessionId: number; resultId: number }) => {
      const response = await fetch(`/api/sessions/${sessionId}/results/${resultId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete test result");
      }

      return response.json();
    },
    onSuccess: (_, { resultId }) => {
      // Update the local viewing session state immediately for real-time UI updates
      if (viewingSession) {
        console.log('Removing result from local state:', resultId);
        const updatedResults = viewingSession.results.filter((result: any) => 
          result.id !== resultId
        );
        
        console.log('Updated results array after deletion:', updatedResults);
        
        // Sort results by asset number for proper display order
        const sortedResults = sortAssetNumbers(updatedResults);
        
        // Recalculate asset counts after the deletion
        calculateAssetCounts(sortedResults);
        
        // Update the viewing session with new results
        setViewingSession({
          ...viewingSession,
          results: sortedResults
        });
        
        console.log('Local viewing session updated after deletion');
      }
      
      // Also invalidate queries to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      if (viewingSession?.session?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/sessions", viewingSession.session.id, "full"],
        });
      }
      
      toast({
        title: "Success",
        description: "Test result deleted successfully",
      });
      setIsDeleteModalOpen(false);
      setDeletingResult(null);
      setIsDeleting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete test result",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: any }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setIsEditUserModalOpen(false);
      setEditingUser(null);
      setEditUserData({
        username: "",
        fullName: "",
        role: "technician",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setIsChangePasswordModalOpen(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: number;
      data: any;
    }) => {
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
        queryClient.invalidateQueries({
          queryKey: ["/api/session", viewingSession.session.id],
        });
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

  /**
   * Sort test results by asset number with proper numerical order
   * Monthly frequencies (1, 2, 3...) display first, then 5-yearly (10001, 10002, 10003...)
   */
  const sortAssetNumbers = (results: any[]) => {
    return [...results].sort((a: any, b: any) => {
      const aAssetNum = parseInt(a.assetNumber) || 0;
      const bAssetNum = parseInt(b.assetNumber) || 0;
      return aAssetNum - bAssetNum;
    });
  };

  /**
   * Helper function to find the next available asset number within a range
   * @param usedNumbers - Set of asset numbers already in use
   * @param start - Starting number for the range (1 for monthly, 10001 for 5-yearly)
   * @returns Next available asset number in the specified range
   */
  const getNextAvailableAssetNumber = (usedNumbers: Set<number>, start: number): number => {
    let candidate = start;
    
    // Keep incrementing until we find an unused number
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
    
    return candidate;
  };

  /**
   * Renumber assets to ensure unique asset numbers within the session
   * Takes into account manually edited asset numbers and finds next available slots
   * @param changingResultId - ID of the result being changed (optional)
   * @param newFrequency - New frequency for the changing result (optional)
   * @returns Next available asset number for the frequency type
   */
  const renumberAssets = (changingResultId?: number, newFrequency?: string): string => {
    // Guard against missing session data
    if (!viewingSession?.results) {
      console.warn('renumberAssets: viewingSession or results is missing');
      return newFrequency === 'fiveyearly' ? '10001' : '1';
    }

    // Get all existing asset numbers, excluding the one being changed
    const usedNumbers = new Set<number>();
    
    viewingSession.results.forEach((result: any) => {
      // Skip the result being changed, as it will get a new number
      if (changingResultId && result.id === changingResultId) {
        return;
      }
      
      // Parse asset number and add to used set if valid
      const assetNum = parseInt(result.assetNumber);
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // If we're updating a specific result's frequency, get the next available number for that frequency
    if (newFrequency) {
      const startNumber = newFrequency === 'fiveyearly' ? 10001 : 1;
      const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
      return nextAvailable.toString();
    }

    // If no specific frequency provided, default to monthly frequency logic
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, 1);
    return nextAvailable.toString();
  };

  /**
   * Calculate asset number counts for monthly and 5-yearly frequencies
   * Used to determine next available asset numbers when editing frequency
   */
  const calculateAssetCounts = (results: any[]) => {
    const monthlyCount = results.filter(r => r.frequency !== 'fiveyearly').length;
    const fiveYearlyCount = results.filter(r => r.frequency === 'fiveyearly').length;
    
    setMonthlyAssetCount(monthlyCount);
    setFiveYearlyAssetCount(fiveYearlyCount);
    
    return { monthlyCount, fiveYearlyCount };
  };

  const handleViewReport = async (session: any) => {
    console.log("Session object:", session);

    // Handle both session object and direct session ID
    const sessionId = typeof session === "object" ? session.id : session;
    console.log("Session ID:", sessionId);

    if (!sessionId) {
      toast({
        title: "Error loading report",
        description: "Invalid session ID",
        variant: "destructive",
      });
      return;
    }

    try {
      // Show loading state if needed (optional enhancement)
      console.log(`Fetching latest report data for session ${sessionId}...`);

      const response = await fetch(`/api/sessions/${sessionId}/full`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch report data`);
      }

      const reportData = await response.json();
      console.log(
        `Successfully fetched report data with ${reportData.results?.length || 0} test results`,
      );

      // Calculate asset number counts for this session
      if (reportData.results) {
        calculateAssetCounts(reportData.results);
      }

      // Update state with fresh data
      setViewingSession(reportData);
      setCurrentPage(1); // Reset to first page when opening report

      // Only open modal after successful data fetch and state update
      setIsViewReportModalOpen(true);
    } catch (error) {
      console.error("Error loading report:", error);
      toast({
        title: "Error loading report",
        description: `Failed to load the full report data: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const handleEditSession = (session: any) => {
    setEditingSession(session);
    setEditSessionData({
      clientName: session.clientName,
      technicianName: session.technicianName,
      testDate: session.testDate.split("T")[0], // Convert to YYYY-MM-DD format
      address: session.address,
      siteContact: session.siteContact,
      country: session.country,
    });
    setIsEditSessionModalOpen(true);
  };

  const handleUpdateSession = () => {
    if (
      !editSessionData.clientName ||
      !editSessionData.technicianName ||
      !editSessionData.testDate ||
      !editSessionData.address ||
      !editSessionData.siteContact
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    updateSessionMutation.mutate({
      sessionId: editingSession.id,
      data: editSessionData,
    });
  };

  const handleEditResult = (result: any) => {
    setEditingResult(result);
    setEditResultData({
      itemName: result.itemType || "",
      location: result.location || "",
      assetNumber: result.assetNumber || "",
      classification: result.classification || "class1",
      result: result.result || "pass",
      frequency: result.frequency || "twelvemonthly",
      failureReason: result.failureReason,
      actionTaken: result.actionTaken,
      notes: result.notes,
    });
    setAssetNumberError(""); // Clear any previous errors
    setIsEditResultModalOpen(true);
  };

  /**
   * Validate asset number for duplicates and range requirements
   * Checks if the entered asset number already exists and follows frequency rules
   */
  const validateAssetNumber = (assetNumber: string, frequency: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
    }

    // Validate range based on frequency
    if (frequency === 'fiveyearly') {
      if (assetNum < 10000) {
        return "5-yearly items must have asset numbers starting from 10000";
      }
    } else {
      // Monthly frequencies should be 1-9999
      if (assetNum >= 10000) {
        return "Monthly frequency items must have asset numbers below 10000";
      }
    }

    if (!viewingSession?.results) {
      return "";
    }

    // Check for duplicates (excluding the current item being edited)
    const isDuplicate = viewingSession.results.some((result: any) => 
      result.assetNumber === assetNumber && result.id !== editingResult?.id
    );

    if (isDuplicate) {
      return `Asset number ${assetNumber} is already in use`;
    }

    return "";
  };

  /**
   * Handle asset number input changes with real-time validation
   */
  const handleAssetNumberChange = (value: string) => {
    setEditResultData(prev => ({ ...prev, assetNumber: value }));
    const error = validateAssetNumber(value, editResultData.frequency);
    setAssetNumberError(error);
  };

  /**
   * Handle frequency changes - clear asset number when frequency changes
   */
  const handleFrequencyChange = (newFrequency: string) => {
    setEditResultData(prev => ({ 
      ...prev, 
      frequency: newFrequency,
      assetNumber: "" // Clear asset number when frequency changes
    }));
    setAssetNumberError("Asset number is required"); // Show validation error for empty field
  };

  /**
   * Manual asset number update function - requires user to enter asset number
   * Validates for duplicates and provides real-time feedback
   */
  const handleUpdateResult = () => {
    if (!editingResult || !viewingSession?.session?.id) return;

    // Validate asset number before proceeding
    const assetError = validateAssetNumber(editResultData.assetNumber, editResultData.frequency);
    if (assetError) {
      setAssetNumberError(assetError);
      toast({
        title: "Invalid Asset Number",
        description: assetError,
        variant: "destructive",
      });
      return;
    }

    // Prepare update data with manually entered asset number
    const updateData = {
      itemName: editResultData.itemName,
      location: editResultData.location,
      assetNumber: editResultData.assetNumber,
      classification: editResultData.classification,
      result: editResultData.result,
      frequency: editResultData.frequency,
      failureReason: editResultData.failureReason,
      actionTaken: editResultData.actionTaken,
      notes: editResultData.notes,
    };

    console.log(`Admin: Manually updating asset number to: ${editResultData.assetNumber}`);

    updateResultMutation.mutate({
      id: editingResult.id,
      sessionId: viewingSession.session.id,
      data: updateData,
    });
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setEditUserData({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      newPassword: "",
      confirmPassword: "",
    });
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;

    // Validate required fields
    if (!editUserData.username || !editUserData.fullName) {
      toast({
        title: "Error",
        description: "Username and Full Name are required",
        variant: "destructive",
      });
      return;
    }

    // Validate password if provided
    if (editUserData.newPassword || editUserData.confirmPassword) {
      if (editUserData.newPassword !== editUserData.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }
      if (editUserData.newPassword.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }
    }

    const updateData: any = {
      username: editUserData.username,
      fullName: editUserData.fullName,
      role: editUserData.role,
    };

    // Include password only if provided
    if (editUserData.newPassword) {
      updateData.password = editUserData.newPassword;
    }

    editUserMutation.mutate({
      userId: editingUser.id,
      data: updateData,
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
    setNewItemAssetNumberError("Asset number is required"); // Show validation error for empty field
    setIsAddItemModalOpen(true);
  };

  /**
   * Handle continuing an existing report - sets session and navigates to item selection
   */
  const handleContinueReport = (session: any) => {
    console.log(`Starting continue for session ${session.id}`);
    
    // Clear any existing session data to prevent conflicts
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('unfinished');
    localStorage.removeItem('unfinishedSessionId');
    
    // Remove any existing batched results for this session
    localStorage.removeItem(`batchedResults_${session.id}`);
    localStorage.removeItem(`monthlyCounter_${session.id}`);
    localStorage.removeItem(`fiveYearlyCounter_${session.id}`);
    
    // Set new session data for continuation
    localStorage.setItem('currentSessionId', session.id.toString());
    localStorage.setItem('unfinished', 'true');
    localStorage.setItem('unfinishedSessionId', session.id.toString());
    
    console.log(`Set continuation flags for session ${session.id}, navigating to items`);
    
    // Navigate to item selection page to continue adding items
    window.location.href = '/items';
  };

  /**
   * Validate new item asset number for duplicates and range requirements
   */
  const validateNewItemAssetNumber = (assetNumber: string, frequency: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
    }

    // Validate range based on frequency
    if (frequency === 'fiveyearly') {
      if (assetNum < 10000) {
        return "5-yearly items must have asset numbers starting from 10000";
      }
    } else {
      // Monthly frequencies should be 1-9999
      if (assetNum >= 10000) {
        return "Monthly frequency items must have asset numbers below 10000";
      }
    }

    if (!addingToSession) {
      return "";
    }

    // Get current session results for duplicate checking
    // We'll validate against the session we're adding to
    if (viewingSession && viewingSession.session.id === addingToSession.id) {
      const isDuplicate = viewingSession.results.some((result: any) => 
        result.assetNumber === assetNumber
      );
      if (isDuplicate) {
        return `Asset number ${assetNumber} is already in use`;
      }
    }

    return "";
  };

  /**
   * Handle new item asset number input changes with validation
   */
  const handleNewItemAssetNumberChange = (value: string) => {
    setNewItemData(prev => ({ ...prev, assetNumber: value }));
    const error = validateNewItemAssetNumber(value, newItemData.frequency);
    setNewItemAssetNumberError(error);
  };

  /**
   * Handle delete result action - shows confirmation dialog
   */
  const handleDeleteResult = (result: any) => {
    setDeletingResult(result);
    setIsDeleteModalOpen(true);
  };

  /**
   * Confirm and execute result deletion
   */
  const confirmDeleteResult = () => {
    if (!deletingResult || !viewingSession?.session?.id) return;

    setIsDeleting(true);
    deleteResultMutation.mutate({
      sessionId: viewingSession.session.id,
      resultId: deletingResult.id,
    });
  };

  /**
   * Cancel result deletion
   */
  const cancelDeleteResult = () => {
    setIsDeleteModalOpen(false);
    setDeletingResult(null);
    setIsDeleting(false);
  };

  /**
   * Handle new item frequency changes - clear asset number when frequency changes
   */
  const handleNewItemFrequencyChange = (newFrequency: string) => {
    setNewItemData(prev => ({ 
      ...prev, 
      frequency: newFrequency,
      assetNumber: "" // Clear asset number when frequency changes
    }));
    setNewItemAssetNumberError("Asset number is required"); // Show validation error for empty field
  };

  const handleSaveNewItem = async () => {
    if (!newItemData.itemName || !newItemData.location || !addingToSession) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate asset number before proceeding
    const assetError = validateNewItemAssetNumber(newItemData.assetNumber, newItemData.frequency);
    if (assetError) {
      setNewItemAssetNumberError(assetError);
      toast({
        title: "Invalid Asset Number",
        description: assetError,
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      itemName: newItemData.itemName,
      itemType: newItemData.itemName,
      location: newItemData.location,
      assetNumber: newItemData.assetNumber,
      classification: newItemData.classification,
      result: newItemData.result,
      frequency: newItemData.frequency,
      failureReason:
        newItemData.result === "fail" ? newItemData.failureReason : null,
      actionTaken:
        newItemData.result === "fail" ? newItemData.actionTaken : null,
      visualInspection: newItemData.visualInspection,
      electricalTest: newItemData.electricalTest,
      notes: null,
      photoData: null,
    };

    console.log(`Admin: Adding new item with asset number: ${newItemData.assetNumber}`);

    addItemMutation.mutate({
      sessionId: addingToSession.id,
      data: itemData,
    });
  };

  const handleCreateUser = () => {
    if (
      !newUserData.username ||
      !newUserData.password ||
      !newUserData.fullName
    ) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createUser.mutate(newUserData);
  };

  const handleDownloadReport = async (
    session: any,
    format: "pdf" | "excel",
  ) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/report`);
      if (!response.ok) throw new Error("Failed to fetch report data");

      const reportData = await response.json();
      const filename = `${session.clientName}-${session.testDate}`;

      if (format === "pdf") {
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
    totalUsers: Array.isArray(users) ? users.length : 0,
    activeUsers: Array.isArray(users) ? users.filter((u: any) => u.isActive).length : 0,
    totalReports: Array.isArray(sessions) ? sessions.length : 0,
    recentReports: Array.isArray(sessions)
      ? sessions.filter((s: any) => {
          const sessionDate = new Date(s.createdAt);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return sessionDate > weekAgo;
        }).length
      : 0,
  };

  console.log(process.env.NODE_ENV);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <img src={logoPath} alt="The Local Guys" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-gray-600">Welcome, {typedUser?.fullName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Change Password</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          className={`grid gap-6 mb-8 ${typedUser?.role === "technician" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-4"}`}
        >
          {/* Only show user stats for super admins and support center */}
          {(typedUser?.role === "super_admin" ||
            typedUser?.role === "support_center") && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Users
                  </CardTitle>
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
                {typedUser?.role === "technician" ? "My Reports" : "Total Reports"}
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
        <Tabs
          defaultValue={typedUser?.role === "technician" ? "reports" : "users"}
          className="space-y-4"
        >
          <TabsList>
            {(typedUser?.role === "super_admin" ||
              typedUser?.role === "support_center") && (
              <TabsTrigger value="users">User Management</TabsTrigger>
            )}
            <TabsTrigger value="reports">
              {typedUser?.role === "technician" ? "My Reports" : "All Reports"}
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
                      {Array.isArray(users) && users.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.fullName}
                          </TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.role === "admin" ? "default" : "secondary"
                              }
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.isActive ? "default" : "destructive"
                              }
                            >
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(user.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditUser(user)}
                                className="flex items-center space-x-1"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                              </Button>
                              <Switch
                                checked={user.isActive}
                                onCheckedChange={(checked) =>
                                  updateUserStatusMutation.mutate({
                                    userId: user.id,
                                    isActive: checked,
                                  })
                                }
                                disabled={user.role === "admin"}
                              />
                              <span className="text-sm text-gray-600">
                                {user.isActive ? "Active" : "Inactive"}
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
                {(typedUser?.role === "super_admin" ||
                  typedUser?.role === "support_center") && (
                  <div className="mb-4">
                    <Label
                      htmlFor="technicianFilter"
                      className="text-sm font-medium"
                    >
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
                        <TableHead>Client Name</TableHead>
                        <TableHead>Service Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.clientName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                session.serviceType === "emergency_exit_light"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-blue-50 text-blue-700"
                              }
                            >
                              {session.serviceType === "emergency_exit_light"
                                ? "Emergency Exit Light"
                                : "Electrical Test & Tag"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(session.testDate).toLocaleDateString(
                              "en-AU",
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewReport(session)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View
                            </Button>
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
              onChange={(e) =>
                setNewUserData((prev) => ({
                  ...prev,
                  fullName: e.target.value,
                }))
              }
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
              onChange={(e) =>
                setNewUserData((prev) => ({
                  ...prev,
                  username: e.target.value,
                }))
              }
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
              onChange={(e) =>
                setNewUserData((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              placeholder="Enter password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Access Level</Label>
            <Select
              value={newUserData.role}
              onValueChange={(
                value: "technician" | "support_center" | "super_admin",
              ) => setNewUserData((prev) => ({ ...prev, role: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select access level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="support_center">
                  Support Center Staff
                </SelectItem>
                {typedUser?.role === "super_admin" && (
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-600">
              {newUserData.role === "super_admin"
                ? "Highest level access - full system control (Jarrad151 only)"
                : newUserData.role === "support_center"
                  ? "Can view/edit all reports, manage technician users"
                  : "Can view/edit own reports only"}
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
            <Button onClick={handleCreateUser} disabled={createUser.isPending}>
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
              onChange={(e) =>
                setEditSessionData((prev) => ({
                  ...prev,
                  clientName: e.target.value,
                }))
              }
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
              onChange={(e) =>
                setEditSessionData((prev) => ({
                  ...prev,
                  technicianName: e.target.value,
                }))
              }
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
              onChange={(e) =>
                setEditSessionData((prev) => ({
                  ...prev,
                  testDate: e.target.value,
                }))
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editAddress">Address</Label>
            <Input
              id="editAddress"
              type="text"
              value={editSessionData.address}
              onChange={(e) =>
                setEditSessionData((prev) => ({
                  ...prev,
                  address: e.target.value,
                }))
              }
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
              onChange={(e) =>
                setEditSessionData((prev) => ({
                  ...prev,
                  siteContact: e.target.value,
                }))
              }
              placeholder="Enter site contact"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editCountry">Country</Label>
            <Select
              value={editSessionData.country}
              onValueChange={(value: "australia" | "newzealand") =>
                setEditSessionData((prev) => ({ ...prev, country: value }))
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
              {updateSessionMutation.isPending
                ? "Updating..."
                : "Update Session"}
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
                  <span className="font-medium">Client:</span>{" "}
                  {viewingSession.session.clientName}
                </div>
                <div>
                  <span className="font-medium">Technician:</span>{" "}
                  {viewingSession.session.technicianName}
                </div>
                <div>
                  <span className="font-medium">Date:</span>{" "}
                  {new Date(viewingSession.session.testDate).toLocaleDateString(
                    "en-AU",
                  )}
                </div>
                <div>
                  <span className="font-medium">Location:</span>{" "}
                  {viewingSession.session.address}
                </div>
              </div>
            </div>

            {/* Test Results */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">
                  Test Results ({viewingSession.results.length} items)
                </h3>
                <div className="flex items-center space-x-2">
                  {/* Items per page selector */}
                  <Label htmlFor="itemsPerPage" className="text-sm">
                    Items per page:
                  </Label>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(parseInt(value));
                      setCurrentPage(1); // Reset to first page
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => handleAddItem(viewingSession.session)}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                </div>
              </div>
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
                    {(() => {
                      // Sort results using the dedicated sorting function
                      const sortedResults = sortAssetNumbers(viewingSession.results);

                      const totalItems = sortedResults.length;
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedResults = sortedResults.slice(
                        startIndex,
                        endIndex,
                      );

                      return paginatedResults.map((result: any) => (
                        <TableRow key={result.id}>
                          <TableCell className="font-mono">
                            {result.assetNumber}
                          </TableCell>
                          <TableCell>{result.itemType}</TableCell>
                          <TableCell>{result.location || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {result.classification?.replace(
                                "class",
                                "Class ",
                              ) || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {result.frequency
                                ?.replace("monthly", "M")
                                .replace("yearly", "Y") || "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                result.result === "pass"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {result.result?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditResult(result)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteResult(result)}
                                className="text-red-600 hover:bg-red-50 hover:border-red-300"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const sortedResults = sortAssetNumbers(viewingSession.results);
                const totalItems = sortedResults.length;
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = Math.min(
                  startIndex + itemsPerPage,
                  totalItems,
                );

                if (totalPages <= 1) return null;

                return (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-500">
                      Showing {startIndex + 1} to {endIndex} of {totalItems}{" "}
                      items
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>

                      {/* Page numbers */}
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => {
                          const pageNum = i + 1;
                          const isCurrentPage = pageNum === currentPage;
                          const shouldShow =
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= currentPage - 1 &&
                              pageNum <= currentPage + 1);

                          if (!shouldShow) {
                            if (
                              pageNum === currentPage - 2 ||
                              pageNum === currentPage + 2
                            ) {
                              return (
                                <span
                                  key={pageNum}
                                  className="px-2 text-gray-400"
                                >
                                  ...
                                </span>
                              );
                            }
                            return null;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={isCurrentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-8 h-8 p-0"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {viewingSession.results.length}
                </div>
                <div className="text-sm text-blue-600">Total Items</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {
                    viewingSession.results.filter(
                      (r: any) => r.result === "pass",
                    ).length
                  }
                </div>
                <div className="text-sm text-green-600">Passed</div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="text-2xl font-bold text-red-600">
                  {
                    viewingSession.results.filter(
                      (r: any) => r.result === "fail",
                    ).length
                  }
                </div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() =>
                  handleDownloadReport(viewingSession.session, "pdf")
                }
              >
                <Download className="w-4 h-4 mr-1" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  handleDownloadReport(viewingSession.session, "excel")
                }
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
                  onChange={(e) =>
                    setEditResultData((prev) => ({
                      ...prev,
                      itemName: e.target.value,
                    }))
                  }
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
                  onChange={(e) =>
                    setEditResultData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  placeholder="Enter location"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAssetNumber">Asset Number *</Label>
              <Input
                id="editAssetNumber"
                type="text"
                value={editResultData.assetNumber}
                onChange={(e) => handleAssetNumberChange(e.target.value)}
                placeholder={editResultData.frequency === 'fiveyearly' ? "Enter number starting from 10000" : "Enter asset number (1-9999)"}
                className={assetNumberError ? "border-red-500 focus:border-red-500" : ""}
              />
              {assetNumberError && (
                <p className="text-sm text-red-500 mt-1">{assetNumberError}</p>
              )}
              <p className="text-sm text-gray-500">
                {editResultData.frequency === 'fiveyearly' 
                  ? "5-yearly items: Use numbers 10000 and above" 
                  : "Monthly frequencies: Use numbers 1-9999"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editClassification">Classification</Label>
                <Select
                  value={editResultData.classification}
                  onValueChange={(value) =>
                    setEditResultData((prev) => ({
                      ...prev,
                      classification: value,
                    }))
                  }
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
                  onValueChange={handleFrequencyChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threemonthly">3 Monthly</SelectItem>
                    <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                    <SelectItem value="twelvemonthly">12 Monthly</SelectItem>
                    <SelectItem value="twentyfourmonthly">
                      24 Monthly
                    </SelectItem>
                    <SelectItem value="fiveyearly">5 Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editResult">Test Result</Label>
              <Select
                value={editResultData.result}
                onValueChange={(value) =>
                  setEditResultData((prev) => ({ ...prev, result: value }))
                }
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

            {editResultData.result === "fail" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editFailureReason">Failure Reason</Label>
                    <Select
                      value={editResultData.failureReason || ""}
                      onValueChange={(value) =>
                        setEditResultData((prev) => ({
                          ...prev,
                          failureReason: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select failure reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vision">
                          Visual Inspection
                        </SelectItem>
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
                      onValueChange={(value) =>
                        setEditResultData((prev) => ({
                          ...prev,
                          actionTaken: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action taken" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="given">Given to User</SelectItem>
                        <SelectItem value="removed">
                          Removed from Service
                        </SelectItem>
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
                    onChange={(e) =>
                      setEditResultData((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
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
                disabled={updateResultMutation.isPending || !!assetNumberError}
              >
                {updateResultMutation.isPending
                  ? "Updating..."
                  : "Update Result"}
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
                <span className="font-medium">Client:</span>{" "}
                {addingToSession.clientName} |
                <span className="font-medium"> Date:</span>{" "}
                {new Date(addingToSession.testDate).toLocaleDateString("en-AU")}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newItemName">Item Type *</Label>
                <Input
                  id="newItemName"
                  type="text"
                  value={newItemData.itemName}
                  onChange={(e) =>
                    setNewItemData((prev) => ({
                      ...prev,
                      itemName: e.target.value,
                    }))
                  }
                  placeholder="Enter item type"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newLocation">Location *</Label>
                <Input
                  id="newLocation"
                  type="text"
                  value={newItemData.location}
                  onChange={(e) =>
                    setNewItemData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                  placeholder="Enter location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newAssetNumber">Asset Number *</Label>
                <Input
                  id="newAssetNumber"
                  type="text"
                  value={newItemData.assetNumber}
                  onChange={(e) => handleNewItemAssetNumberChange(e.target.value)}
                  placeholder={newItemData.frequency === 'fiveyearly' ? "Enter number starting from 10000" : "Enter asset number (1-9999)"}
                  className={newItemAssetNumberError ? "border-red-500 focus:border-red-500" : ""}
                />
                {newItemAssetNumberError && (
                  <p className="text-sm text-red-500 mt-1">{newItemAssetNumberError}</p>
                )}
                <p className="text-sm text-gray-500">
                  {newItemData.frequency === 'fiveyearly' 
                    ? "5-yearly items: Use numbers 10000 and above" 
                    : "Monthly frequencies: Use numbers 1-9999"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newClassification">Classification</Label>
                <Select
                  value={newItemData.classification}
                  onValueChange={(value) =>
                    setNewItemData((prev) => ({
                      ...prev,
                      classification: value,
                    }))
                  }
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
                  onValueChange={(value) =>
                    setNewItemData((prev) => ({ ...prev, result: value }))
                  }
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
                  onValueChange={handleNewItemFrequencyChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="threemonthly">3 Monthly</SelectItem>
                    <SelectItem value="sixmonthly">6 Monthly</SelectItem>
                    <SelectItem value="twelvemonthly">12 Monthly</SelectItem>
                    <SelectItem value="twentyfourmonthly">
                      24 Monthly
                    </SelectItem>
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
                  onChange={(e) =>
                    setNewItemData((prev) => ({
                      ...prev,
                      visualInspection: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <Label htmlFor="newVisualInspection" className="text-sm">
                  Visual Inspection
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="newElectricalTest"
                  checked={newItemData.electricalTest}
                  onChange={(e) =>
                    setNewItemData((prev) => ({
                      ...prev,
                      electricalTest: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <Label htmlFor="newElectricalTest" className="text-sm">
                  Electrical Test
                </Label>
              </div>
            </div>

            {/* Failure Details (only show if result is fail) */}
            {newItemData.result === "fail" && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="newFailureReason">Failure Reason</Label>
                  <Select
                    value={newItemData.failureReason || ""}
                    onValueChange={(value) =>
                      setNewItemData((prev) => ({
                        ...prev,
                        failureReason: value,
                      }))
                    }
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
                    onValueChange={(value) =>
                      setNewItemData((prev) => ({
                        ...prev,
                        actionTaken: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action taken" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="given">Given to User</SelectItem>
                      <SelectItem value="removed">
                        Removed from Service
                      </SelectItem>
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
                disabled={addItemMutation.isPending || !!newItemAssetNumberError}
                className="bg-green-600 hover:bg-green-700"
              >
                {addItemMutation.isPending ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={isChangePasswordModalOpen}
        onClose={() => {
          setIsChangePasswordModalOpen(false);
          setPasswordData({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
        }}
        title="Change Password"
        className="max-w-md"
      >
        {changePasswordMutation.isPending ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                placeholder="Enter current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="Confirm new password"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangePasswordModalOpen(false);
                  setPasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                }}
                disabled={changePasswordMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (
                    passwordData.newPassword !== passwordData.confirmPassword
                  ) {
                    toast({
                      title: "Error",
                      description: "New passwords do not match",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (passwordData.newPassword.length < 6) {
                    toast({
                      title: "Error",
                      description:
                        "Password must be at least 6 characters long",
                      variant: "destructive",
                    });
                    return;
                  }
                  changePasswordMutation.mutate({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                  });
                }}
                disabled={
                  changePasswordMutation.isPending ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {changePasswordMutation.isPending
                  ? "Changing..."
                  : "Change Password"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditUserModalOpen}
        onClose={() => {
          setIsEditUserModalOpen(false);
          setEditingUser(null);
          setEditUserData({
            username: "",
            fullName: "",
            role: "technician",
            newPassword: "",
            confirmPassword: "",
          });
        }}
        title="Edit User"
        className="max-w-md"
      >
        {editUserMutation.isPending ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editUsername">Username *</Label>
              <Input
                id="editUsername"
                type="text"
                value={editUserData.username}
                onChange={(e) =>
                  setEditUserData((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFullName">Full Name *</Label>
              <Input
                id="editFullName"
                type="text"
                value={editUserData.fullName}
                onChange={(e) =>
                  setEditUserData((prev) => ({
                    ...prev,
                    fullName: e.target.value,
                  }))
                }
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRole">Role *</Label>
              <Select
                value={editUserData.role}
                onValueChange={(
                  value: "technician" | "support_center" | "super_admin",
                ) => setEditUserData((prev) => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="support_center">Support Center</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editNewPassword">New Password (optional)</Label>
              <Input
                id="editNewPassword"
                type="password"
                value={editUserData.newPassword}
                onChange={(e) =>
                  setEditUserData((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                placeholder="Leave blank to keep current password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editConfirmPassword">Confirm New Password</Label>
              <Input
                id="editConfirmPassword"
                type="password"
                value={editUserData.confirmPassword}
                onChange={(e) =>
                  setEditUserData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="Confirm new password"
                disabled={!editUserData.newPassword}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditUserModalOpen(false);
                  setEditingUser(null);
                  setEditUserData({
                    username: "",
                    fullName: "",
                    role: "technician",
                    newPassword: "",
                    confirmPassword: "",
                  });
                }}
                disabled={editUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateUser}
                disabled={
                  editUserMutation.isPending ||
                  !editUserData.username ||
                  !editUserData.fullName
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {editUserMutation.isPending ? "Updating..." : "Update User"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Result Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={cancelDeleteResult}
        title="Delete Test Result"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this test result? This action cannot be undone.
          </p>
          
          {deletingResult && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm">
                <div><span className="font-medium">Asset Number:</span> {deletingResult.assetNumber}</div>
                <div><span className="font-medium">Item:</span> {deletingResult.itemType}</div>
                <div><span className="font-medium">Location:</span> {deletingResult.location || "N/A"}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={cancelDeleteResult}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDeleteResult}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete Result"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Loading Progress Bar - Reusable for server operations */}
      <ProgressBar
        isVisible={isDeleting}
        message="Deleting test result..."
      />
    </div>
  );
}
