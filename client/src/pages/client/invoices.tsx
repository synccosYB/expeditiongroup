import { RecordWorkspace } from "@/components/record-workspace";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Search,
  Calendar,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Printer,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { handlePrintWithWidgetRemoval, installPrintListeners } from "@/lib/printUtils";
import { PrintCompanyHeader, PrintStyles } from "@/components/printable-document";
import type { Invoice, Project } from "@shared/schema";
import { format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

type InvoiceWithProject = Invoice & { project?: Project };

const INVOICE_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Awaiting Payment" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ClientInvoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const cleanup = installPrintListeners();
    return cleanup;
  }, []);

  const { data: invoices, isLoading } = useQuery<InvoiceWithProject[]>({
    queryKey: ["/api/client/invoices"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const filteredInvoices = invoices?.filter(Boolean).filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.project?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const unpaidTotal = filteredInvoices
    .filter(Boolean)
    .filter(i => i.status === "sent")
    .reduce((sum, inv) => sum + parseFloat(inv?.total || "0"), 0);

  const paidTotal = filteredInvoices
    .filter(Boolean)
    .filter(i => i.status === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv?.total || "0"), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-chart-2 text-white">Paid</Badge>;
      case "sent":
        return <Badge variant="outline" className="text-chart-3 border-chart-3">Awaiting Payment</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="h-4 w-4 text-chart-2" />;
      case "sent":
        return <Clock className="h-4 w-4 text-chart-3" />;
      case "cancelled":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handlePrint = () => {
    handlePrintWithWidgetRemoval({
      documentTitle: "Invoices",
    });
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-invoices-title">
            Invoices
          </h1>
          <p className="text-muted-foreground mt-1">
            View and track your invoices
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} data-testid="button-print-invoices">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="workspace-metrics print:hidden">
        {[["Invoices", filteredInvoices.length], ["Outstanding", `$${unpaidTotal.toLocaleString()}`], ["Paid", `$${paidTotal.toLocaleString()}`]].map(([label, value]) => <div key={label}><div className="text-2xl font-semibold tabular-nums">{value}</div><div className="text-sm text-muted-foreground">{label}</div></div>)}
      </div>

      <div className="print:hidden flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-invoices"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredInvoices.length > 0 ? (
        <div className="print:hidden"><RecordWorkspace key={`${searchTerm}:${statusFilter}`} records={filteredInvoices} title={invoice => invoice.invoiceNumber} href={invoice => `/invoices/${invoice.id}`}
          columns={[{label: "Invoice", render: invoice => invoice.invoiceNumber}, {label: "Project", render: invoice => invoice.project?.name ?? "—"}, {label: "Amount", render: invoice => `$${parseFloat(invoice.total || "0").toLocaleString()}`}, {label: "Status", render: invoice => getStatusBadge(invoice.status)}]}
          details={invoice => <dl><dt>Project</dt><dd>{invoice.project?.name ?? "—"}</dd><dt>Amount</dt><dd>${parseFloat(invoice.total || "0").toLocaleString()}</dd><dt>Status</dt><dd>{getStatusBadge(invoice.status)}</dd><dt>Issued</dt><dd>{invoice.createdAt ? format(new Date(invoice.createdAt), "MMM d, yyyy") : "—"}</dd><dt>Due</dt><dd>{invoice.dueDate ? format(parseLocalDateFromISO(invoice.dueDate)!, "MMM d, yyyy") : "—"}</dd></dl>}
          actions={invoice => <Button asChild variant="ghost" size="icon"><Link href={`/invoices/${invoice.id}`} aria-label={`Open ${invoice.invoiceNumber}`} data-testid={`button-view-invoice-${invoice.id}`}><Eye className="h-4 w-4" /></Link></Button>}
        /></div>
      ) : (
        <Card className="print:hidden">
          <CardContent className="p-0">
            <EmptyState
              icon={DollarSign}
              title="No invoices found"
              description={searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Invoices will appear here once they are created"}
            />
          </CardContent>
        </Card>
      )}

      <div className="hidden print:block" data-testid="invoices-print-area">
        <div className="p-8">
          <PrintCompanyHeader
            rightTestId="invoices-print-meta"
            right={
              <>
                <h2 className="text-lg font-semibold mb-4">Invoice Statement</h2>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</p>
                </div>
              </>
            }
          />

          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1" data-testid="invoices-print-title">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              {filteredInvoices.length} invoice{filteredInvoices.length === 1 ? "" : "s"}
              {(searchTerm || statusFilter !== "all") ? " (filtered)" : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-muted/30 rounded-md" data-testid="invoices-info-grid">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="font-medium">{filteredInvoices.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
              <p className="font-medium">${unpaidTotal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
              <p className="font-medium">${paidTotal.toLocaleString()}</p>
            </div>
          </div>

          {filteredInvoices.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Invoice #</th>
                  <th className="text-left py-3 font-medium">Project</th>
                  <th className="text-left py-3 font-medium w-28">Date</th>
                  <th className="text-left py-3 font-medium w-28">Due Date</th>
                  <th className="text-right py-3 font-medium w-28">Amount</th>
                  <th className="text-left py-3 font-medium w-32">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b">
                    <td className="py-3 font-mono">{invoice.invoiceNumber}</td>
                    <td className="py-3">{invoice.project?.name || "—"}</td>
                    <td className="py-3">{invoice.createdAt ? format(new Date(invoice.createdAt), "MMM d, yyyy") : "—"}</td>
                    <td className="py-3">{invoice.dueDate ? format(parseLocalDateFromISO(invoice.dueDate)!, "MMM d, yyyy") : "—"}</td>
                    <td className="py-3 text-right font-medium">${parseFloat(invoice?.total || "0").toLocaleString()}</td>
                    <td className="py-3 capitalize">{invoice.status === "sent" ? "Awaiting Payment" : invoice.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices to display.</p>
          )}
        </div>
      </div>

      <PrintStyles
        cardLayout={false}
        extraCss={`
          @media print {
            html { color: #111 !important; }
            [data-testid="invoices-print-area"] {
              background: white !important;
              color: #111 !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              display: block !important;
            }
            [data-testid="invoices-print-area"] * {
              color: #111 !important;
              background-color: transparent !important;
              border-color: #ddd !important;
            }
            [data-testid="invoices-print-area"] .mb-8 { margin-bottom: 1rem !important; }
            [data-testid="invoices-info-grid"] {
              display: grid !important;
              grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
              gap: 1rem !important;
              padding: 0.75rem 1rem !important;
              background-color: #f5f5f5 !important;
            }
            [data-testid="invoices-info-grid"] p { color: #111 !important; }
            [data-testid="invoices-info-grid"] .text-xs { color: #666 !important; }
            [data-testid="invoices-print-meta"] p { color: #555 !important; }
            [data-testid="invoice-company-info"] p { color: #555 !important; }
            th { color: #111 !important; border-bottom: 2px solid #333 !important; }
            td { color: #111 !important; border-bottom: 1px solid #ddd !important; }
            .space-y-6 > * { margin: 0 !important; }
          }
        `}
      />
    </div>
  );
}
