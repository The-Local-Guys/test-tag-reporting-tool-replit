import type { ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, ShieldCheck } from "lucide-react";

interface PdfDownloadMenuProps {
  /** Whether the report has a Certificate of Compliance attached. Without one, clicking downloads straight away. */
  hasCertificate: boolean;
  /** Called with true to append the attached Certificate of Compliance to the PDF, false for the report only. */
  onDownload: (includeCertificate: boolean) => void;
  /** The Download PDF button. It becomes the menu trigger when a certificate is attached. */
  children: ReactNode;
  align?: "start" | "center" | "end";
}

/**
 * Wraps a Download PDF button. When the report has a Certificate of Compliance attached,
 * clicking it opens a small menu to choose whether the certificate is included in the PDF.
 */
export function PdfDownloadMenu({ hasCertificate, onDownload, children, align = "end" }: PdfDownloadMenuProps) {
  if (!hasCertificate) {
    return <Slot onClick={() => onDownload(false)}>{children}</Slot>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-gray-500">
          Certificate of Compliance attached
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onDownload(true)}
          className="items-start gap-2 cursor-pointer"
          data-testid="button-download-pdf-with-certificate"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-700 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Report + Certificate</div>
            <div className="text-xs text-gray-500">Certificate added as the final page(s)</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onDownload(false)}
          className="items-start gap-2 cursor-pointer"
          data-testid="button-download-pdf-without-certificate"
        >
          <FileText className="h-4 w-4 text-gray-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Test Report Only</div>
            <div className="text-xs text-gray-500">Without the certificate</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
