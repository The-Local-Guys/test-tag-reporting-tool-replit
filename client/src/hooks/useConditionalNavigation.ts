import { useLocation } from "wouter";
import { useState } from "react";

export function useConditionalNavigation() {
  const [location, setLocation] = useLocation();
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = (target: string) => {
    // Check for truly unsaved results (those without serverId)
    const currentSessionId = localStorage.getItem("currentSessionId");
    let hasUnsavedResults = false;
    
    if (currentSessionId) {
      const batchedResults = localStorage.getItem(`batchedResults_${currentSessionId}`);
      if (batchedResults) {
        try {
          const results = JSON.parse(batchedResults);
          // Only consider results without serverId as truly unsaved
          const unsaved = results.filter((r: any) => !r.serverId);
          hasUnsavedResults = unsaved.length > 0;
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    console.log("Navigation check - hasUnsavedResults:", hasUnsavedResults);
    
    if (location === "/report" && hasUnsavedResults) {
      setPendingLocation(target);
      setShowConfirm(true);
    } else {
      setLocation(target);
    }
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
