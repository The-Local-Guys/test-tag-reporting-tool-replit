import type { LucideIcon } from "lucide-react";
import { FileText, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import { CertificatesTab } from "@/features/certificates/CertificatesTab";
import { useAdminDashboard } from "@/features/admin/hooks/useAdminDashboard";
import { AdminDashboardDialogs } from "@/features/admin/components/AdminDashboardDialogs";
import { ContinuingReportScreen } from "@/features/admin/components/ContinuingReportScreen";
import { UsersTab } from "@/features/admin/classic/UsersTab";
import { ReportsTab } from "@/features/admin/classic/ReportsTab";
import { AdminDraftsTab } from "@/features/admin/classic/AdminDraftsTab";
import { TechnicianDraftsTab } from "@/features/admin/classic/TechnicianDraftsTab";

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: LucideIcon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DraftCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge variant="secondary" className="ml-2 bg-yellow-100 text-yellow-800">
      {count}
    </Badge>
  );
}

/**
 * Administrative dashboard for managing users, sessions, and system oversight
 * Provides user management, session editing, data export, and system monitoring
 * Restricted to super_admin and support_center roles
 */
export default function AdminDashboard() {
  const dashboard = useAdminDashboard();
  const { currentUser, hasAdminRole, isTechnician, stats } = dashboard;

  // Show loading screen when continuing a report
  if (dashboard.isContinuing) {
    return <ContinuingReportScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <img src={logoPath} alt="The Local Guys" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {currentUser?.fullName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => dashboard.setIsChangePasswordOpen(true)}
              className="flex items-center space-x-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>Change Password</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          className={`grid gap-6 mb-8 ${isTechnician ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-4"}`}
        >
          {/* Only show user stats for super admins and support center */}
          {hasAdminRole && (
            <>
              <StatCard title="Total Users" value={stats.totalUsers} icon={Users} />
              <StatCard title="Active Users" value={stats.activeUsers} icon={UserCheck} />
            </>
          )}
          <StatCard title={isTechnician ? "My Reports" : "Total Reports"} value={stats.totalReports} icon={FileText} />
          <StatCard title="This Week" value={stats.recentReports} icon={FileText} />
        </div>

        {/* Main Content */}
        <Tabs defaultValue={isTechnician ? "reports" : "users"} className="space-y-4">
          <TabsList>
            {hasAdminRole && <TabsTrigger value="users">User Management</TabsTrigger>}
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
            <TabsTrigger value="reports">{isTechnician ? "My Reports" : "All Reports"}</TabsTrigger>
            {hasAdminRole && (
              <TabsTrigger value="drafts">
                Draft Reports
                <DraftCountBadge count={dashboard.adminDrafts.total} />
              </TabsTrigger>
            )}
            {isTechnician && (
              <TabsTrigger value="drafts">
                Draft Reports
                <DraftCountBadge count={dashboard.technicianDrafts.total} />
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <UsersTab
              users={dashboard.users}
              onCreateUser={() => dashboard.setIsCreateUserOpen(true)}
              onEditUser={dashboard.setEditingUser}
            />
          </TabsContent>

          <TabsContent value="certificates" className="space-y-4">
            <CertificatesTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsTab
              reports={dashboard.reports}
              technicians={dashboard.users.technicianNames}
              showTechnicianFilter={hasAdminRole}
              canDelete={dashboard.canDeleteReport}
              onDelete={dashboard.deleteReport.request}
              actions={dashboard.rowActions}
            />
          </TabsContent>

          {/* Draft Reports Tab - Admin Only */}
          {hasAdminRole && (
            <TabsContent value="drafts" className="space-y-4">
              <AdminDraftsTab
                drafts={dashboard.adminDrafts}
                technicians={dashboard.users.technicianNames}
                onDelete={dashboard.deleteDraft.request}
                onBulkDelete={() => dashboard.setIsBulkDeleteConfirmOpen(true)}
                actions={dashboard.rowActions}
              />
            </TabsContent>
          )}

          {/* Draft Reports Tab - Technician (own drafts only) */}
          {isTechnician && (
            <TabsContent value="drafts" className="space-y-4">
              <TechnicianDraftsTab
                drafts={dashboard.technicianDrafts}
                onDelete={dashboard.deleteDraft.request}
                actions={dashboard.rowActions}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <AdminDashboardDialogs dashboard={dashboard} variant="classic" />
    </div>
  );
}
