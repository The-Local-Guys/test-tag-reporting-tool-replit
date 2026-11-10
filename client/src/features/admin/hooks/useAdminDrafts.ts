import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { EMPTY_DATE_FILTER, type DateFilter } from "@/components/date-range-filter";
import { DEFAULT_REPORTS_PAGE_SIZE } from "../utils";

/**
 * Every technician's draft sessions (admin only, for recovery), paginated and filtered
 * server-side, plus multi-select for bulk delete. Narrowing filters also clear the selection.
 */
export function useAdminDrafts(enabled: boolean) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_REPORTS_PAGE_SIZE);
  const [technicianFilter, setTechnicianFilterState] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilterState] = useState<string>("all");
  const [search, setSearchState] = useState("");
  const [dateRange, setDateRangeState] = useState<DateFilter>(EMPTY_DATE_FILTER);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/sessions/drafts", page, pageSize, technicianFilter, serviceTypeFilter, search, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString() });
      if (technicianFilter !== "all") {
        params.set("technicianFilter", technicianFilter);
      }
      if (serviceTypeFilter !== "all") {
        params.set("serviceTypeFilter", serviceTypeFilter);
      }
      if (search.trim()) {
        params.set("search", search.trim());
      }
      if (dateRange.from) {
        params.set("dateFrom", dateRange.from);
      }
      if (dateRange.to) {
        params.set("dateTo", dateRange.to);
      }
      const res = await fetch(`/api/admin/sessions/drafts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch draft sessions");
      return res.json();
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 10000,
    enabled,
  });

  const drafts: any[] = data?.sessions || [];

  // Bulk delete drafts mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (sessionIds: number[]) => {
      // Delete sessions sequentially to avoid overwhelming the server
      const results = [];
      for (const sessionId of sessionIds) {
        const response = await fetch(`/api/admin/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(`Failed to delete session ${sessionId}`);
        }
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (_, sessionIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      setSelectedIds(new Set());
      toast({
        title: "Drafts deleted",
        description: `Successfully deleted ${sessionIds.length} draft report(s).`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete some draft reports.",
        variant: "destructive",
      });
    },
  });

  const withReset = <T>(setter: (value: T) => void, clearSelection: boolean) => (value: T) => {
    setter(value);
    if (clearSelection) setSelectedIds(new Set());
    setPage(1);
  };

  const toggleSelected = (id: number, selected: boolean) => {
    const next = new Set(selectedIds);
    if (selected) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const allSelected = drafts.length > 0 && drafts.every((d: any) => selectedIds.has(d.id));

  const toggleAllSelected = (selected: boolean) => {
    const next = new Set(selectedIds);
    drafts.forEach((d: any) => (selected ? next.add(d.id) : next.delete(d.id)));
    setSelectedIds(next);
  };

  const hasFilters =
    Boolean(search.trim()) ||
    technicianFilter !== "all" ||
    serviceTypeFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);

  const clearFilters = () => {
    setSearchState("");
    setTechnicianFilterState("all");
    setServiceTypeFilterState("all");
    setDateRangeState(EMPTY_DATE_FILTER);
    setSelectedIds(new Set());
    setPage(1);
  };

  return {
    data,
    isLoading,
    drafts,
    total: (data?.total || 0) as number,
    totalPages: (data?.totalPages || 0) as number,
    page,
    setPage,
    pageSize,
    setPageSize: withReset(setPageSizeState, false),
    technicianFilter,
    setTechnicianFilter: withReset(setTechnicianFilterState, true),
    serviceTypeFilter,
    setServiceTypeFilter: withReset(setServiceTypeFilterState, true),
    search,
    setSearch: withReset(setSearchState, false),
    dateRange,
    setDateRange: withReset(setDateRangeState, true),
    hasFilters,
    clearFilters,
    selectedIds,
    allSelected,
    toggleSelected,
    toggleAllSelected,
    bulkDelete: () => bulkDeleteMutation.mutate(Array.from(selectedIds)),
    isBulkDeleting: bulkDeleteMutation.isPending,
  };
}

export type AdminDrafts = ReturnType<typeof useAdminDrafts>;
