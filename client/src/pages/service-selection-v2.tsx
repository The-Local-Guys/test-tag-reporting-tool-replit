import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Clock, FilePen, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import { ServiceBadge } from "@/components/admin-v2/admin-ui";
import { ConfirmDeleteDialog } from "@/features/admin/components/ConfirmDeleteDialog";
import { TESTING_SERVICES, getRelativeTime, type ServiceType, type TestingService } from "@/features/testing/services";
import { useServiceSelection, type DraftSession } from "@/features/testing/useServiceSelection";

/** Per-service accents, matching the service colours on the v2 admin dashboard. */
const ACCENTS: Record<ServiceType, { chip: string; button: string; ring: string }> = {
  electrical: { chip: "bg-blue-50 text-blue-600", button: "bg-blue-600 hover:bg-blue-700", ring: "hover:border-blue-300" },
  emergency_exit_light: { chip: "bg-red-50 text-red-600", button: "bg-red-600 hover:bg-red-700", ring: "hover:border-red-300" },
  fire_testing: { chip: "bg-orange-50 text-orange-600", button: "bg-orange-600 hover:bg-orange-700", ring: "hover:border-orange-300" },
  rcd_reporting: { chip: "bg-violet-50 text-violet-600", button: "bg-violet-600 hover:bg-violet-700", ring: "hover:border-violet-300" },
  microwave_leakage: { chip: "bg-teal-50 text-teal-600", button: "bg-teal-600 hover:bg-teal-700", ring: "hover:border-teal-300" },
};

/** Drafts shown before "Show all", so a long backlog doesn't push the services off screen. */
const COLLAPSED_DRAFT_COUNT = 3;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DraftRow({
  draft,
  onContinue,
  onDiscard,
  isDiscarding,
}: {
  draft: DraftSession;
  onContinue: () => void;
  onDiscard: () => void;
  isDiscarding: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`draft-${draft.id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{draft.clientName}</span>
          <ServiceBadge serviceType={draft.serviceType} />
        </div>
        {draft.address && <div className="mt-0.5 truncate text-sm text-slate-500">{draft.address}</div>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums">
          <span className="font-medium text-slate-700">
            {draft.totalItems} item{draft.totalItems !== 1 ? "s" : ""}
          </span>
          {draft.failedItems > 0 && <span className="font-medium text-red-600">{draft.failedItems} failed</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            {getRelativeTime(draft.lastActivityAt || draft.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={onContinue} className="h-9 flex-1 gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 sm:flex-none">
          <Play className="h-3.5 w-3.5" />
          Continue
        </Button>
        <Button
          variant="ghost"
          onClick={onDiscard}
          disabled={isDiscarding}
          className="h-9 gap-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
          aria-label={`Discard draft for ${draft.clientName}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sm:hidden lg:inline">Discard</span>
        </Button>
      </div>
    </li>
  );
}

function ServiceCard({ service, onSelect }: { service: TestingService; onSelect: () => void }) {
  const accent = ACCENTS[service.id];
  const Icon = service.icon;
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6",
        accent.ring,
      )}
      data-testid={`service-${service.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accent.chip)}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {service.standard}
        </span>
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{service.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{service.description}</p>
      <ul className="mt-4 mb-6 space-y-2 text-sm text-slate-600">
        {service.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {feature}
          </li>
        ))}
      </ul>
      <Button onClick={onSelect} className={cn("mt-auto h-10 w-full gap-2 rounded-lg text-white shadow-sm", accent.button)}>
        Start {service.shortLabel}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </article>
  );
}

/** Redesigned service selection (/testing/v2). Same behaviour as /, refreshed layout. */
export default function ServiceSelectionV2() {
  const { user } = useAuth();
  const firstName = ((user as { fullName?: string } | undefined)?.fullName || "").split(" ")[0];
  const {
    isCheckingDrafts,
    draftsWithItems,
    isDiscarding,
    continueDraft,
    discardDraft,
    selectService,
  } = useServiceSelection();
  const [pendingDiscard, setPendingDiscard] = useState<DraftSession | null>(null);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const visibleDrafts = showAllDrafts ? draftsWithItems : draftsWithItems.slice(0, COLLAPSED_DRAFT_COUNT);

  const todayLabel = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="-mt-6 min-h-screen bg-slate-50 px-4 pb-12 pt-6 font-['Inter',ui-sans-serif,system-ui,sans-serif] text-slate-900 antialiased sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4 sm:mb-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <img src={logoPath} alt="The Local Guys" className="max-h-full w-auto object-contain" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">{todayLabel}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
              {firstName ? `${getGreeting()}, ${firstName}` : "Select Testing Service"}
            </h1>
            <p className="text-sm text-slate-500">Choose the type of testing you want to perform today</p>
          </div>
        </div>

        {/* Unfinished reports */}
        {isCheckingDrafts ? (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Checking for unfinished reports...
          </div>
        ) : (
          draftsWithItems.length > 0 && (
            <section className="mb-8 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/60 px-5 py-4 sm:px-6">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <FilePen className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900">Continue where you left off</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800">
                      {draftsWithItems.length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    You have unfinished report{draftsWithItems.length > 1 ? "s" : ""}. Pick one up or start a new one below.
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 px-5 sm:px-6">
                {visibleDrafts.map((draft) => (
                  <DraftRow
                    key={draft.id}
                    draft={draft}
                    onContinue={() => continueDraft(draft)}
                    onDiscard={() => setPendingDiscard(draft)}
                    isDiscarding={isDiscarding}
                  />
                ))}
              </ul>
              {draftsWithItems.length > COLLAPSED_DRAFT_COUNT && (
                <button
                  type="button"
                  onClick={() => setShowAllDrafts((v) => !v)}
                  className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  data-testid="toggle-all-drafts"
                >
                  {showAllDrafts ? "Show fewer" : `Show all ${draftsWithItems.length} drafts`}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showAllDrafts && "rotate-180")} />
                </button>
              )}
            </section>
          )
        )}

        {/* Services */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Start a new report</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TESTING_SERVICES.map((service) => (
            <ServiceCard key={service.id} service={service} onSelect={() => selectService(service.id)} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          Need help choosing? Contact support for guidance on which service is right for your needs.
        </p>
      </div>

      <ConfirmDeleteDialog
        open={pendingDiscard !== null}
        onCancel={() => setPendingDiscard(null)}
        onConfirm={() => {
          if (pendingDiscard) discardDraft(pendingDiscard);
          setPendingDiscard(null);
        }}
        title="Discard draft?"
        description={`The unfinished report for ${pendingDiscard?.clientName ?? "this client"} will be deleted. This action cannot be undone.`}
      />
    </div>
  );
}
