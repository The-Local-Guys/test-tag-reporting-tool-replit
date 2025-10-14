import { useLocation } from "wouter";
import { useState } from "react";
import { json } from "stream/consumers";

export function useConditionalNavigation() {
  const [location, setLocation] = useLocation();
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = (target: string) => {
    // Example: unsaved changes check
    let hasUnfinishedReport = localStorage.getItem("unfinished"); // Replace with your real condition
    console.log("**********", hasUnfinishedReport, "type: ", typeof(hasUnfinishedReport))
    if (hasUnfinishedReport === "true") {
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
