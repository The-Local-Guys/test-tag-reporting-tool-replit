import { useLocation } from "wouter";
import { CalendarClock, FilePen, FileText, KeyRound, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import { CertificatesTabV2 } from "@/components/admin-v2/CertificatesTabV2";
import { StatTile } from "@/components/admin-v2/admin-ui";
import { UsersSection } from "@/components/admin-v2/UsersSection";
import { ReportsSection } from "@/components/admin-v2/ReportsSection";
import { AdminDraftsSection } from "@/components/admin-v2/AdminDraftsSection";
import { TechnicianDraftsSection } from "@/components/admin-v2/TechnicianDraftsSection";
import { useAdminDashboard } from "@/features/admin/hooks/useAdminDashboard";
import { AdminDashboardDialogs } from "@/features/admin/components/AdminDashboardDialogs";
import { ContinuingReportScreen } from "@/features/admin/components/ContinuingReportScreen";

/** Redesigned admin dashboard (/admin/v2/:section). Same features as /admin, refreshed layout. */
export default function AdminDashboardV2({ section }: { section?: string }) {
  const [, setLocation] = useLocation();
  const dashboard = useAdminDashboard();
  const { currentUser, hasAdminRole, isTechnician, stats } = dashboard;

  // Show loading screen when continuing a report
  if (dashboard.isContinuing) {
    return <ContinuingReportScreen variant="v2" />;
  }

  const draftTotal = hasAdminRole
    ? dashboard.adminDrafts.total
    : isTechnician
      ? dashboard.technicianDrafts.total
      : 0;

  const tabs: { key: string; label: string; icon: typeof Users; badge?: number }[] = [
    ...(hasAdminRole ? [{ key: "users", label: "User Management", icon: Users }] : []),
    { key: "certificates", label: "Certificates", icon: ShieldCheck },
    { key: "reports", label: isTechnician ? "My Reports" : "All Reports", icon: FileText },
    ...(hasAdminRole || isTechnician
      ? [{ key: "drafts", label: "Draft Reports", icon: FilePen, badge: draftTotal > 0 ? draftTotal : undefined }]
      : []),
  ];
  const defaultSection = isTechnician ? "reports" : "users";
  const activeSection =
    section && tabs.some((tab) => tab.key === section)
      ? section
      : tabs.some((tab) => tab.key === defaultSection)
        ? defaultSection
        : tabs[0].key;
  const goToSection = (key: string) => setLocation(`/admin/v2/${key}`);

  const inactiveUsers = stats.totalUsers - stats.activeUsers;
  const activeUserPct = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;
  const todayLabel = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="-mt-6 min-h-screen bg-slate-50 px-4 pb-12 pt-6 font-['Inter',ui-sans-serif,system-ui,sans-serif] text-slate-900 antialiased sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <img src={logoPath} alt="The Local Guys" className="max-h-full w-auto object-contain" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">{todayLabel}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
                Admin Dashboard
              </h1>
              <p className="text-sm text-slate-500">Welcome, {currentUser?.fullName}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => dashboard.setIsChangePasswordOpen(true)}
            className="h-9 gap-2 self-start rounded-lg border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 sm:self-auto"
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div
          className={`grid gap-3 mb-6 sm:gap-4 sm:mb-8 ${isTechnician ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}
        >
          {/* Only show user stats for super admins and support center */}
          {hasAdminRole && (
            <>
              <StatTile
                label="Total Users"
                value={stats.totalUsers}
                icon={Users}
                accent="blue"
                hint={`${inactiveUsers} inactive`}
              />
              <StatTile
                label="Active Users"
                value={stats.activeUsers}
                icon={UserCheck}
                accent="emerald"
                progress={activeUserPct}
                hint={`${activeUserPct}% of all users`}
              />
            </>
          )}
          <StatTile
            label={isTechnician ? "My Reports" : "Total Reports"}
            value={stats.totalReports}
            icon={FileText}
            accent="violet"
            hint="All time"
          />
          <StatTile
            label="This Week"
            value={stats.recentReports}
            icon={CalendarClock}
            accent="amber"
            hint="Created in the last 7 days"
          />
        </div>

        {/* Main Content */}
        <Tabs value={activeSection} onValueChange={goToSection} className="space-y-4 sm:space-y-5">
          <div>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-200/60 p-1 sm:inline-flex sm:w-auto sm:flex-wrap">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-all hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
                    data-testid={`admin-v2-tab-${tab.key}`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.badge !== undefined && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-px text-[11px] font-semibold tabular-nums text-amber-800">
                        {tab.badge}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {activeSection === "users" && hasAdminRole && (
            <UsersSection
              users={dashboard.users}
              onCreateUser={() => dashboard.setIsCreateUserOpen(true)}
              onEditUser={dashboard.setEditingUser}
            />
          )}

          {activeSection === "certificates" && (
            <div className="space-y-4">
              <CertificatesTabV2 />
            </div>
          )}

          {activeSection === "reports" && (
            <ReportsSection
              reports={dashboard.reports}
              technicians={dashboard.users.technicianNames}
              showTechnicianFilter={hasAdminRole}
              canDelete={dashboard.canDeleteReport}
              onDelete={dashboard.deleteReport.request}
              actions={dashboard.rowActions}
            />
          )}

          {activeSection === "drafts" && hasAdminRole && (
            <AdminDraftsSection
              drafts={dashboard.adminDrafts}
              technicians={dashboard.users.technicianNames}
              onDelete={dashboard.deleteDraft.request}
              onBulkDelete={() => dashboard.setIsBulkDeleteConfirmOpen(true)}
              actions={dashboard.rowActions}
            />
          )}

          {activeSection === "drafts" && isTechnician && (
            <TechnicianDraftsSection
              drafts={dashboard.technicianDrafts}
              onDelete={dashboard.deleteDraft.request}
              actions={dashboard.rowActions}
            />
          )}
        </Tabs>
      </div>

      <AdminDashboardDialogs dashboard={dashboard} variant="v2" />
    </div>
  );
}
