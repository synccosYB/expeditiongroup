import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { handlePrintWithWidgetRemoval, installPrintListeners } from "@/lib/printUtils";
import { PrintCompanyHeader, PrintStyles } from "@/components/printable-document";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  ChevronLeft,
  Printer,
  Calendar,
  Building,
  Building2,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Invoice, Project, Client, InvoiceItem, Payment } from "@shared/schema";
import { format } from "date-fns";
import { parseLocalDateFromISO, formatLocalDate } from "@/lib/dateUtils";

type InvoiceWithRelations = Invoice & {
  project: Project;
  client: Client;
  items: InvoiceItem[];
};

export default function ClientInvoiceDetail() {
  const { id } = useParams<{ id: string }>();

  const invoiceId = parseInt(id || "0");

  useEffect(() => {
    const cleanup = installPrintListeners();
    return cleanup;
  }, []);

  const { data: invoice, isLoading } = useQuery<InvoiceWithRelations>({
    queryKey: ["/api/client/invoices", id],
    enabled: !!id,
  });

  const { data: invoicePayments } = useQuery<Payment[]>({
    queryKey: ["/api/client/invoices", invoiceId, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/client/invoices/${invoiceId}/payments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!invoiceId,
  });

  const { data: balanceData } = useQuery<{ total: number; totalPaid: number; remainingBalance: number }>({
    queryKey: ["/api/client/invoices", invoiceId, "balance"],
    queryFn: async () => {
      const res = await fetch(`/api/client/invoices/${invoiceId}/balance`, { credentials: "include" });
      if (!res.ok) return { total: 0, totalPaid: 0, remainingBalance: 0 };
      return res.json();
    },
    enabled: !!invoiceId,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!invoice) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FileText}
            title="Invoice not found"
            description="The invoice you're looking for doesn't exist"
          />
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-chart-2 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="text-chart-3 border-chart-3 gap-1">
            <Clock className="h-3 w-3" />
            Awaiting Payment
          </Badge>
        );
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPrintStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Paid";
      case "sent":
        return "Awaiting Payment";
      case "draft":
        return "Draft";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const handlePrint = () => {
    handlePrintWithWidgetRemoval({
      documentTitle: invoice?.invoiceNumber || "Invoice",
    });
  };

  const subtotal =
    invoice.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
  const total = parseFloat(invoice?.total || "0");
  const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt) : new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div>
          <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back to Invoices
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground font-mono" data-testid="text-invoice-number">
              {invoice.invoiceNumber}
            </h1>
            {getStatusBadge(invoice.status)}
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="print:hidden space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4" />
                Bill To
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{invoice.client?.name}</p>
              {invoice.client?.company && (
                <p className="text-muted-foreground">{invoice.client.company}</p>
              )}
              {invoice.client?.email && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {invoice.client.email}
                </p>
              )}
              {invoice.client?.phone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {invoice.client.phone}
                </p>
              )}
              {invoice.client?.billingAddress && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {invoice.client.billingAddress}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Project
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{invoice.project?.name}</p>
              {invoice.project?.address && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {invoice.project.address}
                </p>
              )}
              {invoice.project?.county && (
                <Badge variant="outline" className="mt-2">
                  {invoice.project.county}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {invoice.createdAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</span>
                </div>
              )}
              {invoice.dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{format(parseLocalDateFromISO(invoice.dueDate)!, "MMM d, yyyy")}</span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid Date</span>
                  <span className="text-chart-2">{format(new Date(invoice.paidAt), "MMM d, yyyy")}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span className="text-lg">${parseFloat(invoice?.total || "0").toLocaleString()}</span>
              </div>
              {balanceData && balanceData.totalPaid > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-green-600">${balanceData.totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>{balanceData.remainingBalance <= 0 ? "Paid in Full" : "Balance Due"}</span>
                    <span className="text-lg" data-testid="text-summary-balance">${balanceData.remainingBalance.toFixed(2)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="invoice-items-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">Description</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items?.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="whitespace-pre-wrap break-words">{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">${parseFloat(item.unitPrice || "0").toFixed(2)}</TableCell>
                    <TableCell className="text-right">${parseFloat(item.amount || "0").toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                  <TableCell className="text-right">${parseFloat(invoice.subtotal || "0").toFixed(2)}</TableCell>
                </TableRow>
                {invoice.tax && parseFloat(invoice.tax) > 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-medium">Tax</TableCell>
                    <TableCell className="text-right">${parseFloat(invoice.tax).toFixed(2)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell colSpan={3} className="text-right text-lg font-bold">Total</TableCell>
                  <TableCell className="text-right text-lg font-bold">
                    ${parseFloat(invoice?.total || "0").toFixed(2)}
                  </TableCell>
                </TableRow>
                {invoicePayments && invoicePayments.length > 0 && (
                  <>
                    {invoicePayments.map((pmt) => (
                      <TableRow key={pmt.id} data-testid={`row-payment-${pmt.id}`}>
                        <TableCell colSpan={3} className="text-right text-sm text-muted-foreground">
                          Payment {pmt.paymentDate ? format(parseLocalDateFromISO(pmt.paymentDate)!, "MMM d, yyyy") : ""}
                          {pmt.paymentMethod ? ` (${pmt.paymentMethod.replace("_", " ")})` : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm text-green-600">
                          -${parseFloat(pmt.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right text-lg font-bold">
                        {balanceData && balanceData.remainingBalance <= 0 ? "Paid in Full" : "Balance Due"}
                      </TableCell>
                      <TableCell className="text-right text-lg font-bold" data-testid="text-balance-due">
                        ${balanceData ? balanceData.remainingBalance.toFixed(2) : parseFloat(invoice?.total || "0").toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
                {invoice.status === "paid" && (!invoicePayments || invoicePayments.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-right text-lg font-bold text-green-600">
                      Paid in Full
                    </TableCell>
                    <TableCell className="text-right text-sm text-green-600" data-testid="text-paid-in-full">
                      {invoice.paidAt ? format(new Date(invoice.paidAt), "MMM d, yyyy") : ""}
                    </TableCell>
                  </TableRow>
                )}
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="hidden print:block" data-testid="invoice-print-area">
        <div className="p-8">
          <PrintCompanyHeader
            rightTestId="invoice-bill-to"
            right={
              <>
                <h2 className="text-lg font-semibold mb-4">Bill To</h2>
                {invoice.client ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">{invoice.client.name}</p>
                    {invoice.client.company && (
                      <p className="text-muted-foreground">{invoice.client.company}</p>
                    )}
                    {invoice.client.billingAddress && (
                      <p className="text-muted-foreground">{invoice.client.billingAddress}</p>
                    )}
                    {invoice.client.email && (
                      <p className="text-muted-foreground">{invoice.client.email}</p>
                    )}
                    {invoice.client.phone && (
                      <p className="text-muted-foreground">{invoice.client.phone}</p>
                    )}
                  </div>
                ) : null}
              </>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-muted/30 rounded-md" data-testid="invoice-info-grid">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Number</p>
              <p className="font-mono font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Date</p>
              <p className="font-medium">{formatLocalDate(invoiceDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              <p className="font-medium">
                {invoice.dueDate ? formatLocalDate(parseLocalDateFromISO(invoice.dueDate)!) : "Upon Receipt"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant="outline" className="mt-1" data-testid="badge-invoice-status">
                {getPrintStatusLabel(invoice.status)}
              </Badge>
            </div>
          </div>

          {invoice.project && (
            <div className="mb-8 p-4 border rounded-md" data-testid="invoice-project-box">
              <div className="flex items-center gap-2 mb-2" data-testid="invoice-project-header">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Project</p>
              </div>
              <p className="text-sm">{invoice.project.name}</p>
              {invoice.project.address && (
                <p className="text-xs text-muted-foreground mt-1">{invoice.project.address}</p>
              )}
            </div>
          )}

          <div className="mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Description</th>
                  <th className="text-right py-3 font-medium w-24">Qty</th>
                  <th className="text-right py-3 font-medium w-28">Unit Price</th>
                  <th className="text-right py-3 font-medium w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, index) => (
                  <tr key={item.id || index} className="border-b">
                    <td className="py-3 whitespace-pre-wrap break-words">{item.description}</td>
                    <td className="text-right py-3">{item.quantity}</td>
                    <td className="text-right py-3">${parseFloat(item.unitPrice || "0").toFixed(2)}</td>
                    <td className="text-right py-3 font-medium">${parseFloat(item.amount || "0").toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end" data-testid="invoice-totals">
            <div className="w-72 space-y-2">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {invoice.tax && parseFloat(invoice.tax) > 0 && (
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${parseFloat(invoice.tax).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between gap-4 text-lg font-semibold">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {invoicePayments && invoicePayments.length > 0 && (
                <>
                  <Separator />
                  {invoicePayments.map((pmt) => (
                    <div key={pmt.id} className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Payment {pmt.paymentDate ? formatLocalDate(parseLocalDateFromISO(pmt.paymentDate)!) : ""}
                        {pmt.paymentMethod ? ` (${pmt.paymentMethod.replace("_", " ")})` : ""}
                      </span>
                      <span className="text-green-600">-${parseFloat(pmt.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between gap-4 text-lg font-semibold">
                    <span>{balanceData && balanceData.remainingBalance <= 0 ? "Paid in Full" : "Balance Due"}</span>
                    <span>
                      ${balanceData ? balanceData.remainingBalance.toFixed(2) : total.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              {invoice.status === "paid" && (!invoicePayments || invoicePayments.length === 0) && (
                <>
                  <Separator />
                  <div className="flex justify-between gap-4 text-lg font-semibold text-green-600">
                    <span>Paid in Full</span>
                    <span>
                      {invoice.paidAt ? formatLocalDate(new Date(invoice.paidAt)) : ""}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 p-4 bg-muted/30 rounded-md" data-testid="invoice-notes-box">
              <p className="text-sm font-medium mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      <PrintStyles
        cardLayout={false}
        extraCss={`
          @media print {
            html {
              color: #111 !important;
            }
            [data-testid="invoice-print-area"] {
              background: white !important;
              color: #111 !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              display: block !important;
            }
            [data-testid="invoice-print-area"] *:not([data-testid="badge-invoice-status"]) {
              color: #111 !important;
              background-color: transparent !important;
              border-color: #ddd !important;
            }
            [data-testid="invoice-print-area"] .mb-8 {
              margin-bottom: 1rem !important;
            }
            [data-testid="invoice-print-area"] .mt-8 {
              margin-top: 1rem !important;
            }
            [data-testid="invoice-info-grid"] {
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              gap: 1rem !important;
              padding: 0.75rem 1rem !important;
              background-color: #f5f5f5 !important;
            }
            [data-testid="invoice-info-grid"] p {
              color: #111 !important;
            }
            [data-testid="invoice-info-grid"] .text-xs {
              color: #666 !important;
            }
            [data-testid="invoice-project-box"] {
              border: 1px solid #ddd !important;
              background: transparent !important;
              padding: 0.75rem 1rem !important;
            }
            [data-testid="invoice-project-header"] {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              gap: 0.5rem !important;
              margin-bottom: 0.25rem !important;
            }
            [data-testid="invoice-project-header"] svg {
              display: inline-block !important;
              flex-shrink: 0 !important;
              width: 1rem !important;
              height: 1rem !important;
            }
            [data-testid="badge-invoice-status"] {
              display: inline-block !important;
              padding: 2px 8px !important;
              border: 1px solid #333 !important;
              border-radius: 9999px !important;
              font-weight: 600 !important;
              font-size: 0.75rem !important;
              color: #111 !important;
              background-color: #fff !important;
              margin-top: 4px !important;
            }
            [data-testid="invoice-notes-box"] {
              background-color: #f5f5f5 !important;
            }
            [data-testid="invoice-bill-to"] p {
              color: #333 !important;
            }
            [data-testid="invoice-bill-to"] .font-medium {
              color: #111 !important;
            }
            [data-testid="invoice-company-info"] p {
              color: #555 !important;
            }
            th {
              color: #111 !important;
              border-bottom: 2px solid #333 !important;
            }
            td {
              color: #111 !important;
              border-bottom: 1px solid #ddd !important;
            }
            [data-testid="invoice-totals"] span {
              color: #111 !important;
            }
            [data-testid="invoice-totals"] .text-green-600 {
              color: #16a34a !important;
            }
            .space-y-6 > * {
              margin: 0 !important;
            }
          }
        `}
      />
    </div>
  );
}
