import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  Printer,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { format } from "date-fns";
import type { Invoice, InvoiceItem, Project, Client } from "@shared/schema";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";

interface InvoiceWithRelations extends Invoice {
  project?: Project;
  client?: Client;
  items?: InvoiceItem[];
}

const invoiceStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = parseInt(id || "0");

  const { data: invoice, isLoading } = useQuery<InvoiceWithRelations>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = invoice?.invoiceNumber || "Invoice";
    window.print();
    document.title = originalTitle;
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button asChild>
          <Link href="/clients">Back to Clients</Link>
        </Button>
      </div>
    );
  }

  const statusInfo = invoiceStatusConfig[invoice.status] || { label: invoice.status, variant: "outline" as const };
  const subtotal = invoice.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
  const total = parseFloat(invoice.total || "0");
  const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt) : new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={invoice.client ? `/clients/${invoice.clientId}` : "/clients"} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-invoice-number">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-sm text-muted-foreground">Invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusInfo.variant} className="text-sm">
            {statusInfo.label}
          </Badge>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8">
          <div className="flex justify-between gap-8 mb-8">
            <div>
              <img 
                src={logoUrl} 
                alt="Expedition Group" 
                className="h-12 dark:invert print:filter-none"
                data-testid="img-company-logo"
              />
              <div className="mt-3 text-sm text-muted-foreground space-y-0.5 print:text-gray-600">
                <p>123 Main Street, Suite 100</p>
                <p>Monroe, NY 10950</p>
                <p>(845) 555-1234</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-semibold mb-4">Bill To</h2>
              {invoice.client && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{invoice.client.name}</p>
                  {invoice.client.company && (
                    <p className="text-muted-foreground print:text-gray-600">{invoice.client.company}</p>
                  )}
                  {invoice.client.address && (
                    <p className="text-muted-foreground print:text-gray-600">{invoice.client.address}</p>
                  )}
                  {invoice.client.email && (
                    <p className="text-muted-foreground print:text-gray-600">{invoice.client.email}</p>
                  )}
                  {invoice.client.phone && (
                    <p className="text-muted-foreground print:text-gray-600">{invoice.client.phone}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Number</p>
              <p className="font-mono font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Date</p>
              <p className="font-medium">{format(invoiceDate, "MMMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              <p className="font-medium">
                {invoice.dueDate ? format(new Date(invoice.dueDate), "MMMM d, yyyy") : "Upon Receipt"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={statusInfo.variant} className="mt-1">
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          {invoice.project && (
            <div className="mb-8 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Project</p>
              </div>
              <Link 
                href={`/projects/${invoice.project.id}`} 
                className="text-sm hover:underline print:no-underline"
                data-testid="link-project"
              >
                {invoice.project.name}
              </Link>
              {invoice.project.address && (
                <p className="text-xs text-muted-foreground mt-1">{invoice.project.address}</p>
              )}
            </div>
          )}

          <div className="mb-8">
            <table className="w-full text-sm" data-testid="table-invoice-items">
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
                  <tr key={item.id || index} className="border-b" data-testid={`row-item-${item.id}`}>
                    <td className="py-3">{item.description}</td>
                    <td className="text-right py-3">{item.quantity}</td>
                    <td className="text-right py-3">${parseFloat(item.unitPrice || "0").toFixed(2)}</td>
                    <td className="text-right py-3 font-medium">${parseFloat(item.amount || "0").toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span data-testid="text-total-amount">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <style>{`
        @media print {
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
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
          .dark\\:invert {
            filter: none !important;
          }
          table {
            border-collapse: collapse;
          }
          th, td {
            border-bottom: 1px solid #ddd;
          }
        }
      `}</style>
    </div>
  );
}
