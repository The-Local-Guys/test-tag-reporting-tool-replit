import { useState, useEffect } from 'react';
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
  };
}

export interface BatchedTestResult {
  id: string; // Temporary local ID
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
  tripTime?: number;
  distributionBoardNumber?: string;
  // Microwave leakage testing fields
  leakageReading?: string;
}

/**
 * Helper function to sanitize batched results by removing legacy fields
 * Strips out itemCode and any other deprecated fields from localStorage data
 */
function sanitizeBatchedResult(result: any): BatchedTestResult {
  const { itemCode, ...rest } = result;
  return rest as BatchedTestResult;
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
 * @param serviceType - The service type (electrical, emergency_exit_light, fire_testing, rcd_reporting)
 * @returns Default starting numbers for that service type
 */
const getDefaultStartingNumbers = (serviceType?: string): typeof DEFAULT_STARTING_NUMBERS => {
  if (serviceType === 'electrical') {
    return DEFAULT_STARTING_NUMBERS_ELECTRICAL;
  }
  return DEFAULT_STARTING_NUMBERS_OTHER;
};

/**
 * Helper function to get starting asset number for each frequency
 * @param frequency - The test frequency (twelvemonthly, sixmonthly, etc.)
 * @param customStartingNumbers - Optional custom starting numbers per frequency
 * @returns Starting asset number for that frequency range
 */
const getStartingAssetNumber = (
  frequency: string, 
  customStartingNumbers?: Partial<CustomStartingNumbers>
): number => {
  const defaults = DEFAULT_STARTING_NUMBERS;
  const custom = customStartingNumbers || {};
  
  switch (frequency) {
    case 'twelvemonthly':
      return custom.twelvemonthly ?? defaults.twelvemonthly;
    case 'sixmonthly':
      return custom.sixmonthly ?? defaults.sixmonthly;
    case 'fiveyearly':
      return custom.fiveyearly ?? defaults.fiveyearly;
    case 'twentyfourmonthly':
      return custom.twentyfourmonthly ?? defaults.twentyfourmonthly;
    case 'threemonthly':
      return custom.threemonthly ?? defaults.threemonthly;
    case 'monthly':
      return custom.monthly ?? defaults.monthly;
    default:
      return custom.twelvemonthly ?? defaults.twelvemonthly;
  }
};

/**
 * Main hook for managing test sessions and results with batched submission
 * Stores results locally until final report submission to reduce server requests
 * Features automatic asset numbering and comprehensive duplicate prevention
 * @returns Object with session data, batched results, mutations, and state management functions
 */
export function useSession() {
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const stored = localStorage.getItem('currentSessionId');
    return stored ? parseInt(stored) : null;
  });

  const [currentLocation, setCurrentLocation] = useState<string>(() => {
    return localStorage.getItem('currentLocation') || '';
  });

  const [currentDistributionBoardNumber, setCurrentDistributionBoardNumber] = useState<string>(() => {
    return localStorage.getItem('currentDistributionBoardNumber') || '';
  });

  // Custom starting numbers (per session)
  const [customStartingNumbers, setCustomStartingNumbers] = useState<Partial<CustomStartingNumbers>>(() => {
    if (!sessionId) return {};
    const stored = localStorage.getItem(`customStartingNumbers_${sessionId}`);
    return stored ? JSON.parse(stored) : {};
  });

  // Asset count state for tracking current counts
  const [assetCounts, setAssetCounts] = useState<{ monthly: number; fiveYearly: number }>(() => {
    if (!sessionId) return { monthly: 0, fiveYearly: 0 };
    
    // Calculate from existing batched results
    const stored = localStorage.getItem(`batchedResults_${sessionId}`);
    if (stored) {
      const results: BatchedTestResult[] = JSON.parse(stored);
      const monthlyCount = results.filter(r => r.frequency !== 'fiveyearly').length;
      const fiveYearlyCount = results.filter(r => r.frequency === 'fiveyearly').length;
      return { monthly: monthlyCount, fiveYearly: fiveYearlyCount };
    }
    
    return { monthly: 0, fiveYearly: 0 };
  });

  // Helper to get starting number from pending or session-specific custom numbers
  const getInitialStartNumber = (frequency: keyof CustomStartingNumbers, sessionIdParam: number | null): number => {
    // Get service type from localStorage to determine correct defaults
    let serviceType = 'electrical'; // default to electrical for backwards compatibility
    if (sessionIdParam) {
      const storedServiceType = localStorage.getItem(`session_${sessionIdParam}_serviceType`);
      if (storedServiceType) {
        serviceType = storedServiceType;
      }
    }
    
    const defaults = getDefaultStartingNumbers(serviceType);
    
    // Check for session-specific custom numbers first (only for electrical sessions)
    if (sessionIdParam && serviceType === 'electrical') {
      const sessionCustom = localStorage.getItem(`customStartingNumbers_${sessionIdParam}`);
      if (sessionCustom) {
        try {
          const custom = JSON.parse(sessionCustom);
          return (custom[frequency] ?? defaults[frequency]) - 1;
        } catch {
          // Fall through to default
        }
      }
    }
    
    // CRITICAL: Only check pending custom numbers for electrical sessions
    // Emergency Exit Light and Fire Equipment Testing must use service-type-specific defaults
    if (serviceType === 'electrical') {
      const pendingCustom = localStorage.getItem('pendingCustomStartingNumbers');
      if (pendingCustom) {
        try {
          const custom = JSON.parse(pendingCustom);
          return (custom[frequency] ?? defaults[frequency]) - 1;
        } catch {
          // Fall through to default
        }
      }
    }
    
    // Use default based on service type
    return defaults[frequency] - 1;
  };

  // Asset number counters - separate counter for each frequency
  // 12 Monthly: 1-10,000
  const [twelvemonthlyCounter, setTwelvemonthlyCounter] = useState<number>(() => {
    if (!sessionId) return getInitialStartNumber('twelvemonthly', null);
    const stored = localStorage.getItem(`twelvemonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : getInitialStartNumber('twelvemonthly', sessionId);
  });

  // 6 Monthly: 10,001-20,000
  const [sixmonthlyCounter, setSixmonthlyCounter] = useState<number>(() => {
    if (!sessionId) return getInitialStartNumber('sixmonthly', null);
    const stored = localStorage.getItem(`sixmonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : getInitialStartNumber('sixmonthly', sessionId);
  });

  // 5 Yearly: 20,001-30,000
  const [fiveyearlyCounter, setFiveyearlyCounter] = useState<number>(() => {
    if (!sessionId) return getInitialStartNumber('fiveyearly', null);
    const stored = localStorage.getItem(`fiveyearlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : getInitialStartNumber('fiveyearly', sessionId);
  });

  // 24 Monthly: 30,001-40,000
  const [twentyfourmonthlyCounter, setTwentyfourmonthlyCounter] = useState<number>(() => {
    if (!sessionId) return getInitialStartNumber('twentyfourmonthly', null);
    const stored = localStorage.getItem(`twentyfourmonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : getInitialStartNumber('twentyfourmonthly', sessionId);
  });

  // 3 Monthly: 40,001-50,000
  const [threemonthlyCounter, setThreemonthlyCounter] = useState<number>(() => {
    if (!sessionId) return getInitialStartNumber('threemonthly', null);
    const stored = localStorage.getItem(`threemonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : getInitialStartNumber('threemonthly', sessionId);
  });

  // Monthly: 50,001+
  const [monthlyCounter, setMonthlyCounter] = useState<number>(() => {
    if (!sessionId) return getInitialStartNumber('monthly', null);
    const stored = localStorage.getItem(`monthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : getInitialStartNumber('monthly', sessionId);
  });

  // RCD Asset Counter (separate for RCD reporting)
  const [rcdAssetCounter, setRcdAssetCounter] = useState<number>(() => {
    if (!sessionId) return 0;
    const stored = localStorage.getItem(`rcdCounter_${sessionId}`);
    return stored ? parseInt(stored) : 0;
  });

  // Microwave Asset Counter (separate for microwave leakage testing)
  const [microwaveCounter, setMicrowaveCounter] = useState<number>(() => {
    if (!sessionId) return 0;
    const stored = localStorage.getItem(`microwaveCounter_${sessionId}`);
    return stored ? parseInt(stored) : 0;
  });

  // Batched results stored in local storage
  const [batchedResults, setBatchedResults] = useState<BatchedTestResult[]>(() => {
    if (!sessionId) return [];
    const stored = localStorage.getItem(`batchedResults_${sessionId}`);
    if (!stored) return [];
    
    // Parse and sanitize legacy data by removing deprecated fields
    const parsed = JSON.parse(stored);
    const sanitized = parsed.map(sanitizeBatchedResult);
    
    // Save sanitized data back to localStorage
    localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(sanitized));
    
    return sanitized;
  });

  const queryClient = useQueryClient();

  // Get current session basic info (not results - those are batched locally)
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
  useEffect(() => {
    if (existingResults && existingResults.length > 0 && batchedResults.length === 0 && sessionId) {
      console.log(`Loading ${existingResults.length} existing results for session ${sessionId}`);
      
      const loadedResults: BatchedTestResult[] = existingResults.map((result: any) => ({
        id: `existing-${result.id}`,
        itemName: result.itemName,
        itemType: result.itemType || result.itemName,
        location: result.location,
        classification: result.classification,
        result: result.result,
        frequency: result.frequency,
        failureReason: result.failureReason || undefined,
        actionTaken: result.actionTaken || undefined,
        notes: result.notes || undefined,
        photoData: result.photoData || undefined,
        visionInspection: result.visionInspection,
        electricalTest: result.electricalTest,
        timestamp: new Date().toISOString(),
        assetNumber: result.assetNumber,
        // Emergency-specific fields
        maintenanceType: result.maintenanceType || undefined,
        globeType: result.globeType || undefined,
        dischargeTest: result.dischargeTest || undefined,
        switchingTest: result.switchingTest || undefined,
        chargingTest: result.chargingTest || undefined,
        manufacturerInfo: result.manufacturerInfo || undefined,
        installationDate: result.installationDate || undefined,
        // Lux testing fields
        luxTest: result.luxTest || undefined,
        luxReading: result.luxReading || undefined,
        luxCompliant: result.luxCompliant || undefined,
      }));
      
      setBatchedResults(loadedResults);
      
      // Store in localStorage for validation and duplicate checking
      localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(loadedResults));
      console.log(`Stored ${loadedResults.length} results in localStorage for session ${sessionId}`);
      
      // Calculate and update asset counts based on loaded results
      const monthlyCount = loadedResults.filter(r => r.frequency !== 'fiveyearly').length;
      const fiveYearlyCount = loadedResults.filter(r => r.frequency === 'fiveyearly').length;
      setAssetCounts({ monthly: monthlyCount, fiveYearly: fiveYearlyCount });
      
      // Set counters to continue from where they left off
      // Find the highest asset numbers for each frequency to continue sequence
      const twelvemonthlyAssets = loadedResults.filter(r => r.frequency === 'twelvemonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n));
      const sixmonthlyAssets = loadedResults.filter(r => r.frequency === 'sixmonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n));
      const fiveyearlyAssets = loadedResults.filter(r => r.frequency === 'fiveyearly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n));
      const twentyfourmonthlyAssets = loadedResults.filter(r => r.frequency === 'twentyfourmonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n));
      const threemonthlyAssets = loadedResults.filter(r => r.frequency === 'threemonthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n));
      const monthlyAssets = loadedResults.filter(r => r.frequency === 'monthly').map(r => parseInt(r.assetNumber || '0')).filter(n => !isNaN(n));
      
      // Get service-type-aware defaults for fallback values
      const serviceTypeDefaults = session ? getDefaultStartingNumbers(session.serviceType) : DEFAULT_STARTING_NUMBERS_ELECTRICAL;
      
      const maxTwelvemonthly = twelvemonthlyAssets.length > 0 ? Math.max(...twelvemonthlyAssets) : (serviceTypeDefaults.twelvemonthly - 1);
      const maxSixmonthly = sixmonthlyAssets.length > 0 ? Math.max(...sixmonthlyAssets) : (serviceTypeDefaults.sixmonthly - 1);
      const maxFiveyearly = fiveyearlyAssets.length > 0 ? Math.max(...fiveyearlyAssets) : (serviceTypeDefaults.fiveyearly - 1);
      const maxTwentyfourmonthly = twentyfourmonthlyAssets.length > 0 ? Math.max(...twentyfourmonthlyAssets) : (serviceTypeDefaults.twentyfourmonthly - 1);
      const maxThreemonthly = threemonthlyAssets.length > 0 ? Math.max(...threemonthlyAssets) : (serviceTypeDefaults.threemonthly - 1);
      const maxMonthly = monthlyAssets.length > 0 ? Math.max(...monthlyAssets) : (serviceTypeDefaults.monthly - 1);
      
      setTwelvemonthlyCounter(maxTwelvemonthly);
      setSixmonthlyCounter(maxSixmonthly);
      setFiveyearlyCounter(maxFiveyearly);
      setTwentyfourmonthlyCounter(maxTwentyfourmonthly);
      setThreemonthlyCounter(maxThreemonthly);
      setMonthlyCounter(maxMonthly);
      
      // Store counters in localStorage
      localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, maxTwelvemonthly.toString());
      localStorage.setItem(`sixmonthlyCounter_${sessionId}`, maxSixmonthly.toString());
      localStorage.setItem(`fiveyearlyCounter_${sessionId}`, maxFiveyearly.toString());
      localStorage.setItem(`twentyfourmonthlyCounter_${sessionId}`, maxTwentyfourmonthly.toString());
      localStorage.setItem(`threemonthlyCounter_${sessionId}`, maxThreemonthly.toString());
      localStorage.setItem(`monthlyCounter_${sessionId}`, maxMonthly.toString());
      
      console.log(`Updated asset counters: 12M=${maxTwelvemonthly}, 6M=${maxSixmonthly}, 5Y=${maxFiveyearly}, 24M=${maxTwentyfourmonthly}, 3M=${maxThreemonthly}, M=${maxMonthly}`);
    }
  }, [existingResults, batchedResults.length, sessionId]);

  // Initialize counters based on service type when a new session is created
  useEffect(() => {
    if (!session || !sessionId) return;
    
    // Check if counters need to be initialized for this session
    const hasStoredCounters = localStorage.getItem(`twelvemonthlyCounter_${sessionId}`) !== null;
    const storedServiceType = localStorage.getItem(`session_${sessionId}_serviceType`);
    
    // Skip if counters already initialized for this exact session AND service type matches
    if (hasStoredCounters && storedServiceType === session.serviceType) {
      console.log(`Counters already initialized for session ${sessionId} (${session.serviceType})`);
      return;
    }
    
    // Get service-type-aware defaults
    const serviceTypeDefaults = getDefaultStartingNumbers(session.serviceType);
    
    // Initialize all counters based on service type
    const initialTwelvemonthly = serviceTypeDefaults.twelvemonthly - 1;
    const initialSixmonthly = serviceTypeDefaults.sixmonthly - 1;
    const initialFiveyearly = serviceTypeDefaults.fiveyearly - 1;
    const initialTwentyfourmonthly = serviceTypeDefaults.twentyfourmonthly - 1;
    const initialThreemonthly = serviceTypeDefaults.threemonthly - 1;
    const initialMonthly = serviceTypeDefaults.monthly - 1;
    
    console.log(`Initializing counters for ${session.serviceType} service (session ${sessionId}): 12M=${initialTwelvemonthly}, 6M=${initialSixmonthly}, 5Y=${initialFiveyearly}, 24M=${initialTwentyfourmonthly}, 3M=${initialThreemonthly}, M=${initialMonthly}`);
    
    // Update state
    setTwelvemonthlyCounter(initialTwelvemonthly);
    setSixmonthlyCounter(initialSixmonthly);
    setFiveyearlyCounter(initialFiveyearly);
    setTwentyfourmonthlyCounter(initialTwentyfourmonthly);
    setThreemonthlyCounter(initialThreemonthly);
    setMonthlyCounter(initialMonthly);
    
    // Store in localStorage
    localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, initialTwelvemonthly.toString());
    localStorage.setItem(`sixmonthlyCounter_${sessionId}`, initialSixmonthly.toString());
    localStorage.setItem(`fiveyearlyCounter_${sessionId}`, initialFiveyearly.toString());
    localStorage.setItem(`twentyfourmonthlyCounter_${sessionId}`, initialTwentyfourmonthly.toString());
    localStorage.setItem(`threemonthlyCounter_${sessionId}`, initialThreemonthly.toString());
    localStorage.setItem(`monthlyCounter_${sessionId}`, initialMonthly.toString());
  }, [session?.id, sessionId, session?.serviceType]);

  // Ensure service type is always persisted to localStorage
  // This is critical for addToBatch to correctly determine starting asset ranges
  useEffect(() => {
    if (session && sessionId) {
      const stored = localStorage.getItem(`session_${sessionId}_serviceType`);
      if (!stored || stored !== session.serviceType) {
        console.log(`Backfilling service type for session ${sessionId}: ${session.serviceType}`);
        localStorage.setItem(`session_${sessionId}_serviceType`, session.serviceType);
      }
    }
  }, [session, sessionId]);

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
    
    // Add manually entered asset numbers from localStorage to prevent conflicts
    const manuallyEnteredKey = `manuallyEnteredAssetNumbers_${sessionId}`;
    const manuallyEnteredStored = localStorage.getItem(manuallyEnteredKey);
    if (manuallyEnteredStored) {
      const manuallyEnteredAssetNumbers = new Set<string>(JSON.parse(manuallyEnteredStored));
      Array.from(manuallyEnteredAssetNumbers).forEach(manualNumber => {
        const assetNum = parseInt(manualNumber);
        if (!isNaN(assetNum) && assetNum > 0) {
          usedNumbers.add(assetNum);
        }
      });
    }

    // Get minimum starting numbers (custom or default based on service type)
    const serviceType = session?.serviceType || 'electrical';
    const defaults = getDefaultStartingNumbers(serviceType);
    const getMinStartNumber = (freq: keyof typeof DEFAULT_STARTING_NUMBERS) => {
      return customStartingNumbers[freq] ?? defaults[freq];
    };

    // Find next available numbers for each frequency range
    const nextTwelvemonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('twelvemonthly'), twelvemonthlyCounter + 1));
    const nextSixmonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('sixmonthly'), sixmonthlyCounter + 1));
    const nextFiveyearly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('fiveyearly'), fiveyearlyCounter + 1));
    const nextTwentyfourmonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('twentyfourmonthly'), twentyfourmonthlyCounter + 1));
    const nextThreemonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('threemonthly'), threemonthlyCounter + 1));
    const nextMonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(getMinStartNumber('monthly'), monthlyCounter + 1));
    
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
    summary: {
      totalItems: batchedResults.length,
      passedItems: batchedResults.filter(r => r.result === 'pass').length,
      failedItems: batchedResults.filter(r => r.result === 'fail').length,
      passRate: batchedResults.length > 0 ? 
        Math.round((batchedResults.filter(r => r.result === 'pass').length / batchedResults.length) * 100) : 0,
    }
  } : undefined;

  /**
   * Creates a new testing session with client and technician details
   * Sets up the testing context for recording test results locally
   */
  const createSessionMutation = useMutation({
    mutationFn: async (data: InsertTestSession) => {
      const response = await apiRequest('POST', '/api/sessions', data);
      return response.json();
    },
    onSuccess: (session: TestSession) => {
      console.log('Session created successfully:', session.id);
      setSessionId(session.id);
      localStorage.setItem('currentSessionId', session.id.toString());
      // Store service type for this session
      localStorage.setItem(`session_${session.id}_serviceType`, session.serviceType);
      // Mark session as unfinished
      localStorage.setItem('unfinished', 'true');
      localStorage.setItem('unfinishedSessionId', session.id.toString());
      console.log('Set unfinished flags for session:', session.id);
      // Clear any existing batched results for this session
      setBatchedResults([]);
      localStorage.removeItem(`batchedResults_${session.id}`);
      
      // Get default starting numbers based on service type
      const defaults = getDefaultStartingNumbers(session.serviceType);
      
      // Reset all frequency-specific asset counters for new session
      setTwelvemonthlyCounter(defaults.twelvemonthly - 1);
      setSixmonthlyCounter(defaults.sixmonthly - 1);
      setFiveyearlyCounter(defaults.fiveyearly - 1);
      setTwentyfourmonthlyCounter(defaults.twentyfourmonthly - 1);
      setThreemonthlyCounter(defaults.threemonthly - 1);
      setMonthlyCounter(defaults.monthly - 1);
      localStorage.setItem(`twelvemonthlyCounter_${session.id}`, (defaults.twelvemonthly - 1).toString());
      localStorage.setItem(`sixmonthlyCounter_${session.id}`, (defaults.sixmonthly - 1).toString());
      localStorage.setItem(`fiveyearlyCounter_${session.id}`, (defaults.fiveyearly - 1).toString());
      localStorage.setItem(`twentyfourmonthlyCounter_${session.id}`, (defaults.twentyfourmonthly - 1).toString());
      localStorage.setItem(`threemonthlyCounter_${session.id}`, (defaults.threemonthly - 1).toString());
      localStorage.setItem(`monthlyCounter_${session.id}`, (defaults.monthly - 1).toString());
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sessions'] });
    },
  });

  /**
   * Adds test result to local batch storage with proper asset numbering
   * Results are stored locally until final report submission
   * Now accepts manually entered asset numbers from the test details form
   * Includes defensive sanitization to strip any legacy/unexpected fields
   */
  const addToBatch = (data: Omit<InsertTestResult, 'sessionId'>) => {
    if (!sessionId) throw new Error('No active session');
    
    // Defensive sanitization: strip itemCode and any other unexpected fields from incoming data
    const { itemCode, ...cleanData } = data as any;
    
    const frequency = cleanData.frequency;
    
    // Collect all existing asset numbers to avoid conflicts
    const usedNumbers = new Set<number>();
    
    // Add numbers from current batched results
    batchedResults.forEach(result => {
      const assetNum = parseInt(result.assetNumber || '');
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });
    
    // Add manually entered asset numbers from localStorage
    // These are tracked when users manually edit asset numbers in report preview
    const manuallyEnteredKey = `manuallyEnteredAssetNumbers_${sessionId}`;
    const manuallyEnteredData = localStorage.getItem(manuallyEnteredKey);
    if (manuallyEnteredData) {
      try {
        const manualNumbers = JSON.parse(manuallyEnteredData);
        if (Array.isArray(manualNumbers)) {
          manualNumbers.forEach(num => {
            const assetNum = parseInt(num);
            if (!isNaN(assetNum) && assetNum > 0) {
              usedNumbers.add(assetNum);
            }
          });
        }
      } catch (error) {
        console.warn('Error parsing manually entered asset numbers:', error);
      }
    }
    
    // Use provided asset number or auto-generate
    let assetNumber: string;
    const isRCD = cleanData.classification === 'rcd' || sessionData?.session?.serviceType === 'rcd_reporting';
    const isMicrowave = cleanData.classification === 'microwave' || sessionData?.session?.serviceType === 'microwave_leakage';
    
    // If asset number is provided, use it and update counters accordingly
    if (cleanData.assetNumber && cleanData.assetNumber.trim() !== '') {
      assetNumber = cleanData.assetNumber.trim();
      const assetNum = parseInt(assetNumber);
      
      // Update the appropriate counter if this number is higher
      if (!isNaN(assetNum)) {
        if (isRCD) {
          if (assetNum > rcdAssetCounter) {
            setRcdAssetCounter(assetNum);
            localStorage.setItem(`rcdCounter_${sessionId}`, assetNum.toString());
          }
        } else if (isMicrowave) {
          if (assetNum > microwaveCounter) {
            setMicrowaveCounter(assetNum);
            localStorage.setItem(`microwaveCounter_${sessionId}`, assetNum.toString());
          }
        } else {
          // Update the appropriate frequency counter
          switch (frequency) {
            case 'twelvemonthly':
              if (assetNum > twelvemonthlyCounter) {
                setTwelvemonthlyCounter(assetNum);
                localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, assetNum.toString());
              }
              break;
            case 'sixmonthly':
              if (assetNum > sixmonthlyCounter) {
                setSixmonthlyCounter(assetNum);
                localStorage.setItem(`sixmonthlyCounter_${sessionId}`, assetNum.toString());
              }
              break;
            case 'fiveyearly':
              if (assetNum > fiveyearlyCounter) {
                setFiveyearlyCounter(assetNum);
                localStorage.setItem(`fiveyearlyCounter_${sessionId}`, assetNum.toString());
              }
              break;
            case 'twentyfourmonthly':
              if (assetNum > twentyfourmonthlyCounter) {
                setTwentyfourmonthlyCounter(assetNum);
                localStorage.setItem(`twentyfourmonthlyCounter_${sessionId}`, assetNum.toString());
              }
              break;
            case 'threemonthly':
              if (assetNum > threemonthlyCounter) {
                setThreemonthlyCounter(assetNum);
                localStorage.setItem(`threemonthlyCounter_${sessionId}`, assetNum.toString());
              }
              break;
            case 'monthly':
              if (assetNum > monthlyCounter) {
                setMonthlyCounter(assetNum);
                localStorage.setItem(`monthlyCounter_${sessionId}`, assetNum.toString());
              }
              break;
          }
        }
      }
    } else {
      // Auto-generate asset number based on frequency
      if (isRCD) {
        // For RCD reporting, use simple sequential numbering starting from 1
        let candidate = Math.max(1, rcdAssetCounter + 1);
        while (usedNumbers.has(candidate)) {
          candidate++;
        }
        assetNumber = candidate.toString();
        setRcdAssetCounter(candidate);
        localStorage.setItem(`rcdCounter_${sessionId}`, candidate.toString());
      } else if (isMicrowave) {
        // For microwave leakage testing, use simple sequential numbering starting from 1
        let candidate = Math.max(1, microwaveCounter + 1);
        while (usedNumbers.has(candidate)) {
          candidate++;
        }
        assetNumber = candidate.toString();
        setMicrowaveCounter(candidate);
        localStorage.setItem(`microwaveCounter_${sessionId}`, candidate.toString());
      } else {
        // Get service type to determine correct starting ranges
        // Priority: 1. Session data, 2. localStorage, 3. Default to 'electrical' for backwards compatibility
        const sessionServiceType = sessionData?.session?.serviceType || 
                                   localStorage.getItem(`session_${sessionId}_serviceType`) || 
                                   'electrical';
        const defaultStartingNumbers = getDefaultStartingNumbers(sessionServiceType);
        
        // IMPORTANT: Custom starting numbers are ONLY for electrical sessions
        // Emergency Exit Light and Fire Equipment Testing always use service-type defaults
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
        
        // Use frequency-specific ranges based on service type
        let candidate: number;
        
        switch (frequency) {
          case 'twelvemonthly':
            candidate = Math.max(startingNumbers.twelvemonthly, twelvemonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setTwelvemonthlyCounter(candidate);
            localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'sixmonthly':
            candidate = Math.max(startingNumbers.sixmonthly, sixmonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setSixmonthlyCounter(candidate);
            localStorage.setItem(`sixmonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'fiveyearly':
            candidate = Math.max(startingNumbers.fiveyearly, fiveyearlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setFiveyearlyCounter(candidate);
            localStorage.setItem(`fiveyearlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'twentyfourmonthly':
            candidate = Math.max(startingNumbers.twentyfourmonthly, twentyfourmonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setTwentyfourmonthlyCounter(candidate);
            localStorage.setItem(`twentyfourmonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'threemonthly':
            candidate = Math.max(startingNumbers.threemonthly, threemonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setThreemonthlyCounter(candidate);
            localStorage.setItem(`threemonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'monthly':
            candidate = Math.max(startingNumbers.monthly, monthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setMonthlyCounter(candidate);
            localStorage.setItem(`monthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          default:
            // Fallback to twelvemonthly range
            candidate = Math.max(startingNumbers.twelvemonthly, twelvemonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setTwelvemonthlyCounter(candidate);
            localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, candidate.toString());
        }
      }
    }
    
    const newResult: BatchedTestResult = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      // Emergency-specific fields
      maintenanceType: cleanData.maintenanceType || undefined,
      globeType: cleanData.globeType || undefined,
      dischargeTest: cleanData.dischargeTest || undefined,
      switchingTest: cleanData.switchingTest || undefined,
      chargingTest: cleanData.chargingTest || undefined,
      luxTest: cleanData.luxTest || undefined,
      luxReading: cleanData.luxReading ? parseFloat(cleanData.luxReading as string) : undefined,
      luxCompliant: cleanData.luxCompliant || undefined,
      manufacturerInfo: cleanData.manufacturerInfo || undefined,
      installationDate: cleanData.installationDate || undefined,
      // RCD-specific fields
      pushButtonTest: (cleanData as any).pushButtonTest ?? undefined,
      injectionTimedTest: (cleanData as any).injectionTimedTest ?? undefined,
      tripTime: (cleanData as any).tripTime ?? undefined,
      distributionBoardNumber: (cleanData as any).distributionBoardNumber || undefined,
      // Microwave-specific fields
      leakageReading: cleanData.leakageReading || undefined,
    };
    
    // Add to batched results
    const updatedResults = [...batchedResults, newResult];
    setBatchedResults(updatedResults);
    
    // Update asset counts state (simplified for all frequencies)
    const freq = cleanData.frequency;
    setAssetCounts(prevCounts => ({
      ...prevCounts,
      [freq === 'fiveyearly' ? 'fiveYearly' : 'monthly']: prevCounts[freq === 'fiveyearly' ? 'fiveYearly' : 'monthly'] + 1,
    }));
    
    // Save to localStorage
    localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    
    // Update current location
    setCurrentLocation(cleanData.location);
    localStorage.setItem('currentLocation', cleanData.location);
    
    // Update current distribution board number (for RCD reporting - Fixed RCD only)
    // Only save if this is a Fixed RCD test with a distribution board number
    const isFixedRcd = cleanData.itemName?.toLowerCase().includes('fixed rcd');
    if (isFixedRcd && (cleanData as any).distributionBoardNumber) {
      setCurrentDistributionBoardNumber((cleanData as any).distributionBoardNumber);
      localStorage.setItem('currentDistributionBoardNumber', (cleanData as any).distributionBoardNumber);
    }
    // Note: We don't clear when adding Portable RCD - we only clear when switching equipment type in the form
    
    console.log(`Added result to batch: ${cleanData.itemName} at ${cleanData.location} -> Asset #${assetNumber}`);
    return newResult;
  };

  /**
   * Submits all batched results to the server in a single request
   * This replaces individual result submissions and improves performance
   */
  const submitBatchMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId || batchedResults.length === 0) {
        throw new Error('No active session or no results to submit');
      }
      
      console.log(`Submitting batch of ${batchedResults.length} results to server`);
      
      // Normalize trip_time values: convert strings to numbers and old seconds format to milliseconds
      const normalizedResults = batchedResults.map(result => {
        const tripTime = (result as any).tripTime;
        if (tripTime != null) {
          // Coerce to number to handle both string and number values
          const tripTimeNum = Number(tripTime);
          
          // Check if it's a valid finite number
          if (isFinite(tripTimeNum)) {
            // If value is < 1, it's in old seconds format - convert to milliseconds
            if (tripTimeNum > 0 && tripTimeNum < 1) {
              const normalizedValue = tripTimeNum * 1000;
              console.log(`Normalizing old trip_time ${tripTime} (seconds) to ${normalizedValue}ms`);
              return {
                ...result,
                tripTime: normalizedValue
              };
            }
            // Always coerce to numeric type even if already in milliseconds (handles string values)
            if (typeof tripTime === 'string') {
              console.log(`Converting trip_time string "${tripTime}" to number ${tripTimeNum}`);
            }
            return {
              ...result,
              tripTime: tripTimeNum
            };
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
      
      // Clear ALL unfinished report indicators since report is now completed
      localStorage.removeItem('unfinished');
      localStorage.removeItem('unfinishedSessionId');
      localStorage.removeItem('unfinishedId');
      localStorage.removeItem('currentSessionId');
      
      // Clear batched results after successful submission
      setBatchedResults([]);
      if (sessionId) {
        localStorage.removeItem(`batchedResults_${sessionId}`);
        localStorage.removeItem(`monthlyCounter_${sessionId}`);
        localStorage.removeItem(`fiveYearlyCounter_${sessionId}`);
      }
      
      // Reset all asset counters and counts for next session
      setTwelvemonthlyCounter(0);
      setSixmonthlyCounter(10000);
      setFiveyearlyCounter(20000);
      setTwentyfourmonthlyCounter(30000);
      setThreemonthlyCounter(40000);
      setMonthlyCounter(50000);
      setAssetCounts({ monthly: 0, fiveYearly: 0 });
      
      // Clear session ID to ensure no unfinished detection
      setSessionId(null);
      
      console.log('Cleared all localStorage unfinished flags and session data');
      
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
   * Updates a batched result locally (before server submission)
   */
  const updateBatchedResult = (id: string, updatedData: Partial<BatchedTestResult>) => {
    try {
      console.log('updateBatchedResult called with:', { id, updatedData });
      console.log('Current batchedResults:', batchedResults);
      
      const foundResult = batchedResults.find(result => result.id === id);
      if (!foundResult) {
        console.error(`No batched result found with ID: ${id}`);
        console.log('Available IDs:', batchedResults.map(r => r.id));
        throw new Error(`No batched result found with ID: ${id}`);
      }
      
      console.log('Found result to update:', foundResult);
      
      const updatedResults = batchedResults.map(result => 
        result.id === id ? { ...result, ...updatedData } : result
      );
      
      console.log('Updated results:', updatedResults);
      
      setBatchedResults(updatedResults);
      if (sessionId) {
        localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
        console.log('Saved updated results to localStorage');
      }
      
      console.log('updateBatchedResult completed successfully');
    } catch (error) {
      console.error('Error in updateBatchedResult:', error);
      throw error;
    }
  };

  /**
   * Removes a result from the local batch and updates asset counts
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
    }
    
    const updatedResults = batchedResults.filter(result => result.id !== id);
    setBatchedResults(updatedResults);
    if (sessionId) {
      localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    }
  };

  /**
   * Renumbers all assets when frequency categories change
   */


  /**
   * Renumber assets to ensure unique asset numbers within the session
   * Takes into account manually edited asset numbers and finds next available slots
   * @param updatedResultId - ID of the result being changed
   * @param newFrequency - New frequency for the changing result
   * @returns Asset number assigned to the updated result
   */
  const renumberAssets = (updatedResultId: string, newFrequency: string): string => {
    // Guard against missing results
    if (!batchedResults.length) {
      console.warn('renumberAssets: No batched results available');
      return newFrequency === 'fiveyearly' ? '10001' : '1';
    }

    // Get all existing asset numbers, excluding the one being changed
    const usedNumbers = new Set<number>();
    
    batchedResults.forEach((result: BatchedTestResult) => {
      // Skip the result being changed, as it will get a new number
      if (result.id === updatedResultId) {
        return;
      }
      
      // Parse asset number and add to used set if valid
      const assetNum = parseInt(result.assetNumber || '');
      if (!isNaN(assetNum) && assetNum > 0) {
        usedNumbers.add(assetNum);
      }
    });

    // Find next available asset number for the new frequency
    const startNumber = newFrequency === 'fiveyearly' ? 10001 : 1;
    const nextAvailable = getNextAvailableAssetNumber(usedNumbers, startNumber);
    const newAssetNumber = nextAvailable.toString();

    // Update the specific result with new frequency and asset number
    const updatedResults = batchedResults.map(r => 
      r.id === updatedResultId 
        ? { ...r, frequency: newFrequency, assetNumber: newAssetNumber }
        : r
    );

    // Update state with the modified results
    setBatchedResults(updatedResults);

    // Recalculate asset counts after the change
    const monthlyCount = updatedResults.filter(r => r.frequency !== 'fiveyearly').length;
    const fiveYearlyCount = updatedResults.filter(r => r.frequency === 'fiveyearly').length;

    setAssetCounts({
      monthly: monthlyCount,
      fiveYearly: fiveYearlyCount
    });

    // Note: Counters are managed individually per frequency now
    // They are updated automatically when adding/removing results

    // Save updated results to localStorage
    if (sessionId) {
      localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    }

    return newAssetNumber;
  };

  const updateResultMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTestResult> }) => {
      if (!sessionId) throw new Error('No active session');
      const response = await fetch(`/api/sessions/${sessionId}/results/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update test result');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/report`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/asset-progress`] });
    },
  });

  const deleteResultMutation = useMutation({
    mutationFn: async (resultId: number) => {
      if (!sessionId) throw new Error('No active session');
      const response = await fetch(`/api/sessions/${sessionId}/results/${resultId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete test result');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/report`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/asset-progress`] });
    },
  });

  // Save session ID to localStorage when it changes and restore session data
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId.toString());
      
      // CRITICAL: Only apply pending custom starting numbers for ELECTRICAL sessions
      // Emergency Exit Light and Fire Equipment Testing must NEVER use custom numbers
      const pendingCustomNumbers = localStorage.getItem('pendingCustomStartingNumbers');
      if (pendingCustomNumbers) {
        try {
          // Check the service type of the current session
          const serviceType = sessionData?.session?.serviceType || localStorage.getItem(`session_${sessionId}_serviceType`) || 'electrical';
          
          if (serviceType === 'electrical') {
            const numbers = JSON.parse(pendingCustomNumbers);
            console.log('Applying pending custom starting numbers to electrical session:', numbers);
            
            // Validate that numbers object contains valid numeric values
            const isValidNumbers = 
              typeof numbers === 'object' &&
              Object.values(numbers).every(val => typeof val === 'number' && !isNaN(val) && val > 0);
            
            if (!isValidNumbers) {
              console.warn('Invalid pending custom numbers detected, clearing and using defaults');
              localStorage.removeItem('pendingCustomStartingNumbers');
              return;
            }
            
            // Save to session-specific storage
            localStorage.setItem(`customStartingNumbers_${sessionId}`, JSON.stringify(numbers));
            setCustomStartingNumbers(numbers);
            
            // Calculate counter values (starting number - 1)
            const twelvemonthlyValue = (numbers.twelvemonthly ?? DEFAULT_STARTING_NUMBERS.twelvemonthly) - 1;
            const sixmonthlyValue = (numbers.sixmonthly ?? DEFAULT_STARTING_NUMBERS.sixmonthly) - 1;
            const fiveyearlyValue = (numbers.fiveyearly ?? DEFAULT_STARTING_NUMBERS.fiveyearly) - 1;
            const twentyfourmonthlyValue = (numbers.twentyfourmonthly ?? DEFAULT_STARTING_NUMBERS.twentyfourmonthly) - 1;
            const threemonthlyValue = (numbers.threemonthly ?? DEFAULT_STARTING_NUMBERS.threemonthly) - 1;
            const monthlyValue = (numbers.monthly ?? DEFAULT_STARTING_NUMBERS.monthly) - 1;
            
            // Save counters to localStorage so they persist
            localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, twelvemonthlyValue.toString());
            localStorage.setItem(`sixmonthlyCounter_${sessionId}`, sixmonthlyValue.toString());
            localStorage.setItem(`fiveyearlyCounter_${sessionId}`, fiveyearlyValue.toString());
            localStorage.setItem(`twentyfourmonthlyCounter_${sessionId}`, twentyfourmonthlyValue.toString());
            localStorage.setItem(`threemonthlyCounter_${sessionId}`, threemonthlyValue.toString());
            localStorage.setItem(`monthlyCounter_${sessionId}`, monthlyValue.toString());
            
            // Update state counters
            setTwelvemonthlyCounter(twelvemonthlyValue);
            setSixmonthlyCounter(sixmonthlyValue);
            setFiveyearlyCounter(fiveyearlyValue);
            setTwentyfourmonthlyCounter(twentyfourmonthlyValue);
            setThreemonthlyCounter(threemonthlyValue);
            setMonthlyCounter(monthlyValue);
            
            // Clear pending custom numbers after applying
            localStorage.removeItem('pendingCustomStartingNumbers');
          } else {
            // CRITICAL: Clear pending custom numbers for non-electrical sessions
            // This prevents contamination of future electrical sessions with stale custom numbers
            console.log(`Clearing pending custom numbers for ${serviceType} session - custom numbers are only for electrical sessions`);
            localStorage.removeItem('pendingCustomStartingNumbers');
          }
        } catch (error) {
          console.warn('Error applying pending custom starting numbers:', error);
        }
      }
      
      // Restore batched results if they exist for this session
      const storedBatchedResults = localStorage.getItem(`batchedResults_${sessionId}`);
      if (storedBatchedResults && batchedResults.length === 0) {
        try {
          const results = JSON.parse(storedBatchedResults);
          if (results.length > 0) {
            console.log(`Restoring ${results.length} batched results for session ${sessionId}`);
            
            // Sanitize legacy data by removing deprecated fields
            const sanitizedResults = results.map(sanitizeBatchedResult);
            
            // Save sanitized data back to localStorage
            localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(sanitizedResults));
            
            setBatchedResults(sanitizedResults);
            
            // Restore asset counts
            const monthlyCount = sanitizedResults.filter((r: BatchedTestResult) => r.frequency !== 'fiveyearly').length;
            const fiveYearlyCount = sanitizedResults.filter((r: BatchedTestResult) => r.frequency === 'fiveyearly').length;
            setAssetCounts({ monthly: monthlyCount, fiveYearly: fiveYearlyCount });
          }
        } catch (error) {
          console.warn('Error restoring batched results:', error);
        }
      }
    }
  }, [sessionId, batchedResults.length]);



  // Save custom starting numbers for the current session
  const saveCustomStartingNumbers = (numbers: Partial<CustomStartingNumbers>) => {
    // CRITICAL: Custom starting numbers are ONLY for electrical sessions
    // Emergency Exit Light and Fire Equipment Testing must use default ranges
    const serviceType = sessionData?.session?.serviceType || localStorage.getItem(`session_${sessionId}_serviceType`) || 'electrical';
    
    if (serviceType !== 'electrical') {
      console.warn('Custom starting numbers are only available for Electrical Test & Tag sessions. Ignoring save request.');
      return;
    }
    
    setCustomStartingNumbers(numbers);
    
    if (sessionId) {
      // If session exists, save to session-specific storage
      localStorage.setItem(`customStartingNumbers_${sessionId}`, JSON.stringify(numbers));
      
      // Reset counters to the new starting numbers - 1 (because they increment before use)
      setTwelvemonthlyCounter((numbers.twelvemonthly ?? DEFAULT_STARTING_NUMBERS.twelvemonthly) - 1);
      setSixmonthlyCounter((numbers.sixmonthly ?? DEFAULT_STARTING_NUMBERS.sixmonthly) - 1);
      setFiveyearlyCounter((numbers.fiveyearly ?? DEFAULT_STARTING_NUMBERS.fiveyearly) - 1);
      setTwentyfourmonthlyCounter((numbers.twentyfourmonthly ?? DEFAULT_STARTING_NUMBERS.twentyfourmonthly) - 1);
      setThreemonthlyCounter((numbers.threemonthly ?? DEFAULT_STARTING_NUMBERS.threemonthly) - 1);
      setMonthlyCounter((numbers.monthly ?? DEFAULT_STARTING_NUMBERS.monthly) - 1);
    } else {
      // No session yet, save to temporary storage (will be applied when session is created)
      localStorage.setItem('pendingCustomStartingNumbers', JSON.stringify(numbers));
    }
  };

  // Reset custom starting numbers to defaults
  const resetCustomStartingNumbers = () => {
    if (!sessionId) return;
    
    // CRITICAL: Custom starting numbers are ONLY for electrical sessions
    const serviceType = sessionData?.session?.serviceType || localStorage.getItem(`session_${sessionId}_serviceType`) || 'electrical';
    
    if (serviceType !== 'electrical') {
      console.warn('Custom starting numbers are only available for Electrical Test & Tag sessions. Ignoring reset request.');
      return;
    }
    
    setCustomStartingNumbers({});
    localStorage.removeItem(`customStartingNumbers_${sessionId}`);
    
    // Reset counters to defaults - 1
    setTwelvemonthlyCounter(DEFAULT_STARTING_NUMBERS.twelvemonthly - 1);
    setSixmonthlyCounter(DEFAULT_STARTING_NUMBERS.sixmonthly - 1);
    setFiveyearlyCounter(DEFAULT_STARTING_NUMBERS.fiveyearly - 1);
    setTwentyfourmonthlyCounter(DEFAULT_STARTING_NUMBERS.twentyfourmonthly - 1);
    setThreemonthlyCounter(DEFAULT_STARTING_NUMBERS.threemonthly - 1);
    setMonthlyCounter(DEFAULT_STARTING_NUMBERS.monthly - 1);
  };

  // Clear session
  const clearSession = () => {
    if (sessionId) {
      localStorage.removeItem(`batchedResults_${sessionId}`);
      localStorage.removeItem(`monthlyCounter_${sessionId}`);
      localStorage.removeItem(`fiveYearlyCounter_${sessionId}`);
      localStorage.removeItem(`rcdCounter_${sessionId}`);
      localStorage.removeItem(`customStartingNumbers_${sessionId}`);
      localStorage.removeItem(`twelvemonthlyCounter_${sessionId}`);
      localStorage.removeItem(`sixmonthlyCounter_${sessionId}`);
      localStorage.removeItem(`fiveyearlyCounter_${sessionId}`);
      localStorage.removeItem(`twentyfourmonthlyCounter_${sessionId}`);
      localStorage.removeItem(`threemonthlyCounter_${sessionId}`);
      localStorage.removeItem(`monthlyCounter_${sessionId}`);
    }
    // Clear unfinished flags
    localStorage.removeItem('unfinished');
    localStorage.removeItem('unfinishedSessionId');
    setSessionId(null);
    setCurrentLocation('');
    setCurrentDistributionBoardNumber('');
    setBatchedResults([]);
    setCustomStartingNumbers({});
    // Reset all frequency-specific counters
    setTwelvemonthlyCounter(0);
    setSixmonthlyCounter(10000);
    setFiveyearlyCounter(20000);
    setTwentyfourmonthlyCounter(30000);
    setThreemonthlyCounter(40000);
    setMonthlyCounter(50000);
    setRcdAssetCounter(0);
    setMicrowaveCounter(0);
    setAssetCounts({ monthly: 0, fiveYearly: 0 });
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('currentLocation');
    localStorage.removeItem('currentDistributionBoardNumber');
    localStorage.removeItem('lastSelectedFrequency');
    queryClient.clear();
  };

  return {
    // Session management
    sessionId,
    sessionData,
    currentLocation,
    setCurrentLocation,
    currentDistributionBoardNumber,
    setCurrentDistributionBoardNumber,
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
    
    // Session operations
    createSession: createSessionMutation.mutate,
    isCreatingSession: createSessionMutation.isPending,
    clearSession,
    
    // Legacy operations (for admin use)
    updateResult: updateResultMutation.mutate,
    deleteResult: deleteResultMutation.mutate,
    isUpdatingResult: updateResultMutation.isPending,
    isDeletingResult: deleteResultMutation.isPending,
    
    // Utility functions

  };
}
