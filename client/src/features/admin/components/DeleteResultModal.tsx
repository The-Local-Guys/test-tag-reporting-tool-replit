import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { DashboardVariant } from "../utils";

/** Confirm deleting one test result from a report. */
export function DeleteResultModal({
  isOpen,
  result,
  isDeleting,
  onCancel,
  onConfirm,
  variant,
}: {
  isOpen: boolean;
  result: any;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  variant: DashboardVariant;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Delete Test Result" className="max-w-md">
      <div className="space-y-4">
        <p className="text-gray-700">
          Are you sure you want to delete this test result? This action cannot be undone.
        </p>

        {result && (
          <div
            className={
              variant === "classic"
                ? "bg-gray-50 p-4 rounded-lg"
                : "rounded-xl border border-slate-200 bg-slate-50/70 p-4"
            }
          >
            <div className="text-sm">
              <div><span className="font-medium">Asset Number:</span> {result.assetNumber}</div>
              <div><span className="font-medium">Item:</span> {result.itemType}</div>
              <div><span className="font-medium">Location:</span> {result.location || "N/A"}</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? "Deleting..." : "Delete Result"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
