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
  // Temporarily show login to stop loading loop while fixing auth system
  return <Login />;
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
