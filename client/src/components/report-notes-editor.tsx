import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MAX_REPORT_NOTES_LENGTH, type TestSession, type User } from "@shared/schema";

interface ReportNotesEditorProps {
  sessionId: number;
  ownerUserId?: number | null;
  reportNotes?: string | null;
  onSaved?: (session: TestSession) => void;
}

/**
 * Report-level notes, printed in a "Notes" section at the end of the PDF report.
 * Editable by the report's technician, super admins and support center users
 * (the server enforces the same rule).
 */
export function ReportNotesEditor({ sessionId, ownerUserId, reportNotes, onSaved }: ReportNotesEditorProps) {
  const { toast } = useToast();
  const { user } = useAuth() as { user?: User };
  const [notes, setNotes] = useState(reportNotes || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNotes(reportNotes || "");
  }, [sessionId, reportNotes]);

  const canEdit =
    !!user &&
    (user.role === "super_admin" || user.role === "support_center" || user.id === ownerUserId);
  const isDirty = notes.trim() !== (reportNotes || "").trim();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest("PATCH", `/api/sessions/${sessionId}/notes`, {
        reportNotes: notes.trim() || null,
      });
      const session: TestSession = await response.json();
      onSaved?.(session);
      toast({ title: "Notes saved", description: "Report notes have been updated." });
    } catch (error) {
      toast({
        title: "Failed to save notes",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`report-notes-${sessionId}`} className="font-semibold">
        Report Notes
      </Label>
      <Textarea
        id={`report-notes-${sessionId}`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={MAX_REPORT_NOTES_LENGTH}
        rows={4}
        disabled={!canEdit || isSaving}
        placeholder={canEdit ? "Add notes for this report..." : "No notes"}
        data-testid="textarea-report-notes"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">Shown in a Notes section at the end of the report.</p>
        <p
          className={`text-xs whitespace-nowrap ${
            notes.length >= MAX_REPORT_NOTES_LENGTH ? "text-amber-600 font-medium" : "text-gray-500"
          }`}
        >
          {notes.length}/{MAX_REPORT_NOTES_LENGTH}
        </p>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            data-testid="button-save-report-notes"
          >
            {isSaving ? "Saving..." : "Save Notes"}
          </Button>
        </div>
      )}
    </div>
  );
}
