import { AttachCertificateModal } from "@/features/certificates/AttachCertificateModal";
import type { AdminDashboard } from "../hooks/useAdminDashboard";
import type { DashboardVariant } from "../utils";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CopyReportDialog } from "./CopyReportDialog";
import { CreateUserModal } from "./CreateUserModal";
import { EditSessionModal } from "./EditSessionModal";
import { EditUserModal } from "./EditUserModal";
import { ViewReportModal } from "./ViewReportModal";

/** Every modal and confirmation dialog the admin dashboard can open. */
export function AdminDashboardDialogs({
  dashboard,
  variant,
}: {
  dashboard: AdminDashboard;
  variant: DashboardVariant;
}) {
  const d = dashboard;

  return (
    <>
      <CreateUserModal
        isOpen={d.isCreateUserOpen}
        onClose={() => d.setIsCreateUserOpen(false)}
        currentUserRole={d.currentUser?.role}
      />

      {d.editingSession && (
        <EditSessionModal session={d.editingSession} onClose={() => d.setEditingSession(null)} />
      )}

      <CopyReportDialog session={d.copyingSession} open={d.isCopyOpen} onOpenChange={d.setIsCopyOpen} />

      <ViewReportModal
        viewReport={d.viewReport}
        variant={variant}
        onContinue={d.continueReport}
        onCopy={d.openCopyDialog}
        onAttachCertificate={d.setAttachCertificateTarget}
        onDownload={d.downloadReport}
      />

      {/* Attach/Change Certificate of Compliance — from the View Report modal or a row's quick action */}
      {d.attachCertificateTarget && (
        <AttachCertificateModal
          isOpen
          onClose={() => d.setAttachCertificateTarget(null)}
          sessionId={d.attachCertificateTarget.id}
          currentCertificateId={d.attachCertificateTarget.certificateId}
          onAttached={d.handleCertificateAttached}
        />
      )}

      <ChangePasswordModal
        isOpen={d.isChangePasswordOpen}
        onClose={() => d.setIsChangePasswordOpen(false)}
      />

      {d.editingUser && <EditUserModal user={d.editingUser} onClose={() => d.setEditingUser(null)} />}

      <ConfirmDeleteDialog
        open={d.deleteReport.isConfirmOpen}
        onCancel={d.deleteReport.cancel}
        onConfirm={d.deleteReport.confirm}
        title="Delete Report?"
        description="Are you sure you want to delete this report? This action cannot be undone."
      />

      <ConfirmDeleteDialog
        open={d.deleteDraft.isConfirmOpen}
        onCancel={d.deleteDraft.cancel}
        onConfirm={d.deleteDraft.confirm}
        title="Delete Draft?"
        description="Are you sure you want to delete this draft? This action cannot be undone."
      />

      <ConfirmDeleteDialog
        open={d.isBulkDeleteConfirmOpen}
        onCancel={() => d.setIsBulkDeleteConfirmOpen(false)}
        onConfirm={d.adminDrafts.bulkDelete}
        title="Delete Drafts?"
        description={`Are you sure you want to delete ${d.adminDrafts.selectedIds.size} draft report(s)? This action cannot be undone.`}
      />
    </>
  );
}
