import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSpaNavigation } from "./useSpaNavigation";
import { type User, type LoginData, type InsertUser } from "@shared/schema";

// Helper function to check for unsaved test results
export function hasUnsavedTestResults(): boolean {
  // Check for any batched results in localStorage
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('batchedResults_')) {
      try {
        const results = JSON.parse(localStorage.getItem(key) || '[]');
        if (results.length > 0) {
          return true;
        }
      } catch (e) {
        // Ignore invalid JSON
      }
    }
  }
  
  // Check for unfinished session flags
  const unfinished = localStorage.getItem('unfinished');
  const currentSessionId = localStorage.getItem('currentSessionId');
  
  return !!(unfinished || currentSessionId);
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { navigateWithReplace } = useSpaNavigation();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: (response, variables) => {
      // Store login mode in session storage when login succeeds
      if (variables.loginMode) {
        sessionStorage.setItem('loginMode', variables.loginMode);
      }
      // Force refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Redirect to admin page after successful login
      navigateWithReplace('/admin');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (forceLogout?: boolean) => {
      // Check for unsaved test results unless force logout is requested
      if (!forceLogout && hasUnsavedTestResults()) {
        throw new Error('UNSAVED_RESULTS');
      }
      
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      // Clear login mode and selected service from session storage
      sessionStorage.removeItem('loginMode');
      sessionStorage.removeItem('selectedService');
      // Clear any localStorage data
      localStorage.clear();
      // Redirect to root page after successful logout (will show login since user is not authenticated)
      navigateWithReplace('/');
    },
  });

  // Custom logout function that handles unsaved results
  const handleLogout = async (forceLogout?: boolean) => {
    try {
      await logoutMutation.mutateAsync(forceLogout);
    } catch (error: any) {
      if (error.message === 'UNSAVED_RESULTS') {
        throw error; // Re-throw so caller can handle the prompt
      }
      throw error; // Re-throw other errors
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: handleLogout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    hasUnsavedResults: hasUnsavedTestResults,
  };
}