import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { resolveRcdTripTimes } from "@/lib/rcd-trip-times";
import { sortAssetNumbers } from "../utils";

const EMPTY_EDIT_RESULT_DATA = {
  itemName: "",
  itemType: "",
  location: "",
  assetNumber: "",
  classification: "class1" as any,
  result: "pass" as any,
  frequency: "twelvemonthly" as any,
  failureReason: null as any,
  actionTaken: null as any,
  notes: null as any,
  photoData: null as string | null,
  // Service-specific boolean criteria fields
  visionInspection: false as boolean,
  electricalTest: false as boolean,
  dischargeTest: false as boolean,
  switchingTest: false as boolean,
  chargingTest: false as boolean,
  // Emergency Exit Light specific fields
  luxTest: false as boolean,
  luxReading: null as number | null,
  luxCompliant: false as boolean,
  manufacturerInfo: null as string | null,
  installationDate: null as string | null,
  expiryDate: null as string | null,
  maintenanceType: null as string | null,
  globeType: null as string | null,
  // Fire Testing specific fields
  pressureTest: false as boolean,
  accessibilityCheck: false as boolean,
  signageCheck: false as boolean,
  operationalTest: false as boolean,
  fireVisualInspection: false as boolean,
  equipmentType: null as string | null,
  extinguisherType: null as string | null,
  size: null as string | null,
  weight: null as string | null,
  testType: null as string | null,
  // Microwave Leakage specific fields
  leakageReading: null as string | null,
  // Electrical test & tag readings
  earthContinuity: null as string | null,
  insulationOperator: null as string | null,
  insulationResistance: null as string | null,
  polarity: null as string | null,
  leakageCurrent: null as string | null,
  // RCD-specific fields
  pushButtonTest: false as boolean,
  injectionTimedTest: false as boolean,
  tripTimes: [] as any[],
  distributionBoardNumber: null as string | null,
  circuitBreakerNumber: null as string | null,
};

export type EditResultData = typeof EMPTY_EDIT_RESULT_DATA;

/**
 * Helper function to find the next available asset number within a range
 * @param usedNumbers - Set of asset numbers already in use
 * @param start - Starting number for the range (1 for monthly, 10001 for 5-yearly)
 * @returns Next available asset number in the specified range
 */
function getNextAvailableAssetNumber(usedNumbers: Set<number>, start: number): number {
  let candidate = start;

  // Keep incrementing until we find an unused number
  while (usedNumbers.has(candidate)) {
    candidate++;
  }

  return candidate;
}

/** Edit and delete individual test results of the report open in the View Report modal. */
export function useReportResultEditor(
  viewingSession: any,
  setViewingSession: (value: any) => void,
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<any>(null);
  const [editResultData, setEditResultData] = useState(EMPTY_EDIT_RESULT_DATA);
  const [assetNumberError, setAssetNumberError] = useState<string>("");
  const [deletingResult, setDeletingResult] = useState<any>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Replaces the open report's results, keeping them in asset-number order. */
  const replaceViewingResults = (results: any[]) => {
    setViewingSession({
      ...viewingSession,
      results: sortAssetNumbers(results),
    });
  };

  const invalidateReportQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
    if (viewingSession?.session?.id) {
      queryClient.invalidateQueries({
        queryKey: ["/api/sessions", viewingSession.session.id, "full"],
      });
    }
  };

  // Update test result mutation
  const updateResultMutation = useMutation({
    mutationFn: async ({ id, data, sessionId }: { id: number; data: any; sessionId: number }) => {
      const res = await fetch(`/api/sessions/${sessionId}/results/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update test result");
      return res.json();
    },
    onSuccess: (updatedResult) => {
      // Update the local viewing session state immediately for real-time UI updates
      if (viewingSession && editingResult) {
        console.log('Updating local state with:', updatedResult);
        replaceViewingResults(
          viewingSession.results.map((result: any) =>
            result.id === editingResult.id ? {
              ...result,
              ...updatedResult,
              // Preserve itemType from response or keep original (itemType is not edited)
              itemType: updatedResult.itemType || result.itemType,
              assetNumber: updatedResult.assetNumber || result.assetNumber
            } : result
          ),
        );
        console.log('Local viewing session updated');
      }

      // Also invalidate queries to ensure data consistency
      invalidateReportQueries();

      toast({
        title: "Success",
        description: "Test result updated successfully",
      });
      setIsEditOpen(false);
      setEditingResult(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update test result",
        variant: "destructive",
      });
    },
  });

  // Delete test result mutation
  const deleteResultMutation = useMutation({
    mutationFn: async ({ sessionId, resultId }: { sessionId: number; resultId: number }) => {
      const response = await fetch(`/api/sessions/${sessionId}/results/${resultId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete test result");
      }

      return response.json();
    },
    onSuccess: (_, { resultId }) => {
      // Update the local viewing session state immediately for real-time UI updates
      if (viewingSession) {
        console.log('Removing result from local state:', resultId);
        replaceViewingResults(
          viewingSession.results.filter((result: any) => result.id !== resultId),
        );
        console.log('Local viewing session updated after deletion');
      }

      // Also invalidate queries to ensure data consistency
      invalidateReportQueries();

      toast({
        title: "Success",
        description: "Test result deleted successfully",
      });
      setIsDeleteOpen(false);
      setDeletingResult(null);
      setIsDeleting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete test result",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
  });

  /**
   * Renumber assets to ensure unique asset numbers within the session
   * Takes into account manually edited asset numbers and finds next available slots
   * Uses proper frequency ranges based on service type and custom starting numbers
   * @param changingResultId - ID of the result being changed (optional)
   * @param newFrequency - New frequency for the changing result (optional)
   * @returns Next available asset number for the frequency type
   */
  const renumberAssets = (changingResultId?: number, newFrequency?: string): string => {
    // Guard against missing session data
    if (!viewingSession?.results) {
      console.warn('renumberAssets: viewingSession or results is missing');
      return '1';
    }

    // Get service type to determine correct starting ranges
    const serviceType = viewingSession?.session?.serviceType || 'electrical';
    const isElectrical = serviceType === 'electrical';

    // Get custom starting numbers from the session if they exist
    const customStartingNumbers = viewingSession?.session?.customStartingNumbers || {};

    // Define starting numbers based on service type and frequency
    const getStartingNumber = (freq: string): number => {
      // For electrical services, check if custom starting numbers are set
      if (isElectrical && customStartingNumbers && Object.keys(customStartingNumbers).length > 0) {
        const customNumber = customStartingNumbers[freq];
        if (customNumber !== undefined) {
          console.log(`Admin: Using custom starting number for ${freq}: ${customNumber}`);
          return customNumber;
        }
      }

      // Fall back to default ranges
      if (isElectrical) {
        // Electrical service type default ranges
        const ranges: Record<string, number> = {
          'twelvemonthly': 1,
          'sixmonthly': 10001,
          'fiveyearly': 20001,
          'twentyfourmonthly': 30001,
          'threemonthly': 40001,
          'monthly': 50001,
        };
        return ranges[freq] || 1;
      } else {
        // Other service types (Emergency, Fire, RCD)
        const ranges: Record<string, number> = {
          'sixmonthly': 1,
          'twelvemonthly': 10001,
          'fiveyearly': 20001,
          'twentyfourmonthly': 30001,
          'threemonthly': 40001,
          'monthly': 50001,
        };
        return ranges[freq] || 1;
      }
    };

    // Get all existing asset numbers, excluding the one being changed
    const usedNumbers = new Set<number>();

    viewingSession.results.forEach((result: any) => {
      // Skip the result being changed, as it will get a new number
      if (changingResultId && result.id === changingResultId) {
        return;
      }

      // Parse asset number and add to used set if valid
      const assetNum = parseInt(result.assetNumber);
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // If we're updating a specific result's frequency, get the next available number for that frequency
    if (newFrequency) {
      const startNumber = getStartingNumber(newFrequency);
      const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
      console.log(`Admin: Generated asset number ${nextAvailable} for ${newFrequency} (start: ${startNumber})`);
      return nextAvailable.toString();
    }

    // If no specific frequency provided, default to twelvemonthly frequency logic
    const startNumber = getStartingNumber('twelvemonthly');
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
    return nextAvailable.toString();
  };

  /**
   * Validate asset number for duplicates and basic validity
   * Range validation removed since auto-generation handles correct ranges
   */
  const validateAssetNumber = (assetNumber: string): string => {
    if (!assetNumber.trim()) {
      return "Asset number is required";
    }

    const assetNum = parseInt(assetNumber);
    if (isNaN(assetNum) || assetNum <= 0) {
      return "Asset number must be a positive number";
    }

    if (!viewingSession?.results) {
      return "";
    }

    // Check for duplicates (excluding the current item being edited)
    const isDuplicate = viewingSession.results.some((result: any) =>
      result.assetNumber === assetNumber && result.id !== editingResult?.id
    );

    if (isDuplicate) {
      return `Asset number ${assetNumber} is already in use`;
    }

    return "";
  };

  const startEdit = (result: any) => {
    setEditingResult(result);
    setEditResultData({
      itemName: result.itemName || result.item_name || "",
      itemType: result.itemType || result.item_type || "",
      location: result.location || "",
      assetNumber: result.assetNumber || result.asset_number || "",
      classification: result.classification || "class1",
      result: result.result || "pass",
      frequency: result.frequency || "twelvemonthly",
      failureReason: result.failureReason || result.failure_reason || null,
      actionTaken: result.actionTaken || result.action_taken || null,
      notes: result.notes || null,
      photoData: result.photoData ?? result.photo_data ?? null,
      // Service-specific boolean criteria fields
      visionInspection: result.visionInspection ?? result.vision_inspection ?? false,
      electricalTest: result.electricalTest ?? result.electrical_test ?? false,
      dischargeTest: result.dischargeTest ?? result.discharge_test ?? false,
      switchingTest: result.switchingTest ?? result.switching_test ?? false,
      chargingTest: result.chargingTest ?? result.charging_test ?? false,
      // Emergency Exit Light specific fields
      luxTest: result.luxTest ?? result.lux_test ?? false,
      luxReading: result.luxReading ?? result.lux_reading ?? null,
      luxCompliant: result.luxCompliant ?? result.lux_compliant ?? false,
      manufacturerInfo: result.manufacturerInfo ?? result.manufacturer_info ?? null,
      installationDate: result.installationDate ?? result.installation_date ?? null,
      expiryDate: result.expiryDate ?? result.expiry_date ?? null,
      maintenanceType: result.maintenanceType ?? result.maintenance_type ?? null,
      globeType: result.globeType ?? result.globe_type ?? null,
      // Fire Testing specific fields
      pressureTest: result.pressureTest ?? result.pressure_test ?? false,
      accessibilityCheck: result.accessibilityCheck ?? result.accessibility_check ?? false,
      signageCheck: result.signageCheck ?? result.signage_check ?? false,
      operationalTest: result.operationalTest ?? result.operational_test ?? false,
      fireVisualInspection: result.fireVisualInspection ?? result.fire_visual_inspection ?? false,
      equipmentType:
        result.equipmentType ??
        result.equipment_type ??
        (viewingSession?.session?.serviceType === "fire_testing"
          ? result.classification
          : null),
      extinguisherType: result.extinguisherType ?? result.extinguisher_type ?? null,
      size: result.size ?? null,
      weight: result.weight ?? null,
      testType: result.testType ?? result.test_type ?? null,
      // Microwave Leakage specific fields
      leakageReading: result.leakageReading ?? result.leakage_reading ?? null,
      // Electrical test & tag readings
      earthContinuity: result.earthContinuity ?? result.earth_continuity ?? null,
      insulationOperator: result.insulationOperator ?? result.insulation_operator ?? null,
      insulationResistance: result.insulationResistance ?? result.insulation_resistance ?? null,
      polarity: result.polarity ?? null,
      leakageCurrent: result.leakageCurrent ?? result.leakage_current ?? null,
      // RCD-specific fields
      pushButtonTest: result.pushButtonTest ?? result.push_button_test ?? false,
      injectionTimedTest: result.injectionTimedTest ?? result.injection_timed_test ?? false,
      tripTimes: resolveRcdTripTimes(result),
      distributionBoardNumber: result.distributionBoardNumber ?? result.distribution_board_number ?? null,
      circuitBreakerNumber: result.circuitBreakerNumber ?? result.circuit_breaker_number ?? null,
    });
    setAssetNumberError(""); // Clear any previous errors
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingResult(null);
  };

  /**
   * Handle asset number input changes with real-time validation
   */
  const handleAssetNumberChange = (value: string) => {
    setEditResultData(prev => ({ ...prev, assetNumber: value }));
    setAssetNumberError(validateAssetNumber(value));
  };

  /**
   * Handle frequency changes - auto-generate new asset number following report page logic
   */
  const handleFrequencyChange = (newFrequency: string) => {
    // Auto-generate new asset number when frequency changes
    const newAssetNumber = renumberAssets(editingResult?.id, newFrequency);

    console.log(`Admin: Frequency changed to ${newFrequency}, auto-generated asset number: ${newAssetNumber}`);

    setEditResultData(prev => ({
      ...prev,
      frequency: newFrequency,
      assetNumber: newAssetNumber
    }));

    // Validate the new asset number
    setAssetNumberError(validateAssetNumber(newAssetNumber));
  };

  /**
   * Manual asset number update function - requires user to enter asset number
   * Validates for duplicates and provides real-time feedback
   */
  const saveEdit = (submittedData?: EditResultData) => {
    if (!editingResult || !viewingSession?.session?.id) return;
    const resultData = submittedData ?? editResultData;

    // Validate asset number before proceeding
    const assetError = validateAssetNumber(resultData.assetNumber);
    if (assetError) {
      setAssetNumberError(assetError);
      toast({
        title: "Invalid Asset Number",
        description: assetError,
        variant: "destructive",
      });
      return;
    }

    const updateData: Record<string, any> = {
      itemName: resultData.itemName,
      itemType: resultData.itemType,
      location: resultData.location,
      assetNumber: resultData.assetNumber,
      classification: resultData.classification,
      result: resultData.result,
      frequency: resultData.frequency,
      failureReason: resultData.failureReason,
      actionTaken: resultData.actionTaken,
      notes: resultData.notes,
      photoData: resultData.photoData,
      // Fire testing specific fields
      visionInspection: resultData.visionInspection,
      pressureTest: resultData.pressureTest,
      accessibilityCheck: resultData.accessibilityCheck,
      signageCheck: resultData.signageCheck,
      operationalTest: resultData.operationalTest,
      fireVisualInspection: resultData.visionInspection,
      equipmentType: resultData.equipmentType,
      extinguisherType: resultData.extinguisherType,
      size: resultData.size,
      weight: resultData.weight,
      testType: resultData.testType,
      // Emergency exit light fields
      electricalTest: resultData.electricalTest,
      dischargeTest: resultData.dischargeTest,
      switchingTest: resultData.switchingTest,
      chargingTest: resultData.chargingTest,
      luxTest: resultData.luxTest,
      luxReading: resultData.luxReading,
      luxCompliant: resultData.luxCompliant,
      globeType: resultData.globeType,
      manufacturerInfo: resultData.manufacturerInfo,
      installationDate: resultData.installationDate,
      expiryDate: resultData.expiryDate,
      maintenanceType: resultData.maintenanceType,
      // RCD fields
      pushButtonTest: resultData.pushButtonTest,
      injectionTimedTest: resultData.injectionTimedTest,
      tripTimes: resolveRcdTripTimes(resultData),
      distributionBoardNumber: resultData.distributionBoardNumber,
      circuitBreakerNumber: resultData.circuitBreakerNumber,
      // Microwave leakage fields
      leakageReading: resultData.leakageReading,
      // Electrical test & tag readings
      earthContinuity: resultData.earthContinuity,
      insulationOperator: resultData.insulationOperator,
      insulationResistance: resultData.insulationResistance,
      polarity: resultData.polarity,
      leakageCurrent: resultData.leakageCurrent,
    };

    console.log(`Admin: Manually updating asset number to: ${resultData.assetNumber}`);

    updateResultMutation.mutate({
      id: editingResult.id,
      sessionId: viewingSession.session.id,
      data: updateData,
    });
  };

  /**
   * Handle delete result action - shows confirmation dialog
   */
  const requestDelete = (result: any) => {
    setDeletingResult(result);
    setIsDeleteOpen(true);
  };

  /**
   * Confirm and execute result deletion
   */
  const confirmDelete = () => {
    if (!deletingResult || !viewingSession?.session?.id) return;

    setIsDeleting(true);
    deleteResultMutation.mutate({
      sessionId: viewingSession.session.id,
      resultId: deletingResult.id,
    });
  };

  /**
   * Cancel result deletion
   */
  const cancelDelete = () => {
    setIsDeleteOpen(false);
    setDeletingResult(null);
    setIsDeleting(false);
  };

  return {
    isEditOpen,
    editResultData,
    setEditResultData,
    assetNumberError,
    isSaving: updateResultMutation.isPending,
    startEdit,
    closeEdit,
    saveEdit,
    handleAssetNumberChange,
    handleFrequencyChange,
    deletingResult,
    isDeleteOpen,
    isDeleting,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
