import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/** Delete-with-confirmation for one report or draft: `request` opens the confirm dialog, `confirm` deletes. */
export function useDeleteSession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
      toast({
        title: "Report deleted",
        description: "The test report has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete report.",
        variant: "destructive",
      });
    },
  });

  return {
    isConfirmOpen: pendingId !== null,
    request: (sessionId: number) => setPendingId(sessionId),
    cancel: () => setPendingId(null),
    confirm: () => {
      if (pendingId !== null) {
        deleteSessionMutation.mutate(pendingId);
        setPendingId(null);
      }
    },
  };
}

export type DeleteSession = ReturnType<typeof useDeleteSession>;
