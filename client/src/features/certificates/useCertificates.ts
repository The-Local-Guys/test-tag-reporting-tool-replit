import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCertificateSchema, type Certificate } from "@shared/schema";

/**
 * Custom hook for certificate operations
 * Encapsulates all certificate-related queries and mutations
 */
export function useCertificates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all certificates (user's own or all if admin)
  const { data: certificates, isLoading: certificatesLoading } = useQuery({
    queryKey: ["/api/certificates"],
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
    certificates,
    certificatesLoading,
    createCertificateMutation,
    updateCertificateMutation,
    deleteCertificateMutation,
  };
}
