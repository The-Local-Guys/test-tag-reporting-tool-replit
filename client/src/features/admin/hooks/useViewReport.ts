import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { sortAssetNumbers } from "../utils";

/** The report open in the View & Edit Report modal: loading, item search/filter and pagination. */
export function useViewReport() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [viewingSession, setViewingSession] = useState<any>(null);
  const [itemsPerPage, setItemsPerPageState] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemSearch, setItemSearchState] = useState("");
  const [resultFilter, setResultFilterState] = useState("all");

  // Certificate currently attached to the open report, if any
  const { data: certificate } = useQuery<any | null>({
    queryKey: [`/api/sessions/${viewingSession?.session?.id}/certificate`],
    enabled: isOpen && !!viewingSession?.session?.id,
  });

  const open = async (session: any) => {
    console.log("Session object:", session);

    // Handle both session object and direct session ID
    const sessionId = typeof session === "object" ? session.id : session;
    console.log("Session ID:", sessionId);

    if (!sessionId) {
      toast({
        title: "Error loading report",
        description: "Invalid session ID",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`Fetching latest report data for session ${sessionId}...`);

      const response = await fetch(`/api/sessions/${sessionId}/full`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch report data`);
      }

      const reportData = await response.json();
      console.log(
        `Successfully fetched report data with ${reportData.results?.length || 0} test results`,
      );

      // Update state with fresh data
      setViewingSession(reportData);
      setCurrentPage(1); // Reset to first page when opening report
      setItemSearchState("");
      setResultFilterState("all");

      // Only open modal after successful data fetch and state update
      setIsOpen(true);
    } catch (error) {
      console.error("Error loading report:", error);
      toast({
        title: "Error loading report",
        description: `Failed to load the full report data: ${(error as Error).message}`,
        variant: "destructive",
      });
    }
  };

  const close = () => {
    setIsOpen(false);
    setViewingSession(null);
  };

  const filteredResults: any[] = (() => {
    if (!viewingSession?.results) return [];

    const searchTerm = itemSearch.trim().toLowerCase();
    const matching = viewingSession.results.filter((result: any) => {
      const matchesResult = resultFilter === "all" || result.result === resultFilter;
      const matchesSearch =
        !searchTerm ||
        [result.assetNumber, result.itemName, result.itemType, result.location]
          .some((value) => String(value || "").toLowerCase().includes(searchTerm));

      return matchesResult && matchesSearch;
    });

    return sortAssetNumbers(matching);
  })();

  const withPageReset = <T>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const clearItemFilters = () => {
    setItemSearchState("");
    setResultFilterState("all");
    setCurrentPage(1);
  };

  return {
    isOpen,
    viewingSession,
    setViewingSession,
    certificate,
    open,
    close,
    filteredResults,
    itemsPerPage,
    setItemsPerPage: withPageReset(setItemsPerPageState),
    currentPage,
    setCurrentPage,
    itemSearch,
    setItemSearch: withPageReset(setItemSearchState),
    resultFilter,
    setResultFilter: withPageReset(setResultFilterState),
    hasItemFilters: Boolean(itemSearch) || resultFilter !== "all",
    clearItemFilters,
  };
}

export type ViewReport = ReturnType<typeof useViewReport>;
