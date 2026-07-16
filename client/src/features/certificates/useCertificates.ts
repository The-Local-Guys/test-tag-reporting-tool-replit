import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { insertCertificateSchema, type Certificate } from "@shared/schema";

export type CertificatesQueryParams = {
  page: number;
  limit: number;
  search?: string;
  clientName?: string;
};

export type PaginatedCertificatesResponse = {
  certificates: Certificate[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  clientNames: string[];
};

/**
 * Custom hook for certificate operations
 * Encapsulates all certificate-related queries and mutations
 */
export function useCertificates(params: CertificatesQueryParams) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const normalizedParams = {
    page: params.page,
    limit: params.limit,
    search: params.search?.trim() || undefined,
    clientName: params.clientName?.trim() || undefined,
  };

  const { data, isLoading: certificatesLoading, isFetching: certificatesFetching } = useQuery<PaginatedCertificatesResponse>({
    queryKey: ["/api/certificates", normalizedParams],
    queryFn: async () => {
      const query = new URLSearchParams({
        page: String(normalizedParams.page),
        limit: String(normalizedParams.limit),
      });
      if (normalizedParams.search) query.set("search", normalizedParams.search);
      if (normalizedParams.clientName) query.set("clientName", normalizedParams.clientName);

      const response = await fetch(`/api/certificates?${query.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to fetch certificates");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
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
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
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
    totalPages: data?.totalPages ?? 0,
    limit: data?.limit ?? params.limit,
    clientNames: data?.clientNames ?? [],
    certificatesLoading,
    certificatesFetching,
    createCertificateMutation,
    updateCertificateMutation,
    deleteCertificateMutation,
  };
}
