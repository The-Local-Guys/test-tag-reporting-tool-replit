import { Edit, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import type { AdminUsers } from "@/features/admin/hooks/useAdminUsers";
import { formatRoleLabel, getRoleBadgeClass } from "@/features/admin/utils";
import { DataTableFrame, FilterField, InitialsAvatar, SectionPanel } from "./admin-ui";

export function UsersSection({
  users,
  onCreateUser,
  onEditUser,
}: {
  users: AdminUsers;
  onCreateUser: () => void;
  onEditUser: (user: any) => void;
}) {
  return (
    <SectionPanel
      title="Technicians"
      count={users.isLoading ? undefined : users.filteredUsers.length}
      description="Manage user accounts and permissions"
      actions={
        <Button onClick={onCreateUser} className="h-9 gap-2 rounded-lg bg-blue-600 shadow-sm hover:bg-blue-700">
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      }
      toolbar={
        <>
          <FilterField label="Search" htmlFor="user-search">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                id="user-search"
                type="text"
                placeholder="Search by name, username or role..."
                value={users.search}
                onChange={(e) => users.setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </FilterField>
          <FilterField label="Filter by Role" htmlFor="user-role-filter">
            <Select value={users.roleFilter} onValueChange={users.setRoleFilter}>
              <SelectTrigger id="user-role-filter" className="w-full sm:w-48 bg-white" data-testid="users-role-filter">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {users.roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {formatRoleLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Filter by Status" htmlFor="user-status-filter">
            <Select value={users.statusFilter} onValueChange={users.setStatusFilter}>
              <SelectTrigger id="user-status-filter" className="w-full sm:w-40 bg-white" data-testid="users-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <DateRangeFilter
            label="Filter by Date Created"
            value={users.dateRange}
            onChange={users.setDateRange}
            testIdPrefix="users-date"
          />
          {users.hasFilters && (
            <button
              onClick={users.clearFilters}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 pb-2"
              data-testid="users-clear-filters"
            >
              Clear filters
            </button>
          )}
        </>
      }
    >
      {users.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <DataTableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created (DD/MM/YYYY)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.filteredUsers.map((user: any) => (
                <TableRow key={user.id}>
                  <TableCell data-span="full">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={user.fullName} className="h-8 w-8 bg-blue-50 text-blue-700" />
                      <span className="font-medium text-slate-900">{user.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell data-label="Username" className="text-slate-600">{user.username}</TableCell>
                  <TableCell data-label="Role">
                    <Badge variant="outline" className={`font-medium ${getRoleBadgeClass(user.role)}`}>
                      {formatRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Status">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell data-label="Created (DD/MM/YYYY)" className="text-slate-600 tabular-nums">
                    {new Date(user.createdAt).toLocaleDateString("en-AU")}
                  </TableCell>
                  <TableCell data-actions>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditUser(user)}
                        className="flex items-center gap-1 h-8"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </Button>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.isActive}
                          onCheckedChange={(checked) => users.setUserActive(user.id, checked)}
                          disabled={user.role === "admin"}
                        />
                        <span className="text-xs text-slate-500 w-12">
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <NoResults
                      hasFilters={users.hasFilters}
                      emptyTitle="No users found"
                      emptyHint="Users will appear here once accounts have been created."
                      onClearFilters={users.clearFilters}
                      testId="users-no-results"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableFrame>
      )}
    </SectionPanel>
  );
}
