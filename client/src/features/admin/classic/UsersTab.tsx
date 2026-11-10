import { Edit, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRangeFilter } from "@/components/date-range-filter";
import { NoResults } from "@/components/no-results";
import type { AdminUsers } from "../hooks/useAdminUsers";
import { formatRoleLabel, getRoleBadgeClass } from "../utils";

export function UsersTab({
  users,
  onCreateUser,
  onEditUser,
}: {
  users: AdminUsers;
  onCreateUser: () => void;
  onEditUser: (user: any) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Technicians</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </div>
          <Button onClick={onCreateUser} className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="user-search" className="text-sm font-medium block mb-1">
              Search
            </Label>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                id="user-search"
                type="text"
                placeholder="Search by name, username or role..."
                value={users.search}
                onChange={(e) => users.setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="user-role-filter" className="text-sm font-medium block mb-1">
              Filter by Role
            </Label>
            <Select value={users.roleFilter} onValueChange={users.setRoleFilter}>
              <SelectTrigger id="user-role-filter" className="w-48" data-testid="users-role-filter">
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
          </div>
          <div>
            <Label htmlFor="user-status-filter" className="text-sm font-medium block mb-1">
              Filter by Status
            </Label>
            <Select value={users.statusFilter} onValueChange={users.setStatusFilter}>
              <SelectTrigger id="user-status-filter" className="w-40" data-testid="users-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DateRangeFilter
            label="Filter by Date Created"
            value={users.dateRange}
            onChange={users.setDateRange}
            testIdPrefix="users-date"
          />
          {users.hasFilters && (
            <button
              onClick={users.clearFilters}
              className="text-sm text-muted-foreground hover:text-foreground underline pb-2"
              data-testid="users-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {users.isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
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
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-medium ${getRoleBadgeClass(user.role)}`}>
                      {formatRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString("en-AU")}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditUser(user)}
                        className="flex items-center space-x-1"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                      </Button>
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={(checked) => users.setUserActive(user.id, checked)}
                        disabled={user.role === "admin"}
                      />
                      <span className="text-sm text-gray-600">{user.isActive ? "Active" : "Inactive"}</span>
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
        )}
      </CardContent>
    </Card>
  );
}
