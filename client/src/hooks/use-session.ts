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

  // Add test result
  const addResultMutation = useMutation({
    mutationFn: async (data: Omit<InsertTestResult, 'sessionId'>) => {
      if (!sessionId) throw new Error('No active session');
      console.log('Sending test result to server:', {
        ...data,
        photoData: data.photoData ? `Photo included (${Math.round(data.photoData.length / 1024)}KB)` : 'No photo'
      });
      
      try {
        const response = await apiRequest('POST', `/api/sessions/${sessionId}/results`, data);
        const result = await response.json();
        console.log('Server response:', result);
        return result;
      } catch (error) {
        console.error('Error saving test result:', error);
        throw error;
      }
    },
    onSuccess: (result: TestResult) => {
      console.log('Successfully saved test result:', result);
      // Update current location
      setCurrentLocation(result.location);
      localStorage.setItem('currentLocation', result.location);
      
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/report`] });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
    },
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
    localStorage.removeItem('currentSessionId');
    localStorage.removeItem('currentLocation');
    queryClient.clear();
  };

  return {
    sessionId,
    sessionData,
    currentLocation,
    setCurrentLocation,
    isLoading,
    createSession: createSessionMutation.mutate,
    addResult: addResultMutation.mutate,
    updateResult: updateResultMutation.mutateAsync,
    clearSession,
    isCreatingSession: createSessionMutation.isPending,
    isAddingResult: addResultMutation.isPending,
    isUpdatingResult: updateResultMutation.isPending,
  };
}
