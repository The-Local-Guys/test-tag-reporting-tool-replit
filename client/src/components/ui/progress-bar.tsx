import { cn } from "@/lib/utils";

interface ProgressBarProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

/**
 * Reusable progress bar component for server operations
 * Shows loading state with optional message while API calls are in progress
 */
export function ProgressBar({ isVisible, message = "Processing...", className }: ProgressBarProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
      className
    )}>
      <div className="bg-white rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-700 text-center font-medium">{message}</p>
        </div>
      </div>
    </div>
  );
}