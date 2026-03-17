import { useState, useEffect } from "react";
import { handlePrintWithWidgetRemoval, installPrintListeners } from "@/lib/printUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Building2,
  Printer,
  Trash2,
  Pencil,
  ChevronDown,
  Plus,
  X,
  Send,
  CheckCircle,
  XCircle,
  FileText,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { parseLocalDateFromISO, formatLocalDate, formatDateForInput } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, InvoiceItem, Project, Client, Payment } from "@shared/schema";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";

interface InvoiceWithRelations extends Invoice {
  project?: Project;
  client?: Client;
  items?: InvoiceItem[];
}

interface LineItem {
  _key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const cleanup = installPrintListeners();
    return cleanup;
  }, []);

  const { data: invoice, isLoading } = useQuery<InvoiceWithRelations>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  const { data: invoicePayments } = useQuery<Payment[]>({
    queryKey: ["/api/invoices", invoiceId, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!invoiceId,
  });

  const { data: balanceData } = useQuery<{ total: number; totalPaid: number; remainingBalance: number }>({
    queryKey: ["/api/invoices", invoiceId, "balance"],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}/balance`, { credentials: "include" });
      if (!res.ok) return { total: 0, totalPaid: 0, remainingBalance: 0 };
      return res.json();
    },
    enabled: !!invoiceId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted successfully" });
      setLocation(invoice?.clientId ? `/clients/${invoice.clientId}` : "/invoices");
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const body: any = { status: newStatus };
      if (newStatus === "paid") {
        body.paidAt = new Date().toISOString();
      }
      await apiRequest("PATCH", `/api/invoices/${invoiceId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Invoice status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update invoice status", variant: "destructive" });
    },
  });

  const handlePrint = () => {
    handlePrintWithWidgetRemoval({
      documentTitle: invoice?.invoiceNumber || "Invoice",
    });
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button asChild>
          <Link href="/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const statusInfo = invoiceStatusConfig[invoice.status] || { label: invoice.status, variant: "outline" as const };
  const subtotal = invoice.items?.reduce((sum, item) => sum + parseFloat(item.amount || "0"), 0) || 0;
  const total = parseFloat(invoice?.total || "0");
  const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt) : new Date();

  const availableStatusTransitions: { status: string; label: string; icon: any }[] = [];
  if (invoice.status === "draft") {
    availableStatusTransitions.push({ status: "sent", label: "Mark as Sent", icon: Send });
    availableStatusTransitions.push({ status: "cancelled", label: "Cancel Invoice", icon: XCircle });
  } else if (invoice.status === "sent") {
    availableStatusTransitions.push({ status: "paid", label: "Mark as Paid", icon: CheckCircle });
    availableStatusTransitions.push({ status: "cancelled", label: "Cancel Invoice", icon: XCircle });
  } else if (invoice.status === "cancelled") {
    availableStatusTransitions.push({ status: "draft", label: "Revert to Draft", icon: FileText });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={invoice.clientId ? `/clients/${invoice.clientId}` : "/invoices"} data-testid="button-back">
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusInfo.variant} className="text-sm">
            {statusInfo.label}
          </Badge>

          {availableStatusTransitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-status-menu">
                  Update Status
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {availableStatusTransitions.map((t) => (
                  <DropdownMenuItem
                    key={t.status}
                    onSelect={() => statusMutation.mutate(t.status)}
                    data-testid={`button-status-${t.status}`}
                  >
                    <t.icon className="h-4 w-4 mr-2" />
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {invoice.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="button-edit-invoice">
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="button-delete-invoice">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete invoice {invoice.invoiceNumber}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground"
                  data-testid="button-confirm-delete"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0" data-testid="invoice-print-area">
        <CardContent className="p-8">
          <div className="flex justify-between gap-8 mb-8">
            <div data-testid="invoice-company-info">
              <img 
                src={logoUrl} 
                alt="Expedition Group" 
                className="h-12 dark:invert print:filter-none"
                data-testid="img-company-logo"
              />
              <div className="mt-3 text-sm text-muted-foreground space-y-0.5">
                <p>17 Sandybrook Drive</p>
                <p>Spring Valley, NY 10977</p>
                <p>(845) 212-2040</p>
                <p>Info@expeditiongroupny.com</p>
              </div>
            </div>
            <div className="text-right" data-testid="invoice-bill-to">
              <h2 className="text-lg font-semibold mb-4">Bill To</h2>
              {invoice.client ? (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{invoice.client.name}</p>
                  {invoice.client.company && (
                    <p className="text-muted-foreground">{invoice.client.company}</p>
                  )}
                  {invoice.client.address && (
                    <p className="text-muted-foreground">{invoice.client.address}</p>
                  )}
                  {invoice.client.email && (
                    <p className="text-muted-foreground">{invoice.client.email}</p>
                  )}
                  {invoice.client.phone && (
                    <p className="text-muted-foreground">{invoice.client.phone}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{invoice.recipientName || "Manual Invoice"}</p>
                  {invoice.recipientAddress && (
                    <p className="text-muted-foreground">{invoice.recipientAddress}</p>
                  )}
                  {invoice.recipientEmail && (
                    <p className="text-muted-foreground">{invoice.recipientEmail}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 bg-muted/30 rounded-md" data-testid="invoice-info-grid">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Number</p>
              <p className="font-mono font-medium" data-testid="text-invoice-num-value">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Invoice Date</p>
              <p className="font-medium" data-testid="text-invoice-date-value">{formatLocalDate(invoiceDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
              <p className="font-medium" data-testid="text-due-date-value">
                {invoice.dueDate ? formatLocalDate(parseLocalDateFromISO(invoice.dueDate)!) : "Upon Receipt"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={statusInfo.variant} className="mt-1" data-testid="badge-invoice-status">
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          {invoice.project && (
            <div className="mb-8 p-4 border rounded-md" data-testid="invoice-project-box">
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

          <div className="flex justify-end" data-testid="invoice-totals">
            <div className="w-72 space-y-2">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4 text-lg font-semibold">
                <span>Total</span>
                <span data-testid="text-total-amount">${total.toFixed(2)}</span>
              </div>
              {invoicePayments && invoicePayments.length > 0 && (
                <>
                  <Separator />
                  {invoicePayments.map((pmt) => (
                    <div key={pmt.id} className="flex justify-between gap-4 text-sm" data-testid={`row-payment-${pmt.id}`}>
                      <span className="text-muted-foreground">
                        Payment {pmt.paymentDate ? formatLocalDate(new Date(pmt.paymentDate)) : ""}
                        {pmt.paymentMethod ? ` (${pmt.paymentMethod.replace("_", " ")})` : ""}
                      </span>
                      <span className="text-green-600">-${parseFloat(pmt.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between gap-4 text-lg font-semibold">
                    <span>{balanceData && balanceData.remainingBalance <= 0 ? "Paid in Full" : "Balance Due"}</span>
                    <span data-testid="text-balance-due">
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
                    <span data-testid="text-paid-in-full">
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
        </CardContent>
      </Card>

      {editOpen && invoice && (
        <EditInvoiceDialog
          invoice={invoice}
          open={editOpen}
          onOpenChange={setEditOpen}
          invoiceId={invoiceId}
        />
      )}

      <style>{`
        @media print {
          body, html {
            background: white !important;
            color: #111 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          [data-testid="invoice-print-area"] {
            background: white !important;
            color: #111 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          [data-testid="invoice-print-area"] * {
            color: #111 !important;
            background-color: transparent !important;
            border-color: #ddd !important;
          }
          [data-testid="invoice-info-grid"] {
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
          }
          [data-testid="invoice-notes-box"] {
            background-color: #f5f5f5 !important;
          }
          .dark\\:invert, img.dark\\:invert {
            filter: none !important;
          }
          [data-testid="img-company-logo"] {
            filter: none !important;
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
          table {
            border-collapse: collapse;
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
      `}</style>
    </div>
  );
}

function EditInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  invoiceId,
}: {
  invoice: InvoiceWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
}) {
  const { toast } = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber || "");
  const [recipientName, setRecipientName] = useState(invoice.recipientName || "");
  const [recipientEmail, setRecipientEmail] = useState(invoice.recipientEmail || "");
  const [recipientAddress, setRecipientAddress] = useState(invoice.recipientAddress || "");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.createdAt ? formatDateForInput(invoice.createdAt) : "");
  const [dueDate, setDueDate] = useState(invoice.dueDate ? formatDateForInput(invoice.dueDate) : "");
  const [lineItems, setLineItems] = useState<LineItem[]>(
    invoice.items && invoice.items.length > 0
      ? invoice.items.map((i) => ({
          _key: i.id?.toString() || crypto.randomUUID(),
          description: i.description || "",
          quantity: i.quantity?.toString() || "1",
          unitPrice: i.unitPrice || "0",
          amount: i.amount || "0",
        }))
      : [{ _key: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "0", amount: "0" }]
  );

  const addLineItem = () => {
    setLineItems([...lineItems, { _key: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "0", amount: "0" }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      const qty = parseFloat(updated[index].quantity) || 0;
      const price = parseFloat(updated[index].unitPrice) || 0;
      updated[index].amount = (qty * price).toFixed(2);
    }
    setLineItems(updated);
  };

  const grandTotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!invoiceNumber.trim()) {
        throw new Error("Invoice number is required");
      }
      const validItems = lineItems.filter((i) => i.description.trim());
      if (validItems.length === 0) {
        throw new Error("At least one line item is required");
      }
      const body: any = {
        invoiceNumber: invoiceNumber.trim(),
        recipientName: recipientName || null,
        recipientEmail: recipientEmail || null,
        recipientAddress: recipientAddress || null,
        notes: notes || null,
        createdAt: invoiceDate || null,
        dueDate: dueDate || null,
        subtotal: grandTotal.toFixed(2),
        total: grandTotal.toFixed(2),
        items: validItems.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
          isCustom: true,
        })),
      };
      await apiRequest("PATCH", `/api/invoices/${invoiceId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: error.message || "Failed to update invoice",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Invoice {invoice.invoiceNumber}</DialogTitle>
          <DialogDescription className="sr-only">Edit invoice details</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-invoice-number">Invoice Number</Label>
            <Input
              id="edit-invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              data-testid="input-edit-invoice-number"
            />
          </div>

          {!invoice.clientId && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Recipient Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-recipient-name">Recipient Name</Label>
                  <Input
                    id="edit-recipient-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    data-testid="input-edit-recipient-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-recipient-email">Email</Label>
                  <Input
                    id="edit-recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    data-testid="input-edit-recipient-email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-recipient-address">Address</Label>
                <Input
                  id="edit-recipient-address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  data-testid="input-edit-recipient-address"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-invoice-date">Invoice Date</Label>
              <Input
                id="edit-invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                data-testid="input-edit-invoice-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-edit-due-date"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Line Items</h3>
              <Button variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={item._key} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Description</Label>}
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Service description"
                      data-testid={`input-edit-item-desc-${index}`}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                      data-testid={`input-edit-item-qty-${index}`}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Unit Price</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                      data-testid={`input-edit-item-price-${index}`}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Amount</Label>}
                    <Input
                      value={`$${parseFloat(item.amount).toFixed(2)}`}
                      disabled
                      data-testid={`text-edit-item-amount-${index}`}
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">&nbsp;</Label>}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={lineItems.length <= 1}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-semibold" data-testid="text-edit-total">${grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              data-testid="input-edit-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-edit-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            data-testid="button-edit-save"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
