import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { TestSession, TestResult, InsertTestSession, InsertTestResult } from '@shared/schema';

export interface SessionData {
  session: TestSession | null;
  results: TestResult[];
  summary: {
    totalItems: number;
    passedItems: number;
    failedItems: number;
    passRate: number;
    numberOfPushButtons?: number; // For RCD reporting only
    numberOfTimeTests?: number;   // For RCD reporting only
  };
}

export interface BatchedTestResult {
  id: string; // Temporary local ID
  serverId?: number; // Server-assigned ID after auto-save (for tracking saved results)
  itemName: string;
  itemType: string;
  location: string;
  classification: string;
  result: 'pass' | 'fail';
  frequency: string;
  failureReason?: string;
  actionTaken?: string;
  notes?: string;
  photoData?: string;
  visionInspection: boolean;
  electricalTest: boolean;
  timestamp: string;
  assetNumber?: string; // Added for preview display
  // Emergency-specific fields
  maintenanceType?: string;
  globeType?: string;
  dischargeTest?: boolean;
  switchingTest?: boolean;
  chargingTest?: boolean;
  manufacturerInfo?: string;
  installationDate?: string;
  // Lux testing fields
  luxTest?: boolean;
  luxReading?: number;
  luxCompliant?: boolean;
  // RCD testing fields
  pushButtonTest?: boolean;
  injectionTimedTest?: boolean;
  tripTimes?: number[]; // Array of trip times in milliseconds (for Fixed RCD, up to 3 values)
  distributionBoardNumber?: string;
  circuitBreakerNumber?: string;
  // Microwave leakage testing fields
  leakageReading?: string;
  // Fire testing specific fields
  pressureTest?: boolean;
  accessibilityCheck?: boolean;
  signageCheck?: boolean;
  operationalTest?: boolean;
  extinguisherType?: string;
  size?: string;
  weight?: string;
}

export interface SaveStatus {
  savedCount: number;     // items with serverId
  pendingCount: number;   // auto-saves in flight
  failedCount: number;    // failed after retries
  isOnline: boolean;
}

/**
 * Helper function to find the next available asset number within a range
 * @param usedNumbers - Set of asset numbers already in use
 * @param start - Starting number for the range
 * @returns Next available asset number in the specified range
 */
const getNextAvailableAssetNumber = (usedNumbers: Set<number>, start: number): number => {
  let candidate = start;

  // Keep incrementing until we find an unused number
  while (usedNumbers.has(candidate)) {
    candidate++;
  }

  return candidate;
};

/**
 * Default starting asset numbers for each frequency (Electrical Test & Tag only)
 */
export const DEFAULT_STARTING_NUMBERS_ELECTRICAL = {
  twelvemonthly: 1,
  sixmonthly: 10001,
  fiveyearly: 20001,
  twentyfourmonthly: 30001,
  threemonthly: 40001,
  monthly: 50001,
};

/**
 * Default starting asset numbers for non-electrical service types
 * (Emergency Exit Light, Fire Testing, RCD Reporting)
 * 6 Monthly: starts at 1
 * Annually (12 Monthly): starts at 10001
 */
const DEFAULT_STARTING_NUMBERS_OTHER = {
  sixmonthly: 1,
  twelvemonthly: 10001,
  fiveyearly: 20001,
  twentyfourmonthly: 30001,
  threemonthly: 40001,
  monthly: 50001,
};

export const DEFAULT_STARTING_NUMBERS = DEFAULT_STARTING_NUMBERS_ELECTRICAL;
export type CustomStartingNumbers = typeof DEFAULT_STARTING_NUMBERS;

/**
 * Get default starting numbers based on service type
 */
const getDefaultStartingNumbers = (serviceType?: string): typeof DEFAULT_STARTING_NUMBERS => {
  if (serviceType === 'electrical') {
    return DEFAULT_STARTING_NUMBERS_ELECTRICAL;
  }
  return DEFAULT_STARTING_NUMBERS_OTHER;
};

/**
 * Main hook for managing test sessions and results with batched submission
 *
 * DATABASE-ONLY ARCHITECTURE: Zero localStorage usage.
 * - React state (in-memory) for current session data
 * - Database (server) for persistence via auto-save
 * - On page refresh, data loads from /api/sessions/drafts + /api/sessions/{id}/results
 */
export function useSession() {
  // Initialize sessionId from sessionStorage if available (navigation bridge between pages)
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem('currentSessionId');
    return stored ? parseInt(stored, 10) : null;
  });
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [currentDistributionBoardNumber, setCurrentDistributionBoardNumber] = useState<string>('');
  const [currentCircuitBreakerNumber, setCurrentCircuitBreakerNumber] = useState<string>('');

  // Custom starting numbers (per session) - loaded from DB session record
  const [customStartingNumbers, setCustomStartingNumbers] = useState<Partial<CustomStartingNumbers>>({});

  // Pending custom starting numbers for sessions not yet created
  const [pendingCustomStartingNumbers, setPendingCustomStartingNumbers] = useState<Partial<CustomStartingNumbers> | null>(null);

  // Asset count state for tracking current counts
  const [assetCounts, setAssetCounts] = useState<{ monthly: number; fiveYearly: number }>({ monthly: 0, fiveYearly: 0 });

  // Track manually entered asset numbers in React state (was localStorage)
  const [manuallyEnteredAssetNumbers, setManuallyEnteredAssetNumbers] = useState<Set<string>>(new Set());

  // Asset number counters - separate counter for each frequency
  const [twelvemonthlyCounter, setTwelvemonthlyCounter] = useState<number>(0);
  const [sixmonthlyCounter, setSixmonthlyCounter] = useState<number>(10000);
  const [fiveyearlyCounter, setFiveyearlyCounter] = useState<number>(20000);
  const [twentyfourmonthlyCounter, setTwentyfourmonthlyCounter] = useState<number>(30000);
  const [threemonthlyCounter, setThreemonthlyCounter] = useState<number>(40000);
  const [monthlyCounter, setMonthlyCounter] = useState<number>(50000);

  // RCD Asset Counter (separate for RCD reporting)
  const [rcdAssetCounter, setRcdAssetCounter] = useState<number>(0);

  // Microwave Asset Counter (separate for microwave leakage testing)
  const [microwaveCounter, setMicrowaveCounter] = useState<number>(0);

  // === Ref mirrors for synchronous counter access (prevents duplicate asset numbers) ===
  // React setState is async/batched, so rapid back-to-back addToBatch calls read stale state.
  // Refs are updated synchronously alongside setState to ensure correct reads.
  const twelvemonthlyCounterRef = useRef(0);
  const sixmonthlyCounterRef = useRef(10000);
  const fiveyearlyCounterRef = useRef(20000);
  const twentyfourmonthlyCounterRef = useRef(30000);
  const threemonthlyCounterRef = useRef(40000);
  const monthlyCounterRef = useRef(50000);
  const rcdAssetCounterRef = useRef(0);
  const microwaveCounterRef = useRef(0);
  const batchedResultsRef = useRef<BatchedTestResult[]>([]);

  /** Update both the ref (synchronous) and state (async) for a counter */
  const updateCounter = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    ref: React.MutableRefObject<number>,
    value: number
  ) => {
    ref.current = value;
    setter(value);
  };

  /** Update both the ref (synchronous) and state (async) for batchedResults */
  const updateBatchedResultsState = (value: BatchedTestResult[]) => {
    batchedResultsRef.current = value;
    setBatchedResults(value);
  };

  // Batched results in memory only - DB is the persistence layer
  const [batchedResults, setBatchedResults] = useState<BatchedTestResult[]>([]);

  // Save status tracking
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    savedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    isOnline: navigator.onLine,
  });

  // Track if counters have been initialized for the current session
  const countersInitializedRef = useRef<number | null>(null);

  // Track which server results we've already processed (fingerprint = sorted IDs)
  // This allows re-processing when server data changes (e.g., auto-save completes on another page)
  const processedServerFingerprintRef = useRef<string>('');

  const queryClient = useQueryClient();

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setSaveStatus(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSaveStatus(prev => ({ ...prev, isOnline: false }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync sessionId to sessionStorage for cross-page navigation
  useEffect(() => {
    if (sessionId !== null) {
      sessionStorage.setItem('currentSessionId', sessionId.toString());
    } else {
      sessionStorage.removeItem('currentSessionId');
    }
  }, [sessionId]);

  // Update save status counts whenever batchedResults change
  useEffect(() => {
    const saved = batchedResults.filter(r => r.serverId).length;
    setSaveStatus(prev => ({ ...prev, savedCount: saved }));
  }, [batchedResults]);

  // Get current session basic info
  const { data: session, isLoading } = useQuery<TestSession>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  // When continuing an existing session, load existing results from server
  const { data: existingResults } = useQuery<TestResult[]>({
    queryKey: [`/api/sessions/${sessionId}/results`],
    enabled: !!sessionId && session?.id === sessionId,
  });

  // Effect to handle loading existing results when they become available
  // Uses fingerprint-based dedup so it re-processes when server data changes
  // (e.g., auto-save completes after navigating to a different page)
  useEffect(() => {
    if (!existingResults || existingResults.length === 0 || !sessionId) return;

    // Build a fingerprint of server result IDs to detect changes
    const fingerprint = existingResults.map((r: any) => r.id).sort((a: number, b: number) => a - b).join(',');
    if (fingerprint === processedServerFingerprintRef.current) return;
    processedServerFingerprintRef.current = fingerprint;

    const isInitialLoad = batchedResults.length === 0;
    console.log('🔄 ********** LOADING RESULTS FROM DATABASE **********');
    console.log(`Loading ${existingResults.length} existing results for session ${sessionId}${isInitialLoad ? '' : ' (merge)'}`);

    const loadedResults: BatchedTestResult[] = existingResults.map((result: any) => ({
      id: `existing-${result.id}`,
      serverId: result.id, // Track server ID for auto-save updates
      itemName: result.item_name || result.itemName,
      itemType: result.item_type || result.itemType || result.itemName,
      location: result.location,
      classification: result.classification,
      result: result.result,
      frequency: result.frequency,
      failureReason: result.failure_reason || result.failureReason || undefined,
      actionTaken: result.action_taken || result.actionTaken || undefined,
      // Clean notes by removing [TRIP_TIMES:[...]] pattern that was used for storage
      notes: (() => {
        const rawNotes = result.notes || '';
        const cleanedNotes = rawNotes.replace(/\s*\[TRIP_TIMES:\[[^\]]*\]\]/g, '').trim();
        return cleanedNotes || undefined;
      })(),
      photoData: result.photo_data || result.photoData || undefined,
      visionInspection: result.vision_inspection ?? result.visionInspection,
      electricalTest: result.electrical_test ?? result.electricalTest,
      timestamp: new Date().toISOString(),
      assetNumber: result.asset_number || result.assetNumber,
      // Emergency-specific fields
      maintenanceType: result.maintenance_type ?? result.maintenanceType ?? undefined,
      globeType: result.globe_type ?? result.globeType ?? undefined,
      dischargeTest: result.discharge_test ?? result.dischargeTest ?? undefined,
      switchingTest: result.switching_test ?? result.switchingTest ?? undefined,
      chargingTest: result.charging_test ?? result.chargingTest ?? undefined,
      manufacturerInfo: result.manufacturer_info ?? result.manufacturerInfo ?? undefined,
      installationDate: result.installation_date ?? result.installationDate ?? undefined,
      // Lux testing fields
      luxTest: result.lux_test ?? result.luxTest ?? undefined,
      luxReading: result.lux_reading ?? result.luxReading ?? undefined,
      luxCompliant: result.lux_compliant ?? result.luxCompliant ?? undefined,
      // Fire testing fields
      equipmentType: result.equipment_type ?? result.equipmentType ?? undefined,
      extinguisherType: result.extinguisher_type ?? result.extinguisherType ?? undefined,
      size: result.size ?? undefined,
      weight: result.weight ?? undefined,
      testType: result.test_type ?? result.testType ?? undefined,
      fireVisualInspection: result.fire_visual_inspection ?? result.fireVisualInspection ?? undefined,
      pressureTest: result.pressure_test ?? result.pressureTest ?? undefined,
      accessibilityCheck: result.accessibility_check ?? result.accessibilityCheck ?? undefined,
      signageCheck: result.signage_check ?? result.signageCheck ?? undefined,
      operationalTest: result.operational_test ?? result.operationalTest ?? undefined,
      // RCD testing fields
      pushButtonTest: result.pushButtonTest ?? result.push_button_test ?? undefined,
      injectionTimedTest: result.injectionTimedTest ?? result.injection_timed_test ?? undefined,
      tripTimes: (() => {
        const notesValue = result.notes || '';
        const tripTimesMatch = notesValue.match(/\[TRIP_TIMES:\[([^\]]*)\]\]/);
        if (tripTimesMatch && tripTimesMatch[1]) {
          const parsedTimes = tripTimesMatch[1].split(',').map((t: string) => Number(t.trim())).filter((t: number) => t > 0);
          if (parsedTimes.length > 0) {
            return parsedTimes;
          }
        }
        if (result.tripTimes && Array.isArray(result.tripTimes) && result.tripTimes.length > 0) {
          const validTimes = result.tripTimes.map((t: any) => Number(t)).filter((t: number) => t > 0);
          if (validTimes.length > 0) {
            return validTimes;
          }
        }
        const singleTripTime = result.trip_time || result.tripTime;
        if (singleTripTime != null && Number(singleTripTime) > 0) {
          return [Number(singleTripTime)];
        }
        return undefined;
      })(),
      distributionBoardNumber: result.distributionBoardNumber ?? result.distribution_board_number ?? undefined,
      circuitBreakerNumber: result.circuitBreakerNumber ?? result.circuit_breaker_number ?? undefined,
      leakageReading: result.leakageReading || result.leakage_reading || undefined,
    }));

    // Merge strategy: on initial load replace entirely, on subsequent updates
    // keep any pending (unsaved) local items and replace saved items with fresh server data
    setBatchedResults(prev => {
      let merged: BatchedTestResult[];
      if (prev.length === 0) {
        merged = loadedResults;
      } else {
        const pendingItems = prev.filter(r => !r.serverId);
        merged = [...loadedResults, ...pendingItems];
      }
      batchedResultsRef.current = merged;
      return merged;
    });

    // Only recalculate counters on initial load (counters are already correct
    // from addToBatch increments during the current session)
    if (isInitialLoad) {
      // Calculate and update asset counts based on loaded results
      const monthlyCount = loadedResults.filter(r => r.frequency !== 'fiveyearly').length;
      const fiveYearlyCount = loadedResults.filter(r => r.frequency === 'fiveyearly').length;
      setAssetCounts({ monthly: monthlyCount, fiveYearly: fiveYearlyCount });

      // Set counters to continue from where they left off
      const twelvemonthlyAssets = loadedResults.filter(r => r.frequency === 'twelvemonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n) && n > 0);
      const sixmonthlyAssets = loadedResults.filter(r => r.frequency === 'sixmonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n) && n > 0);
      const fiveyearlyAssets = loadedResults.filter(r => r.frequency === 'fiveyearly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n) && n > 0);
      const twentyfourmonthlyAssets = loadedResults.filter(r => r.frequency === 'twentyfourmonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n) && n > 0);
      const threemonthlyAssets = loadedResults.filter(r => r.frequency === 'threemonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n) && n > 0);
      const monthlyAssets = loadedResults.filter(r => r.frequency === 'monthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n) && n > 0);

      // Get service-type-aware defaults for fallback values
      const serviceTypeDefaults = session ? getDefaultStartingNumbers(session.serviceType) : DEFAULT_STARTING_NUMBERS_ELECTRICAL;

      const maxTwelvemonthly = twelvemonthlyAssets.length > 0 ? Math.max(...twelvemonthlyAssets) : (serviceTypeDefaults.twelvemonthly - 1);
      const maxSixmonthly = sixmonthlyAssets.length > 0 ? Math.max(...sixmonthlyAssets) : (serviceTypeDefaults.sixmonthly - 1);
      const maxFiveyearly = fiveyearlyAssets.length > 0 ? Math.max(...fiveyearlyAssets) : (serviceTypeDefaults.fiveyearly - 1);
      const maxTwentyfourmonthly = twentyfourmonthlyAssets.length > 0 ? Math.max(...twentyfourmonthlyAssets) : (serviceTypeDefaults.twentyfourmonthly - 1);
      const maxThreemonthly = threemonthlyAssets.length > 0 ? Math.max(...threemonthlyAssets) : (serviceTypeDefaults.threemonthly - 1);
      const maxMonthly = monthlyAssets.length > 0 ? Math.max(...monthlyAssets) : (serviceTypeDefaults.monthly - 1);

      updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, maxTwelvemonthly);
      updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, maxSixmonthly);
      updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, maxFiveyearly);
      updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, maxTwentyfourmonthly);
      updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, maxThreemonthly);
      updateCounter(setMonthlyCounter, monthlyCounterRef, maxMonthly);

      // Also set RCD and microwave counters from loaded results
      const rcdAssets = loadedResults
        .filter(r => r.classification === 'rcd' || r.classification === 'fixed-rcd' || r.classification === 'portable-rcd' || r.pushButtonTest !== undefined || r.injectionTimedTest !== undefined)
        .map(r => parseInt(r.assetNumber || '0'))
        .filter(n => !isNaN(n) && n > 0);
      if (rcdAssets.length > 0) {
        const maxFromResults = Math.max(...rcdAssets);
        // Also consider session's startingAssetNumber - counter should be at least startingAssetNumber - 1
        // This handles the case where old items have wrong asset numbers (e.g., "1" instead of "100")
        const startingMin = (session?.serviceType === 'rcd_reporting' && session?.startingAssetNumber)
          ? session.startingAssetNumber - 1
          : 0;
        updateCounter(setRcdAssetCounter, rcdAssetCounterRef, Math.max(maxFromResults, startingMin));
      } else if (session?.serviceType === 'rcd_reporting' && session?.startingAssetNumber) {
        // Fallback: use session starting asset number if no RCD results found (e.g., old data with null fields)
        updateCounter(setRcdAssetCounter, rcdAssetCounterRef, session.startingAssetNumber - 1);
      }

      const microwaveAssets = loadedResults
        .filter(r => r.classification === 'microwave' || r.leakageReading !== undefined)
        .map(r => parseInt(r.assetNumber || '0'))
        .filter(n => !isNaN(n) && n > 0);
      if (microwaveAssets.length > 0) {
        updateCounter(setMicrowaveCounter, microwaveCounterRef, Math.max(...microwaveAssets));
      }

      // Restore last used location from most recent result
      if (loadedResults.length > 0) {
        const lastResult = loadedResults[loadedResults.length - 1];
        if (lastResult.location) {
          setCurrentLocation(lastResult.location);
          console.log('📍 Restored location from last result:', lastResult.location);
        }
      }

      console.log('⚙️ ********** COUNTERS UPDATED FROM DB **********');
      console.log(`Updated asset counters: 12M=${maxTwelvemonthly}, 6M=${maxSixmonthly}, 5Y=${maxFiveyearly}, 24M=${maxTwentyfourmonthly}, 3M=${maxThreemonthly}, M=${maxMonthly}`);
      console.log('⚙️ ********** END COUNTER UPDATE **********');
    }
  }, [existingResults, batchedResults.length, sessionId]);

  // Initialize counters and load custom starting numbers in a SINGLE effect
  // to eliminate the race condition where defaults were set before custom numbers loaded.
  // Previously these were two separate effects (A: set defaults, B: load custom numbers)
  // which caused a brief window where counters showed defaults before being corrected.
  useEffect(() => {
    if (!session || !sessionId) return;

    const serviceType = session.serviceType || 'electrical';

    // Skip if counters already initialized for this exact session
    // (unless we have pending custom numbers to apply)
    if (countersInitializedRef.current === sessionId && !pendingCustomStartingNumbers) {
      return;
    }

    // Only initialize if we don't have existing results loaded yet
    // (existingResults effect handles counter setup when resuming)
    if (existingResults && existingResults.length > 0) {
      // Still need to load custom starting numbers state even when results exist
      const sessionCustomNumbers = (session as any)?.customStartingNumbers;
      if (sessionCustomNumbers && serviceType === 'electrical' && Object.keys(sessionCustomNumbers).length > 0) {
        setCustomStartingNumbers(sessionCustomNumbers);
      }
      countersInitializedRef.current = sessionId;
      return;
    }

    // Get service-type-aware defaults as fallback
    const serviceTypeDefaults = getDefaultStartingNumbers(session.serviceType);

    // Check for custom starting numbers from DB session FIRST (highest priority)
    const sessionCustomNumbers = (session as any)?.customStartingNumbers;
    if (sessionCustomNumbers && serviceType === 'electrical' && Object.keys(sessionCustomNumbers).length > 0) {
      console.log('Loading custom starting numbers from database session:', sessionCustomNumbers);
      setCustomStartingNumbers(sessionCustomNumbers);

      // Initialize counters with custom numbers directly — no default-then-override race
      updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, (sessionCustomNumbers.twelvemonthly ?? DEFAULT_STARTING_NUMBERS.twelvemonthly) - 1);
      updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, (sessionCustomNumbers.sixmonthly ?? DEFAULT_STARTING_NUMBERS.sixmonthly) - 1);
      updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, (sessionCustomNumbers.fiveyearly ?? DEFAULT_STARTING_NUMBERS.fiveyearly) - 1);
      updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, (sessionCustomNumbers.twentyfourmonthly ?? DEFAULT_STARTING_NUMBERS.twentyfourmonthly) - 1);
      updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, (sessionCustomNumbers.threemonthly ?? DEFAULT_STARTING_NUMBERS.threemonthly) - 1);
      updateCounter(setMonthlyCounter, monthlyCounterRef, (sessionCustomNumbers.monthly ?? DEFAULT_STARTING_NUMBERS.monthly) - 1);

      countersInitializedRef.current = sessionId;
      console.log(`Initialized counters with CUSTOM numbers for ${serviceType} service (session ${sessionId})`);
    }
    // Check for pending custom starting numbers for NEW sessions (stored in React state)
    else if (pendingCustomStartingNumbers && serviceType === 'electrical') {
      const numbers = pendingCustomStartingNumbers;
      console.log('Applying pending custom starting numbers to electrical session:', numbers);

      const isValidNumbers =
        typeof numbers === 'object' &&
        Object.values(numbers).every(val => typeof val === 'number' && !isNaN(val as number) && (val as number) > 0);

      if (isValidNumbers) {
        setCustomStartingNumbers(numbers);

        updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, (numbers.twelvemonthly ?? DEFAULT_STARTING_NUMBERS.twelvemonthly) - 1);
        updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, (numbers.sixmonthly ?? DEFAULT_STARTING_NUMBERS.sixmonthly) - 1);
        updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, (numbers.fiveyearly ?? DEFAULT_STARTING_NUMBERS.fiveyearly) - 1);
        updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, (numbers.twentyfourmonthly ?? DEFAULT_STARTING_NUMBERS.twentyfourmonthly) - 1);
        updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, (numbers.threemonthly ?? DEFAULT_STARTING_NUMBERS.threemonthly) - 1);
        updateCounter(setMonthlyCounter, monthlyCounterRef, (numbers.monthly ?? DEFAULT_STARTING_NUMBERS.monthly) - 1);

        // Save to database for persistence
        apiRequest('PATCH', `/api/sessions/${sessionId}/custom-numbers`, {
          customStartingNumbers: numbers
        }).then(() => {
          console.log('Custom starting numbers saved to database');
        }).catch((err) => {
          console.warn('Failed to save custom numbers to database:', err);
        });
      }

      // Clear pending after applying
      setPendingCustomStartingNumbers(null);
      countersInitializedRef.current = sessionId;
      console.log(`Initialized counters with PENDING custom numbers for ${serviceType} service (session ${sessionId})`);
    }
    // No custom numbers — use service-type defaults
    else {
      if (pendingCustomStartingNumbers && serviceType !== 'electrical') {
        console.log(`Clearing pending custom numbers for ${serviceType} session`);
        setPendingCustomStartingNumbers(null);
      }

      updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, serviceTypeDefaults.twelvemonthly - 1);
      updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, serviceTypeDefaults.sixmonthly - 1);
      updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, serviceTypeDefaults.fiveyearly - 1);
      updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, serviceTypeDefaults.twentyfourmonthly - 1);
      updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, serviceTypeDefaults.threemonthly - 1);
      updateCounter(setMonthlyCounter, monthlyCounterRef, serviceTypeDefaults.monthly - 1);

      // For RCD sessions, initialize rcdAssetCounter from session's startingAssetNumber
      if (session.serviceType === 'rcd_reporting' && session.startingAssetNumber) {
        updateCounter(setRcdAssetCounter, rcdAssetCounterRef, session.startingAssetNumber - 1);
      }

      countersInitializedRef.current = sessionId;
      console.log(`Initialized counters with DEFAULTS for ${serviceType} service (session ${sessionId})`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, sessionId, session?.serviceType, existingResults, pendingCustomStartingNumbers, JSON.stringify((session as any)?.customStartingNumbers)]);

  // Calculate local asset progress from actual used numbers (accounts for gaps)
  const getLocalAssetProgress = () => {
    // Collect all existing asset numbers
    const usedNumbers = new Set<number>();

    // Add numbers from batched results
    batchedResults.forEach((result: BatchedTestResult) => {
      const assetNum = parseInt(result.assetNumber || '');
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Add manually entered asset numbers from React state to prevent conflicts
    manuallyEnteredAssetNumbers.forEach(manualNumber => {
      const assetNum = parseInt(manualNumber);
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Get minimum starting numbers (custom or default based on service type)
    const serviceType = session?.serviceType || 'electrical';
    const defaults = getDefaultStartingNumbers(serviceType);
    const getMinStartNumber = (freq: keyof typeof DEFAULT_STARTING_NUMBERS) => {
      return customStartingNumbers[freq] ?? defaults[freq];
    };

    // Debug logging for troubleshooting
    console.log('🔍 ********** CALCULATING NEXT ASSET NUMBERS **********');
    console.log('🔍 Asset Progress Calculation:', {
      batchedResultsCount: batchedResults.length,
      batchedResults: batchedResults.map(r => ({
        id: r.id,
        assetNumber: r.assetNumber,
        frequency: r.frequency,
        itemName: r.itemName
      })),
      usedNumbers: Array.from(usedNumbers),
      customStartingNumbers,
      counters: {
        twelvemonthly: twelvemonthlyCounter,
        sixmonthly: sixmonthlyCounter,
        fiveyearly: fiveyearlyCounter,
        twentyfourmonthly: twentyfourmonthlyCounter,
        threemonthly: threemonthlyCounter,
        monthly: monthlyCounter,
      }
    });

    // Find next available numbers for each frequency range
    const nextTwelvemonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('twelvemonthly'), twelvemonthlyCounter + 1));
    const nextSixmonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('sixmonthly'), sixmonthlyCounter + 1));
    const nextFiveyearly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('fiveyearly'), fiveyearlyCounter + 1));
    const nextTwentyfourmonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('twentyfourmonthly'), twentyfourmonthlyCounter + 1));
    const nextThreemonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('threemonthly'), threemonthlyCounter + 1));
    const nextMonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('monthly'), monthlyCounter + 1));

    console.log('🔍 Next Asset Numbers:', {
      nextTwelvemonthly,
      nextSixmonthly,
      nextFiveyearly,
      nextTwentyfourmonthly,
      nextThreemonthly,
      nextMonthly,
    });
    console.log('🔍 ********** END CALCULATION **********');

    // Count items by frequency
    const twelvemonthlyCount = batchedResults.filter(r => r.frequency === 'twelvemonthly').length;
    const sixmonthlyCount = batchedResults.filter(r => r.frequency === 'sixmonthly').length;
    const fiveyearlyCount = batchedResults.filter(r => r.frequency === 'fiveyearly').length;
    const twentyfourmonthlyCount = batchedResults.filter(r => r.frequency === 'twentyfourmonthly').length;
    const threemonthlyCount = batchedResults.filter(r => r.frequency === 'threemonthly').length;
    const monthlyCount = batchedResults.filter(r => r.frequency === 'monthly').length;

    return {
      nextTwelvemonthly,
      nextSixmonthly,
      nextFiveyearly,
      nextTwentyfourmonthly,
      nextThreemonthly,
      nextMonthly,
      twelvemonthlyCount,
      sixmonthlyCount,
      fiveyearlyCount,
      twentyfourmonthlyCount,
      threemonthlyCount,
      monthlyCount,
    };
  };

  // Create session data from local batched results
  const sessionData: SessionData | undefined = session ? {
    session,
    results: [], // Empty since we're using batched results
    summary: (() => {
      // For RCD reporting, count all items and track test types separately
      if (session.serviceType === 'rcd_reporting') {
        const totalItems = batchedResults.length;
        const passedItems = batchedResults.filter(r => r.result === 'pass').length;
        const failedItems = batchedResults.filter(r => r.result === 'fail').length;
        let numberOfPushButtons = 0;
        let numberOfTimeTests = 0;

        batchedResults.forEach(result => {
          if ((result as any).pushButtonTest === true) {
            numberOfPushButtons++;
          }
          if ((result as any).injectionTimedTest === true) {
            numberOfTimeTests++;
          }
        });

        return {
          totalItems,
          passedItems,
          failedItems,
          passRate: totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0,
          numberOfPushButtons,
          numberOfTimeTests,
        };
      }

      // For other service types, count normally
      return {
        totalItems: batchedResults.length,
        passedItems: batchedResults.filter(r => r.result === 'pass').length,
        failedItems: batchedResults.filter(r => r.result === 'fail').length,
        passRate: batchedResults.length > 0 ?
          Math.round((batchedResults.filter(r => r.result === 'pass').length / batchedResults.length) * 100) : 0,
      };
    })()
  } : undefined;

  /**
   * Creates a new testing session with client and technician details
   */
  const createSessionMutation = useMutation({
    mutationFn: async (data: InsertTestSession) => {
      const response = await apiRequest('POST', '/api/sessions', data);
      return response.json();
    },
    onSuccess: (session: TestSession) => {
      console.log('Session created successfully:', session.id);

      setSessionId(session.id);

      // Clear any existing batched results for this session
      updateBatchedResultsState([]);

      // Get default starting numbers based on service type
      const defaults = getDefaultStartingNumbers(session.serviceType);

      // Check if we have pending custom starting numbers for electrical service
      const shouldApplyCustomNumbers =
        session.serviceType === 'electrical' &&
        pendingCustomStartingNumbers &&
        Object.keys(pendingCustomStartingNumbers).length > 0;

      if (shouldApplyCustomNumbers) {
        // Apply pending custom starting numbers immediately to avoid race condition
        const customNumbers = pendingCustomStartingNumbers!;
        console.log('Applying pending custom starting numbers to new session:', customNumbers);

        setCustomStartingNumbers(customNumbers);
        updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, (customNumbers.twelvemonthly ?? defaults.twelvemonthly) - 1);
        updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, (customNumbers.sixmonthly ?? defaults.sixmonthly) - 1);
        updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, (customNumbers.fiveyearly ?? defaults.fiveyearly) - 1);
        updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, (customNumbers.twentyfourmonthly ?? defaults.twentyfourmonthly) - 1);
        updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, (customNumbers.threemonthly ?? defaults.threemonthly) - 1);
        updateCounter(setMonthlyCounter, monthlyCounterRef, (customNumbers.monthly ?? defaults.monthly) - 1);

        // Save to database immediately
        apiRequest('PATCH', `/api/sessions/${session.id}/custom-numbers`, {
          customStartingNumbers: customNumbers
        }).then(() => {
          console.log('Custom starting numbers saved to database for new session');
        }).catch((err) => {
          console.warn('Failed to save custom numbers to database:', err);
        });

        // Clear pending after applying
        setPendingCustomStartingNumbers(null);
      } else {
        // Reset all frequency-specific asset counters for new session using defaults
        updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, defaults.twelvemonthly - 1);
        updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, defaults.sixmonthly - 1);
        updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, defaults.fiveyearly - 1);
        updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, defaults.twentyfourmonthly - 1);
        updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, defaults.threemonthly - 1);
        updateCounter(setMonthlyCounter, monthlyCounterRef, defaults.monthly - 1);
      }

      // For RCD sessions, use startingAssetNumber if provided (allows custom starting numbers)
      if (session.serviceType === 'rcd_reporting' && session.startingAssetNumber) {
        updateCounter(setRcdAssetCounter, rcdAssetCounterRef, session.startingAssetNumber - 1);
      } else {
        updateCounter(setRcdAssetCounter, rcdAssetCounterRef, 0);
      }
      updateCounter(setMicrowaveCounter, microwaveCounterRef, 0);
      countersInitializedRef.current = session.id;

      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/drafts'] });
    },
  });

  /**
   * Adds test result to local batch storage with proper asset numbering
   * Results are auto-saved to server immediately after being added to state
   */
  const addToBatch = (data: Omit<InsertTestResult, 'sessionId'>) => {
    if (!sessionId) throw new Error('No active session');

    // Defensive sanitization: strip itemCode and any other unexpected fields from incoming data
    const { itemCode, ...cleanData } = data as any;

    const frequency = cleanData.frequency;

    // Collect all existing asset numbers to avoid conflicts
    // Read from ref for synchronous accuracy (state may be stale in rapid calls)
    const usedNumbers = new Set<number>();

    // Add numbers from current batched results (ref for synchronous read)
    batchedResultsRef.current.forEach(result => {
      const assetNum = parseInt(result.assetNumber || '');
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Add manually entered asset numbers from React state
    manuallyEnteredAssetNumbers.forEach(num => {
      const assetNum = parseInt(num);
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Use provided asset number or auto-generate
    let assetNumber: string;
    const isRCD = cleanData.classification === 'rcd' || sessionData?.session?.serviceType === 'rcd_reporting';
    const isMicrowave = cleanData.classification === 'microwave' || sessionData?.session?.serviceType === 'microwave_leakage';

    // If asset number is provided, use it and update counters accordingly
    if (cleanData.assetNumber && cleanData.assetNumber.trim() !== '') {
      assetNumber = cleanData.assetNumber.trim();
      const assetNum = parseInt(assetNumber);

      console.log('📝 Adding result with PROVIDED asset number:', {
        assetNumber,
        assetNum,
        frequency,
        currentCounter: frequency === 'fiveyearly' ? fiveyearlyCounterRef.current :
                       frequency === 'twelvemonthly' ? twelvemonthlyCounterRef.current :
                       frequency === 'sixmonthly' ? sixmonthlyCounterRef.current : 'other'
      });

      // Update the appropriate counter if this number is higher (read refs for synchronous accuracy)
      if (!isNaN(assetNum)) {
        if (isRCD) {
          if (assetNum > rcdAssetCounterRef.current) {
            console.log('✅ Updating RCD counter:', rcdAssetCounterRef.current, '→', assetNum);
            updateCounter(setRcdAssetCounter, rcdAssetCounterRef, assetNum);
          }
        } else if (isMicrowave) {
          if (assetNum > microwaveCounterRef.current) {
            console.log('✅ Updating microwave counter:', microwaveCounterRef.current, '→', assetNum);
            updateCounter(setMicrowaveCounter, microwaveCounterRef, assetNum);
          }
        } else {
          switch (frequency) {
            case 'twelvemonthly':
              if (assetNum > twelvemonthlyCounterRef.current) {
                console.log('✅ Updating 12M counter:', twelvemonthlyCounterRef.current, '→', assetNum);
                updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, assetNum);
              } else {
                console.log('⚠️ NOT updating 12M counter (assetNum <= current):', assetNum, '<=', twelvemonthlyCounterRef.current);
              }
              break;
            case 'sixmonthly':
              if (assetNum > sixmonthlyCounterRef.current) {
                console.log('✅ Updating 6M counter:', sixmonthlyCounterRef.current, '→', assetNum);
                updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, assetNum);
              } else {
                console.log('⚠️ NOT updating 6M counter (assetNum <= current):', assetNum, '<=', sixmonthlyCounterRef.current);
              }
              break;
            case 'fiveyearly':
              if (assetNum > fiveyearlyCounterRef.current) {
                console.log('✅ Updating 5Y counter:', fiveyearlyCounterRef.current, '→', assetNum);
                updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, assetNum);
              } else {
                console.log('⚠️ NOT updating 5Y counter (assetNum <= current):', assetNum, '<=', fiveyearlyCounterRef.current);
              }
              break;
            case 'twentyfourmonthly':
              if (assetNum > twentyfourmonthlyCounterRef.current) {
                console.log('✅ Updating 24M counter:', twentyfourmonthlyCounterRef.current, '→', assetNum);
                updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, assetNum);
              } else {
                console.log('⚠️ NOT updating 24M counter (assetNum <= current):', assetNum, '<=', twentyfourmonthlyCounterRef.current);
              }
              break;
            case 'threemonthly':
              if (assetNum > threemonthlyCounterRef.current) {
                console.log('✅ Updating 3M counter:', threemonthlyCounterRef.current, '→', assetNum);
                updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, assetNum);
              } else {
                console.log('⚠️ NOT updating 3M counter (assetNum <= current):', assetNum, '<=', threemonthlyCounterRef.current);
              }
              break;
            case 'monthly':
              if (assetNum > monthlyCounterRef.current) {
                console.log('✅ Updating M counter:', monthlyCounterRef.current, '→', assetNum);
                updateCounter(setMonthlyCounter, monthlyCounterRef, assetNum);
              } else {
                console.log('⚠️ NOT updating M counter (assetNum <= current):', assetNum, '<=', monthlyCounterRef.current);
              }
              break;
          }
        }
      }
    } else {
      // Auto-generate asset number based on frequency (read refs for synchronous accuracy)
      if (isRCD) {
        let candidate = Math.max(1, rcdAssetCounterRef.current + 1);
        while (usedNumbers.has(candidate)) candidate++;
        assetNumber = candidate.toString();
        updateCounter(setRcdAssetCounter, rcdAssetCounterRef, candidate);
      } else if (isMicrowave) {
        let candidate = Math.max(1, microwaveCounterRef.current + 1);
        while (usedNumbers.has(candidate)) candidate++;
        assetNumber = candidate.toString();
        updateCounter(setMicrowaveCounter, microwaveCounterRef, candidate);
      } else {
        // Get service type to determine correct starting ranges
        const sessionServiceType = sessionData?.session?.serviceType || 'electrical';
        const defaultStartingNumbers = getDefaultStartingNumbers(sessionServiceType);

        const startingNumbers = sessionServiceType === 'electrical'
          ? {
              twelvemonthly: customStartingNumbers.twelvemonthly ?? defaultStartingNumbers.twelvemonthly,
              sixmonthly: customStartingNumbers.sixmonthly ?? defaultStartingNumbers.sixmonthly,
              fiveyearly: customStartingNumbers.fiveyearly ?? defaultStartingNumbers.fiveyearly,
              twentyfourmonthly: customStartingNumbers.twentyfourmonthly ?? defaultStartingNumbers.twentyfourmonthly,
              threemonthly: customStartingNumbers.threemonthly ?? defaultStartingNumbers.threemonthly,
              monthly: customStartingNumbers.monthly ?? defaultStartingNumbers.monthly,
            }
          : defaultStartingNumbers;

        let candidate: number;

        switch (frequency) {
          case 'twelvemonthly':
            candidate = Math.max(startingNumbers.twelvemonthly, twelvemonthlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, candidate);
            break;
          case 'sixmonthly':
            candidate = Math.max(startingNumbers.sixmonthly, sixmonthlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, candidate);
            break;
          case 'fiveyearly':
            candidate = Math.max(startingNumbers.fiveyearly, fiveyearlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, candidate);
            break;
          case 'twentyfourmonthly':
            candidate = Math.max(startingNumbers.twentyfourmonthly, twentyfourmonthlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, candidate);
            break;
          case 'threemonthly':
            candidate = Math.max(startingNumbers.threemonthly, threemonthlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, candidate);
            break;
          case 'monthly':
            candidate = Math.max(startingNumbers.monthly, monthlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setMonthlyCounter, monthlyCounterRef, candidate);
            break;
          default:
            candidate = Math.max(startingNumbers.twelvemonthly, twelvemonthlyCounterRef.current + 1);
            while (usedNumbers.has(candidate)) candidate++;
            assetNumber = candidate.toString();
            updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, candidate);
        }
      }
    }

    const newResult: BatchedTestResult = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      itemName: cleanData.itemName,
      itemType: cleanData.itemType,
      location: cleanData.location,
      classification: cleanData.classification,
      result: cleanData.result as 'pass' | 'fail',
      frequency: cleanData.frequency,
      assetNumber,
      failureReason: cleanData.failureReason || undefined,
      actionTaken: cleanData.actionTaken || undefined,
      notes: cleanData.notes || undefined,
      photoData: cleanData.photoData || undefined,
      visionInspection: cleanData.visionInspection ?? true,
      electricalTest: cleanData.electricalTest ?? true,
      timestamp: new Date().toISOString(),
      maintenanceType: cleanData.maintenanceType || undefined,
      globeType: cleanData.globeType || undefined,
      dischargeTest: cleanData.dischargeTest ?? undefined,
      switchingTest: cleanData.switchingTest ?? undefined,
      chargingTest: cleanData.chargingTest ?? undefined,
      luxTest: cleanData.luxTest ?? undefined,
      luxReading: cleanData.luxReading ? parseFloat(cleanData.luxReading as string) : undefined,
      luxCompliant: cleanData.luxCompliant ?? undefined,
      manufacturerInfo: cleanData.manufacturerInfo || undefined,
      installationDate: cleanData.installationDate || undefined,
      pushButtonTest: (cleanData as any).pushButtonTest ?? undefined,
      injectionTimedTest: (cleanData as any).injectionTimedTest ?? undefined,
      tripTimes: (cleanData as any).tripTimes ?? undefined,
      distributionBoardNumber: (cleanData as any).distributionBoardNumber || undefined,
      circuitBreakerNumber: (cleanData as any).circuitBreakerNumber || undefined,
      leakageReading: cleanData.leakageReading || undefined,
      // Fire testing specific fields
      pressureTest: (cleanData as any).pressureTest ?? undefined,
      accessibilityCheck: (cleanData as any).accessibilityCheck ?? undefined,
      signageCheck: (cleanData as any).signageCheck ?? undefined,
      operationalTest: (cleanData as any).operationalTest ?? undefined,
      extinguisherType: (cleanData as any).extinguisherType || undefined,
      size: (cleanData as any).size || undefined,
      weight: (cleanData as any).weight || undefined,
    };

    console.log('💾 ********** CREATED NEW RESULT **********');
    console.log('💾 Created new result object:', {
      id: newResult.id,
      itemName: newResult.itemName,
      assetNumber: newResult.assetNumber,
      frequency: newResult.frequency,
      providedAssetNumber: cleanData.assetNumber,
    });
    console.log('💾 Emergency fields:', {
      globeType: newResult.globeType,
      maintenanceType: newResult.maintenanceType,
      luxTest: newResult.luxTest,
      luxReading: newResult.luxReading,
      luxCompliant: newResult.luxCompliant,
    });

    // Add to batched results (update ref synchronously for rapid calls)
    const updatedResults = [...batchedResultsRef.current, newResult];
    updateBatchedResultsState(updatedResults);

    console.log('✅ Added to batchedResults. New count:', updatedResults.length);
    console.log('✅ ********** END CREATE RESULT **********');

    // Update asset counts state
    const freq = cleanData.frequency;
    setAssetCounts(prevCounts => ({
      ...prevCounts,
      [freq === 'fiveyearly' ? 'fiveYearly' : 'monthly']: prevCounts[freq === 'fiveyearly' ? 'fiveYearly' : 'monthly'] + 1,
    }));

    // Update current location
    setCurrentLocation(cleanData.location);

    // Update current distribution board number and circuit breaker number (for RCD reporting - Fixed RCD only)
    const isFixedRcd = cleanData.itemName?.toLowerCase().includes('fixed rcd');
    if (isFixedRcd && (cleanData as any).distributionBoardNumber) {
      setCurrentDistributionBoardNumber((cleanData as any).distributionBoardNumber);
    }
    if (isFixedRcd && (cleanData as any).circuitBreakerNumber) {
      setCurrentCircuitBreakerNumber((cleanData as any).circuitBreakerNumber);
    }

    console.log(`Added result to batch: ${cleanData.itemName} at ${cleanData.location} -> Asset #${assetNumber}`);

    // Auto-save to server immediately to prevent data loss
    autoSaveNewResultMutation.mutate(newResult);

    return newResult;
  };

  /**
   * Submits all batched results to the server in a single request
   */
  const submitBatchMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId || batchedResults.length === 0) {
        throw new Error('No active session or no results to submit');
      }

      console.log(`Submitting batch of ${batchedResults.length} results to server`);

      // Normalize tripTimes values
      const normalizedResults = batchedResults.map(result => {
        const tripTimes = (result as any).tripTimes;
        const legacyTripTime = (result as any).tripTime;

        if (legacyTripTime != null && tripTimes == null) {
          const tripTimeNum = Number(legacyTripTime);
          if (isFinite(tripTimeNum) && tripTimeNum > 0) {
            const normalized = tripTimeNum < 1 ? tripTimeNum * 1000 : tripTimeNum;
            return { ...result, tripTimes: [normalized], tripTime: undefined };
          }
        }
        else if (tripTimes != null && Array.isArray(tripTimes)) {
          const normalized = tripTimes.map(tripTime => {
            const tripTimeNum = Number(tripTime);
            if (isFinite(tripTimeNum) && tripTimeNum > 0) {
              return tripTimeNum < 1 ? tripTimeNum * 1000 : tripTimeNum;
            }
            return null;
          }).filter((v): v is number => v !== null);

          if (normalized.length > 0) {
            return { ...result, tripTimes: normalized };
          } else {
            return { ...result, tripTimes: undefined };
          }
        }

        return result;
      });

      const response = await apiRequest('POST', `/api/sessions/${sessionId}/batch-results`, {
        results: normalizedResults
      });

      return response.json();
    },
    onSuccess: (data: any) => {
      const submittedResults = data.savedResults || [];
      console.log(`Successfully submitted ${submittedResults.length} results to server`);

      // Clear batched results after successful submission
      updateBatchedResultsState([]);

      // Reset all asset counters and counts for next session
      updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, 0);
      updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, 10000);
      updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, 20000);
      updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, 30000);
      updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, 40000);
      updateCounter(setMonthlyCounter, monthlyCounterRef, 50000);
      setAssetCounts({ monthly: 0, fiveYearly: 0 });
      updateCounter(setRcdAssetCounter, rcdAssetCounterRef, 0);
      updateCounter(setMicrowaveCounter, microwaveCounterRef, 0);
      setManuallyEnteredAssetNumbers(new Set());

      // Clear session ID to ensure no unfinished detection
      setSessionId(null);
      countersInitializedRef.current = null;

      console.log('Cleared session data after successful submission');

      // Refresh session data
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sessions'] });
    },
    onError: (error) => {
      console.error('Failed to submit batch results:', error);
      alert(`Failed to submit test results: ${error}. Please try again or contact support.`);
    },
  });

  /**
   * Auto-save mutation: Creates a single new result on the server
   * Called automatically after addToBatch to ensure no data loss
   * Includes retry with exponential backoff for resilience
   */
  const autoSaveNewResultMutation = useMutation({
    mutationFn: async (result: BatchedTestResult) => {
      if (!sessionId) throw new Error('No active session');

      // Normalize tripTimes if present
      let tripTimes = result.tripTimes;
      if (tripTimes && Array.isArray(tripTimes)) {
        tripTimes = tripTimes.map(t => {
          const num = Number(t);
          if (isFinite(num) && num > 0) {
            return num < 1 ? num * 1000 : num;
          }
          return null;
        }).filter((v): v is number => v !== null);
      }

      const resultData = {
        itemName: result.itemName,
        itemType: result.itemType,
        location: result.location,
        classification: result.classification,
        result: result.result,
        frequency: result.frequency,
        assetNumber: result.assetNumber,
        failureReason: result.failureReason || null,
        actionTaken: result.actionTaken || null,
        notes: result.notes || null,
        photoData: result.photoData || null,
        visionInspection: result.visionInspection,
        electricalTest: result.electricalTest,
        // Emergency Exit Light specific fields
        maintenanceType: result.maintenanceType || null,
        globeType: result.globeType || null,
        dischargeTest: result.dischargeTest ?? false,
        switchingTest: result.switchingTest ?? false,
        chargingTest: result.chargingTest ?? false,
        luxTest: result.luxTest ?? false,
        luxReading: result.luxReading || null,
        luxCompliant: result.luxCompliant ?? false,
        manufacturerInfo: result.manufacturerInfo || null,
        installationDate: result.installationDate || null,
        // Fire Testing specific fields
        pressureTest: result.pressureTest ?? false,
        accessibilityCheck: result.accessibilityCheck ?? false,
        signageCheck: result.signageCheck ?? false,
        operationalTest: result.operationalTest ?? false,
        extinguisherType: result.extinguisherType || null,
        size: result.size || null,
        weight: result.weight || null,
        // RCD specific fields
        pushButtonTest: result.pushButtonTest ?? null,
        injectionTimedTest: result.injectionTimedTest ?? null,
        tripTimes: tripTimes && tripTimes.length > 0 ? tripTimes : null,
        distributionBoardNumber: result.distributionBoardNumber || null,
        circuitBreakerNumber: result.circuitBreakerNumber || null,
        // Microwave Leakage specific field
        leakageReading: result.leakageReading || null,
      };

      console.log('💾 ********** AUTO-SAVING TO DATABASE **********');
      console.log(`Auto-saving new result to server: ${result.itemName} (Asset #${result.assetNumber})`);

      const response = await apiRequest('POST', `/api/sessions/${sessionId}/results`, resultData);
      return { localId: result.id, serverResult: await response.json() };
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onMutate: () => {
      setSaveStatus(prev => ({ ...prev, pendingCount: prev.pendingCount + 1 }));
    },
    onSuccess: ({ localId, serverResult }) => {
      console.log('✅ ********** AUTO-SAVE SUCCESSFUL **********');
      console.log(`Auto-save successful: ${serverResult.item_name} -> Server ID: ${serverResult.id}, Asset: ${serverResult.asset_number}`);
      console.log('✅ Server returned fields:', {
        globeType: serverResult.globe_type,
        maintenanceType: serverResult.maintenance_type,
        luxTest: serverResult.lux_test,
      });

      // Update the local result with the full server response (merge all fields from server)
      setBatchedResults(prev => {
        const updated = prev.map(r => {
          if (r.id === localId) {
            // Merge server result back into local state (convert snake_case to camelCase)
            return {
              ...r,
              serverId: serverResult.id,
              // Update all fields from server response to ensure consistency
              // Emergency exit light fields
              globeType: serverResult.globe_type || r.globeType,
              maintenanceType: serverResult.maintenance_type || r.maintenanceType,
              luxTest: serverResult.lux_test ?? r.luxTest,
              luxReading: serverResult.lux_reading || r.luxReading,
              luxCompliant: serverResult.lux_compliant ?? r.luxCompliant,
              dischargeTest: serverResult.discharge_test ?? r.dischargeTest,
              switchingTest: serverResult.switching_test ?? r.switchingTest,
              chargingTest: serverResult.charging_test ?? r.chargingTest,
              manufacturerInfo: serverResult.manufacturer_info || r.manufacturerInfo,
              installationDate: serverResult.installation_date || r.installationDate,
              // Fire testing fields
              equipmentType: serverResult.equipment_type || r.equipmentType,
              extinguisherType: serverResult.extinguisher_type || r.extinguisherType,
              size: serverResult.size || r.size,
              weight: serverResult.weight || r.weight,
              testType: serverResult.test_type || r.testType,
              fireVisualInspection: serverResult.fire_visual_inspection ?? r.fireVisualInspection,
              pressureTest: serverResult.pressure_test ?? r.pressureTest,
              accessibilityCheck: serverResult.accessibility_check ?? r.accessibilityCheck,
              signageCheck: serverResult.signage_check ?? r.signageCheck,
              operationalTest: serverResult.operational_test ?? r.operationalTest,
              // RCD testing fields
              pushButtonTest: serverResult.push_button_test ?? r.pushButtonTest,
              injectionTimedTest: serverResult.injection_timed_test ?? r.injectionTimedTest,
              tripTimes: serverResult.trip_times || r.tripTimes,
              distributionBoardNumber: serverResult.distribution_board_number || r.distributionBoardNumber,
              circuitBreakerNumber: serverResult.circuit_breaker_number || r.circuitBreakerNumber,
              // Microwave testing fields
              leakageReading: serverResult.leakage_reading || r.leakageReading,
            };
          }
          return r;
        });
        batchedResultsRef.current = updated;
        return updated;
      });

      setSaveStatus(prev => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
      }));

      // Update the query cache so other pages get fresh data immediately on navigation
      queryClient.setQueryData<TestResult[]>(
        [`/api/sessions/${sessionId}/results`],
        (old) => old ? [...old, serverResult] : [serverResult]
      );
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sessions'] });
    },
    onError: (error, result) => {
      console.error(`Auto-save failed for ${result.itemName}:`, error);
      setSaveStatus(prev => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        failedCount: prev.failedCount + 1,
      }));
    },
  });

  /**
   * Auto-save mutation: Updates an existing result on the server
   * Includes retry with exponential backoff for resilience
   */
  const autoUpdateResultMutation = useMutation({
    mutationFn: async ({ serverId, data }: { serverId: number; data: BatchedTestResult }) => {
      if (!sessionId) throw new Error('No active session');

      let tripTimes = data.tripTimes;
      if (tripTimes && Array.isArray(tripTimes)) {
        tripTimes = tripTimes.map(t => {
          const num = Number(t);
          if (isFinite(num) && num > 0) {
            return num < 1 ? num * 1000 : num;
          }
          return null;
        }).filter((v): v is number => v !== null);
      }

      const updateData = {
        itemName: data.itemName,
        itemType: data.itemType,
        location: data.location,
        classification: data.classification,
        result: data.result,
        frequency: data.frequency,
        assetNumber: data.assetNumber,
        failureReason: data.failureReason || null,
        actionTaken: data.actionTaken || null,
        notes: data.notes || null,
        photoData: data.photoData || null,
        visionInspection: data.visionInspection,
        electricalTest: data.electricalTest,
        // Emergency exit light fields
        maintenanceType: data.maintenanceType || null,
        globeType: data.globeType || null,
        dischargeTest: data.dischargeTest ?? false,
        switchingTest: data.switchingTest ?? false,
        chargingTest: data.chargingTest ?? false,
        luxTest: data.luxTest ?? false,
        luxReading: data.luxReading || null,
        luxCompliant: data.luxCompliant ?? false,
        manufacturerInfo: data.manufacturerInfo || null,
        installationDate: data.installationDate || null,
        // Fire testing fields
        equipmentType: data.equipmentType || null,
        extinguisherType: data.extinguisherType || null,
        size: data.size || null,
        weight: data.weight || null,
        testType: data.testType || null,
        fireVisualInspection: data.fireVisualInspection ?? false,
        accessibilityCheck: data.accessibilityCheck ?? false,
        signageCheck: data.signageCheck ?? false,
        operationalTest: data.operationalTest ?? false,
        pressureTest: data.pressureTest ?? false,
        // RCD testing fields
        pushButtonTest: data.pushButtonTest ?? null,
        injectionTimedTest: data.injectionTimedTest ?? null,
        tripTimes: tripTimes && tripTimes.length > 0 ? tripTimes : null,
        distributionBoardNumber: data.distributionBoardNumber || null,
        circuitBreakerNumber: data.circuitBreakerNumber || null,
        // Microwave testing fields
        leakageReading: data.leakageReading || null,
      };

      console.log(`Auto-updating result on server: ID ${serverId}`);

      const response = await apiRequest('PATCH', `/api/sessions/${sessionId}/results/${serverId}`, updateData);
      return response.json();
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onSuccess: (serverResult, { serverId, data }) => {
      console.log(`Auto-update successful: Server ID ${serverResult.id}`);

      // Update local batched results with server response to ensure UI reflects saved data
      setBatchedResults(prev => {
        const updated = prev.map(r => {
          if (r.serverId === serverId) {
            // Merge server response back into local state (convert snake_case to camelCase)
            return {
              ...r,
              // Emergency exit light fields
              globeType: serverResult.globe_type ?? r.globeType,
              maintenanceType: serverResult.maintenance_type ?? r.maintenanceType,
              luxTest: serverResult.lux_test ?? r.luxTest,
              luxReading: serverResult.lux_reading ?? r.luxReading,
              luxCompliant: serverResult.lux_compliant ?? r.luxCompliant,
              dischargeTest: serverResult.discharge_test ?? r.dischargeTest,
              switchingTest: serverResult.switching_test ?? r.switchingTest,
              chargingTest: serverResult.charging_test ?? r.chargingTest,
              manufacturerInfo: serverResult.manufacturer_info ?? r.manufacturerInfo,
              installationDate: serverResult.installation_date ?? r.installationDate,
              // Fire testing fields
              equipmentType: serverResult.equipment_type ?? r.equipmentType,
              extinguisherType: serverResult.extinguisher_type ?? r.extinguisherType,
              size: serverResult.size ?? r.size,
              weight: serverResult.weight ?? r.weight,
              testType: serverResult.test_type ?? r.testType,
              fireVisualInspection: serverResult.fire_visual_inspection ?? r.fireVisualInspection,
              pressureTest: serverResult.pressure_test ?? r.pressureTest,
              accessibilityCheck: serverResult.accessibility_check ?? r.accessibilityCheck,
              signageCheck: serverResult.signage_check ?? r.signageCheck,
              operationalTest: serverResult.operational_test ?? r.operationalTest,
              // RCD testing fields
              pushButtonTest: serverResult.push_button_test ?? r.pushButtonTest,
              injectionTimedTest: serverResult.injection_timed_test ?? r.injectionTimedTest,
              tripTimes: serverResult.trip_times ?? r.tripTimes,
              distributionBoardNumber: serverResult.distribution_board_number ?? r.distributionBoardNumber,
              circuitBreakerNumber: serverResult.circuit_breaker_number ?? r.circuitBreakerNumber,
              // Microwave testing fields
              leakageReading: serverResult.leakage_reading ?? r.leakageReading,
              // Core fields
              itemName: serverResult.item_name ?? r.itemName,
              itemType: serverResult.item_type ?? r.itemType,
              location: serverResult.location ?? r.location,
              classification: serverResult.classification ?? r.classification,
              result: serverResult.result ?? r.result,
              frequency: serverResult.frequency ?? r.frequency,
              assetNumber: serverResult.asset_number ?? r.assetNumber,
              failureReason: serverResult.failure_reason ?? r.failureReason,
              actionTaken: serverResult.action_taken ?? r.actionTaken,
              notes: serverResult.notes ?? r.notes,
              visionInspection: serverResult.vision_inspection ?? r.visionInspection,
              electricalTest: serverResult.electrical_test ?? r.electricalTest,
            };
          }
          return r;
        });
        batchedResultsRef.current = updated;
        return updated;
      });

      queryClient.setQueryData<TestResult[]>(
        [`/api/sessions/${sessionId}/results`],
        (old) => old?.map(r => r.id === serverResult.id ? serverResult : r) ?? []
      );
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sessions'] });
    },
    onError: (error, { serverId }) => {
      console.error(`Auto-update failed for server ID ${serverId}:`, error);
    },
  });

  /**
   * Updates a batched result locally and auto-saves to server
   */
  const updateBatchedResult = (id: string, updatedData: Partial<BatchedTestResult>) => {
    try {
      const foundResult = batchedResults.find(result => result.id === id);
      if (!foundResult) {
        console.error(`No batched result found with ID: ${id}`);
        throw new Error(`No batched result found with ID: ${id}`);
      }

      // Merge the update data with the existing result
      const mergedResult = { ...foundResult, ...updatedData };

      const updatedResults = batchedResults.map(result =>
        result.id === id ? mergedResult : result
      );

      updateBatchedResultsState(updatedResults);

      // Auto-update on server if this result has been saved before
      if (foundResult.serverId) {
        autoUpdateResultMutation.mutate({
          serverId: foundResult.serverId,
          data: mergedResult
        });
      }
    } catch (error) {
      console.error('Error in updateBatchedResult:', error);
      throw error;
    }
  };

  /**
   * Removes a result from the local batch and updates asset counts
   * Also deletes from server if the result has been saved
   */
  const removeBatchedResult = (id: string) => {
    const resultToRemove = batchedResults.find(result => result.id === id);
    if (resultToRemove) {
      const freq = resultToRemove.frequency;

      // Update asset counts state
      setAssetCounts(prevCounts => ({
        ...prevCounts,
        [freq === 'fiveyearly' ? 'fiveYearly' : 'monthly']: Math.max(0, prevCounts[freq === 'fiveyearly' ? 'fiveYearly' : 'monthly'] - 1),
      }));

      // If the result has been saved to the server, delete it from database
      if (resultToRemove.serverId && sessionId) {
        console.log(`Deleting result from server: ID ${resultToRemove.serverId}`);
        deleteResultMutation.mutate(resultToRemove.serverId);
      }
    }

    const updatedResults = batchedResults.filter(result => result.id !== id);
    updateBatchedResultsState(updatedResults);
  };

  /**
   * Renumber assets to ensure unique asset numbers within the session
   */
  const renumberAssets = (updatedResultId: string, newFrequency: string): string => {
    if (!batchedResults.length) {
      console.warn('renumberAssets: No batched results available');
      return newFrequency === 'fiveyearly' ? '10001' : '1';
    }

    const usedNumbers = new Set<number>();

    batchedResults.forEach((result: BatchedTestResult) => {
      if (result.id === updatedResultId) return;
      const assetNum = parseInt(result.assetNumber || '');
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    const startNumber = newFrequency === 'fiveyearly' ? 10001 : 1;
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
    const newAssetNumber = nextAvailable.toString();

    const updatedResults = batchedResults.map(r =>
      r.id === updatedResultId
        ? { ...r, frequency: newFrequency, assetNumber: newAssetNumber }
        : r
    );

    updateBatchedResultsState(updatedResults);

    const monthlyCount = updatedResults.filter(r => r.frequency !== 'fiveyearly').length;
    const fiveYearlyCount = updatedResults.filter(r => r.frequency === 'fiveyearly').length;

    setAssetCounts({
      monthly: monthlyCount,
      fiveYearly: fiveYearlyCount
    });

    return newAssetNumber;
  };

  const updateResultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTestResult> }) => {
      if (!sessionId) throw new Error('No active session');
      const response = await fetch(`/api/sessions/${sessionId}/results/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update test result');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/report`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/asset-progress`] });
    },
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: number) => {
      if (!sessionId) throw new Error('No active session');
      const response = await fetch(`/api/sessions/${sessionId}/results/${resultId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete test result');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/results`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/report`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/asset-progress`] });
    },
  });

  // Save custom starting numbers for the current session (database-first approach)
  const saveCustomStartingNumbers = async (numbers: Partial<CustomStartingNumbers>) => {
    const serviceType = session?.serviceType || 'electrical';

    if (serviceType !== 'electrical') {
      console.warn('Custom starting numbers are only available for Electrical Test & Tag sessions.');
      return;
    }

    setCustomStartingNumbers(numbers);

    // Reset counters to the new starting numbers - 1
    updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, (numbers.twelvemonthly ?? DEFAULT_STARTING_NUMBERS.twelvemonthly) - 1);
    updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, (numbers.sixmonthly ?? DEFAULT_STARTING_NUMBERS.sixmonthly) - 1);
    updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, (numbers.fiveyearly ?? DEFAULT_STARTING_NUMBERS.fiveyearly) - 1);
    updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, (numbers.twentyfourmonthly ?? DEFAULT_STARTING_NUMBERS.twentyfourmonthly) - 1);
    updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, (numbers.threemonthly ?? DEFAULT_STARTING_NUMBERS.threemonthly) - 1);
    updateCounter(setMonthlyCounter, monthlyCounterRef, (numbers.monthly ?? DEFAULT_STARTING_NUMBERS.monthly) - 1);

    if (sessionId) {
      // Save to database (primary source of truth)
      try {
        await apiRequest('PATCH', `/api/sessions/${sessionId}/custom-numbers`, {
          customStartingNumbers: numbers
        });
        console.log('Custom starting numbers saved to database for session', sessionId);
      } catch (error) {
        console.error('Failed to save custom starting numbers to database:', error);
      }
    } else {
      // No session yet, save to React state (will be applied when session is created)
      setPendingCustomStartingNumbers(numbers);
    }
  };

  // Reset custom starting numbers to defaults
  const resetCustomStartingNumbers = () => {
    if (!sessionId) return;

    const serviceType = session?.serviceType || 'electrical';

    if (serviceType !== 'electrical') {
      console.warn('Custom starting numbers are only available for Electrical Test & Tag sessions.');
      return;
    }

    setCustomStartingNumbers({});

    // Reset counters to defaults - 1
    updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, DEFAULT_STARTING_NUMBERS.twelvemonthly - 1);
    updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, DEFAULT_STARTING_NUMBERS.sixmonthly - 1);
    updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, DEFAULT_STARTING_NUMBERS.fiveyearly - 1);
    updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, DEFAULT_STARTING_NUMBERS.twentyfourmonthly - 1);
    updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, DEFAULT_STARTING_NUMBERS.threemonthly - 1);
    updateCounter(setMonthlyCounter, monthlyCounterRef, DEFAULT_STARTING_NUMBERS.monthly - 1);
  };

  // Clear session
  const clearSession = () => {
    setSessionId(null);
    setCurrentLocation('');
    setCurrentDistributionBoardNumber('');
    setCurrentCircuitBreakerNumber('');
    updateBatchedResultsState([]);
    setCustomStartingNumbers({});
    setPendingCustomStartingNumbers(null);
    setManuallyEnteredAssetNumbers(new Set());
    // Reset all frequency-specific counters
    updateCounter(setTwelvemonthlyCounter, twelvemonthlyCounterRef, 0);
    updateCounter(setSixmonthlyCounter, sixmonthlyCounterRef, 10000);
    updateCounter(setFiveyearlyCounter, fiveyearlyCounterRef, 20000);
    updateCounter(setTwentyfourmonthlyCounter, twentyfourmonthlyCounterRef, 30000);
    updateCounter(setThreemonthlyCounter, threemonthlyCounterRef, 40000);
    updateCounter(setMonthlyCounter, monthlyCounterRef, 50000);
    updateCounter(setRcdAssetCounter, rcdAssetCounterRef, 0);
    updateCounter(setMicrowaveCounter, microwaveCounterRef, 0);
    setAssetCounts({ monthly: 0, fiveYearly: 0 });
    countersInitializedRef.current = null;
    // Reset save status for clean slate
    setSaveStatus({ savedCount: 0, pendingCount: 0, failedCount: 0, isOnline: navigator.onLine });
    queryClient.clear();
  };

  // Periodic sync safety net: retry unsaved results every 30 seconds
  useEffect(() => {
    if (!sessionId) return;

    const syncUnsaved = () => {
      // Skip if there are already saves in flight to avoid duplicates
      if (autoSaveNewResultMutation.isPending) return;

      const unsaved = batchedResults.filter(r => !r.serverId);
      if (unsaved.length > 0 && navigator.onLine) {
        console.log(`Periodic sync: retrying ${unsaved.length} unsaved results`);
        // Reset failedCount since we're retrying
        setSaveStatus(prev => ({ ...prev, failedCount: 0 }));
        unsaved.forEach(result => {
          autoSaveNewResultMutation.mutate(result);
        });
      }
    };

    const interval = setInterval(syncUnsaved, 30000);

    // Also sync when coming back online
    const handleOnline = () => {
      console.log('Back online - syncing unsaved results');
      syncUnsaved();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [sessionId, batchedResults]);

  return {
    // Session management
    sessionId,
    setSessionId,
    sessionData,
    currentLocation,
    setCurrentLocation,
    currentDistributionBoardNumber,
    setCurrentDistributionBoardNumber,
    currentCircuitBreakerNumber,
    setCurrentCircuitBreakerNumber,
    isLoading,

    // Batched results
    batchedResults,
    setBatchedResults,
    addToBatch,
    updateBatchedResult,
    removeBatchedResult,
    renumberAssets,
    submitBatch: submitBatchMutation.mutate,
    isSubmittingBatch: submitBatchMutation.isPending,

    // Local asset progress
    assetProgress: getLocalAssetProgress(),
    assetCounts,
    rcdAssetCounter,
    microwaveCounter,

    // Custom asset numbers
    customStartingNumbers,
    saveCustomStartingNumbers,
    resetCustomStartingNumbers,
    pendingCustomStartingNumbers,
    setPendingCustomStartingNumbers,

    // Manually entered asset numbers (for report preview edits)
    manuallyEnteredAssetNumbers,
    setManuallyEnteredAssetNumbers,

    // Session operations
    createSession: createSessionMutation.mutate,
    isCreatingSession: createSessionMutation.isPending,
    clearSession,

    // Legacy operations (for admin use)
    updateResult: updateResultMutation.mutate,
    deleteResult: deleteResultMutation.mutate,
    isUpdatingResult: updateResultMutation.isPending,
    isDeletingResult: deleteResultMutation.isPending,

    // Save status
    saveStatus,
  };
}
