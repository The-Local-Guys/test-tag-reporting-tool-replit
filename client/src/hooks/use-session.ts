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

  // Calculate local asset progress from batched results
  const getLocalAssetProgress = () => {
    const monthlyResults = batchedResults.filter(r => 
      r.frequency === 'threemonthly' || 
      r.frequency === 'sixmonthly' || 
      r.frequency === 'twelvemonthly' || 
      r.frequency === 'twentyfourmonthly'
    );
    
    const fiveYearlyResults = batchedResults.filter(r => r.frequency === 'fiveyearly');
    
    return {
      nextMonthly: monthlyResults.length + 1,
      nextFiveYearly: fiveYearlyResults.length > 0 ? 10001 + fiveYearlyResults.length : 10001,
      monthlyCount: monthlyResults.length,
      fiveYearlyCount: fiveYearlyResults.length,
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
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
  });

  /**
   * Adds test result to local batch storage (no immediate server request)
   * Results are stored locally until final report submission
   */
  const addToBatch = (data: Omit<InsertTestResult, 'sessionId' | 'assetNumber'>) => {
    if (!sessionId) throw new Error('No active session');
    
    const newResult: BatchedTestResult = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemName: data.itemName,
      itemType: data.itemType,
      location: data.location,
      classification: data.classification,
      result: data.result as 'pass' | 'fail',
      frequency: data.frequency,
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
    
    // Save to localStorage
    localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    
    // Update current location
    setCurrentLocation(data.location);
    localStorage.setItem('currentLocation', data.location);
    
    console.log(`Added result to batch: ${data.itemName} at ${data.location}`);
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
    const updatedResults = batchedResults.map(result => 
      result.id === id ? { ...result, ...updatedData } : result
    );
    setBatchedResults(updatedResults);
    if (sessionId) {
      localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    }
  };

  /**
   * Removes a result from the local batch
   */
  const removeBatchedResult = (id: string) => {
    const updatedResults = batchedResults.filter(result => result.id !== id);
    setBatchedResults(updatedResults);
    if (sessionId) {
      localStorage.setItem(`batchedResults_${sessionId}`, JSON.stringify(updatedResults));
    }
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
    setSessionId(null);
    setCurrentLocation('');
    setBatchedResults([]);
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('currentLocation');
    localStorage.removeItem('lastSelectedFrequency');
    if (sessionId) {
      localStorage.removeItem(`batchedResults_${sessionId}`);
    }
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
    addToBatch,
    updateBatchedResult,
    removeBatchedResult,
    submitBatch: submitBatchMutation.mutate,
    isSubmittingBatch: submitBatchMutation.isPending,
    
    // Local asset progress
    assetProgress: getLocalAssetProgress(),
    
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
