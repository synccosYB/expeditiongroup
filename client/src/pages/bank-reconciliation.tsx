import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, X, AlertTriangle, CheckCircle, Loader2, DollarSign, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { BankAccount, BankTransaction, BankReconciliation } from "@shared/schema";

function safeFormatDate(dateValue: string | Date | null | undefined, formatStr: string): string {
  if (!dateValue) return "N/A";
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (isNaN(date.getTime())) return "N/A";
    return format(date, formatStr);
  } catch {
    return "N/A";
  }
}

type TransactionWithRelations = BankTransaction & {
  vendor?: { company: string } | null;
  account?: { name: string } | null;
  linkedSource?: { type: string; id: number; billId?: number } | null;
};

const CHECKS_AND_PAYMENTS_TYPES = ["withdrawal", "check", "payment", "transfer"];
const DEPOSITS_AND_CREDITS_TYPES = ["deposit", "refund"];

function isChecksAndPayments(type: string): boolean {
  return CHECKS_AND_PAYMENTS_TYPES.includes(type);
}

function isDepositsAndCredits(type: string): boolean {
  return DEPOSITS_AND_CREDITS_TYPES.includes(type);
}

function getTransactionNavigationPath(
  transaction: TransactionWithRelations,
  bankAccountId: number
): string {
  const link = transaction.linkedSource;

  if (link) {
    switch (link.type) {
      case "expense":
        return "/expenses";
      case "bill":
        return `/bills/${link.id}`;
      case "deposit":
        return "/deposits";
      case "invoice":
        return `/invoices/${link.id}`;
    }
  }

  return `/bank-register/${bankAccountId}`;
}

export default function BankReconciliationPage() {
  const params = useParams<{ id: string }>();
  const accountId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [statementDate, setStatementDate] = useState(new Date().toISOString().split("T")[0]);
  const [statementEndingBalance, setStatementEndingBalance] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [activeReconciliation, setActiveReconciliation] = useState<BankReconciliation | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: bankAccount, isLoading: isLoadingAccount } = useQuery<BankAccount>({
    queryKey: ["/api/bank-accounts", accountId],
    enabled: accountId > 0,
  });

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<TransactionWithRelations[]>({
    queryKey: ["/api/bank-accounts", accountId, "transactions"],
    enabled: accountId > 0,
  });

  const { data: reconciliations, isLoading: isLoadingReconciliations } = useQuery<BankReconciliation[]>({
    queryKey: ["/api/bank-accounts", accountId, "reconciliations"],
    enabled: accountId > 0,
  });

  const createReconciliationMutation = useMutation({
    mutationFn: async (data: { statementDate: Date; statementEndingBalance: string }) => {
      return await apiRequest("POST", `/api/bank-accounts/${accountId}/reconciliations`, {
        ...data,
        bankAccountId: accountId,
      });
    },
    onSuccess: async (response) => {
      const reconciliation = await response.json();
      setActiveReconciliation(reconciliation);
      setIsReconciling(true);
      initializeSelectedTransactions();
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "reconciliations"] });
      toast({ title: "Reconciliation started" });
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
        description: "Failed to start reconciliation",
        variant: "destructive",
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, isCleared }: { id: number; isCleared: boolean }) => {
      return await apiRequest("PATCH", `/api/bank-transactions/${id}`, { isCleared });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "transactions"] });
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

  const completeReconciliationMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/reconciliations/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId, "transactions"] });
      setIsReconciling(false);
      setActiveReconciliation(null);
      setSelectedTransactions(new Set());
      setShowConfirmDialog(false);
      toast({ title: "Reconciliation completed successfully!" });
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
        description: "Failed to complete reconciliation",
        variant: "destructive",
      });
    },
  });

  const initializeSelectedTransactions = () => {
    if (transactions) {
      const clearedIds = new Set<number>();
      transactions.forEach(t => {
        if (t.isCleared) {
          clearedIds.add(t.id);
        }
      });
      setSelectedTransactions(clearedIds);
    }
  };

  const handleStartReconciliation = () => {
    if (!statementDate) {
      toast({
        title: "Error",
        description: "Please enter the statement date",
        variant: "destructive",
      });
      return;
    }
    if (!statementEndingBalance) {
      toast({
        title: "Error",
        description: "Please enter the statement ending balance",
        variant: "destructive",
      });
      return;
    }
    const parsedDate = new Date(statementDate);
    if (isNaN(parsedDate.getTime())) {
      toast({
        title: "Error",
        description: "Please enter a valid statement date",
        variant: "destructive",
      });
      return;
    }
    createReconciliationMutation.mutate({
      statementDate: parsedDate,
      statementEndingBalance,
    });
  };

  const handleToggleCleared = (transactionId: number) => {
    const newSelected = new Set(selectedTransactions);
    const isNowCleared = !newSelected.has(transactionId);
    
    if (isNowCleared) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactions(newSelected);
    updateTransactionMutation.mutate({ id: transactionId, isCleared: isNowCleared });
  };

  const handleTransactionClick = (transaction: TransactionWithRelations) => {
    const path = getTransactionNavigationPath(transaction, accountId);
    setLocation(path);
  };

  const handleCancelReconciliation = () => {
    setIsReconciling(false);
    setActiveReconciliation(null);
    setSelectedTransactions(new Set());
    setStatementEndingBalance("");
    toast({ title: "Reconciliation cancelled" });
  };

  const handleCompleteReconciliation = () => {
    if (activeReconciliation && difference === "0.00") {
      setShowConfirmDialog(true);
    } else {
      toast({
        title: "Cannot complete reconciliation",
        description: "The difference must be zero to complete the reconciliation",
        variant: "destructive",
      });
    }
  };

  const confirmComplete = () => {
    if (activeReconciliation) {
      completeReconciliationMutation.mutate(activeReconciliation.id);
    }
  };

  const openingBalance = parseFloat(bankAccount?.openingBalance || "0");

  const clearedBalance = transactions?.reduce((sum, t) => {
    if (selectedTransactions.has(t.id)) {
      const amount = parseFloat(t.amount || "0");
      if (t.transactionType === "deposit" || t.transactionType === "refund") {
        return sum + amount;
      } else if (t.transactionType === "withdrawal" || t.transactionType === "transfer" || t.transactionType === "check" || t.transactionType === "payment") {
        return sum - amount;
      }
    }
    return sum;
  }, openingBalance) || openingBalance;

  const statementBalance = parseFloat(statementEndingBalance || "0");
  const difference = (statementBalance - clearedBalance).toFixed(2);

  const checksAndPayments = transactions?.filter(t => !isDepositsAndCredits(t.transactionType)) || [];
  const depositsAndCredits = transactions?.filter(t => isDepositsAndCredits(t.transactionType)) || [];

  const clearedChecksAndPayments = checksAndPayments.filter(t => selectedTransactions.has(t.id));
  const clearedDepositsAndCredits = depositsAndCredits.filter(t => selectedTransactions.has(t.id));

  const checksAndPaymentsTotal = checksAndPayments.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const depositsAndCreditsTotal = depositsAndCredits.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  const clearedChecksAndPaymentsTotal = clearedChecksAndPayments.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const clearedDepositsAndCreditsTotal = clearedDepositsAndCredits.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  if (isLoadingAccount || isLoadingTransactions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bankAccount) {
    return (
      <div className="p-8">
        <p>Bank account not found</p>
        <Button variant="ghost" onClick={() => setLocation("/bank-accounts")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Bank Accounts
        </Button>
      </div>
    );
  }

  const renderTransactionRow = (transaction: TransactionWithRelations, columnType: "checks" | "deposits") => {
    const isCleared = selectedTransactions.has(transaction.id);
    const isDeposit = columnType === "deposits";

    return (
      <TableRow
        key={transaction.id}
        className={`${isCleared ? "bg-muted/30" : ""} group`}
        data-testid={`transaction-row-${columnType}-${transaction.id}`}
      >
        <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isCleared}
            onCheckedChange={() => handleToggleCleared(transaction.id)}
            data-testid={`checkbox-clear-${transaction.id}`}
          />
        </TableCell>
        <TableCell
          className="cursor-pointer hover:underline"
          onClick={() => handleTransactionClick(transaction)}
          data-testid={`link-transaction-${transaction.id}`}
        >
          {safeFormatDate(transaction.transactionDate, "MM/dd/yyyy")}
        </TableCell>
        <TableCell
          className="cursor-pointer"
          onClick={() => handleTransactionClick(transaction)}
        >
          <Badge variant={isDeposit ? "default" : "secondary"}>
            {transaction.transactionType}
          </Badge>
        </TableCell>
        <TableCell
          className="cursor-pointer"
          onClick={() => handleTransactionClick(transaction)}
        >
          {transaction.payee || transaction.vendor?.company || "-"}
        </TableCell>
        <TableCell
          className={`text-right font-mono cursor-pointer ${isDeposit ? "text-green-600" : "text-red-600"}`}
          onClick={() => handleTransactionClick(transaction)}
        >
          ${parseFloat(transaction.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </TableCell>
        <TableCell className="w-8">
          <ExternalLink
            className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
            onClick={() => handleTransactionClick(transaction)}
            data-testid={`icon-navigate-${transaction.id}`}
          />
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation(`/bank-register/${accountId}`)} data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Register
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Bank Reconciliation</h1>
          <p className="text-muted-foreground">{bankAccount.name}</p>
        </div>
      </div>

      {!isReconciling ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Start New Reconciliation</CardTitle>
              <CardDescription>
                Enter your bank statement details to begin reconciling transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="statement-date">Statement Date</Label>
                <Input
                  id="statement-date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  data-testid="input-statement-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ending-balance">Statement Ending Balance</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ending-balance"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={statementEndingBalance}
                    onChange={(e) => setStatementEndingBalance(e.target.value)}
                    className="pl-8"
                    data-testid="input-ending-balance"
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleStartReconciliation}
                disabled={createReconciliationMutation.isPending}
                data-testid="button-start-reconciliation"
              >
                {createReconciliationMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Start Reconciliation
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reconciliation History</CardTitle>
              <CardDescription>Previous reconciliations for this account</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingReconciliations ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : reconciliations && reconciliations.length > 0 ? (
                <div className="space-y-3">
                  {reconciliations.slice(0, 5).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`reconciliation-item-${rec.id}`}
                    >
                      <div>
                        <p className="font-medium">
                          {safeFormatDate(rec.statementDate, "MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Balance: ${parseFloat(rec.statementEndingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <Badge variant={rec.status === "completed" ? "default" : "secondary"}>
                        {rec.status === "completed" ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Completed
                          </>
                        ) : (
                          "In Progress"
                        )}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No previous reconciliations</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Opening Balance</p>
                <p className="text-2xl font-bold" data-testid="text-opening-balance">
                  ${openingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Cleared Checks/Payments</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-cleared-checks-payments">
                  -${clearedChecksAndPaymentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Cleared Deposits/Credits</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-cleared-deposits-credits">
                  +${clearedDepositsAndCreditsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Cleared Balance</p>
                <p className="text-2xl font-bold" data-testid="text-cleared-balance">
                  ${clearedBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Statement Balance</p>
                <p className="text-2xl font-bold" data-testid="text-statement-balance">
                  ${statementBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card className={difference === "0.00" ? "border-green-500" : "border-yellow-500"}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className={`text-2xl font-bold ${difference === "0.00" ? "text-green-600" : "text-yellow-600"}`} data-testid="text-difference">
                  ${Math.abs(parseFloat(difference)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-muted-foreground">
              Mark transactions as cleared to match your bank statement
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancelReconciliation} data-testid="button-cancel-reconciliation">
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleCompleteReconciliation}
                disabled={difference !== "0.00" || completeReconciliationMutation.isPending}
                data-testid="button-complete-reconciliation"
              >
                {completeReconciliationMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Complete Reconciliation
              </Button>
            </div>
          </div>

          {difference !== "0.00" && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardContent className="flex items-center gap-3 pt-6">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-yellow-800 dark:text-yellow-200">
                  The difference is ${Math.abs(parseFloat(difference)).toFixed(2)}. 
                  Continue marking transactions as cleared until the difference is $0.00.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2" data-testid="reconciliation-columns">
            <Card>
              <CardHeader>
                <CardTitle>Checks and Payments ({checksAndPayments.length})</CardTitle>
                <CardDescription>Withdrawals, checks, payments, and transfers</CardDescription>
              </CardHeader>
              <CardContent>
                {checksAndPayments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Clear</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checksAndPayments.map((transaction) =>
                        renderTransactionRow(transaction, "checks")
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No checks or payments</p>
                )}
                <div className="mt-4 pt-4 border-t space-y-2" data-testid="subtotal-checks-payments">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {checksAndPayments.length} item{checksAndPayments.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono font-medium text-red-600">
                      -${checksAndPaymentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {clearedChecksAndPayments.length} cleared
                    </span>
                    <span className="font-mono font-medium text-red-600">
                      -${clearedChecksAndPaymentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deposits and Credits ({depositsAndCredits.length})</CardTitle>
                <CardDescription>Deposits and refunds</CardDescription>
              </CardHeader>
              <CardContent>
                {depositsAndCredits.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Clear</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositsAndCredits.map((transaction) =>
                        renderTransactionRow(transaction, "deposits")
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No deposits or credits</p>
                )}
                <div className="mt-4 pt-4 border-t space-y-2" data-testid="subtotal-deposits-credits">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {depositsAndCredits.length} item{depositsAndCredits.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono font-medium text-green-600">
                      +${depositsAndCreditsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {clearedDepositsAndCredits.length} cleared
                    </span>
                    <span className="font-mono font-medium text-green-600">
                      +${clearedDepositsAndCreditsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes about this reconciliation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                data-testid="textarea-notes"
              />
            </CardContent>
          </Card>
        </>
      )}

      {showConfirmDialog && (
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Reconciliation</DialogTitle>
            <DialogDescription>
              Are you sure you want to complete this reconciliation? This will mark all selected transactions as reconciled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statement Date:</span>
              <span className="font-medium">{safeFormatDate(statementDate, "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statement Balance:</span>
              <span className="font-medium">${statementBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cleared Checks/Payments:</span>
              <span className="font-medium text-red-600">{clearedChecksAndPayments.length} (-${clearedChecksAndPaymentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cleared Deposits/Credits:</span>
              <span className="font-medium text-green-600">{clearedDepositsAndCredits.length} (+${clearedDepositsAndCreditsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button onClick={confirmComplete} disabled={completeReconciliationMutation.isPending} data-testid="button-confirm-complete">
              {completeReconciliationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
