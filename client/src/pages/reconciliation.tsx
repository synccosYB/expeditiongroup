import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Scale, ArrowRight, Landmark, CreditCard, Wallet } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";
import type { BankAccount, BankReconciliation } from "@shared/schema";

type BankAccountWithReconciliation = BankAccount & {
  lastReconciliation?: BankReconciliation | null;
};

function formatCurrency(value: string | null | undefined): string {
  const num = parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function getAccountIcon(accountType: string) {
  switch (accountType) {
    case "credit_card":
      return CreditCard;
    case "savings":
      return Wallet;
    default:
      return Landmark;
  }
}

export default function ReconciliationPage() {
  const [, setLocation] = useLocation();

  const { data: bankAccounts, isLoading } = useQuery<BankAccountWithReconciliation[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const activeAccounts = bankAccounts?.filter(a => a.isActive !== false) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Bank Reconciliation</h1>
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
        <p className="text-muted-foreground mt-1">
          Reconcile your bank accounts by comparing your records with your bank statements
        </p>
      </div>

      {activeAccounts.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No Bank Accounts"
          description="Add a bank account first to start reconciling."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeAccounts.map((account) => {
            const AccountIcon = getAccountIcon(account.accountType);
            return (
              <Card key={account.id} className="hover-elevate cursor-pointer" onClick={() => setLocation(`/bank-reconciliation/${account.id}`)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AccountIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-lg">{account.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {account.accountType.replace("_", " ")}
                    </Badge>
                  </div>
                  {account.accountNumber && (
                    <CardDescription>
                      ****{account.accountNumber.slice(-4)}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Balance</span>
                      <span className="font-medium">{formatCurrency(account.currentBalance)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Reconciled</span>
                      <span className="text-sm">
                        {account.lastReconciliation?.statementDate 
                          ? format(parseLocalDateFromISO(account.lastReconciliation.statementDate)!, "MMM d, yyyy")
                          : "Never"
                        }
                      </span>
                    </div>
                    <Button className="w-full mt-2" variant="outline" data-testid={`button-reconcile-${account.id}`}>
                      Start Reconciliation
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
