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
}

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

  // Asset number counters - start fresh for each session
  const [monthlyAssetCounter, setMonthlyAssetCounter] = useState<number>(() => {
    if (!sessionId) return 0;
    const stored = localStorage.getItem(`monthlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 0;
  });

  const [fiveYearlyAssetCounter, setFiveYearlyAssetCounter] = useState<number>(() => {
    if (!sessionId) return 10000;
    const stored = localStorage.getItem(`fiveYearlyCounter_${sessionId}`);
    return stored ? parseInt(stored) : 10000;
  });

  // Batched results stored in local storage
  const [batchedResults, setBatchedResults] = useState<BatchedTestResult[]>(() => {
    if (!sessionId) return [];
    const stored = localStorage.getItem(`batchedResults_${sessionId}`);
    return stored ? JSON.parse(stored) : [];
  });

  const queryClient = useQueryClient();

  // Get current session basic info (not results - those are batched locally)
  const { data: session, isLoading } = useQuery<TestSession>({
    queryKey: [`/api/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  // Calculate local asset progress from current counters
  const getLocalAssetProgress = () => {
    return {
      nextMonthly: monthlyAssetCounter + 1,
      nextFiveYearly: fiveYearlyAssetCounter + 1,
      monthlyCount: monthlyAssetCounter,
      fiveYearlyCount: fiveYearlyAssetCounter - 10000,
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
      setSessionId(session.id);
      localStorage.setItem('currentSessionId', session.id.toString());
      // Clear any existing batched results for this session
      setBatchedResults([]);
      localStorage.removeItem(`batchedResults_${session.id}`);
      // Reset asset counters for new session
      setMonthlyAssetCounter(0);
      setFiveYearlyAssetCounter(10000);
      localStorage.setItem(`monthlyCounter_${session.id}`, '0');
      localStorage.setItem(`fiveYearlyCounter_${session.id}`, '10000');
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
  });

  /**
   * Adds test result to local batch storage with proper asset numbering
   * Results are stored locally until final report submission
   */
  const addToBatch = (data: Omit<InsertTestResult, 'sessionId' | 'assetNumber'>) => {
    if (!sessionId) throw new Error('No active session');
    
    // Determine if this is a 5-yearly frequency
    const isFiveYearly = data.frequency === 'fiveyearly';
    
    // Generate asset number and update counters
    let assetNumber: string;
    let newMonthlyCounter = monthlyAssetCounter;
    let newFiveYearlyCounter = fiveYearlyAssetCounter;
    
    if (isFiveYearly) {
      newFiveYearlyCounter = fiveYearlyAssetCounter + 1;
      assetNumber = newFiveYearlyCounter.toString();
      setFiveYearlyAssetCounter(newFiveYearlyCounter);
      localStorage.setItem(`fiveYearlyCounter_${sessionId}`, newFiveYearlyCounter.toString());
    } else {
      newMonthlyCounter = monthlyAssetCounter + 1;
      assetNumber = newMonthlyCounter.toString();
      setMonthlyAssetCounter(newMonthlyCounter);
      localStorage.setItem(`monthlyCounter_${sessionId}`, newMonthlyCounter.toString());
    }
    
    const newResult: BatchedTestResult = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemName: data.itemName,
      itemType: data.itemType,
      location: data.location,
      classification: data.classification,
      result: data.result as 'pass' | 'fail',
      frequency: data.frequency,
      assetNumber,
      failureReason: data.failureReason || undefined,
      actionTaken: data.actionTaken || undefined,
      notes: data.notes || undefined,
      photoData: data.photoData || undefined,
      visionInspection: data.visionInspection ?? true,
      electricalTest: data.electricalTest ?? true,
      timestamp: new Date().toISOString(),
    };
    
    // Add to batched results
    const updatedResults = [...batchedResults, newResult];
    setBatchedResults(updatedResults);
    
    // Update asset counts state
    setAssetCounts(prevCounts => ({
      ...prevCounts,
      [isFiveYearly ? 'fiveYearly' : 'monthly']: prevCounts[isFiveYearly ? 'fiveYearly' : 'monthly'] + 1,
    }));
    
    // Save to localStorage
    localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    
    // Update current location
    setCurrentLocation(data.location);
    localStorage.setItem('currentLocation', data.location);
    
    console.log(`Added result to batch: ${data.itemName} at ${data.location} -> Asset #${assetNumber}`);
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
    onSuccess: (submittedResults: TestResult[]) => {
      console.log(`Successfully submitted ${submittedResults.length} results to server`);
      
      // Clear batched results after successful submission
      setBatchedResults([]);
      localStorage.removeItem(`batchedResults_${sessionId}`);
      // Reset asset counters and counts for next session
      setMonthlyAssetCounter(0);
      setFiveYearlyAssetCounter(10000);
      setAssetCounts({ monthly: 0, fiveYearly: 0 });
      if (sessionId) {
        localStorage.removeItem(`monthlyCounter_${sessionId}`);
        localStorage.removeItem(`fiveYearlyCounter_${sessionId}`);
      }
      
      // Refresh session data
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
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
      const isFiveYearly = resultToRemove.frequency === 'fiveyearly';
      
      // Update asset counts state
      setAssetCounts(prevCounts => ({
        ...prevCounts,
        [isFiveYearly ? 'fiveYearly' : 'monthly']: Math.max(0, prevCounts[isFiveYearly ? 'fiveYearly' : 'monthly'] - 1),
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
  const renumberAssets = (updatedResultId: string, newFrequency: string) => {
    // Create a temporary array with the updated item
    const tempResults = batchedResults.map(r => 
      r.id === updatedResultId ? { ...r, frequency: newFrequency } : r
    );

    // Separate into monthly and 5-yearly groups
    const monthlyItems = tempResults.filter(r => r.frequency !== 'fiveyearly');
    const fiveYearlyItems = tempResults.filter(r => r.frequency === 'fiveyearly');

    // Renumber monthly items (1, 2, 3...)
    monthlyItems.forEach((item, index) => {
      item.assetNumber = (index + 1).toString();
    });

    // Renumber 5-yearly items (10001, 10002, 10003...)
    fiveYearlyItems.forEach((item, index) => {
      item.assetNumber = (10001 + index).toString();
    });

    // Combine and update state
    const allUpdatedResults = [...monthlyItems, ...fiveYearlyItems];
    setBatchedResults(allUpdatedResults);

    // Save to localStorage
    if (sessionId) {
      localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(allUpdatedResults));
    }

    return allUpdatedResults.find(r => r.id === updatedResultId)?.assetNumber || '1';
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

  // Save session ID to localStorage when it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('currentSessionId', sessionId.toString());
    }
  }, [sessionId]);



  // Clear session
  const clearSession = () => {
    if (sessionId) {
      localStorage.removeItem(`batchedResults_${sessionId}`);
      localStorage.removeItem(`monthlyCounter_${sessionId}`);
      localStorage.removeItem(`fiveYearlyCounter_${sessionId}`);
    }
    setSessionId(null);
    setCurrentLocation('');
    setBatchedResults([]);
    setMonthlyAssetCounter(0);
    setFiveYearlyAssetCounter(10000);
    setAssetCounts({ monthly: 0, fiveYearly: 0 });
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('currentLocation');
    localStorage.removeItem('lastSelectedFrequency');
    queryClient.clear();
  };

  return {
    // Session management
    sessionId,
    sessionData,
    currentLocation,
    setCurrentLocation,
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
