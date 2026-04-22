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
import { TestResultEditModal } from "@/components/test-result-edit-modal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Checkbox } from "@/components/ui/checkbox";
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
  PlayCircle,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { generatePDFReport, downloadPDF } from "@/lib/pdf-generator";
import { generateExcelReport, downloadExcel } from "@/lib/excel-generator";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import { CertificatesTab } from "@/features/certificates/CertificatesTab";
import { failureReasons, emergencyFailureReasons, fireFailureReasons, rcdFailureReasons } from "@shared/schema";

/**
 * Administrative dashboard for managing users, sessions, and system oversight
 * Provides user management, session editing, data export, and system monitoring
 * Restricted to super_admin and support_center roles
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  
  // Type guard for user object
  const typedUser = user as { fullName?: string; role?: 'super_admin' | 'support_center' | 'technician'; id?: number } | undefined;
  
  // Log when admin dashboard loads
  useEffect(() => {
    console.log("Hello The Local Guys");
  }, []);
  
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
  const [isContinuing, setIsContinuing] = useState(false);
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
    country: "australia" as "australia" | "newzealand" | "national_client",
  });
  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    role: "technician" as "technician" | "support_center" | "super_admin",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);
  const [selectedTechnicianFilter, setSelectedTechnicianFilter] =
    useState<string>("all");
  const [selectedDraftTechnicianFilter, setSelectedDraftTechnicianFilter] =
    useState<string>("all");

  // Copy report state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyingSession, setCopyingSession] = useState<any>(null);
  const [copyTestDate, setCopyTestDate] = useState("");
  const [isCopying, setIsCopying] = useState(false);

  // Multi-select state for draft reports bulk delete
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set());

  // Pagination states
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Asset number calculation states
  const [monthlyAssetCount, setMonthlyAssetCount] = useState(0);
  const [fiveYearlyAssetCount, setFiveYearlyAssetCount] = useState(0);
  
  const [editResultData, setEditResultData] = useState({
    itemName: "",
    itemType: "",
    location: "",
    assetNumber: "",
    classification: "class1" as any,
    result: "pass" as any,
    frequency: "twelvemonthly" as any,
    failureReason: null as any,
    actionTaken: null as any,
    notes: null as any,
    // Service-specific boolean criteria fields
    visionInspection: false as boolean,
    electricalTest: false as boolean,
    dischargeTest: false as boolean,
    switchingTest: false as boolean,
    chargingTest: false as boolean,
    // Emergency Exit Light specific fields
    luxTest: false as boolean,
    luxReading: null as number | null,
    luxCompliant: false as boolean,
    manufacturerInfo: null as string | null,
    installationDate: null as string | null,
    maintenanceType: null as string | null,
    globeType: null as string | null,
    // Fire Testing specific fields
    pressureTest: false as boolean,
    accessibilityCheck: false as boolean,
    signageCheck: false as boolean,
    operationalTest: false as boolean,
    fireVisualInspection: false as boolean,
    equipmentType: null as string | null,
    extinguisherType: null as string | null,
    size: null as string | null,
    weight: null as string | null,
    testType: null as string | null,
    // Microwave Leakage specific fields
    leakageReading: null as string | null,
    // RCD-specific fields
    pushButtonTest: false as boolean,
    injectionTimedTest: false as boolean,
    tripTimes: [] as any[],
    distributionBoardNumber: null as string | null,
    circuitBreakerNumber: null as string | null,
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

  // Delete session/draft confirmation state
  const [deleteReportConfirmOpen, setDeleteReportConfirmOpen] = useState(false);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<number | null>(null);
  const [deleteDraftConfirmOpen, setDeleteDraftConfirmOpen] = useState(false);
  const [pendingDeleteDraftId, setPendingDeleteDraftId] = useState<number | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);


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
    refetchInterval: 5000,
    refetchIntervalInBackground:true
  });

  // Fetch all draft sessions (admin only - for recovery purposes)
  const { data: adminDraftSessions, isLoading: adminDraftsLoading } = useQuery({
    queryKey: ["/api/admin/sessions/drafts"],
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: typedUser?.role === 'super_admin' || typedUser?.role === 'support_center',
  });

  // Fetch own draft sessions (technician only)
  const { data: technicianDraftSessions, isLoading: technicianDraftsLoading } = useQuery({
    queryKey: ["/api/sessions/drafts"],
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
    enabled: typedUser?.role === 'technician',
  });

  // Fetch custom form types
  const { data: customFormTypes } = useQuery<any[]>({
    queryKey: ['/api/custom-forms'],
  });


  // Force refresh data when component mounts or when navigating to admin
  useEffect(() => {
    console.log('Admin dashboard mounted, refreshing data...');
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions/drafts"] });
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

  // Filter draft sessions based on selected technician and sort by last activity
  const filteredDraftSessions = Array.isArray(adminDraftSessions)
    ? adminDraftSessions
        .filter((session: any) => {
          if (selectedDraftTechnicianFilter === "all") return true;
          return session.technicianName === selectedDraftTechnicianFilter;
        })
        .sort((a: any, b: any) => {
          // Sort by last activity descending (most recent first)
          const dateA = new Date(a.lastActivityAt || a.createdAt);
          const dateB = new Date(b.lastActivityAt || b.createdAt);
          return dateB.getTime() - dateA.getTime();
        })
    : [];

  // Get unique technician names for draft filter dropdown
  const uniqueDraftTechnicians = Array.isArray(adminDraftSessions)
    ? [
        ...Array.from(new Set(
          adminDraftSessions.map((session: any) => session.technicianName),
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

  // Bulk delete drafts mutation
  const bulkDeleteDraftsMutation = useMutation({
    mutationFn: async (sessionIds: number[]) => {
      // Delete sessions sequentially to avoid overwhelming the server
      const results = [];
      for (const sessionId of sessionIds) {
        const response = await fetch(`/api/admin/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(`Failed to delete session ${sessionId}`);
        }
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (_, sessionIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      setSelectedDraftIds(new Set());
      toast({
        title: "Drafts deleted",
        description: `Successfully deleted ${sessionIds.length} draft report(s).`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete some draft reports.",
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
            // Preserve itemType from response or keep original (itemType is not edited)
            itemType: updatedResult.itemType || result.itemType,
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

  // Edit session mutation
  const editSessionMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: number; data: any }) => {
      const response = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update session");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      if (viewingSession?.session?.id) {
        queryClient.invalidateQueries({
          queryKey: ["/api/sessions", viewingSession.session.id, "full"],
        });
        // Update local viewing session state
        setViewingSession((prev: any) => ({
          ...prev,
          session: {
            ...prev.session,
            ...editSessionData
          }
        }));
      }
      toast({
        title: "Success",
        description: "Session details updated successfully",
      });
      setIsEditSessionModalOpen(false);
      setEditingSession(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update session",
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
        confirmPassword: "",
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
   * Uses proper frequency ranges based on service type and custom starting numbers
   * @param changingResultId - ID of the result being changed (optional)
   * @param newFrequency - New frequency for the changing result (optional)
   * @returns Next available asset number for the frequency type
   */
  const renumberAssets = (changingResultId?: number, newFrequency?: string): string => {
    // Guard against missing session data
    if (!viewingSession?.results) {
      console.warn('renumberAssets: viewingSession or results is missing');
      return '1';
    }

    // Get service type to determine correct starting ranges
    const serviceType = viewingSession?.session?.serviceType || 'electrical';
    const isElectrical = serviceType === 'electrical';

    // Get custom starting numbers from the session if they exist
    const customStartingNumbers = viewingSession?.session?.customStartingNumbers || {};

    // Define starting numbers based on service type and frequency
    const getStartingNumber = (freq: string): number => {
      // For electrical services, check if custom starting numbers are set
      if (isElectrical && customStartingNumbers && Object.keys(customStartingNumbers).length > 0) {
        const customNumber = customStartingNumbers[freq];
        if (customNumber !== undefined) {
          console.log(`Admin: Using custom starting number for ${freq}: ${customNumber}`);
          return customNumber;
        }
      }

      // Fall back to default ranges
      if (isElectrical) {
        // Electrical service type default ranges
        const ranges: Record<string, number> = {
          'twelvemonthly': 1,
          'sixmonthly': 10001,
          'fiveyearly': 20001,
          'twentyfourmonthly': 30001,
          'threemonthly': 40001,
          'monthly': 50001,
        };
        return ranges[freq] || 1;
      } else {
        // Other service types (Emergency, Fire, RCD)
        const ranges: Record<string, number> = {
          'sixmonthly': 1,
          'twelvemonthly': 10001,
          'fiveyearly': 20001,
          'twentyfourmonthly': 30001,
          'threemonthly': 40001,
          'monthly': 50001,
        };
        return ranges[freq] || 1;
      }
    };

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
      const startNumber = getStartingNumber(newFrequency);
      const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
      console.log(`Admin: Generated asset number ${nextAvailable} for ${newFrequency} (start: ${startNumber})`);
      return nextAvailable.toString();
    }

    // If no specific frequency provided, default to twelvemonthly frequency logic
    const startNumber = getStartingNumber('twelvemonthly');
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
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
      clientName: session.clientName || '',
      technicianName: session.technicianName || '',
      testDate: session.testDate?.split("T")[0] || session.testDate || '', // Convert to YYYY-MM-DD format
      address: session.address || '',
      siteContact: session.siteContact || '',
      country: session.country || 'australia',
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
    editSessionMutation.mutate({
      sessionId: editingSession.id,
      data: editSessionData,
    });
  };

  // Helper function to get appropriate failure reasons based on service type
  const getFailureReasons = () => {
    const serviceType = viewingSession?.session?.serviceType;
    switch (serviceType) {
      case 'emergency_exit_light':
        return emergencyFailureReasons;
      case 'fire_testing':
        return fireFailureReasons;
      case 'rcd_reporting':
        return rcdFailureReasons;
      default:
        return failureReasons; // electrical testing
    }
  };

  // Helper function to convert snake_case to display labels
  const getFailureReasonLabel = (reason: string) => {
    const labelMap: { [key: string]: string } = {
      // Electrical testing reasons
      'vision': 'Vision',
      'earth': 'Earth',
      'insulation': 'Insulation',
      'polarity': 'Polarity',
      // Emergency exit light reasons
      'physical_damage': 'Physical Damage',
      'battery_failure': 'Battery Failure',
      'lamp_failure': 'Lamp/LED Failure',
      'wiring_fault': 'Wiring Fault',
      'charging_fault': 'Charging Fault',
      'insufficient_illumination': 'Insufficient Illumination',
      'mounting_issue': 'Mounting Issue',
      // Fire testing reasons
      'pressure_loss': 'Pressure Loss',
      'corrosion': 'Corrosion',
      'blocked_nozzle': 'Blocked Nozzle',
      'damaged_seal': 'Damaged Seal',
      'expired': 'Expired',
      // RCD testing reasons
      'push_button': 'Push Button Test Failed',
      'injection_timed': 'Injection/Timed Test Failed',
      'tripping_time': 'Incorrect Tripping Time',
      'no_trip': 'Failed to Trip',
      'visual': 'Visual Damage/Defect',
      // Common
      'other': 'Other'
    };
    return labelMap[reason] || reason;
  };

  const handleEditResult = (result: any) => {
    setEditingResult(result);
    setEditResultData({
      itemName: result.itemName || result.item_name || "",
      itemType: result.itemType || result.item_type || "",
      location: result.location || "",
      assetNumber: result.assetNumber || result.asset_number || "",
      classification: result.classification || "class1",
      result: result.result || "pass",
      frequency: result.frequency || "twelvemonthly",
      failureReason: result.failureReason || result.failure_reason || null,
      actionTaken: result.actionTaken || result.action_taken || null,
      notes: result.notes || null,
      // Service-specific boolean criteria fields
      visionInspection: result.visionInspection ?? result.vision_inspection ?? false,
      electricalTest: result.electricalTest ?? result.electrical_test ?? false,
      dischargeTest: result.dischargeTest ?? result.discharge_test ?? false,
      switchingTest: result.switchingTest ?? result.switching_test ?? false,
      chargingTest: result.chargingTest ?? result.charging_test ?? false,
      // Emergency Exit Light specific fields
      luxTest: result.luxTest ?? result.lux_test ?? false,
      luxReading: result.luxReading ?? result.lux_reading ?? null,
      luxCompliant: result.luxCompliant ?? result.lux_compliant ?? false,
      manufacturerInfo: result.manufacturerInfo ?? result.manufacturer_info ?? null,
      installationDate: result.installationDate ?? result.installation_date ?? null,
      maintenanceType: result.maintenanceType ?? result.maintenance_type ?? null,
      globeType: result.globeType ?? result.globe_type ?? null,
      // Fire Testing specific fields
      pressureTest: result.pressureTest ?? result.pressure_test ?? false,
      accessibilityCheck: result.accessibilityCheck ?? result.accessibility_check ?? false,
      signageCheck: result.signageCheck ?? result.signage_check ?? false,
      operationalTest: result.operationalTest ?? result.operational_test ?? false,
      fireVisualInspection: result.fireVisualInspection ?? result.fire_visual_inspection ?? false,
      equipmentType: result.equipmentType ?? result.equipment_type ?? null,
      extinguisherType: result.extinguisherType ?? result.extinguisher_type ?? null,
      size: result.size ?? null,
      weight: result.weight ?? null,
      testType: result.testType ?? result.test_type ?? null,
      // Microwave Leakage specific fields
      leakageReading: result.leakageReading ?? result.leakage_reading ?? null,
      // RCD-specific fields
      pushButtonTest: result.pushButtonTest ?? result.push_button_test ?? false,
      injectionTimedTest: result.injectionTimedTest ?? result.injection_timed_test ?? false,
      tripTimes: (() => {
        const stored = result.tripTimes ?? result.trip_times ?? [];
        if (Array.isArray(stored) && stored.length > 0) return stored.map((t: any) => Number(t)).filter((t: number) => t > 0);
        return [];
      })(),
      distributionBoardNumber: result.distributionBoardNumber ?? result.distribution_board_number ?? null,
      circuitBreakerNumber: result.circuitBreakerNumber ?? result.circuit_breaker_number ?? null,
    });
    setAssetNumberError(""); // Clear any previous errors
    setIsEditResultModalOpen(true);
  };

  /**
   * Validate asset number for duplicates and basic validity
   * Range validation removed since auto-generation handles correct ranges
   */
  const validateAssetNumber = (assetNumber: string, frequency: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
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
   * Handle frequency changes - auto-generate new asset number following report page logic
   */
  const handleFrequencyChange = (newFrequency: string) => {
    // Auto-generate new asset number when frequency changes
    const newAssetNumber = renumberAssets(editingResult?.id, newFrequency);

    console.log(`Admin: Frequency changed to ${newFrequency}, auto-generated asset number: ${newAssetNumber}`);

    setEditResultData(prev => ({
      ...prev,
      frequency: newFrequency,
      assetNumber: newAssetNumber
    }));

    // Validate the new asset number
    const error = validateAssetNumber(newAssetNumber, newFrequency);
    setAssetNumberError(error);
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
    let notes = editResultData.notes;

    // Rebuild notes string for fire testing to reflect checkbox changes
    if (viewingSession?.session?.serviceType === 'fire_testing') {
      const existingNotes = editResultData.notes || '';
      const parts = existingNotes.split(' | ');
      const userNote = parts.length > 0 &&
        !parts[0].startsWith('Equipment Type:') &&
        !parts[0].startsWith('Visual Inspection:') ? parts[0] : '';

      const equipmentType = editResultData.classification || '';
      const extType = editResultData.extinguisherType;

      notes = [
        userNote,
        `Equipment Type: ${equipmentType}`,
        extType ? `Extinguisher Type: ${extType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}` : '',
        editResultData.size ? `Net Size: ${editResultData.size}` : '',
        editResultData.weight ? `Gross Weight: ${editResultData.weight}` : '',
        `Visual Inspection: ${editResultData.visionInspection ? 'Pass' : 'Fail'}`,
        `Operational Test: ${editResultData.operationalTest ? 'Pass' : 'Fail'}`,
        (equipmentType === 'fire_extinguisher' || equipmentType === 'fire_hose_reel')
          ? `Pressure Test: ${editResultData.pressureTest ? 'Pass' : 'Fail'}` : '',
        `Accessibility Check: ${editResultData.accessibilityCheck ? 'Pass' : 'Fail'}`,
        `Signage Check: ${editResultData.signageCheck ? 'Pass' : 'Fail'}`,
      ].filter(Boolean).join(' | ');
    }

    const updateData: Record<string, any> = {
      itemName: editResultData.itemName,
      location: editResultData.location,
      assetNumber: editResultData.assetNumber,
      classification: editResultData.classification,
      result: editResultData.result,
      frequency: editResultData.frequency,
      failureReason: editResultData.failureReason,
      actionTaken: editResultData.actionTaken,
      notes: notes,
      // Fire testing specific fields
      visionInspection: editResultData.visionInspection,
      pressureTest: editResultData.pressureTest,
      accessibilityCheck: editResultData.accessibilityCheck,
      signageCheck: editResultData.signageCheck,
      operationalTest: editResultData.operationalTest,
      extinguisherType: editResultData.extinguisherType,
      size: editResultData.size,
      weight: editResultData.weight,
      // Emergency exit light fields
      electricalTest: editResultData.electricalTest,
      dischargeTest: editResultData.dischargeTest,
      switchingTest: editResultData.switchingTest,
      chargingTest: editResultData.chargingTest,
      luxTest: editResultData.luxTest,
      luxReading: editResultData.luxReading,
      luxCompliant: editResultData.luxCompliant,
      globeType: editResultData.globeType,
      manufacturerInfo: editResultData.manufacturerInfo,
      installationDate: editResultData.installationDate,
      maintenanceType: editResultData.maintenanceType,
      // RCD fields
      pushButtonTest: editResultData.pushButtonTest,
      injectionTimedTest: editResultData.injectionTimedTest,
      tripTimes: editResultData.tripTimes,
      distributionBoardNumber: editResultData.distributionBoardNumber,
      circuitBreakerNumber: editResultData.circuitBreakerNumber,
      // Microwave leakage fields
      leakageReading: editResultData.leakageReading,
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
   * Check for existing data conflicts (database-first approach - no localStorage)
   */
  const checkForExistingData = async (session: any) => {
    // No localStorage to check - all data is in the database
    // Proceed directly to continue
    proceedWithContinue(session);
  };

  /**
   * Handle continuing an existing report after conflict resolution
   */
  const proceedWithContinue = (session: any) => {
    console.log(`Starting continue for session ${session.id}`);

    // Show loading screen
    setIsContinuing(true);

    // Set session ID in sessionStorage for cross-page navigation bridge
    sessionStorage.setItem('currentSessionId', session.id.toString());
    sessionStorage.setItem('selectedService', session.serviceType || 'electrical');

    console.log(`Set continuation flags for session ${session.id}, navigating to items`);

    // Add a longer delay to show the loading screen and ensure smooth transition
    setTimeout(() => {
      window.location.href = '/items';
    }, 1500);
  };
  
  /**
   * Handle continuing an existing report - first checks for conflicts
   */
  const handleContinueReport = (session: any) => {
    checkForExistingData(session);
  };

  /**
   * Open copy dialog for a report (non-electrical services only)
   */
  const handleOpenCopyDialog = (session: any) => {
    const today = new Date().toISOString().split("T")[0];
    setCopyingSession(session);
    setCopyTestDate(today);
    setCopyDialogOpen(true);
  };

  /**
   * Execute the copy — creates a new draft session with the same equipment
   */
  const handleConfirmCopy = async () => {
    if (!copyingSession || !copyTestDate) return;
    setIsCopying(true);
    try {
      const response = await apiRequest("POST", `/api/sessions/${copyingSession.id}/copy`, { testDate: copyTestDate });
      const data = await response.json();
      setCopyDialogOpen(false);
      toast({ title: "Report copied", description: "Opening the copied report now…" });
      sessionStorage.setItem("currentSessionId", data.session.id.toString());
      sessionStorage.setItem("selectedService", data.session.serviceType);
      setTimeout(() => {
        window.location.href = "/items";
      }, 800);
    } catch (err) {
      toast({ title: "Copy failed", description: "Could not copy the report. Please try again.", variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };
  

  /**
   * Validate new item asset number for duplicates and basic validity
   * Range validation removed since auto-generation handles correct ranges
   */
  const validateNewItemAssetNumber = (assetNumber: string, frequency: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
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
   * Handle new item frequency changes - auto-generate new asset number
   */
  const handleNewItemFrequencyChange = (newFrequency: string) => {
    // Auto-generate new asset number when frequency changes for new items
    const newAssetNumber = renumberAssets(undefined, newFrequency);

    console.log(`Admin: New item frequency changed to ${newFrequency}, auto-generated asset number: ${newAssetNumber}`);

    setNewItemData(prev => ({
      ...prev,
      frequency: newFrequency,
      assetNumber: newAssetNumber
    }));

    // Validate the new asset number
    const error = validateNewItemAssetNumber(newAssetNumber, newFrequency);
    setNewItemAssetNumberError(error);
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
    if (newUserData.password !== newUserData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
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
        await downloadPDF(reportData, `${filename}.pdf`);
      } else {
        downloadExcel(reportData, `${filename}.xlsx`);
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
  // Show loading screen when continuing a report
  if (isContinuing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <img
              src={logoPath}
              alt="The Local Guys"
              className="h-24 w-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <LoadingSpinner />
            <p className="text-lg font-medium text-gray-700">
              Continuing Report...
            </p>
            <p className="text-sm text-gray-500">
              Loading item selection page
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="reports">
              {typedUser?.role === "technician" ? "My Reports" : "All Reports"}
            </TabsTrigger>
            {(typedUser?.role === "super_admin" ||
              typedUser?.role === "support_center") && (
              <TabsTrigger value="drafts">
                Draft Reports
                {filteredDraftSessions.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
                    {filteredDraftSessions.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {typedUser?.role === "technician" && (
              <TabsTrigger value="drafts">
                Draft Reports
                {Array.isArray(technicianDraftSessions) && technicianDraftSessions.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
                    {technicianDraftSessions.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
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

          <TabsContent value="certificates" className="space-y-4">
            <CertificatesTab />
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
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">Client Name</TableHead>
                          <TableHead className="min-w-[120px]">Technician</TableHead>
                          <TableHead className="min-w-[140px]">Service Type</TableHead>
                          <TableHead className="min-w-[100px]">Date</TableHead>
                          <TableHead className="min-w-[100px]">Results</TableHead>
                          <TableHead className="min-w-[160px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {filteredSessions.map((session: any) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.clientName}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {session.technicianFullName || session.technicianName || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                session.serviceType === "emergency_exit_light"
                                  ? "bg-red-50 text-red-700"
                                  : session.serviceType === "fire_testing"
                                  ? "bg-orange-50 text-orange-700"
                                  : session.serviceType === "rcd_reporting"
                                  ? "bg-purple-50 text-purple-700"
                                  : session.serviceType === "microwave_leakage"
                                  ? "bg-teal-50 text-teal-700"
                                  : "bg-blue-50 text-blue-700"
                              }
                            >
                              {session.serviceType === "emergency_exit_light"
                                ? "Emergency Exit Light"
                                : session.serviceType === "fire_testing"
                                ? "Fire Testing"
                                : session.serviceType === "rcd_reporting"
                                ? "RCD Reporting"
                                : session.serviceType === "microwave_leakage"
                                ? "Microwave Leakage Testing"
                                : "Electrical Test & Tag"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(session.testDate).toLocaleDateString(
                              "en-AU",
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {/* Passed Items Circle */}
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
                                  {(session.totalItems || 0) - (session.failedItems || 0)}
                                </div>
                                <span className="text-xs text-green-600 hidden sm:inline">Pass</span>
                              </div>
                              
                              {/* Failed Items Circle */}
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-medium">
                                  {session.failedItems || 0}
                                </div>
                                <span className="text-xs text-red-600 hidden sm:inline">Fail</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReport(session)}
                                className="p-2 h-8 w-8"
                                title="View Report"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSession(session)}
                                className="p-2 h-8 w-8"
                                title="Edit Session"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleContinueReport(session)}
                                className="p-2 h-8 w-8 text-green-600 hover:bg-green-50 hover:border-green-300"
                                title="Continue Report"
                              >
                                <PlayCircle className="w-4 h-4" />
                              </Button>
                              {session.serviceType !== "electrical" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenCopyDialog(session)}
                                  className="p-2 h-8 w-8 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                                  title="Copy Report"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              {/* Delete button - visible for admins and session owners */}
                              {(typedUser?.role === "super_admin" ||
                                typedUser?.role === "support_center" ||
                                (typedUser?.role === "technician" && session.userId === typedUser?.id)) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPendingDeleteSessionId(session.id);
                                    setDeleteReportConfirmOpen(true);
                                  }}
                                  className="p-2 h-8 w-8 text-red-600 hover:bg-red-50 hover:border-red-300"
                                  title="Delete Report"
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
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Draft Reports Tab - Admin Only */}
          {(typedUser?.role === "super_admin" ||
            typedUser?.role === "support_center") && (
            <TabsContent value="drafts" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <div>
                      <CardTitle>Draft Reports</CardTitle>
                      <CardDescription>
                        Unfinished reports from all technicians. Use this to recover or manage incomplete work.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Technician Filter and Bulk Actions for Drafts */}
                  <div className="mb-4 flex flex-wrap items-end gap-4">
                    <div>
                      <Label
                        htmlFor="draftTechnicianFilter"
                        className="text-sm font-medium"
                      >
                        Filter by Technician
                      </Label>
                      <Select
                        value={selectedDraftTechnicianFilter}
                        onValueChange={(value) => {
                          setSelectedDraftTechnicianFilter(value);
                          setSelectedDraftIds(new Set()); // Clear selection when filter changes
                        }}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="All Technicians" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Technicians</SelectItem>
                          {uniqueDraftTechnicians.map((technician) => (
                            <SelectItem key={technician} value={technician}>
                              {technician}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bulk Delete Button */}
                    {selectedDraftIds.size > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {selectedDraftIds.size} selected
                        </span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setBulkDeleteConfirmOpen(true)}
                          disabled={bulkDeleteDraftsMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {bulkDeleteDraftsMutation.isPending ? 'Deleting...' : `Delete ${selectedDraftIds.size} Draft(s)`}
                        </Button>
                      </div>
                    )}
                  </div>

                  {adminDraftsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : filteredDraftSessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No draft reports found</p>
                      <p className="text-sm">All reports have been completed or there are no unfinished sessions.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={
                                  filteredDraftSessions.length > 0 &&
                                  selectedDraftIds.size === filteredDraftSessions.length
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDraftIds(new Set(filteredDraftSessions.map((d: any) => d.id)));
                                  } else {
                                    setSelectedDraftIds(new Set());
                                  }
                                }}
                                aria-label="Select all"
                              />
                            </TableHead>
                            <TableHead className="min-w-[120px]">Client Name</TableHead>
                            <TableHead className="min-w-[120px]">Technician</TableHead>
                            <TableHead className="min-w-[140px]">Service Type</TableHead>
                            <TableHead className="min-w-[80px]">Items</TableHead>
                            <TableHead className="min-w-[120px]">Last Activity</TableHead>
                            <TableHead className="min-w-[100px]">Created</TableHead>
                            <TableHead className="min-w-[120px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDraftSessions.map((draft: any) => (
                            <TableRow key={draft.id} className={selectedDraftIds.has(draft.id) ? "bg-blue-50" : "bg-yellow-50/30"}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedDraftIds.has(draft.id)}
                                  onCheckedChange={(checked) => {
                                    const newSelected = new Set(selectedDraftIds);
                                    if (checked) {
                                      newSelected.add(draft.id);
                                    } else {
                                      newSelected.delete(draft.id);
                                    }
                                    setSelectedDraftIds(newSelected);
                                  }}
                                  aria-label={`Select ${draft.clientName || 'draft'}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {draft.clientName || <span className="text-gray-400 italic">No client name</span>}
                              </TableCell>
                              <TableCell className="text-gray-700">
                                {draft.technicianName || 'Unknown'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    draft.serviceType === "emergency_exit_light"
                                      ? "bg-red-50 text-red-700"
                                      : draft.serviceType === "fire_testing"
                                      ? "bg-orange-50 text-orange-700"
                                      : draft.serviceType === "rcd_reporting"
                                      ? "bg-purple-50 text-purple-700"
                                      : draft.serviceType === "microwave_leakage"
                                      ? "bg-teal-50 text-teal-700"
                                      : "bg-blue-50 text-blue-700"
                                  }
                                >
                                  {draft.serviceType === "emergency_exit_light"
                                    ? "Emergency Exit Light"
                                    : draft.serviceType === "fire_testing"
                                    ? "Fire Testing"
                                    : draft.serviceType === "rcd_reporting"
                                    ? "RCD Reporting"
                                    : draft.serviceType === "microwave_leakage"
                                    ? "Microwave Leakage"
                                    : "Electrical Test & Tag"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
                                      {(draft.totalItems || 0) - (draft.failedItems || 0)}
                                    </div>
                                    <span className="text-xs text-green-600">Pass</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-medium">
                                      {draft.failedItems || 0}
                                    </div>
                                    <span className="text-xs text-red-600">Fail</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm text-gray-600">
                                  <Clock className="w-3 h-3" />
                                  {draft.lastActivityAt
                                    ? new Date(draft.lastActivityAt).toLocaleString("en-AU", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "N/A"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(draft.createdAt).toLocaleDateString("en-AU")}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewReport(draft)}
                                    className="p-2 h-8 w-8"
                                    title="View Draft"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleContinueReport(draft)}
                                    className="p-2 h-8 w-8 text-green-600 hover:bg-green-50 hover:border-green-300"
                                    title="Continue Report"
                                  >
                                    <PlayCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setPendingDeleteDraftId(draft.id);
                                      setDeleteDraftConfirmOpen(true);
                                    }}
                                    className="p-2 h-8 w-8 text-red-600 hover:bg-red-50 hover:border-red-300"
                                    title="Delete Draft"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Draft Reports Tab - Technician (own drafts only) */}
          {typedUser?.role === "technician" && (
            <TabsContent value="drafts" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <div>
                      <CardTitle>Draft Reports</CardTitle>
                      <CardDescription>
                        Your unfinished reports. Continue where you left off or discard them.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {technicianDraftsLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : !Array.isArray(technicianDraftSessions) || technicianDraftSessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No draft reports found</p>
                      <p className="text-sm">You have no unfinished reports.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[120px]">Client Name</TableHead>
                            <TableHead className="min-w-[140px]">Service Type</TableHead>
                            <TableHead className="min-w-[80px]">Items</TableHead>
                            <TableHead className="min-w-[120px]">Last Activity</TableHead>
                            <TableHead className="min-w-[100px]">Created</TableHead>
                            <TableHead className="min-w-[160px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {technicianDraftSessions
                            .sort((a: any, b: any) =>
                              new Date(b.lastActivityAt || b.createdAt).getTime() -
                              new Date(a.lastActivityAt || a.createdAt).getTime()
                            )
                            .map((draft: any) => (
                              <TableRow key={draft.id} className="bg-yellow-50/30">
                                <TableCell className="font-medium">
                                  {draft.clientName || <span className="text-gray-400 italic">No client name</span>}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={
                                      draft.serviceType === "emergency_exit_light"
                                        ? "bg-red-50 text-red-700"
                                        : draft.serviceType === "fire_testing"
                                        ? "bg-orange-50 text-orange-700"
                                        : draft.serviceType === "rcd_reporting"
                                        ? "bg-purple-50 text-purple-700"
                                        : draft.serviceType === "microwave_leakage"
                                        ? "bg-teal-50 text-teal-700"
                                        : "bg-blue-50 text-blue-700"
                                    }
                                  >
                                    {draft.serviceType === "emergency_exit_light"
                                      ? "Emergency Exit Light"
                                      : draft.serviceType === "fire_testing"
                                      ? "Fire Testing"
                                      : draft.serviceType === "rcd_reporting"
                                      ? "RCD Reporting"
                                      : draft.serviceType === "microwave_leakage"
                                      ? "Microwave Leakage"
                                      : "Electrical Test & Tag"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
                                        {(draft.totalItems || 0) - (draft.failedItems || 0)}
                                      </div>
                                      <span className="text-xs text-green-600">Pass</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <div className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-medium">
                                        {draft.failedItems || 0}
                                      </div>
                                      <span className="text-xs text-red-600">Fail</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-sm text-gray-600">
                                    <Clock className="w-3 h-3" />
                                    {draft.lastActivityAt
                                      ? new Date(draft.lastActivityAt).toLocaleString("en-AU", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "N/A"}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {new Date(draft.createdAt).toLocaleDateString("en-AU")}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewReport(draft)}
                                      className="p-2 h-8 w-8"
                                      title="View Report"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleEditSession(draft)}
                                      className="p-2 h-8 w-8"
                                      title="Edit Session"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleContinueReport(draft)}
                                      className="p-2 h-8 w-8 text-green-600 hover:bg-green-50 hover:border-green-300"
                                      title="Continue Report"
                                    >
                                      <PlayCircle className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setPendingDeleteDraftId(draft.id);
                                        setDeleteDraftConfirmOpen(true);
                                      }}
                                      className="p-2 h-8 w-8 text-red-600 hover:bg-red-50 hover:border-red-300"
                                      title="Delete Draft"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
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
            <div className="relative">
              <Input
                id="password"
                type={showNewPassword ? "text" : "password"}
                value={newUserData.password}
                onChange={(e) =>
                  setNewUserData((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                placeholder="Enter password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showNewConfirmPassword ? "text" : "password"}
                value={newUserData.confirmPassword}
                onChange={(e) =>
                  setNewUserData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder="Confirm password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNewConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
            <Label htmlFor="editCountry">Country / Form Type</Label>
            <Select
              value={editSessionData.country}
              onValueChange={(value: string) =>
                setEditSessionData((prev) => ({ ...prev, country: value as any }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country or form type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="australia">Australia</SelectItem>
                <SelectItem value="newzealand">New Zealand</SelectItem>
                <SelectItem value="national_client">ARA Compliance</SelectItem>
                {customFormTypes && customFormTypes.map((formType) => (
                  <SelectItem key={formType.id} value={`custom_${formType.id}`}>
                    {formType.name}
                  </SelectItem>
                ))}
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
              disabled={editSessionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSession}
              disabled={editSessionMutation.isPending}
            >
              {editSessionMutation.isPending
                ? "Updating..."
                : "Update Session"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Copy Report Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={(open) => !isCopying && setCopyDialogOpen(open)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Copy Report</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              A new draft will be created with all equipment from <strong>{copyingSession?.clientName}</strong> ({copyingSession?.address}). Update the date then save.
            </p>
            <div className="space-y-1">
              <Label htmlFor="copy-test-date">New Test Date</Label>
              <Input
                id="copy-test-date"
                type="date"
                value={copyTestDate}
                onChange={(e) => setCopyTestDate(e.target.value)}
                disabled={isCopying}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)} disabled={isCopying}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCopy} disabled={isCopying || !copyTestDate}>
              {isCopying ? "Copying…" : "Copy & Open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                onClick={() => handleOpenCopyDialog(viewingSession.session)}
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy Report & Open
              </Button>
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

      {/* Edit Result Modal - Using Shared Component */}
      <TestResultEditModal
        isOpen={isEditResultModalOpen}
        onClose={() => {
          setIsEditResultModalOpen(false);
          setEditingResult(null);
        }}
        editResultData={editResultData}
        setEditResultData={setEditResultData}
        onSave={handleUpdateResult}
        serviceType={viewingSession?.session?.serviceType}
        assetNumberError={assetNumberError}
        onAssetNumberChange={handleAssetNumberChange}
        onFrequencyChange={handleFrequencyChange}
        isSaving={updateResultMutation.isPending}
      />


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
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
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

      {/* Delete Report Confirmation Dialog */}
      <AlertDialog open={deleteReportConfirmOpen} onOpenChange={setDeleteReportConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteSessionId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteSessionId !== null) {
                  deleteSessionMutation.mutate(pendingDeleteSessionId);
                  setPendingDeleteSessionId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Draft Confirmation Dialog */}
      <AlertDialog open={deleteDraftConfirmOpen} onOpenChange={setDeleteDraftConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this draft? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteDraftId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteDraftId !== null) {
                  deleteSessionMutation.mutate(pendingDeleteDraftId);
                  setPendingDeleteDraftId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Drafts Confirmation Dialog */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drafts?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedDraftIds.size} draft report(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteDraftsMutation.mutate(Array.from(selectedDraftIds));
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
