import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, LIST_PAGE_REFETCH_INTERVAL_MS } from "@/lib/queryClient";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowLeft, Check, X, AlertTriangle, CheckCircle, Loader2, DollarSign, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { formatDateForInput, parseLocalDateFromISO } from "@/lib/dateUtils";
import type { BankAccount, BankTransaction, BankReconciliation } from "@shared/schema";

function safeFormatDate(dateValue: string | Date | null | undefined, formatStr: string): string {
  if (!dateValue) return "N/A";
  try {
    const date = dateValue instanceof Date ? dateValue : parseLocalDateFromISO(dateValue);
    if (!date || isNaN(date.getTime())) return "N/A";
    return format(date, formatStr);
  } catch {
    return "N/A";
  }
}

type TransactionWithRelations = BankTransaction & {
  vendor?: { company: string } | null;
  account?: { name: string } | null;
  linkedExpenseId?: number | null;
  linkedBillPaymentId?: number | null;
  linkedBillId?: number | null;
  linkedDepositId?: number | null;
};

const INCOMING_TYPES = ["deposit", "refund"];

function getLinkedRoute(transaction: TransactionWithRelations): string | null {
  if (transaction.linkedExpenseId) {
    return `/expenses?highlight=${transaction.linkedExpenseId}`;
  }
  if (transaction.linkedBillId) {
    return `/bills/${transaction.linkedBillId}`;
  }
  if (transaction.linkedBillPaymentId && transaction.linkedBillId) {
    return `/bills/${transaction.linkedBillId}`;
  }
  if (transaction.linkedDepositId) {
    return `/deposits?highlight=${transaction.linkedDepositId}`;
  }
  return null;
}

function getLinkedLabel(transaction: TransactionWithRelations): string {
  if (transaction.linkedExpenseId) return "View Expense";
  if (transaction.linkedBillId) return "View Bill";
  if (transaction.linkedBillPaymentId) return "View Bill Payment";
  if (transaction.linkedDepositId) return "View Deposit";
  return "No linked record";
}

interface TransactionColumnProps {
  title: string;
  transactions: TransactionWithRelations[];
  selectedTransactions: Set<number>;
  onToggleCleared: (id: number) => void;
  onNavigate: (path: string) => void;
  isCleared: boolean;
}

function TransactionColumn({ title, transactions, selectedTransactions, onToggleCleared, onNavigate, isCleared }: TransactionColumnProps) {
  const subtotal = transactions.reduce((sum, t) => {
    return sum + parseFloat(t.amount || "0");
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 px-1">
        <h4 className="font-semibold text-sm" data-testid={`text-column-title-${isCleared ? "cleared" : "uncleared"}-${title.includes("Checks") ? "outgoing" : "incoming"}`}>
          {title} ({transactions.length})
        </h4>
      </div>
      <div className="border rounded-lg flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Check className="h-3 w-3" />
              </TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Payee</TableHead>
              <TableHead className="text-right text-xs">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">
                  No transactions
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => {
                const linkedRoute = getLinkedRoute(transaction);
                const hasLink = !!linkedRoute;
                return (
                  <TooltipProvider key={transaction.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TableRow
                          className={`${isCleared ? "bg-muted/30" : ""} ${hasLink ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}
                          data-testid={`transaction-row-${isCleared ? "cleared" : "uncleared"}-${transaction.id}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('button') || target.closest('[role="checkbox"]') || target.tagName === 'INPUT') return;
                            if (linkedRoute) {
                              onNavigate(linkedRoute);
                            }
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedTransactions.has(transaction.id)}
                              onCheckedChange={() => onToggleCleared(transaction.id)}
                              data-testid={`checkbox-${isCleared ? "unclear" : "clear"}-${transaction.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {safeFormatDate(transaction.transactionDate, "MM/dd")}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[120px]">
                            <div className="flex items-center gap-1">
                              <span className="truncate">{transaction.payee || transaction.vendor?.company || "-"}</span>
                              {hasLink && <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            ${parseFloat(transaction.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="text-xs space-y-1">
                          <p className="font-semibold">{transaction.payee || transaction.vendor?.company || "Unknown"}</p>
                          {transaction.description && <p>{transaction.description}</p>}
                          <p className="text-muted-foreground">{getLinkedLabel(transaction)}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center mt-2 px-2 py-1 bg-muted/50 rounded text-sm font-medium">
        <span data-testid={`text-subtotal-label-${isCleared ? "cleared" : "uncleared"}-${title.includes("Checks") ? "outgoing" : "incoming"}`}>
          {transactions.length} item{transactions.length !== 1 ? "s" : ""}
        </span>
        <span data-testid={`text-subtotal-${isCleared ? "cleared" : "uncleared"}-${title.includes("Checks") ? "outgoing" : "incoming"}`}>
          ${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export default function BankReconciliationPage() {
  const params = useParams<{ id: string }>();
  const accountId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [statementDate, setStatementDate] = useState(formatDateForInput(new Date()));
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
    queryKey: ["/api/bank-accounts", accountId, "transactions", { excludeReconciled: isReconciling }],
    refetchInterval: LIST_PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const url = isReconciling
        ? `/api/bank-accounts/${accountId}/transactions?excludeReconciled=true`
        : `/api/bank-accounts/${accountId}/transactions`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: accountId > 0,
  });

  const { data: reconciliations, isLoading: isLoadingReconciliations } = useQuery<BankReconciliation[]>({
    queryKey: ["/api/bank-accounts", accountId, "reconciliations"],
    enabled: accountId > 0,
    refetchInterval: LIST_PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: "always",
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
          setLocation("/auth");
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
          setLocation("/auth");
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
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts", accountId] });
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
          setLocation("/auth");
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
    const parsedDate = new Date(statementDate + 'T12:00:00');
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
    const previousSelected = new Set(selectedTransactions);
    const newSelected = new Set(selectedTransactions);
    const isNowCleared = !newSelected.has(transactionId);
    
    if (isNowCleared) {
      newSelected.add(transactionId);
    } else {
      newSelected.delete(transactionId);
    }
    setSelectedTransactions(newSelected);
    updateTransactionMutation.mutate(
      { id: transactionId, isCleared: isNowCleared },
      {
        onError: () => {
          setSelectedTransactions(previousSelected);
        },
      }
    );
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
  const isCreditCard = bankAccount?.accountType === "credit_card";

  const clearedBalance = transactions?.reduce((sum, t) => {
    if (selectedTransactions.has(t.id)) {
      const amount = parseFloat(t.amount || "0");
      if (t.transactionType === "deposit" || t.transactionType === "refund") {
        return isCreditCard ? sum - amount : sum + amount;
      } else if (t.transactionType === "withdrawal" || t.transactionType === "transfer" || t.transactionType === "check" || t.transactionType === "payment") {
        return isCreditCard ? sum + amount : sum - amount;
      }
    }
    return sum;
  }, openingBalance) ?? openingBalance;

  const statementBalance = parseFloat(statementEndingBalance || "0");
  const rawDifference = (statementBalance - clearedBalance).toFixed(2);
  const difference = rawDifference === "-0.00" ? "0.00" : rawDifference;

  const unclearedTransactions = transactions?.filter(t => !selectedTransactions.has(t.id)) || [];
  const clearedTransactionsList = transactions?.filter(t => selectedTransactions.has(t.id)) || [];

  const unclearedOutgoing = unclearedTransactions.filter(t => !INCOMING_TYPES.includes(t.transactionType));
  const unclearedIncoming = unclearedTransactions.filter(t => INCOMING_TYPES.includes(t.transactionType));
  const clearedOutgoing = clearedTransactionsList.filter(t => !INCOMING_TYPES.includes(t.transactionType));
  const clearedIncoming = clearedTransactionsList.filter(t => INCOMING_TYPES.includes(t.transactionType));

  const clearedChecksAndPaymentsTotal = clearedOutgoing.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const clearedDepositsAndCreditsTotal = clearedIncoming.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

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
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      data-testid={`reconciliation-item-${rec.id}`}
                      onClick={() => {
                        if (rec.status === "completed") {
                          setLocation(`/reconciliation-detail/${rec.id}`);
                        } else {
                          setActiveReconciliation(rec);
                          setStatementDate(formatDateForInput(new Date(rec.statementDate)));
                          setStatementEndingBalance(rec.statementEndingBalance);
                          setNotes(rec.notes || "");
                          setIsReconciling(true);
                          initializeSelectedTransactions();
                        }
                      }}
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
                <p className="text-sm text-muted-foreground">{isCreditCard ? "Cleared Charges" : "Cleared Checks/Payments"}</p>
                <p className={`text-2xl font-bold ${isCreditCard ? "text-green-600" : "text-red-600"}`} data-testid="text-cleared-checks-payments">
                  {isCreditCard ? "+" : "-"}${clearedChecksAndPaymentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{isCreditCard ? "Cleared Payments/Credits" : "Cleared Deposits/Credits"}</p>
                <p className={`text-2xl font-bold ${isCreditCard ? "text-red-600" : "text-green-600"}`} data-testid="text-cleared-deposits-credits">
                  {isCreditCard ? "-" : "+"}${clearedDepositsAndCreditsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
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

          <Card>
            <CardHeader>
              <CardTitle>Uncleared Transactions ({unclearedTransactions.length})</CardTitle>
              <CardDescription>Check transactions that appear on your bank statement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TransactionColumn
                  title={isCreditCard ? "Charges" : "Checks and Payments"}
                  transactions={unclearedOutgoing}
                  selectedTransactions={selectedTransactions}
                  onToggleCleared={handleToggleCleared}
                  onNavigate={setLocation}
                  isCleared={false}
                />
                <TransactionColumn
                  title={isCreditCard ? "Payments and Credits" : "Deposits and Other Credits"}
                  transactions={unclearedIncoming}
                  selectedTransactions={selectedTransactions}
                  onToggleCleared={handleToggleCleared}
                  onNavigate={setLocation}
                  isCleared={false}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cleared Transactions ({clearedTransactionsList.length})</CardTitle>
              <CardDescription>Transactions that have been marked as cleared</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TransactionColumn
                  title={isCreditCard ? "Charges" : "Checks and Payments"}
                  transactions={clearedOutgoing}
                  selectedTransactions={selectedTransactions}
                  onToggleCleared={handleToggleCleared}
                  onNavigate={setLocation}
                  isCleared={true}
                />
                <TransactionColumn
                  title={isCreditCard ? "Payments and Credits" : "Deposits and Other Credits"}
                  transactions={clearedIncoming}
                  selectedTransactions={selectedTransactions}
                  onToggleCleared={handleToggleCleared}
                  onNavigate={setLocation}
                  isCleared={true}
                />
              </div>
            </CardContent>
          </Card>

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
              <span className="text-muted-foreground">{isCreditCard ? "Cleared Charges:" : "Cleared Checks/Payments:"}</span>
              <span className={`font-medium ${isCreditCard ? "text-green-600" : "text-red-600"}`}>{clearedOutgoing.length} ({isCreditCard ? "+" : "-"}${clearedChecksAndPaymentsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{isCreditCard ? "Cleared Payments/Credits:" : "Cleared Deposits/Credits:"}</span>
              <span className={`font-medium ${isCreditCard ? "text-red-600" : "text-green-600"}`}>{clearedIncoming.length} ({isCreditCard ? "-" : "+"}${clearedDepositsAndCreditsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
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
