import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { isAdminRole, type AdminUser, type ReportRowActions } from "../utils";
import { useAdminUsers } from "./useAdminUsers";
import { useReportsList } from "./useReportsList";
import { useAdminDrafts } from "./useAdminDrafts";
import { useTechnicianDrafts } from "./useTechnicianDrafts";
import { useViewReport } from "./useViewReport";
import { useReportActions } from "./useReportActions";
import { useDeleteSession } from "./useDeleteSession";

type CertificateTarget = { id: number; certificateId: number | null };

/**
 * Everything the admin dashboard pages (/admin and /admin/v2) share: data, filters and
 * which dialog is open. The pages only differ in how they lay this out.
 */
export function useAdminDashboard() {
  const { user } = useAuth();
  const currentUser = user as AdminUser | undefined;
  const hasAdminRole = isAdminRole(currentUser?.role);
  const isTechnician = currentUser?.role === "technician";
  const queryClient = useQueryClient();

  // Log when admin dashboard loads
  useEffect(() => {
    console.log("Hello The Local Guys");
  }, []);

  // Force refresh data when component mounts or when navigating to admin
  useEffect(() => {
    console.log('Admin dashboard mounted, refreshing data...');
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions/drafts"] });
  }, [queryClient]);

  const users = useAdminUsers();
  const reports = useReportsList();
  const adminDrafts = useAdminDrafts(hasAdminRole);
  const technicianDrafts = useTechnicianDrafts(isTechnician);
  const viewReport = useViewReport();
  const { isContinuing, continueReport, downloadReport } = useReportActions();
  const deleteReport = useDeleteSession();
  const deleteDraft = useDeleteSession();

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingSession, setEditingSession] = useState<any>(null);
  // Kept after closing so the dialog text doesn't vanish during its close animation
  const [copyingSession, setCopyingSession] = useState<any>(null);
  const [isCopyOpen, setIsCopyOpen] = useState(false);
  // Session currently targeted by the "Attach Certificate" picker (from the View Report
  // modal or a row action)
  const [attachCertificateTarget, setAttachCertificateTarget] = useState<CertificateTarget | null>(null);

  /**
   * Open copy dialog for a report (non-electrical services only)
   */
  const openCopyDialog = (session: any) => {
    setCopyingSession(session);
    setIsCopyOpen(true);
  };

  // Refreshes every place a report's attached certificate is shown, after an attach/detach
  const handleCertificateAttached = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions/drafts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sessions/drafts"] });
  };

  const rowActions: ReportRowActions = {
    onView: viewReport.open,
    onEditSession: setEditingSession,
    onContinue: continueReport,
    onAttachCertificate: (session) =>
      setAttachCertificateTarget({ id: session.id, certificateId: session.certificateId ?? null }),
    onCopy: openCopyDialog,
  };

  // Admins can delete any report; technicians only their own
  const canDeleteReport = (session: any) =>
    hasAdminRole || (isTechnician && session.userId === currentUser?.id);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const stats = {
    totalUsers: users.totalUsers,
    activeUsers: users.activeUsers,
    totalReports: reports.total,
    recentReports: reports.sessions.filter((s: any) => new Date(s.createdAt) > weekAgo).length,
  };

  return {
    currentUser,
    hasAdminRole,
    isTechnician,
    stats,
    users,
    reports,
    adminDrafts,
    technicianDrafts,
    viewReport,
    rowActions,
    canDeleteReport,
    isContinuing,
    continueReport,
    downloadReport,
    deleteReport,
    deleteDraft,
    isCreateUserOpen,
    setIsCreateUserOpen,
    isChangePasswordOpen,
    setIsChangePasswordOpen,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
    editingUser,
    setEditingUser,
    editingSession,
    setEditingSession,
    copyingSession,
    isCopyOpen,
    setIsCopyOpen,
    openCopyDialog,
    attachCertificateTarget,
    setAttachCertificateTarget,
    handleCertificateAttached,
  };
}

export type AdminDashboard = ReturnType<typeof useAdminDashboard>;
