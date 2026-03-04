import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Wallet, Building, Trash2, ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Invoice, BankAccount, Payment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
] as const;

const paymentFormSchema = z.object({
  paymentDate: z.string().min(1, "Date is required"),
  clientId: z.string().min(1, "Client is required"),
  invoiceId: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  paymentMethod: z.string().default("check"),
  reference: z.string().optional(),
  memo: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

type InvoiceAllocation = {
  invoiceId: number;
  invoiceNumber: string;
  total: number;
  totalPaid: number;
  remainingBalance: number;
  allocatedAmount: string;
};

type PaymentWithRelations = Payment & {
  client: Client;
  invoice?: Invoice;
};

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(typeof amount === "string" ? parseFloat(amount) : amount);
}

export default function UndepositedFunds() {
  const { toast } = useToast();
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [depositBankAccountId, setDepositBankAccountId] = useState<string>("");
  const [depositDate, setDepositDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [useBulkAllocation, setUseBulkAllocation] = useState(false);
  const [allocations, setAllocations] = useState<InvoiceAllocation[]>([]);

  const { data: payments, isLoading: paymentsLoading } = useQuery<PaymentWithRelations[]>({
    queryKey: ["/api/payments/undeposited"],
  });

  const { data: totalData } = useQuery<{ total: number }>({
    queryKey: ["/api/payments/undeposited-total"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: invoices } = useQuery<(Invoice & { client: Client })[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: nextNumber } = useQuery<{ paymentNumber: string }>({
    queryKey: ["/api/payments/next-number"],
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      clientId: "",
      invoiceId: "",
      amount: "",
      paymentMethod: "check",
      reference: "",
      memo: "",
    },
  });

  const handlePaymentSubmit = (data: PaymentFormData) => {
    if (useBulkAllocation) {
      const activeAllocations = allocations.filter(a => parseFloat(a.allocatedAmount || "0") > 0);
      if (activeAllocations.length === 0) {
        toast({ title: "Please allocate amounts to at least one invoice", variant: "destructive" });
        return;
      }
      const totalAllocated = activeAllocations.reduce((sum, a) => sum + parseFloat(a.allocatedAmount || "0"), 0);
      if (Math.abs(totalAllocated - parseFloat(data.amount)) > 0.01) {
        toast({ 
          title: "Allocation mismatch", 
          description: `Total allocated (${formatCurrency(totalAllocated)}) doesn't match payment amount (${formatCurrency(data.amount)})`,
          variant: "destructive" 
        });
        return;
      }
      bulkPaymentMutation.mutate({ formData: data, allocations: activeAllocations });
    } else {
      createPaymentMutation.mutate(data);
    }
  };

  const handlePaymentSubmitError = (errors: any) => {
    console.error("Payment form validation errors:", errors);
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => `${field}: ${error?.message || 'Invalid'}`)
      .join(', ');
    toast({ 
      title: "Please fix the form errors", 
      description: errorMessages || "Check all required fields",
      variant: "destructive" 
    });
  };

  const invalidatePaymentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited-total"] });
    queryClient.invalidateQueries({ queryKey: ["/api/payments/next-number"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    queryClient.invalidateQueries({ queryKey: ["/api/invoice-balances"] });
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const invoiceIdValue = data.invoiceId && data.invoiceId !== "none" ? parseInt(data.invoiceId) : null;
      const response = await apiRequest("POST", "/api/payments", {
        paymentNumber: nextNumber?.paymentNumber || `PMT-${Date.now()}`,
        paymentDate: new Date(data.paymentDate).toISOString(),
        clientId: parseInt(data.clientId),
        invoiceId: invoiceIdValue,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference || null,
        memo: data.memo || null,
      });
      return response.json();
    },
    onSuccess: () => {
      invalidatePaymentQueries();
      toast({ title: "Payment recorded successfully" });
      setIsPaymentDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Payment creation error:", error);
      toast({ 
        title: "Failed to record payment", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const bulkPaymentMutation = useMutation({
    mutationFn: async ({ formData, allocations }: { formData: PaymentFormData; allocations: InvoiceAllocation[] }) => {
      const response = await apiRequest("POST", "/api/payments/bulk", {
        paymentDate: new Date(formData.paymentDate).toISOString(),
        clientId: parseInt(formData.clientId),
        totalAmount: formData.amount,
        paymentMethod: formData.paymentMethod,
        reference: formData.reference || null,
        memo: formData.memo || null,
        allocations: allocations.map(a => ({
          invoiceId: a.invoiceId,
          amount: a.allocatedAmount,
        })),
      });
      return response.json();
    },
    onSuccess: () => {
      invalidatePaymentQueries();
      toast({ title: "Bulk payment recorded successfully" });
      setIsPaymentDialogOpen(false);
      setUseBulkAllocation(false);
      setAllocations([]);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Bulk payment creation error:", error);
      toast({ 
        title: "Failed to record bulk payment", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoice-balances"] });
      toast({ title: "Payment deleted successfully" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete payment", variant: "destructive" });
    },
  });

  const createDepositMutation = useMutation({
    mutationFn: async () => {
      const selectedPaymentData = payments?.filter(p => selectedPayments.includes(p.id)) || [];
      const totalAmount = selectedPaymentData.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      
      const response = await apiRequest("POST", "/api/deposits", {
        depositDate: new Date(depositDate + "T12:00:00").toISOString(),
        bankAccountId: parseInt(depositBankAccountId),
        totalAmount: totalAmount.toFixed(2),
        memo: `Deposit of ${selectedPayments.length} payment(s)`,
        paymentIds: selectedPayments,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Deposit created successfully" });
      setIsDepositDialogOpen(false);
      setSelectedPayments([]);
      setDepositBankAccountId("");
      setDepositDate(format(new Date(), "yyyy-MM-dd"));
    },
    onError: () => {
      toast({ title: "Failed to create deposit", variant: "destructive" });
    },
  });

  const handlePaymentToggle = (paymentId: number) => {
    setSelectedPayments(prev => 
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPayments.length === payments?.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(payments?.map(p => p.id) || []);
    }
  };

  const selectedTotal = payments
    ?.filter(p => selectedPayments.includes(p.id))
    .reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;

  const unpaidInvoices = invoices?.filter(inv => inv.status === 'sent' || inv.status === 'draft');
  const selectedClientId = form.watch("clientId");
  const selectedInvoiceId = form.watch("invoiceId");
  const clientInvoicesRaw = unpaidInvoices?.filter(inv => inv.clientId.toString() === selectedClientId);

  const clientInvoiceIds = clientInvoicesRaw?.map(inv => inv.id).sort() || [];
  const { data: invoiceBalances, isLoading: balancesLoading } = useQuery<Record<string, { total: number; totalPaid: number; remainingBalance: number }>>({
    queryKey: ["/api/invoice-balances", selectedClientId, clientInvoiceIds.join(",")],
    queryFn: async () => {
      if (!clientInvoicesRaw || clientInvoicesRaw.length === 0) return {};
      const results: Record<string, { total: number; totalPaid: number; remainingBalance: number }> = {};
      await Promise.all(
        clientInvoicesRaw.map(async (inv) => {
          const res = await fetch(`/api/invoices/${inv.id}/balance`, { credentials: "include" });
          if (res.ok) {
            results[inv.id.toString()] = await res.json();
          }
        })
      );
      return results;
    },
    enabled: !!selectedClientId && !!clientInvoicesRaw && clientInvoicesRaw.length > 0,
  });

  const clientInvoices = clientInvoicesRaw?.filter(inv => {
    const balance = invoiceBalances?.[inv.id.toString()];
    if (balance && balance.remainingBalance <= 0) return false;
    return true;
  });

  const currentBalance = selectedInvoiceId && selectedInvoiceId !== "none" ? invoiceBalances?.[selectedInvoiceId] : null;

  if (paymentsLoading) {
    return <ListSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Undeposited Funds</h1>
          <p className="text-muted-foreground">Payments received but not yet deposited to a bank account</p>
        </div>
        <div className="flex gap-2">
          {selectedPayments.length > 0 && (
            <Button onClick={() => setIsDepositDialogOpen(true)} data-testid="button-make-deposit">
              <Building className="h-4 w-4 mr-2" />
              Deposit Selected ({selectedPayments.length})
            </Button>
          )}
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-receive-payment">
                <Plus className="h-4 w-4 mr-2" />
                Receive Payment
              </Button>
            </DialogTrigger>
            <DialogContent className={useBulkAllocation ? "max-w-2xl" : "max-w-md"}>
              <DialogHeader>
                <DialogTitle>Receive Payment</DialogTitle>
                <DialogDescription className="sr-only">Record a received payment</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handlePaymentSubmit, handlePaymentSubmitError)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-payment-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("invoiceId", "");
                            form.setValue("amount", "");
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-client">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedClientId && clientInvoices && clientInvoices.length > 1 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="bulk-allocation"
                        checked={useBulkAllocation}
                        onCheckedChange={(checked) => {
                          setUseBulkAllocation(!!checked);
                          if (checked && clientInvoices) {
                            setAllocations(clientInvoices.map(inv => {
                              const balance = invoiceBalances?.[inv.id.toString()];
                              return {
                                invoiceId: inv.id,
                                invoiceNumber: inv.invoiceNumber,
                                total: balance ? balance.total : parseFloat(inv.total),
                                totalPaid: balance ? balance.totalPaid : 0,
                                remainingBalance: balance ? balance.remainingBalance : parseFloat(inv.total),
                                allocatedAmount: "",
                              };
                            }));
                            form.setValue("invoiceId", "none");
                          } else {
                            setAllocations([]);
                          }
                        }}
                        data-testid="checkbox-bulk-allocation"
                      />
                      <label htmlFor="bulk-allocation" className="text-sm cursor-pointer">
                        Allocate across multiple invoices
                      </label>
                    </div>
                  )}

                  {selectedClientId && !useBulkAllocation && (
                    <FormField
                      control={form.control}
                      name="invoiceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apply to Invoice</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              if (value && value !== "none") {
                                const balance = invoiceBalances?.[value];
                                if (balance) {
                                  form.setValue("amount", balance.remainingBalance.toFixed(2));
                                } else {
                                  const selectedInvoice = clientInvoices?.find(inv => inv.id.toString() === value);
                                  if (selectedInvoice) {
                                    form.setValue("amount", selectedInvoice.total);
                                  }
                                }
                              } else {
                                form.setValue("amount", "");
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-invoice">
                                <SelectValue placeholder={balancesLoading ? "Loading invoices..." : "Select invoice"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">No invoice (general payment)</SelectItem>
                              {clientInvoices && clientInvoices.length > 0 ? (
                                clientInvoices.map((invoice) => {
                                  const balance = invoiceBalances?.[invoice.id.toString()];
                                  const displayAmount = balance ? balance.remainingBalance : parseFloat(invoice.total);
                                  const hasPartialPayment = balance && balance.totalPaid > 0;
                                  return (
                                    <SelectItem key={invoice.id} value={invoice.id.toString()}>
                                      {invoice.invoiceNumber} - {formatCurrency(displayAmount)}{hasPartialPayment ? " remaining" : ""}
                                    </SelectItem>
                                  );
                                })
                              ) : (
                                <SelectItem value="no-invoices" disabled>
                                  No unpaid invoices for this client
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          {currentBalance && currentBalance.totalPaid > 0 && (
                            <p className="text-xs text-muted-foreground mt-1" data-testid="text-invoice-balance">
                              Invoice total: {formatCurrency(currentBalance.total)} | Paid: {formatCurrency(currentBalance.totalPaid)} | Balance due: {formatCurrency(currentBalance.remainingBalance)}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field} 
                            data-testid="input-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {useBulkAllocation && allocations.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Invoice Allocations</label>
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left p-2 font-medium">Invoice</th>
                              <th className="text-right p-2 font-medium">Balance Due</th>
                              <th className="text-right p-2 font-medium w-32">Allocate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allocations.map((alloc, idx) => (
                              <tr key={alloc.invoiceId} className="border-t">
                                <td className="p-2">
                                  <div>{alloc.invoiceNumber}</div>
                                  {alloc.totalPaid > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {formatCurrency(alloc.totalPaid)} paid of {formatCurrency(alloc.total)}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-right font-medium">
                                  {formatCurrency(alloc.remainingBalance)}
                                </td>
                                <td className="p-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="text-right h-8"
                                    value={alloc.allocatedAmount}
                                    onChange={(e) => {
                                      const newAllocations = [...allocations];
                                      newAllocations[idx] = { ...alloc, allocatedAmount: e.target.value };
                                      setAllocations(newAllocations);
                                      const totalAllocated = newAllocations.reduce((sum, a) => sum + parseFloat(a.allocatedAmount || "0"), 0);
                                      form.setValue("amount", totalAllocated.toFixed(2));
                                    }}
                                    data-testid={`input-allocation-${alloc.invoiceId}`}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t bg-muted/30">
                              <td className="p-2 font-medium">Total Allocated</td>
                              <td className="p-2 text-right font-medium">
                                {formatCurrency(allocations.reduce((sum, a) => sum + a.remainingBalance, 0))}
                              </td>
                              <td className="p-2 text-right font-medium">
                                {formatCurrency(allocations.reduce((sum, a) => sum + parseFloat(a.allocatedAmount || "0"), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newAllocations = allocations.map(a => ({
                            ...a,
                            allocatedAmount: a.remainingBalance.toFixed(2),
                          }));
                          setAllocations(newAllocations);
                          const total = newAllocations.reduce((sum, a) => sum + parseFloat(a.allocatedAmount || "0"), 0);
                          form.setValue("amount", total.toFixed(2));
                        }}
                        data-testid="button-auto-fill-allocations"
                      >
                        Auto-fill all balances
                      </Button>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference / Check #</FormLabel>
                        <FormControl>
                          <Input placeholder="Check number or reference" {...field} data-testid="input-reference" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="memo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Memo</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional notes" {...field} data-testid="input-memo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => { setIsPaymentDialogOpen(false); setUseBulkAllocation(false); setAllocations([]); }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPaymentMutation.isPending || bulkPaymentMutation.isPending} data-testid="button-save-payment">
                      {(createPaymentMutation.isPending || bulkPaymentMutation.isPending) ? "Saving..." : "Save Payment"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Undeposited</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-undeposited-total">
            {formatCurrency(totalData?.total || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {payments?.length || 0} payment(s) pending deposit
          </p>
        </CardContent>
      </Card>

      {!payments || payments.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No undeposited payments"
          description="Payments you receive will appear here until they are deposited to a bank account."
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Payments Pending Deposit</CardTitle>
            {payments.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleSelectAll} data-testid="button-select-all">
                {selectedPayments.length === payments.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    selectedPayments.includes(payment.id) ? "bg-accent border-accent" : ""
                  }`}
                  data-testid={`payment-row-${payment.id}`}
                >
                  <Checkbox
                    checked={selectedPayments.includes(payment.id)}
                    onCheckedChange={() => handlePaymentToggle(payment.id)}
                    data-testid={`checkbox-payment-${payment.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{payment.paymentNumber}</span>
                      <Badge variant="outline">{payment.paymentMethod}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {payment.client.name}
                      {payment.invoice && (
                        <span> - Applied to {payment.invoice.invoiceNumber}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {payment.paymentDate && formatLocalDate(new Date(payment.paymentDate))}
                      {payment.reference && <span> - Ref: {payment.reference}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold" data-testid={`text-amount-${payment.id}`}>
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(payment.id)}
                    data-testid={`button-delete-${payment.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>

            {selectedPayments.length > 0 && (
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Selected: </span>
                  <span className="font-semibold">{selectedPayments.length} payment(s)</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Total: </span>
                    <span className="font-semibold">{formatCurrency(selectedTotal)}</span>
                  </div>
                  <Button onClick={() => setIsDepositDialogOpen(true)} data-testid="button-deposit-selected">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Make Deposit
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={isDepositDialogOpen} onOpenChange={(open) => {
        setIsDepositDialogOpen(open);
        if (!open) {
          setDepositBankAccountId("");
          setDepositDate(format(new Date(), "yyyy-MM-dd"));
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Deposit</DialogTitle>
            <DialogDescription className="sr-only">Create a new deposit from selected payments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Depositing {selectedPayments.length} payment(s) totaling:
              </p>
              <p className="text-2xl font-bold">{formatCurrency(selectedTotal)}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Deposit Date</label>
              <Input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                data-testid="input-deposit-date"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Deposit To Bank Account</label>
              <Select onValueChange={setDepositBankAccountId} value={depositBankAccountId}>
                <SelectTrigger data-testid="select-bank-account">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts?.filter(a => a.isActive).map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.accountType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDepositDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createDepositMutation.mutate()}
                disabled={!depositBankAccountId || !depositDate || createDepositMutation.isPending}
                data-testid="button-confirm-deposit"
              >
                {createDepositMutation.isPending ? "Depositing..." : "Confirm Deposit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this payment record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deletePaymentMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
