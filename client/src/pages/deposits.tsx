import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building, Trash2, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BankAccount, Deposit, Payment, Client, Invoice } from "@shared/schema";
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

type PaymentWithRelations = Payment & {
  client: Client;
  invoice?: Invoice;
};

type DepositWithRelations = Deposit & {
  bankAccount: BankAccount;
  payments: PaymentWithRelations[];
};

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(typeof amount === "string" ? parseFloat(amount) : amount);
}

export default function Deposits() {
  const { toast } = useToast();
  const [expandedDepositId, setExpandedDepositId] = useState<number | null>(null);
  const [viewDepositId, setViewDepositId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: deposits, isLoading } = useQuery<DepositWithRelations[]>({
    queryKey: ["/api/deposits"],
  });

  const deleteDepositMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/deposits/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/undeposited-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Deposit deleted successfully" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete deposit", variant: "destructive" });
    },
  });

  const viewDeposit = deposits?.find(d => d.id === viewDepositId);

  if (isLoading) {
    return <ListSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Deposits</h1>
          <p className="text-muted-foreground">History of bank deposits</p>
        </div>
      </div>

      {!deposits || deposits.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No deposits yet"
          description="When you deposit undeposited funds to a bank account, they will appear here."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Deposit History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {deposits.map((deposit) => (
                <div key={deposit.id} className="border rounded-lg" data-testid={`deposit-row-${deposit.id}`}>
                  <div className="flex items-center gap-4 p-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedDepositId(expandedDepositId === deposit.id ? null : deposit.id)}
                      data-testid={`button-expand-${deposit.id}`}
                    >
                      {expandedDepositId === deposit.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {deposit.depositDate && formatLocalDate(new Date(deposit.depositDate))}
                        </span>
                        <Badge variant="outline">
                          {deposit.payments?.length || 0} payment(s)
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <Building className="inline h-3 w-3 mr-1" />
                        {deposit.bankAccount?.name}
                        {deposit.memo && <span> - {deposit.memo}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold" data-testid={`text-total-${deposit.id}`}>
                        {formatCurrency(deposit.totalAmount)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewDepositId(deposit.id)}
                        data-testid={`button-view-${deposit.id}`}
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(deposit.id)}
                        data-testid={`button-delete-${deposit.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {expandedDepositId === deposit.id && deposit.payments && deposit.payments.length > 0 && (
                    <div className="border-t bg-muted/30 p-4 space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">Payments in this deposit:</div>
                      {deposit.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between text-sm py-2 px-3 bg-background rounded">
                          <div>
                            <span className="font-medium">{payment.paymentNumber}</span>
                            <span className="text-muted-foreground"> - {payment.client?.name}</span>
                            {payment.reference && <span className="text-muted-foreground"> (Ref: {payment.reference})</span>}
                          </div>
                          <div className="font-medium">{formatCurrency(payment.amount)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={viewDepositId !== null} onOpenChange={() => setViewDepositId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deposit Details</DialogTitle>
            <DialogDescription className="sr-only">View deposit details</DialogDescription>
          </DialogHeader>
          {viewDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Date</div>
                  <div className="font-medium">
                    {viewDeposit.depositDate && formatLocalDate(new Date(viewDeposit.depositDate))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Bank Account</div>
                  <div className="font-medium">{viewDeposit.bankAccount?.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="font-medium text-lg">{formatCurrency(viewDeposit.totalAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payments</div>
                  <div className="font-medium">{viewDeposit.payments?.length || 0} payment(s)</div>
                </div>
              </div>

              {viewDeposit.memo && (
                <div>
                  <div className="text-sm text-muted-foreground">Memo</div>
                  <div>{viewDeposit.memo}</div>
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground mb-2">Included Payments</div>
                <div className="border rounded-lg divide-y">
                  {viewDeposit.payments?.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3">
                      <div>
                        <div className="font-medium">{payment.paymentNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.client?.name}
                          <Badge variant="outline" className="ml-2">{payment.paymentMethod}</Badge>
                        </div>
                      </div>
                      <div className="font-medium">{formatCurrency(payment.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the deposit record and move the associated payments back to undeposited funds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteDepositMutation.mutate(deleteId)}
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
