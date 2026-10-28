import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DateRangeFilter, EMPTY_DATE_FILTER, type DateFilter } from "@/components/date-range-filter";
import { CheckCircle, ChevronLeft, ChevronRight, Link2, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getServiceDisplayName, getServiceBadgeClass } from "./certificate-display";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

interface AttachCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The report (test session) a certificate is being attached to or changed on. */
  sessionId: number;
  /** The id of the certificate currently attached to this report, if any — highlighted in the list and enables "Detach". */
  currentCertificateId?: number | null;
  /**
   * Called right after an attach/detach succeeds, with the new certificate id (null on detach).
   * The modal already invalidates the per-session certificate query itself; use this to update
   * any other local state the caller is holding (e.g. a row in a list) and/or invalidate list queries.
   */
  onAttached?: (certificateId: number | null) => void;
}

/**
 * Shared "attach a Certificate of Compliance to this report" picker: search/filter/paginate
 * existing certificates and attach or detach one. Every selection saves immediately via
 * PATCH /api/sessions/:id/certificate — there is no separate save step.
 * Used by the report page and the admin dashboard (View Report modal and quick action).
 */
export function AttachCertificateModal({
  isOpen,
  onClose,
  sessionId,
  currentCertificateId,
  onAttached,
}: AttachCertificateModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>(EMPTY_DATE_FILTER);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const resetFilters = () => {
    setSearch("");
    setClientFilter("all");
    setDateFilter(EMPTY_DATE_FILTER);
    setPage(1);
  };

  const hasFilters = clientFilter !== "all" || Boolean(search.trim()) || Boolean(dateFilter.from || dateFilter.to);

  const handleClose = () => {
    onClose();
    resetFilters();
  };

  // Distinct client names for the filter dropdown, independent of the current page/filters
  const { data: clientNames } = useQuery<string[]>({
    queryKey: ["/api/certificates/client-names"],
    enabled: isOpen,
  });

  const { data: results, isLoading } = useQuery<{ certificates: any[]; total: number; totalPages: number }>({
    queryKey: [
      "/api/certificates/paginated",
      { search, clientName: clientFilter, dateFrom: dateFilter.from, dateTo: dateFilter.to, page, limit: pageSize },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString() });
      if (search.trim()) params.set("search", search.trim());
      if (clientFilter !== "all") params.set("clientName", clientFilter);
      if (dateFilter.from) params.set("dateFrom", dateFilter.from);
      if (dateFilter.to) params.set("dateTo", dateFilter.to);
      const res = await fetch(`/api/certificates/paginated?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search certificates");
      return res.json();
    },
    enabled: isOpen,
  });

  const attachMutation = useMutation({
    mutationFn: async (certificateId: number | null) => {
      const res = await fetch(`/api/sessions/${sessionId}/certificate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ certificateId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to attach certificate");
      }
      return res.json();
    },
    onSuccess: (_data, certificateId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/certificate`] });
      onAttached?.(certificateId);
      handleClose();
      toast({
        title: "Success",
        description: certificateId === null ? "Certificate detached from this report." : "Certificate attached to this report.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to attach certificate",
        variant: "destructive",
      });
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Attach Certificate of Compliance" className="max-w-3xl">
      <div className="space-y-4">
        {currentCertificateId && (
          <Button
            variant="outline"
            className="w-full justify-start text-red-600 hover:text-red-700"
            onClick={() => attachMutation.mutate(null)}
            disabled={attachMutation.isPending}
            data-testid="button-detach-certificate"
          >
            Detach current certificate
          </Button>
        )}

        {/* Filter row, mirroring Admin -> Certificates */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="attach-certificate-search" className="text-sm font-medium block mb-1">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                id="attach-certificate-search"
                type="text"
                placeholder="Search by client name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-certificate-search"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="attach-certificate-client-filter" className="text-sm font-medium block mb-1">
              Filter by Client
            </Label>
            <Select
              value={clientFilter}
              onValueChange={(value) => {
                setClientFilter(value);
                setSearch("");
                setPage(1);
              }}
            >
              <SelectTrigger id="attach-certificate-client-filter" className="w-48" data-testid="select-certificate-client-filter">
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {(clientNames ?? []).filter((name) => !!name && name.trim() !== "").map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateRangeFilter
            label="Issue Date"
            value={dateFilter}
            onChange={(value) => {
              setDateFilter(value);
              setPage(1);
            }}
            testIdPrefix="attach-certificates-date"
          />
          {hasFilters && (
            <button onClick={resetFilters} className="text-sm text-muted-foreground hover:text-foreground underline pb-2">
              Clear filter
            </button>
          )}
        </div>

        {/* Results table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead className="w-16">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(results?.certificates ?? []).map((cert: any) => {
                  const isAttached = currentCertificateId === cert.id;
                  const services = (cert.services as string[]) ?? [];
                  return (
                    <TableRow key={cert.id} className={cn(isAttached && "bg-primary/5")} data-testid={`option-certificate-${cert.id}`}>
                      <TableCell className="font-medium">{cert.clientName}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{cert.address}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {services.map((serviceType: string, i: number) => (
                            <Badge key={i} variant="outline" className={`text-xs font-medium ${getServiceBadgeClass(serviceType)}`}>
                              {getServiceDisplayName(serviceType)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{new Date(cert.certificationDate).toLocaleDateString("en-AU")}</TableCell>
                      <TableCell>
                        {isAttached ? (
                          <div
                            className="flex items-center justify-center text-primary"
                            title="Currently attached"
                            data-testid={`indicator-attached-${cert.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="p-2 h-8 w-8"
                            onClick={() => attachMutation.mutate(cert.id)}
                            disabled={attachMutation.isPending}
                            title="Attach this certificate"
                            data-testid={`button-select-certificate-${cert.id}`}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(results?.certificates ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-6">
                      No certificates found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination + page size, mirroring Admin -> Certificates */}
        {!isLoading && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              {results && results.total > 0
                ? `Showing ${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, results.total)} of ${results.total} certificates`
                : "No certificates"}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="attach-certificate-page-size" className="text-sm">
                  Show:
                </Label>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => {
                    setPageSize(parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="attach-certificate-page-size" className="w-20" data-testid="select-certificate-picker-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {results && results.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 h-8 w-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-certificate-picker-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    Page {page} of {results.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 h-8 w-8"
                    onClick={() => setPage((p) => Math.min(results.totalPages, p + 1))}
                    disabled={page === results.totalPages}
                    data-testid="button-certificate-picker-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
