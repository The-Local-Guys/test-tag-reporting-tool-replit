import React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import NotFound from "@/pages/not-found";
import Setup from "@/pages/setup";
import ItemSelection from "@/pages/item-selection";
import TestDetails from "@/pages/test-details";
import FailureDetails from "@/pages/failure-details";
import ReportPreview from "@/pages/report-preview";
import AdminDashboard from "@/pages/admin-dashboard";
import Login from "@/pages/login";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Check for development bypass
  const devBypass = sessionStorage.getItem('devBypass') === 'true';

  // Show login if not authenticated (unless using dev bypass)
  if (!isAuthenticated && !devBypass) {
    return <Login />;
  }

  // Check if user chose admin mode at login
  const loginMode = sessionStorage.getItem('loginMode');
  console.log('Login mode:', loginMode, 'User role:', user?.role); // Debug log
  
  // Show admin dashboard if user selected admin mode and has admin privileges (including technicians viewing their own data)
  if (loginMode === 'admin' && user && (user.role === 'super_admin' || user.role === 'support_center' || user.role === 'technician')) {
    return <AdminDashboard />;
  }

  // For testing mode, ensure we start fresh - clear any session navigation state
  // This ensures users always start at the setup screen when opening the reporting tool
  React.useEffect(() => {
    try {
      const currentLoginMode = sessionStorage.getItem('loginMode');
      if (currentLoginMode === 'testing' || !currentLoginMode) {
        // Clear any existing navigation state that might redirect away from setup
        sessionStorage.removeItem('pendingTestResult');
        sessionStorage.removeItem('pendingPhotos');
      }
    } catch (error) {
      console.error('Error in useEffect:', error);
    }
  }, []);

  // Regular technician interface (for testing mode or regular technicians)
  return (
    <Switch>
      <Route path="/" component={Setup} />
      <Route path="/items" component={ItemSelection} />
      <Route path="/test" component={TestDetails} />
      <Route path="/failure" component={FailureDetails} />
      <Route path="/report" component={ReportPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
