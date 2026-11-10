import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowRight, FileText, Plus, Trash2, Clock } from "lucide-react";
import logoPath from "@assets/The Local Guys - with plug wide boarder - png seek.png";
import { TESTING_SERVICES, getRelativeTime, getServiceShortLabel, type ServiceType } from "@/features/testing/services";
import { useServiceSelection } from "@/features/testing/useServiceSelection";

/** Per-service colours for the service cards. */
const SERVICE_CARD_STYLES: Record<ServiceType, { card: string; iconBg: string; icon: string; button: string }> = {
  electrical: { card: "hover:border-blue-500", iconBg: "bg-blue-100", icon: "text-blue-600", button: "" },
  emergency_exit_light: { card: "hover:border-red-500", iconBg: "bg-red-100", icon: "text-red-600", button: "bg-red-600 hover:bg-red-700" },
  fire_testing: { card: "hover:border-orange-500", iconBg: "bg-orange-100", icon: "text-orange-600", button: "bg-orange-600 hover:bg-orange-700" },
  rcd_reporting: { card: "hover:border-purple-500", iconBg: "bg-purple-100", icon: "text-purple-600", button: "bg-purple-600 hover:bg-purple-700" },
  microwave_leakage: { card: "hover:border-green-500", iconBg: "bg-green-100", icon: "text-green-600", button: "bg-green-600 hover:bg-green-700" },
};

export default function ServiceSelection() {
  const {
    isCheckingDrafts,
    draftsWithItems,
    isDiscarding,
    continueDraft,
    discardDraft,
    startNewReport,
    selectService,
  } = useServiceSelection();
  const [showDraftsDialog, setShowDraftsDialog] = useState(false);

  // Show the drafts dialog while there are drafts with items (real work done),
  // and close it once the last one is discarded
  useEffect(() => {
    if (draftsWithItems.length > 0) {
      console.log(`Found ${draftsWithItems.length} draft sessions with items:`, draftsWithItems);
    }
    setShowDraftsDialog(draftsWithItems.length > 0);
  }, [draftsWithItems.length]);

  const handleStartNewReport = () => {
    startNewReport();
    setShowDraftsDialog(false);
  };

  // Show loading while checking for draft sessions
  if (isCheckingDrafts) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking for unfinished reports...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Draft Sessions Dialog - Database-First Approach */}
      <Dialog open={showDraftsDialog} onOpenChange={setShowDraftsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Unfinished Report{draftsWithItems.length > 1 ? 's' : ''} Found
            </DialogTitle>
            <DialogDescription>
              You have {draftsWithItems.length} unfinished report{draftsWithItems.length > 1 ? 's' : ''}.
              Continue where you left off or start fresh.
            </DialogDescription>
          </DialogHeader>

          {/* List of draft sessions */}
          <div className="space-y-3 mt-4 max-h-[300px] overflow-y-auto">
            {draftsWithItems.map((draft) => (
              <div
                key={draft.id}
                className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{draft.clientName}</div>
                    <div className="text-sm text-gray-600">{draft.address}</div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        {getServiceShortLabel(draft.serviceType)}
                      </span>
                      <span className="font-medium">
                        {draft.totalItems} item{draft.totalItems !== 1 ? 's' : ''}
                      </span>
                      {draft.failedItems > 0 && (
                        <span className="text-red-600">
                          {draft.failedItems} failed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      Last activity: {getRelativeTime(draft.lastActivityAt || draft.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        continueDraft(draft);
                        setShowDraftsDialog(false);
                      }}
                      className="bg-primary"
                    >
                      Continue
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => discardDraft(draft)}
                      disabled={isDiscarding}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Discard
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-4">
            <Button
              onClick={handleStartNewReport}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start New Report Instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <img
          src={logoPath}
          alt="The Local Guys"
          className="h-24 mx-auto mb-6"
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Select Testing Service
        </h1>
        <p className="text-lg text-gray-600">
          Choose the type of testing you want to perform today
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TESTING_SERVICES.map((service) => {
            const styles = SERVICE_CARD_STYLES[service.id];
            const Icon = service.icon;
            return (
              <Card key={service.id} className={`cursor-pointer hover:shadow-lg transition-shadow border-2 ${styles.card}`}>
                <CardHeader className="text-center">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${styles.iconBg}`}>
                    <Icon className={`w-8 h-8 ${styles.icon}`} />
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-gray-600 space-y-2 mb-6">
                    {service.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => selectService(service.id)}
                    className={`w-full ${styles.button}`}
                    size="lg"
                  >
                    {service.selectLabel}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Need help choosing? Contact support for guidance on which service is right for your needs.
        </p>
      </div>
    </div>
    </>
  );
}
