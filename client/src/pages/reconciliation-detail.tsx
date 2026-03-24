import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";
import type { BankReconciliation, BankTransaction } from "@shared/schema";

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

const OUTGOING_TYPES = ["check", "payment", "expense", "bill_payment", "transfer"];

export default function ReconciliationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: reconciliation, isLoading: isLoadingRec } = useQuery<BankReconciliation>({
    queryKey: ["/api/reconciliations", parseInt(id!)],
    enabled: !!id,
  });

  const { data: transactions, isLoading: isLoadingTxns } = useQuery<BankTransaction[]>({
    queryKey: ["/api/reconciliations", parseInt(id!), "transactions"],
    enabled: !!id,
  });

  const { data: allReconciliations } = useQuery<BankReconciliation[]>({
    queryKey: ["/api/bank-accounts", reconciliation?.bankAccountId, "reconciliations"],
    enabled: !!reconciliation?.bankAccountId,
  });

  const openingBalance = (() => {
    if (!allReconciliations || !reconciliation) return "0";
    const completed = allReconciliations
      .filter((r) => r.status === "completed" && r.id !== reconciliation.id)
      .sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());
    const previous = completed.find(
      (r) => new Date(r.statementDate).getTime() < new Date(reconciliation.statementDate).getTime()
    );
    if (previous) return previous.statementEndingBalance;
    const statementEnding = parseFloat(reconciliation.statementEndingBalance);
    const txnTotal = (transactions || []).reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
    return (statementEnding - txnTotal).toFixed(2);
  })();

  if (isLoadingRec || isLoadingTxns) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-reconciliation-detail">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!reconciliation) {
    return (
      <div className="p-6" data-testid="reconciliation-not-found">
        <p className="text-muted-foreground">Reconciliation not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => window.history.back()} data-testid="button-back-not-found">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  const checksAndPayments = (transactions || []).filter(
    (t) => OUTGOING_TYPES.includes(t.transactionType) || parseFloat(t.amount || "0") < 0
  );
  const depositsAndCredits = (transactions || []).filter(
    (t) => !OUTGOING_TYPES.includes(t.transactionType) && parseFloat(t.amount || "0") >= 0
  );

  const checksTotal = checksAndPayments.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const depositsTotal = depositsAndCredits.reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="reconciliation-detail-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/bank-reconciliation/${reconciliation.bankAccountId}`)} data-testid="button-back-to-reconciliation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reconciliation
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reconciliation-title">
            Reconciliation Detail
          </h1>
          <p className="text-muted-foreground" data-testid="text-reconciliation-date">
            Statement Date: {safeFormatDate(reconciliation.statementDate, "MMMM d, yyyy")}
          </p>
        </div>
        <Badge variant={reconciliation.status === "completed" ? "default" : "secondary"} data-testid="badge-reconciliation-status">
          {reconciliation.status === "completed" ? (
            <>
              <CheckCircle className="mr-1 h-3 w-3" />
              Completed
            </>
          ) : (
            "In Progress"
          )}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-opening-balance">
          <CardHeader className="pb-2">
            <CardDescription>Opening Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-opening-balance">
              ${parseFloat(openingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-statement-ending-balance">
          <CardHeader className="pb-2">
            <CardDescription>Statement Ending Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-statement-ending-balance">
              ${parseFloat(reconciliation.statementEndingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-cleared-balance">
          <CardHeader className="pb-2">
            <CardDescription>Cleared Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-cleared-balance">
              ${parseFloat(reconciliation.clearedBalance || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-difference">
          <CardHeader className="pb-2">
            <CardDescription>Difference</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-difference">
              ${parseFloat(reconciliation.difference || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        {reconciliation.completedAt && (
          <Card data-testid="card-completed-at">
            <CardHeader className="pb-2">
              <CardDescription>Completed On</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-completed-at">
                {safeFormatDate(reconciliation.completedAt, "MMM d, yyyy")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-checks-and-payments">
          <CardHeader>
            <CardTitle className="text-base">Checks and Payments ({checksAndPayments.length})</CardTitle>
            <CardDescription>
              Total: ${Math.abs(checksTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checksAndPayments.length > 0 ? (
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payee / Description</TableHead>
                      <TableHead>Check #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checksAndPayments.map((txn) => (
                      <TableRow key={txn.id} data-testid={`row-check-payment-${txn.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {safeFormatDate(txn.transactionDate, "MM/dd/yyyy")}
                        </TableCell>
                        <TableCell>{txn.payee || txn.description || "—"}</TableCell>
                        <TableCell>{txn.checkNumber || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${Math.abs(parseFloat(txn.amount || "0")).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No checks or payments</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-deposits-and-credits">
          <CardHeader>
            <CardTitle className="text-base">Deposits and Credits ({depositsAndCredits.length})</CardTitle>
            <CardDescription>
              Total: ${depositsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {depositsAndCredits.length > 0 ? (
              <div className="border rounded-lg overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Payee / Description</TableHead>
                      <TableHead>Check #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depositsAndCredits.map((txn) => (
                      <TableRow key={txn.id} data-testid={`row-deposit-credit-${txn.id}`}>
                        <TableCell className="whitespace-nowrap">
                          {safeFormatDate(txn.transactionDate, "MM/dd/yyyy")}
                        </TableCell>
                        <TableCell>{txn.payee || txn.description || "—"}</TableCell>
                        <TableCell>{txn.checkNumber || "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          ${parseFloat(txn.amount || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No deposits or credits</p>
            )}
          </CardContent>
        </Card>
      </div>

      {reconciliation.notes && (
        <Card data-testid="card-reconciliation-notes">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap" data-testid="text-reconciliation-notes">{reconciliation.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}