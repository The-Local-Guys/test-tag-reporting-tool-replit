import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCertificateSchema, type Certificate } from "@shared/schema";

export interface CertificatesPage {
  certificates: Certificate[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface CertificatesFilters {
  page: number;
  limit?: number;
  search?: string;
  clientName?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Custom hook for certificate operations
 * Encapsulates all certificate-related queries and mutations
 */
export function useCertificates(filters: CertificatesFilters) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { page, limit = 20, search, clientName, dateFrom, dateTo } = filters;

  // Fetch a page of certificates (user's own or all if admin), filtered server-side
  const { data, isLoading: certificatesLoading } = useQuery<CertificatesPage>({
    queryKey: ["/api/certificates/paginated", page, limit, search, clientName, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search?.trim()) params.set("search", search.trim());
      if (clientName && clientName !== "all") params.set("clientName", clientName);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/certificates/paginated?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch certificates");
      return res.json();
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch the distinct client names for the filter dropdown (independent of the current page/filters)
  const { data: clientNames } = useQuery<string[]>({
    queryKey: ["/api/certificates/client-names"],
    retry: false,
  });

  // Create certificate mutation
  const createCertificateMutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate data with Zod schema (omit userId - server adds it)
      const clientSchema = insertCertificateSchema.omit({ userId: true });
      const validatedData = clientSchema.parse(data);

      const response = await fetch("/api/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create certificate");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/client-names"] });
      toast({
        title: "Success",
        description: "Certificate created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create certificate",
        variant: "destructive",
      });
    },
  });

  // Update certificate mutation
  const updateCertificateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      // Validate data with Zod schema (omit userId - server preserves it)
      const clientSchema = insertCertificateSchema.omit({ userId: true }).partial();
      const validatedData = clientSchema.parse(data);

      const response = await fetch(`/api/certificates/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validatedData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update certificate");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/client-names"] });
      toast({
        title: "Success",
        description: "Certificate updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update certificate",
        variant: "destructive",
      });
    },
  });

  // Delete certificate mutation
  const deleteCertificateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/certificates/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete certificate");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/client-names"] });
      toast({
        title: "Success",
        description: "Certificate deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete certificate",
        variant: "destructive",
      });
    },
  });

  return {
    certificates: data?.certificates ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    clientNames: clientNames ?? [],
    certificatesLoading,
    createCertificateMutation,
    updateCertificateMutation,
    deleteCertificateMutation,
  };
}
