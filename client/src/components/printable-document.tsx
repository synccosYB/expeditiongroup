import type { ReactNode } from "react";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";

const BASE_PRINT_STYLES = `
  @media print {
    body {
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print\\:hidden {
      display: none !important;
    }
    .dark\\:invert {
      filter: none !important;
    }
    [data-testid="img-company-logo"] {
      filter: none !important;
    }
    .text-green-600 {
      color: #16a34a !important;
    }
    table {
      border-collapse: collapse;
      table-layout: auto !important;
      width: 100% !important;
    }
    th, td {
      border-bottom: 1px solid #ddd;
    }
    td:first-child {
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      white-space: pre-wrap !important;
      max-width: none !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .sdx-widget-btn,
    .sdx-overlay,
    #synkdex-widget,
    [class*='sdx-'],
    [id*='synkdex'],
    iframe[src*='synkdex'],
    iframe[id*='synkdex'],
    iframe[id*='sdx'],
    iframe[class*='sdx'],
    img[src*='synkdex'],
    img[src*='Synkdex'],
    img[alt*='synkdex'],
    img[alt*='Synkdex'] {
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      left: -9999px !important;
    }
  }
`;

const CARD_PRINT_STYLES = `
  @media print {
    [class*="space-y-6"] {
      margin: 0 !important;
      padding: 20px !important;
    }
    [class*="CardContent"] {
      padding: 0 !important;
    }
    [class*="bg-muted"] {
      background-color: #f5f5f5 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    [class*="text-muted-foreground"] {
      color: #666 !important;
    }
  }
`;

interface PrintStylesProps {
  /**
   * When true (default), include the additional layout overrides used by
   * card-based printable documents (invoice, bill, bank statement) that
   * collapse the space-y-6/CardContent paddings and force muted backgrounds.
   * Set to false for pages that don't use that layout (e.g. the client
   * portal invoice view) to avoid altering their print output.
   */
  cardLayout?: boolean;
  extraCss?: string;
}

export function PrintStyles({ cardLayout = true, extraCss }: PrintStylesProps) {
  return (
    <style>{`${BASE_PRINT_STYLES}${cardLayout ? CARD_PRINT_STYLES : ""}${extraCss ?? ""}`}</style>
  );
}

interface PrintCompanyHeaderProps {
  right?: ReactNode;
  rightTestId?: string;
  companyInfoTestId?: string;
}

export function PrintCompanyHeader({
  right,
  rightTestId,
  companyInfoTestId = "invoice-company-info",
}: PrintCompanyHeaderProps) {
  return (
    <div className="flex justify-between gap-8 mb-8">
      <div data-testid={companyInfoTestId}>
        <img
          src={logoUrl}
          alt="Expedition Group"
          className="h-12 dark:invert print:filter-none"
          data-testid="img-company-logo"
        />
        <div className="mt-3 text-sm text-muted-foreground space-y-0.5 print:text-gray-600">
          <p>17 Sandybrook Drive</p>
          <p>Spring Valley, NY 10977</p>
          <p>(845) 212-2040</p>
          <p>Info@expeditiongroupny.com</p>
        </div>
      </div>
      {right !== undefined && (
        <div className="text-right" data-testid={rightTestId}>
          {right}
        </div>
      )}
    </div>
  );
}
