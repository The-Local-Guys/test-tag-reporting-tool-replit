import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import NotFound from "@/pages/not-found";
import ServiceSelection from "@/pages/service-selection";
import Setup from "@/pages/setup";
import ItemSelection from "@/pages/item-selection";
import TestDetails from "@/pages/test-details";
import EmergencyTestDetails from "@/pages/emergency-test-details";
import FailureDetails from "@/pages/failure-details";
import ReportPreview from "@/pages/report-preview";
import AdminDashboard from "@/pages/admin-dashboard";
import DiagnosticTool from "@/pages/diagnostic-tool";
import Login from "@/pages/login";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Check if user chose admin mode at login
  const loginMode = sessionStorage.getItem('loginMode');
  console.log('Login mode:', loginMode, 'User role:', user?.role); // Debug log
  
  // Show admin dashboard if user selected admin mode and has admin privileges (including technicians viewing their own data)
  if (loginMode === 'admin' && user && (user.role === 'super_admin' || user.role === 'support_center' || user.role === 'technician')) {
    return <AdminDashboard />;
  }

  // Regular technician interface (for testing mode or regular technicians)
  return (
    <Switch>
      <Route path="/" component={ServiceSelection} />
      <Route path="/setup" component={Setup} />
      <Route path="/items" component={ItemSelection} />
      <Route path="/test" component={TestDetails} />
      <Route path="/emergency-test" component={EmergencyTestDetails} />
      <Route path="/failure" component={FailureDetails} />
      <Route path="/report" component={ReportPreview} />
      <Route path="/diagnostic" component={DiagnosticTool} />
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
