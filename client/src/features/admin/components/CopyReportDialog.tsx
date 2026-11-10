import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

/** Copy a report (non-electrical services) into a new draft with the same equipment, then open it. */
export function CopyReportDialog({
  session,
  open,
  onOpenChange,
}: {
  session: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [testDate, setTestDate] = useState("");
  const [isCopying, setIsCopying] = useState(false);

  // Each copy defaults to today's date
  useEffect(() => {
    if (open) setTestDate(new Date().toISOString().split("T")[0]);
  }, [open]);

  /**
   * Execute the copy — creates a new draft session with the same equipment
   */
  const handleConfirmCopy = async () => {
    if (!session || !testDate) return;
    setIsCopying(true);
    try {
      const response = await apiRequest("POST", `/api/sessions/${session.id}/copy`, { testDate });
      const data = await response.json();
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={(next) => !isCopying && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Copy Report</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            A new draft will be created with all equipment from <strong>{session?.clientName}</strong> ({session?.address}). Update the date then save.
          </p>
          <div className="space-y-1">
            <Label htmlFor="copy-test-date">New Test Date</Label>
            <Input
              id="copy-test-date"
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
              disabled={isCopying}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCopying}>
            Cancel
          </Button>
          <Button onClick={handleConfirmCopy} disabled={isCopying || !testDate}>
            {isCopying ? "Copying…" : "Copy & Open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
