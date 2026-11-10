import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { EMPTY_DATE_FILTER, type DateFilter } from "@/components/date-range-filter";
import { toLocalDateKey } from "../utils";

/** User list for user management, with client-side filters and the active/inactive toggle. */
export function useAdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateFilter>(EMPTY_DATE_FILTER);

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
    staleTime: 0, // Always consider data stale
    refetchOnMount: true, // Always refetch on mount
  });

  const allUsers: any[] = Array.isArray(users) ? users : [];

  // Technician names for the report/draft filter dropdowns
  const technicianNames: string[] = allUsers.map((u: any) => u.fullName).filter(Boolean).sort();

  // Roles actually present on the user list, so the filter never offers an empty option
  const roles: string[] = Array.from(new Set(allUsers.map((u: any) => u.role).filter(Boolean))).sort() as string[];

  const filteredUsers = allUsers.filter((user: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (user.fullName || "").toLowerCase().includes(q) ||
      (user.username || "").toLowerCase().includes(q) ||
      (user.role || "").toLowerCase().includes(q);
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? Boolean(user.isActive) : !user.isActive);
    const createdKey = toLocalDateKey(user.createdAt);
    const matchesDate =
      (!dateRange.from || (createdKey !== "" && createdKey >= dateRange.from)) &&
      (!dateRange.to || (createdKey !== "" && createdKey <= dateRange.to));
    return matchesSearch && matchesRole && matchesStatus && matchesDate;
  });

  const hasFilters =
    Boolean(search.trim()) ||
    roleFilter !== "all" ||
    statusFilter !== "all" ||
    Boolean(dateRange.from || dateRange.to);

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setDateRange(EMPTY_DATE_FILTER);
  };

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error("Failed to update user status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User status updated",
        description: "The user's status has been successfully changed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    },
  });

  const setUserActive = (userId: number, isActive: boolean) =>
    updateStatusMutation.mutate({ userId, isActive });

  return {
    isLoading,
    totalUsers: allUsers.length,
    activeUsers: allUsers.filter((u: any) => u.isActive).length,
    filteredUsers,
    technicianNames,
    roles,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    hasFilters,
    clearFilters,
    setUserActive,
  };
}

export type AdminUsers = ReturnType<typeof useAdminUsers>;
