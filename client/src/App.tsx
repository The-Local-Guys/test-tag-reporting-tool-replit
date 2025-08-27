import { Switch, Route, useLocation } from "wouter";
import { useEffect, useRef } from "react";
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
  const { isPageLoading, finishPageLoad } = useLoading();
  const [location] = useLocation();
  const prevLocationRef = useRef(location);

  // Get current login mode
  const loginMode = sessionStorage.getItem('loginMode');
  console.log('Login mode:', loginMode, 'User role:', (user as any)?.role); // Debug log

  // Always call all hooks before any early returns
  useEffect(() => {
    if (prevLocationRef.current !== location) {
      prevLocationRef.current = location;
      
      // Allow a brief moment for content to render, then finish loading
      const timer = setTimeout(() => {
        finishPageLoad();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [location, finishPageLoad]);

  // Update login mode based on current route for SPA behavior
  useEffect(() => {
    if (isAuthenticated) {
      if (location.startsWith('/admin') && loginMode !== 'admin') {
        sessionStorage.setItem('loginMode', 'admin');
      } else if (!location.startsWith('/admin') && loginMode !== 'testing') {
        sessionStorage.setItem('loginMode', 'testing');
      }
    }
  }, [location, loginMode, isAuthenticated]);

  // Now handle conditional rendering after all hooks
  if (!isAuthenticated) {
    return <Login />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <MobileMenuProvider>
        <AppLayout>
          <div className="relative">
            <PageLoading isVisible={isPageLoading} />
            <Switch>
              {/* Admin Routes */}
              <Route path="/admin">
                {user && ((user as any).role === 'super_admin' || (user as any).role === 'support_center' || (user as any).role === 'technician') ? 
                  <AdminDashboard /> : 
                  <ServiceSelection />
                }
              </Route>
              
              {/* Testing Routes */}
              <Route path="/" component={ServiceSelection} />
              <Route path="/setup" component={Setup} />
              <Route path="/items" component={ItemSelection} />
              <Route path="/test" component={TestDetails} />
              <Route path="/emergency-test" component={EmergencyTestDetails} />
              <Route path="/failure" component={FailureDetails} />
              <Route path="/report" component={ReportPreview} />

              <Route component={NotFound} />
            </Switch>
          </div>
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
