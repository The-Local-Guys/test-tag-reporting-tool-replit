import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { downloadPDF } from "@/lib/pdf-generator";
import { downloadExcel } from "@/lib/excel-generator";

/** Continue a report in the testing flow, and download a report as PDF or Excel. */
export function useReportActions() {
  const { toast } = useToast();
  const [isContinuing, setIsContinuing] = useState(false);

  /**
   * Handle continuing an existing report (database-first approach - no localStorage to check)
   */
  const continueReport = (session: any) => {
    console.log(`Starting continue for session ${session.id}`);

    // Show loading screen
    setIsContinuing(true);

    // Set session ID in sessionStorage for cross-page navigation bridge
    sessionStorage.setItem('currentSessionId', session.id.toString());
    sessionStorage.setItem('selectedService', session.serviceType || 'electrical');

    console.log(`Set continuation flags for session ${session.id}, navigating to items`);

    // Add a longer delay to show the loading screen and ensure smooth transition
    setTimeout(() => {
      window.location.href = '/items';
    }, 1500);
  };

  const downloadReport = async (
    session: any,
    format: "pdf" | "excel",
    includeCertificate = true,
  ) => {
    try {
      const response = await fetch(`/api/sessions/${session.id}/report`);
      if (!response.ok) throw new Error("Failed to fetch report data");

      const reportData = await response.json();
      const filename = `${session.clientName}-${session.testDate}`;

      if (format === "pdf") {
        await downloadPDF(
          includeCertificate ? reportData : { ...reportData, attachedCertificate: null },
          `${filename}.pdf`,
        );
      } else {
        downloadExcel(reportData, `${filename}.xlsx`);
      }

      toast({
        title: "Download started",
        description: `${format.toUpperCase()} report is being downloaded.`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the report.",
        variant: "destructive",
      });
    }
  };

  return { isContinuing, continueReport, downloadReport };
}
