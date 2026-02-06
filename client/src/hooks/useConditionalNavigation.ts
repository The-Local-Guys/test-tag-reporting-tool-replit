import { useLocation } from "wouter";
import { useState } from "react";

export function useConditionalNavigation() {
  const [location, setLocation] = useLocation();
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = (target: string) => {
    // With database-only architecture, all results are auto-saved to the server.
    // No need to check localStorage for unsaved data.
    setLocation(target);
  };

  const confirmNavigation = () => {
    if (pendingLocation) {
      setLocation(pendingLocation);
      setPendingLocation(null);
      setShowConfirm(false);
    }
  };

  const cancelNavigation = () => {
    setPendingLocation(null);
    setShowConfirm(false);
  };

  return { navigate, showConfirm, confirmNavigation, cancelNavigation };
}
