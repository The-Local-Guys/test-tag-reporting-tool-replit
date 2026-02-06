import { CheckCircle, Loader2, WifiOff, AlertTriangle } from "lucide-react";
import { useSession } from "@/hooks/use-session";

/**
 * Compact save status indicator for test flow pages.
 * Shows the current state of auto-saving items to the database.
 */
export function SaveStatusIndicator() {
  const { saveStatus, batchedResults } = useSession();
  const { pendingCount, failedCount, isOnline } = saveStatus;

  const totalItems = batchedResults.length;
  const savedItems = batchedResults.filter(r => r.serverId).length;
  const unsavedItems = totalItems - savedItems;

  // Don't show anything if there are no items yet
  if (totalItems === 0) return null;

  // Determine state
  const isSaving = pendingCount > 0;
  const hasFailures = failedCount > 0 || unsavedItems > 0;
  const isOffline = !isOnline;
  const allSaved = savedItems === totalItems && !isSaving && !hasFailures;

  let bgColor = "bg-green-50 border-green-200";
  let textColor = "text-green-700";
  let icon = <CheckCircle className="w-3.5 h-3.5" />;
  let message = `${savedItems} item${savedItems !== 1 ? "s" : ""} saved`;

  if (isSaving) {
    bgColor = "bg-blue-50 border-blue-200";
    textColor = "text-blue-700";
    icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    message = `Saving... (${savedItems}/${totalItems})`;
  } else if (isOffline) {
    bgColor = "bg-yellow-50 border-yellow-200";
    textColor = "text-yellow-700";
    icon = <WifiOff className="w-3.5 h-3.5" />;
    message = `Offline – ${savedItems} saved, ${unsavedItems} pending`;
  } else if (hasFailures) {
    bgColor = "bg-red-50 border-red-200";
    textColor = "text-red-700";
    icon = <AlertTriangle className="w-3.5 h-3.5" />;
    message = `${savedItems}/${totalItems} saved – ${unsavedItems} pending`;
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs font-medium ${bgColor} ${textColor}`}>
      {icon}
      <span>{message}</span>
    </div>
  );
}
