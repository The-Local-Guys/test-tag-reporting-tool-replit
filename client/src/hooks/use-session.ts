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

export function useSession() {
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const stored = localStorage.getItem('currentSessionId');
    return stored ? parseInt(stored) : null;
  });

  const [currentLocation, setCurrentLocation] = useState<string>(() => {
    return localStorage.getItem('currentLocation') || '';
  });

  const queryClient = useQueryClient();

  // Get current session data
  const { data: sessionData, isLoading } = useQuery<SessionData>({
    queryKey: [`/api/sessions/${sessionId}/report`],
    enabled: !!sessionId,
  });

  // Get asset progress
  const { data: assetProgress } = useQuery<{
    nextMonthly: number;
    nextFiveYearly: number;
    monthlyCount: number;
    fiveYearlyCount: number;
  }>({
    queryKey: [`/api/sessions/${sessionId}/asset-progress`],
    enabled: !!sessionId,
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (data: InsertTestSession) => {
      const response = await apiRequest('POST', '/api/sessions', data);
      return response.json();
    },
    onSuccess: (session: TestSession) => {
      setSessionId(session.id);
      localStorage.setItem('currentSessionId', session.id.toString());
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    },
  });

  // Add test result with retry logic
  const addResultMutation = useMutation({
    mutationFn: async (data: Omit<InsertTestResult, 'sessionId'>) => {
      if (!sessionId) throw new Error('No active session');
      
      // Add timestamp to track when the request was made
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Sending test result to server:`, {
        ...data,
        photoData: data.photoData ? `Photo included (${Math.round(data.photoData.length / 1024)}KB)` : 'No photo'
      });
      
      // Retry logic with exponential backoff
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          const response = await apiRequest('POST', `/api/sessions/${sessionId}/results`, data);
          const result = await response.json();
          console.log(`[${timestamp}] Server response (attempt ${retryCount + 1}):`, result);
          
          // Verify the result was properly saved by checking if it has an ID
          if (!result.id) {
            throw new Error('Server returned invalid result - no ID');
          }
          
          return result;
        } catch (error) {
          retryCount++;
          console.error(`[${timestamp}] Error saving test result (attempt ${retryCount}/${maxRetries}):`, error);
          
          if (retryCount >= maxRetries) {
            // Store failed result locally for recovery
            const failedResults = JSON.parse(localStorage.getItem('failedResults') || '[]');
            failedResults.push({ data, timestamp, sessionId, error: String(error) });
            localStorage.setItem('failedResults', JSON.stringify(failedResults));
            
            throw new Error(`Failed to save test result after ${maxRetries} attempts: ${error}`);
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }
    },
    onSuccess: (result: TestResult) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Successfully saved test result:`, result);
      
      // Update current location
      setCurrentLocation(result.location);
      localStorage.setItem('currentLocation', result.location);
      
      // Clear any matching failed results from localStorage
      const failedResults = JSON.parse(localStorage.getItem('failedResults') || '[]');
      const updatedFailedResults = failedResults.filter((failed: any) => 
        failed.data.assetNumber !== result.assetNumber || failed.sessionId !== sessionId
      );
      localStorage.setItem('failedResults', JSON.stringify(updatedFailedResults));
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/report`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/next-asset-number`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/next-monthly-asset-number`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/next-five-yearly-asset-number`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/asset-progress`] });
    },
    onError: (error) => {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] Final mutation error:`, error);
      
      // Alert user about the failure
      alert(`Failed to save test result: ${error}. Please try again or contact support if this continues.`);
    },
    // Configure retry behavior
    retry: false, // We handle retries manually
  });

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

  // Recovery function to retry failed results
  const retryFailedResults = async () => {
    const failedResults = JSON.parse(localStorage.getItem('failedResults') || '[]');
    
    if (failedResults.length === 0) return;
    
    console.log(`Found ${failedResults.length} failed results to retry`);
    
    for (const failed of failedResults) {
      try {
        await addResultMutation.mutateAsync(failed.data);
        console.log('Successfully retried failed result:', failed.data.assetNumber);
      } catch (error) {
        console.error('Failed to retry result:', failed.data.assetNumber, error);
      }
    }
  };
  
  // Check for failed results when session loads
  useEffect(() => {
    if (sessionId && sessionData) {
      const failedResults = JSON.parse(localStorage.getItem('failedResults') || '[]');
      if (failedResults.length > 0) {
        console.log(`Session ${sessionId} has ${failedResults.length} failed results to retry`);
        // Automatically retry failed results after a short delay
        setTimeout(() => retryFailedResults(), 2000);
      }
    }
  }, [sessionId, sessionData]);

  // Clear session
  const clearSession = () => {
    setSessionId(null);
    setCurrentLocation('');
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('currentLocation');
    localStorage.removeItem('lastSelectedFrequency'); // Clear frequency persistence for new session
    queryClient.clear();
  };

  return {
    sessionId,
    sessionData,
    assetProgress,
    currentLocation,
    setCurrentLocation,
    isLoading,
    createSession: createSessionMutation.mutate,
    addResult: addResultMutation.mutate,
    updateResult: updateResultMutation.mutateAsync,
    deleteResult: deleteResultMutation.mutateAsync,
    clearSession,
    retryFailedResults,
    isCreatingSession: createSessionMutation.isPending,
    isAddingResult: addResultMutation.isPending,
    isUpdatingResult: updateResultMutation.isPending,
    isDeletingResult: deleteResultMutation.isPending,
  };
}
