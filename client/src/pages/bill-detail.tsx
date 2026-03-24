import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, FileText, ExternalLink } from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";
import { handlePrintWithWidgetRemoval, installPrintListeners } from "@/lib/printUtils";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";
import type { Bill, BillItem, Vendor, BillPayment, BankAccount } from "@shared/schema";

type BillWithRelations = Bill & {
  vendor: Vendor;
  items: BillItem[];
  payments?: BillPayment[];
};

const billStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  paid: { label: "Paid", variant: "default" },
  partial: { label: "Partial", variant: "secondary" },
  void: { label: "Void", variant: "destructive" },
  draft: { label: "Draft", variant: "outline" },
  pending: { label: "Pending", variant: "outline" },
};

const formatCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const billId = parseInt(id || "0");

  useEffect(() => {
    const cleanup = installPrintListeners();
    return cleanup;
  }, []);

  const { data: bill, isLoading } = useQuery<BillWithRelations>({
    queryKey: ["/api/bills", billId],
    enabled: !!billId,
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const handlePrint = () => {
    handlePrintWithWidgetRemoval({
      documentTitle: bill?.billNumber || "Bill",
    });
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Bill not found</p>
        <Button asChild>
          <Link href="/bills">Back to Bills</Link>
        </Button>
      </div>
    );
  }

  const statusInfo = billStatusConfig[bill.status || "pending"] || { label: bill.status, variant: "outline" as const };
  const subtotal = bill.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
  const total = parseFloat(bill.total || "0");
  const amountPaid = parseFloat(bill.amountPaid || "0");
  const balanceDue = parseFloat(bill.amountDue || "0");
  const billDate = bill.billDate ? parseLocalDateFromISO(bill.billDate)! : new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/bills" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-bill-number">
              {bill.vendor?.name} — {bill.billNumber}
            </h1>
            <p className="text-sm text-muted-foreground">Bill</p>
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
                <p>17 Sandybrook Drive</p>
                <p>Spring Valley, NY 10977</p>
                <p>(845) 212-2040</p>
                <p>Info@expeditiongroupny.com</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-semibold mb-4">Bill From</h2>
              {bill.vendor && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{bill.vendor.name}</p>
                  {bill.vendor.company && (
                    <p className="text-muted-foreground print:text-gray-600">{bill.vendor.company}</p>
                  )}
                  {bill.vendor.email && (
                    <p className="text-muted-foreground print:text-gray-600">{bill.vendor.email}</p>
                  )}
                  {bill.vendor.phone && (
                    <p className="text-muted-foreground print:text-gray-600">{bill.vendor.phone}</p>
                  )}
                  {bill.vendor.address && (
                    <p className="text-muted-foreground print:text-gray-600">{bill.vendor.address}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bill Number</p>
              <p className="font-mono font-medium">{bill.billNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Bill Date</p>
              <p className="font-medium">{format(billDate, "MMMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              <p className="font-medium">
                {bill.dueDate ? format(parseLocalDateFromISO(bill.dueDate)!, "MMMM d, yyyy") : "Upon Receipt"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={statusInfo.variant} className="mt-1">
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          <div className="mb-8">
            <table className="w-full text-sm" data-testid="table-bill-items">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Description</th>
                  <th className="text-right py-3 font-medium w-24">Qty</th>
                  <th className="text-right py-3 font-medium w-28">Unit Price</th>
                  <th className="text-right py-3 font-medium w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items?.map((item, index) => (
                  <tr key={item.id || index} className="border-b" data-testid={`row-item-${item.id}`}>
                    <td className="py-3">{item.description}</td>
                    <td className="text-right py-3">{item.quantity}</td>
                    <td className="text-right py-3">{formatCurrency.format(parseFloat(item.unitPrice || "0"))}</td>
                    <td className="text-right py-3 font-medium">{formatCurrency.format(parseFloat(item.amount || "0"))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency.format(subtotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span data-testid="text-total-amount">{formatCurrency.format(total)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Amount Paid</span>
                  <span>-{formatCurrency.format(amountPaid)}</span>
                </div>
              )}
              {balanceDue !== total && (
                <div className="flex justify-between text-base font-semibold">
                  <span>Balance Due</span>
                  <span data-testid="text-balance-due">{formatCurrency.format(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>

          {bill.payments && bill.payments.length > 0 && (
            <div className="mt-8 print:hidden">
              <h3 className="text-sm font-medium mb-4">Payment History</h3>
              <div className="space-y-3">
                {bill.payments.map((payment) => {
                  const bankAccount = bankAccounts?.find(a => a.id === payment.bankAccountId);
                  return (
                    <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {format(parseLocalDateFromISO(payment.paymentDate)!, "MMMM d, yyyy")} — {formatCurrency.format(parseFloat(payment.amount || "0"))}
                        </p>
                        <p className="text-muted-foreground">
                          {payment.paymentMethod && <span className="capitalize">{payment.paymentMethod}</span>}
                          {payment.reference && <span> — Ref: {payment.reference}</span>}
                          {bankAccount?.name && <span> — {bankAccount.name}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {bill.notes && (
            <div className="mt-8 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium mb-2">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}

          {bill.documentUrl && (
            <div className="mt-8 print:hidden">
              <h3 className="text-sm font-medium mb-3">Attached Document</h3>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/bills/document/${bill.id}`} target="_blank" rel="noopener noreferrer" data-testid="link-view-document">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Document
                </a>
              </Button>
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
