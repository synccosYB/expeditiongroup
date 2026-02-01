import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ArrowLeft, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { BankAccount, BankTransaction, Vendor, Account } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

const transactionFormSchema = z.object({
  transactionDate: z.string().min(1, "Date is required"),
  transactionType: z.enum(["deposit", "withdrawal", "transfer"]),
  amount: z.string().min(1, "Amount is required"),
  payee: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  vendorId: z.string().optional(),
  accountId: z.string().optional(),
  transferToBankAccountId: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

type TransactionWithRelations = BankTransaction & {
  vendor?: Vendor;
  account?: Account;
};

export default function BankRegister() {
  const { toast } = useToast();
  const [, params] = useRoute("/bank-register/:id");
  const accountId = params?.id ? parseInt(params.id) : null;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionWithRelations | null>(null);

  const { data: bankAccount, isLoading: accountLoading } = useQuery<BankAccount>({
    queryKey: ["/api/bank-accounts", accountId],
    enabled: !!accountId,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<TransactionWithRelations[]>({
    queryKey: ["/api/bank-accounts", accountId, "transactions"],
    enabled: !!accountId,
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      transactionDate: new Date().toISOString().split("T")[0],
      transactionType: "withdrawal",
      amount: "",
      payee: "",
      description: "",
      reference: "",
      vendorId: "",
      accountId: "",
      transferToBankAccountId: "",
    },
  });

  const transactionType = form.watch("transactionType");

  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const payload = {
        bankAccountId: accountId,
        transactionDate: new Date(data.transactionDate),
        transactionType: data.transactionType,
        amount: data.amount,
        payee: data.payee,
        description: data.description,
        reference: data.reference,
        vendorId: data.vendorId ? parseInt(data.vendorId) : null,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        transferToBankAccountId: data.transferToBankAccountId ? parseInt(data.transferToBankAccountId) : null,
      };
      return await apiRequest("POST", `/api/bank-accounts/${accountId}/transactions`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Transaction created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TransactionFormData }) => {
      const payload = {
        transactionDate: new Date(data.transactionDate),
        transactionType: data.transactionType,
        amount: data.amount,
        payee: data.payee,
        description: data.description,
        reference: data.reference,
        vendorId: data.vendorId ? parseInt(data.vendorId) : null,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        transferToBankAccountId: data.transferToBankAccountId ? parseInt(data.transferToBankAccountId) : null,
      };
      return await apiRequest("PATCH", `/api/bank-transactions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Transaction updated successfully" });
      setIsDialogOpen(false);
      setEditingTransaction(null);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/bank-transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Transaction deleted successfully" });
      setDeletingTransaction(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (transaction?: TransactionWithRelations) => {
    if (transaction) {
      setEditingTransaction(transaction);
      form.reset({
        transactionDate: transaction.transactionDate ? new Date(transaction.transactionDate).toISOString().split("T")[0] : "",
        transactionType: transaction.transactionType as "deposit" | "withdrawal" | "transfer",
        amount: transaction.amount || "",
        payee: transaction.payee || "",
        description: transaction.description || "",
        reference: transaction.reference || "",
        vendorId: transaction.vendorId?.toString() || "",
        accountId: transaction.accountId?.toString() || "",
        transferToBankAccountId: transaction.transferToBankAccountId?.toString() || "",
      });
    } else {
      setEditingTransaction(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: TransactionFormData) => {
    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "withdrawal":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case "transfer":
        return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const calculateRunningBalance = () => {
    if (!transactions || !bankAccount) return [];
    
    let balance = parseFloat(bankAccount.openingBalance || "0");
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime()
    );
    
    return sorted.map(t => {
      const amount = parseFloat(t.amount || "0");
      if (t.transactionType === "deposit") {
        balance += amount;
      } else if (t.transactionType === "withdrawal" || t.transactionType === "transfer") {
        balance -= amount;
      }
      return { ...t, runningBalance: balance };
    }).reverse();
  };

  const transactionsWithBalance = calculateRunningBalance();
  const activeVendors = vendors?.filter(v => v.isActive);
  const expenseAccounts = accounts?.filter(a => a.accountType === "expense" && a.isActive);
  const revenueAccounts = accounts?.filter(a => a.accountType === "revenue" && a.isActive);
  const otherBankAccounts = bankAccounts?.filter(b => b.id !== accountId && b.isActive);

  const isLoading = accountLoading || transactionsLoading;

  if (!accountId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/bank-accounts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-semibold">Bank Register</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<span className="text-4xl">📋</span>}
              title="No account selected"
              description="Please select a bank account to view its register"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/bank-accounts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold">Bank Register</h1>
            <p className="text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/bank-accounts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              {bankAccount?.name || "Bank Register"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {bankAccount?.bankName} • Balance: {formatCurrency(bankAccount?.currentBalance || "0")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/bank-reconciliation/${accountId}`}>
            <Button variant="outline" data-testid="button-reconcile">
              Reconcile
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-transaction">
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingTransaction ? "Edit Transaction" : "Add Transaction"}
                </DialogTitle>
              </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transactionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-transaction-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="transactionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-transaction-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="deposit">Deposit</SelectItem>
                            <SelectItem value="withdrawal">Withdrawal</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-transaction-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check # / Ref</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Reference"
                            {...field}
                            data-testid="input-transaction-reference"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="payee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payee</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Payee name"
                          {...field}
                          data-testid="input-transaction-payee"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {transactionType === "withdrawal" && (
                  <>
                    <FormField
                      control={form.control}
                      name="vendorId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vendor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {activeVendors?.map((vendor) => (
                                <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                  {vendor.name}
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
                      name="accountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expense Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {expenseAccounts?.map((account) => (
                                <SelectItem key={account.id} value={account.id.toString()}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                {transactionType === "deposit" && (
                  <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Revenue Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {revenueAccounts?.map((account) => (
                              <SelectItem key={account.id} value={account.id.toString()}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {transactionType === "transfer" && (
                  <FormField
                    control={form.control}
                    name="transferToBankAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transfer To</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {otherBankAccounts?.map((account) => (
                              <SelectItem key={account.id} value={account.id.toString()}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Memo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Description"
                          {...field}
                          data-testid="input-transaction-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-transaction"
                  >
                    {editingTransaction ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {!transactionsWithBalance || transactionsWithBalance.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<span className="text-4xl">📋</span>}
                title="No transactions yet"
                description="Add your first transaction to start tracking"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="text-left text-sm">
                    <th className="p-3 w-10">
                      <Checkbox />
                    </th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Ref</th>
                    <th className="p-3">Payee / Description</th>
                    <th className="p-3 text-right">Payment</th>
                    <th className="p-3 text-right">Deposit</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactionsWithBalance.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="hover:bg-muted/30"
                      data-testid={`transaction-row-${transaction.id}`}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={transaction.isCleared ?? false}
                          data-testid={`checkbox-cleared-${transaction.id}`}
                        />
                      </td>
                      <td className="p-3 text-sm">
                        {transaction.transactionDate ? format(new Date(transaction.transactionDate), "MM/dd/yy") : "-"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {getTransactionIcon(transaction.transactionType)}
                          <span className="text-sm capitalize">{transaction.transactionType}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {transaction.reference || "-"}
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-sm">{transaction.payee || transaction.description || "-"}</p>
                        {transaction.payee && transaction.description && (
                          <p className="text-xs text-muted-foreground">{transaction.description}</p>
                        )}
                      </td>
                      <td className="p-3 text-right text-sm">
                        {transaction.transactionType === "withdrawal" || transaction.transactionType === "transfer"
                          ? formatCurrency(transaction.amount)
                          : "-"}
                      </td>
                      <td className="p-3 text-right text-sm">
                        {transaction.transactionType === "deposit"
                          ? formatCurrency(transaction.amount)
                          : "-"}
                      </td>
                      <td className="p-3 text-right font-medium text-sm">
                        {formatCurrency(transaction.runningBalance?.toString() || "0")}
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(transaction)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingTransaction(transaction)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTransaction && deleteMutation.mutate(deletingTransaction.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
