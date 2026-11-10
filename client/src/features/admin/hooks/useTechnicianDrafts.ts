import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EMPTY_DATE_FILTER, type DateFilter } from "@/components/date-range-filter";
import { DEFAULT_REPORTS_PAGE_SIZE } from "../utils";

/** The signed-in technician's own draft sessions, paginated and filtered server-side. */
export function useTechnicianDrafts(enabled: boolean) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_REPORTS_PAGE_SIZE);
  const [serviceTypeFilter, setServiceTypeFilterState] = useState<string>("all");
  const [search, setSearchState] = useState("");
  const [dateRange, setDateRangeState] = useState<DateFilter>(EMPTY_DATE_FILTER);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sessions/drafts", page, pageSize, serviceTypeFilter, search, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString() });
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
      const res = await fetch(`/api/sessions/drafts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch draft sessions");
      return res.json();
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
    enabled,
  });

  const withPageReset = <T>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const hasFilters =
    Boolean(search.trim()) ||
    serviceTypeFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);

  const clearFilters = () => {
    setSearchState("");
    setServiceTypeFilterState("all");
    setDateRangeState(EMPTY_DATE_FILTER);
    setPage(1);
  };

  return {
    data,
    isLoading,
    drafts: (data?.sessions || []) as any[],
    total: (data?.total || 0) as number,
    totalPages: (data?.totalPages || 0) as number,
    page,
    setPage,
    pageSize,
    setPageSize: withPageReset(setPageSizeState),
    serviceTypeFilter,
    setServiceTypeFilter: withPageReset(setServiceTypeFilterState),
    search,
    setSearch: withPageReset(setSearchState),
    dateRange,
    setDateRange: withPageReset(setDateRangeState),
    hasFilters,
    clearFilters,
  };
}

export type TechnicianDrafts = ReturnType<typeof useTechnicianDrafts>;
