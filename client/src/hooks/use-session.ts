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
      const response = await apiRequest('POST', `/api/sessions/${sessionId}/results`, data);
      return response.json();
    },
    onSuccess: (result: TestResult) => {
      // Update current location
      setCurrentLocation(result.location);
      localStorage.setItem('currentLocation', result.location);
      
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
    clearSession,
    isCreatingSession: createSessionMutation.isPending,
    isAddingResult: addResultMutation.isPending,
  };
}
