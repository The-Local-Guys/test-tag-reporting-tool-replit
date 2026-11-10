import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSpaNavigation } from "@/hooks/useSpaNavigation";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ServiceType } from "./services";

export interface DraftSession {
  id: number;
  clientName: string;
  address: string;
  serviceType: string;
  testDate: string;
  totalItems: number;
  failedItems: number;
  lastActivityAt: string;
  createdAt: string;
}

/**
 * Starting point of the testing flow: the technician's unfinished drafts (database-first)
 * and starting a new report for a chosen service.
 */
export function useServiceSelection() {
  const { navigate } = useSpaNavigation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Fetch draft sessions from server (database-first approach)
  const { data: draftSessionsData, isLoading: isCheckingDrafts } = useQuery<{ sessions: DraftSession[]; total: number; page: number; totalPages: number }>({
    queryKey: ['/api/sessions/drafts'],
    staleTime: 0, // Always refetch
  });
  const draftSessions = draftSessionsData?.sessions || [];

  // Only drafts with items count as real unfinished work
  const draftsWithItems = draftSessions.filter((d) => d.totalItems > 0);

  const continueDraft = (draft: DraftSession) => {
    console.log('Continuing draft session:', draft.id);
    // Set the current session ID via sessionStorage (picked up by useSession hook)
    sessionStorage.setItem('currentSessionId', draft.id.toString());
    // Store service type for the session
    sessionStorage.setItem('selectedService', draft.serviceType);
    // Navigate directly to items page (skip setup since session already exists)
    navigate('/items');
  };

  const discardDraft = async (draft: DraftSession) => {
    setIsDiscarding(true);
    try {
      console.log('Discarding draft session:', draft.id);
      await apiRequest('DELETE', `/api/sessions/${draft.id}`);

      // Refresh draft sessions list
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/drafts'] });

      toast({
        title: "Draft Discarded",
        description: `Report for ${draft.clientName} has been deleted.`,
      });
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast({
        title: "Error",
        description: "Failed to discard the draft. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDiscarding(false);
    }
  };

  /** Clears any stale currentSessionId so the next report starts fresh. */
  const startNewReport = () => {
    sessionStorage.removeItem('currentSessionId');
  };

  const selectService = (serviceType: ServiceType) => {
    // Clear any stale session ID so the setup page always starts fresh
    sessionStorage.removeItem('currentSessionId');
    // Store the selected service type
    sessionStorage.setItem('selectedService', serviceType);
    // Navigate to setup page
    navigate('/setup');
  };

  return {
    isCheckingDrafts,
    draftsWithItems,
    isDiscarding,
    continueDraft,
    discardDraft,
    startNewReport,
    selectService,
  };
}
