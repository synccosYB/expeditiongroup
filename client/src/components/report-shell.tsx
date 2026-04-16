import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Printer, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function formatCurrency(amount: number | string | null | undefined) {
  const num = parseFloat(String(amount || "0"));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "-";
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}/${d.getFullYear()}`;
}

export function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface PdfExportData {
  title: string;
  subtitle?: string;
  head: string[];
  body: (string | number)[][];
  filename: string;
}

export function exportPDF(data: PdfExportData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  doc.setFontSize(16);
  doc.text(data.title, 40, 50);
  if (data.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(data.subtitle, 40, 68);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    startY: 90,
    head: [data.head],
    body: data.body.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [240, 240, 240], textColor: 30 },
    margin: { left: 40, right: 40 },
  });
  doc.save(data.filename);
}

interface ReportShellProps {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
  onPrint?: () => void;
  onExport?: () => void;
  onExportPdf?: () => void;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function ReportShell({
  title,
  subtitle,
  controls,
  onPrint,
  onExport,
  onExportPdf,
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: ReportShellProps) {
  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" data-testid="button-back-reports">
            <Link href="/reports">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold" data-testid="text-report-title">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
          {onExportPdf && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPdf}
              data-testid="button-export-pdf"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            data-testid="button-print-report"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {controls && (
        <Card className="print:hidden">
          <CardContent className="p-4 flex flex-wrap items-end gap-4">
            {controls}
          </CardContent>
        </Card>
      )}

      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm">{subtitle}</p>}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading report...
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-empty-state">
            {emptyMessage || "No data for the selected period."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 print:p-0">
            <div className="overflow-x-auto">{children}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function DateRangeControls({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label className="text-xs">Start Date</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="w-44"
          data-testid="input-start-date"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">End Date</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="w-44"
          data-testid="input-end-date"
        />
      </div>
    </>
  );
}

export function AsOfControls({
  asOf,
  onChange,
}: {
  asOf: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">As Of</Label>
      <Input
        type="date"
        value={asOf}
        onChange={(e) => onChange(e.target.value)}
        className="w-44"
        data-testid="input-as-of-date"
      />
    </div>
  );
}

export const reportTableClass =
  "w-full text-sm [&_th]:p-3 [&_th]:text-left [&_th]:font-medium [&_th]:bg-muted/50 [&_th]:border-b [&_td]:p-3 [&_td]:border-b [&_tr:last-child_td]:border-b-0";

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export function yearStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}
