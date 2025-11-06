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
  distributionBoardNumber?: string;
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
 * Helper function to get starting asset number for each frequency
 * @param frequency - The test frequency (twelvemonthly, sixmonthly, etc.)
 * @returns Starting asset number for that frequency range
 */
const getStartingAssetNumber = (frequency: string): number => {
  switch (frequency) {
    case 'twelvemonthly':
      return 1;
    case 'sixmonthly':
      return 10001;
    case 'fiveyearly':
      return 20001;
    case 'twentyfourmonthly':
      return 30001;
    case 'threemonthly':
      return 40001;
    case 'monthly':
      return 50001;
    default:
      return 1; // Default to twelvemonthly range
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

  // Asset number counters - separate counter for each frequency
  // 12 Monthly: 1-10,000
  const [twelvemonthlyCounter, setTwelvemonthlyCounter] = useState<number>(() => {
    if (!sessionId) return 0;
    const stored = localStorage.getItem(`twelvemonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 0;
  });

  // 6 Monthly: 10,001-20,000
  const [sixmonthlyCounter, setSixmonthlyCounter] = useState<number>(() => {
    if (!sessionId) return 10000;
    const stored = localStorage.getItem(`sixmonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 10000;
  });

  // 5 Yearly: 20,001-30,000
  const [fiveyearlyCounter, setFiveyearlyCounter] = useState<number>(() => {
    if (!sessionId) return 20000;
    const stored = localStorage.getItem(`fiveyearlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 20000;
  });

  // 24 Monthly: 30,001-40,000
  const [twentyfourmonthlyCounter, setTwentyfourmonthlyCounter] = useState<number>(() => {
    if (!sessionId) return 30000;
    const stored = localStorage.getItem(`twentyfourmonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 30000;
  });

  // 3 Monthly: 40,001-50,000
  const [threemonthlyCounter, setThreemonthlyCounter] = useState<number>(() => {
    if (!sessionId) return 40000;
    const stored = localStorage.getItem(`threemonthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 40000;
  });

  // Monthly: 50,001+
  const [monthlyCounter, setMonthlyCounter] = useState<number>(() => {
    if (!sessionId) return 50000;
    const stored = localStorage.getItem(`monthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 50000;
  });

  // RCD Asset Counter (separate for RCD reporting)
  const [rcdAssetCounter, setRcdAssetCounter] = useState<number>(() => {
    if (!sessionId) return 0;
    const stored = localStorage.getItem(`rcdCounter_${sessionId}`);
    return stored ? parseInt(stored) : 0;
  });

  // Custom Asset Number Starting Points (per session, only for Electrical Test & Tag)
  const [customAssetStarts, setCustomAssetStarts] = useState<{
    twelvemonthly: number;
    sixmonthly: number;
    fiveyearly: number;
    twentyfourmonthly: number;
    threemonthly: number;
    monthly: number;
  }>(() => {
    if (!sessionId) {
      return {
        twelvemonthly: 1,
        sixmonthly: 10001,
        fiveyearly: 20001,
        twentyfourmonthly: 30001,
        threemonthly: 40001,
        monthly: 50001,
      };
    }
    const stored = localStorage.getItem(`customAssetStarts_${sessionId}`);
    return stored ? JSON.parse(stored) : {
      twelvemonthly: 1,
      sixmonthly: 10001,
      fiveyearly: 20001,
      twentyfourmonthly: 30001,
      threemonthly: 40001,
      monthly: 50001,
    };
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
      
      const maxTwelvemonthly = twelvemonthlyAssets.length > 0 ? Math.max(...twelvemonthlyAssets) : 0;
      const maxSixmonthly = sixmonthlyAssets.length > 0 ? Math.max(...sixmonthlyAssets) : 10000;
      const maxFiveyearly = fiveyearlyAssets.length > 0 ? Math.max(...fiveyearlyAssets) : 20000;
      const maxTwentyfourmonthly = twentyfourmonthlyAssets.length > 0 ? Math.max(...twentyfourmonthlyAssets) : 30000;
      const maxThreemonthly = threemonthlyAssets.length > 0 ? Math.max(...threemonthlyAssets) : 40000;
      const maxMonthly = monthlyAssets.length > 0 ? Math.max(...monthlyAssets) : 50000;
      
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

    // Find next available numbers for each frequency range
    const nextTwelvemonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(1, twelvemonthlyCounter + 1));
    const nextSixmonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(10001, sixmonthlyCounter + 1));
    const nextFiveyearly = getNextAvailableAssetNumber(usedNumbers, Math.max(20001, fiveyearlyCounter + 1));
    const nextTwentyfourmonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(30001, twentyfourmonthlyCounter + 1));
    const nextThreemonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(40001, threemonthlyCounter + 1));
    const nextMonthly = getNextAvailableAssetNumber(usedNumbers, Math.max(50001, monthlyCounter + 1));
    
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
      // Mark session as unfinished
      localStorage.setItem('unfinished', 'true');
      localStorage.setItem('unfinishedSessionId', session.id.toString());
      console.log('Set unfinished flags for session:', session.id);
      // Clear any existing batched results for this session
      setBatchedResults([]);
      localStorage.removeItem(`batchedResults_${session.id}`);
      // Reset all frequency-specific asset counters for new session
      setTwelvemonthlyCounter(0);
      setSixmonthlyCounter(10000);
      setFiveyearlyCounter(20000);
      setTwentyfourmonthlyCounter(30000);
      setThreemonthlyCounter(40000);
      setMonthlyCounter(50000);
      localStorage.setItem(`twelvemonthlyCounter_${session.id}`, '0');
      localStorage.setItem(`sixmonthlyCounter_${session.id}`, '10000');
      localStorage.setItem(`fiveyearlyCounter_${session.id}`, '20000');
      localStorage.setItem(`twentyfourmonthlyCounter_${session.id}`, '30000');
      localStorage.setItem(`threemonthlyCounter_${session.id}`, '40000');
      localStorage.setItem(`monthlyCounter_${session.id}`, '50000');
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
      } else {
        // For Electrical Test & Tag, use frequency-specific ranges
        let candidate: number;
        
        switch (frequency) {
          case 'twelvemonthly':
            candidate = Math.max(1, twelvemonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setTwelvemonthlyCounter(candidate);
            localStorage.setItem(`twelvemonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'sixmonthly':
            candidate = Math.max(10001, sixmonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setSixmonthlyCounter(candidate);
            localStorage.setItem(`sixmonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'fiveyearly':
            candidate = Math.max(20001, fiveyearlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setFiveyearlyCounter(candidate);
            localStorage.setItem(`fiveyearlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'twentyfourmonthly':
            candidate = Math.max(30001, twentyfourmonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setTwentyfourmonthlyCounter(candidate);
            localStorage.setItem(`twentyfourmonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'threemonthly':
            candidate = Math.max(40001, threemonthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setThreemonthlyCounter(candidate);
            localStorage.setItem(`threemonthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          case 'monthly':
            candidate = Math.max(50001, monthlyCounter + 1);
            while (usedNumbers.has(candidate)) {
              candidate++;
            }
            assetNumber = candidate.toString();
            setMonthlyCounter(candidate);
            localStorage.setItem(`monthlyCounter_${sessionId}`, candidate.toString());
            break;
            
          default:
            // Fallback to twelvemonthly range
            candidate = Math.max(1, twelvemonthlyCounter + 1);
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
      distributionBoardNumber: (cleanData as any).distributionBoardNumber || undefined,
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
      
      const response = await apiRequest('POST', `/api/sessions/${sessionId}/batch-results`, {
        results: batchedResults
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



  // Clear session
  const clearSession = () => {
    if (sessionId) {
      localStorage.removeItem(`batchedResults_${sessionId}`);
      localStorage.removeItem(`monthlyCounter_${sessionId}`);
      localStorage.removeItem(`fiveYearlyCounter_${sessionId}`);
      localStorage.removeItem(`rcdCounter_${sessionId}`);
    }
    // Clear unfinished flags
    localStorage.removeItem('unfinished');
    localStorage.removeItem('unfinishedSessionId');
    setSessionId(null);
    setCurrentLocation('');
    setCurrentDistributionBoardNumber('');
    setBatchedResults([]);
    // Reset all frequency-specific counters
    setTwelvemonthlyCounter(0);
    setSixmonthlyCounter(10000);
    setFiveyearlyCounter(20000);
    setTwentyfourmonthlyCounter(30000);
    setThreemonthlyCounter(40000);
    setMonthlyCounter(50000);
    setRcdAssetCounter(0);
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
