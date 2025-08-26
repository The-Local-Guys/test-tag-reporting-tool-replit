import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MobileMenuProvider } from "@/contexts/MobileMenuContext";
import { LoadingProvider, useLoading } from "@/contexts/LoadingContext";
import { MobileMenu } from "@/components/mobile-menu";
import { AppLayout } from "@/components/layout/app-layout";
import { PageLoading } from "@/components/ui/page-loading";
import NotFound from "@/pages/not-found";
import ServiceSelection from "@/pages/service-selection";
import Setup from "@/pages/setup";
import ItemSelection from "@/pages/item-selection";
import TestDetails from "@/pages/test-details";
import EmergencyTestDetails from "@/pages/emergency-test-details";
import FailureDetails from "@/pages/failure-details";
import ReportPreview from "@/pages/report-preview";
import AdminDashboard from "@/pages/admin-dashboard";

import Login from "@/pages/login";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isPageLoading } = useLoading();

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Check if user chose admin mode at login
  const loginMode = sessionStorage.getItem('loginMode');
  console.log('Login mode:', loginMode, 'User role:', (user as any)?.role); // Debug log
  
  // Show admin dashboard if user selected admin mode and has admin privileges
  if (loginMode === 'admin' && user && (user as any).role && ((user as any).role === 'super_admin' || (user as any).role === 'support_center' || (user as any).role === 'technician')) {
    return (
      <>
        <PageLoading isVisible={isPageLoading} />
        <MobileMenuProvider>
          <AppLayout>
            <AdminDashboard />
          </AppLayout>
          <MobileMenu />
        </MobileMenuProvider>
      </>
    );
  }

  // Regular technician interface (for testing mode or regular technicians)
  return (
    <>
      <PageLoading isVisible={isPageLoading} />
      <MobileMenuProvider>
        <AppLayout>
          <Switch>
            <Route path="/" component={ServiceSelection} />
            <Route path="/setup" component={Setup} />
            <Route path="/items" component={ItemSelection} />
            <Route path="/test" component={TestDetails} />
            <Route path="/emergency-test" component={EmergencyTestDetails} />
            <Route path="/failure" component={FailureDetails} />
            <Route path="/report" component={ReportPreview} />

            <Route component={NotFound} />
          </Switch>
        </AppLayout>
        <MobileMenu />
      </MobileMenuProvider>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <LoadingProvider>
          <Router />
        </LoadingProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
