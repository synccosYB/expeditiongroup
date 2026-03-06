import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, Landmark } from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { format } from "date-fns";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";
import type { BankAccount, BankTransaction } from "@shared/schema";

const formatCurrency = (value: string | number | null | undefined) => {
  const num = typeof value === "number" ? value : parseFloat(value || "0");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
};

const maskNumber = (value: string | null | undefined) => {
  if (!value || value.length < 4) return value || "";
  return "****" + value.slice(-4);
};

const accountTypeLabels: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  cash: "Cash",
  other: "Other",
};

export default function BankAccountDetail() {
  const { id } = useParams<{ id: string }>();
  const accountId = id || "";

  const { data: account, isLoading } = useQuery<BankAccount>({
    queryKey: ["/api/bank-accounts", parseInt(accountId)],
    enabled: !!accountId,
  });

  const { data: transactions } = useQuery<BankTransaction[]>({
    queryKey: [`/api/bank-transactions?bankAccountId=${accountId}`],
    enabled: !!accountId,
  });

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = account?.name || "Bank Account";

    const htmlEl = document.documentElement;
    const wasDark = htmlEl.classList.contains("dark");
    if (wasDark) {
      htmlEl.classList.remove("dark");
    }

    const widgetBtn = document.querySelector(".sdx-widget-btn") as HTMLElement | null;
    const widgetOverlay = document.querySelector(".sdx-overlay") as HTMLElement | null;
    const widgetRoot = document.getElementById("synkdex-widget") as HTMLElement | null;
    if (widgetBtn) widgetBtn.style.setProperty("display", "none", "important");
    if (widgetOverlay) widgetOverlay.style.setProperty("display", "none", "important");
    if (widgetRoot) widgetRoot.style.setProperty("display", "none", "important");

    const restore = () => {
      if (wasDark) {
        htmlEl.classList.add("dark");
      }
      if (widgetBtn) widgetBtn.style.removeProperty("display");
      if (widgetOverlay) widgetOverlay.style.removeProperty("display");
      if (widgetRoot) widgetRoot.style.removeProperty("display");
      document.title = originalTitle;
    };

    window.addEventListener("afterprint", restore, { once: true });

    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Bank account not found</p>
        <Button asChild>
          <Link href="/bank-accounts">Back to Bank Accounts</Link>
        </Button>
      </div>
    );
  }

  const sortedTransactions = [...(transactions || [])]
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 20);

  const allTransactions = transactions || [];
  const totalDeposits = allTransactions
    .filter((t) => t.transactionType === "deposit")
    .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);
  const totalWithdrawals = allTransactions
    .filter((t) => t.transactionType !== "deposit")
    .reduce((sum, t) => sum + parseFloat(t.amount || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/bank-accounts" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-account-name">
              {account.name}
            </h1>
            <p className="text-sm text-muted-foreground">Bank Account</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-sm">
            {accountTypeLabels[account.accountType] || account.accountType}
          </Badge>
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bank-register/${accountId}`}>View Register</Link>
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
              <h2 className="text-lg font-semibold mb-4">Account Summary</h2>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{account.name}</p>
                {account.bankName && (
                  <p className="text-muted-foreground print:text-gray-600">{account.bankName}</p>
                )}
                {account.accountNumber && (
                  <p className="text-muted-foreground print:text-gray-600">
                    Acct: {maskNumber(account.accountNumber)}
                  </p>
                )}
                {account.routingNumber && (
                  <p className="text-muted-foreground print:text-gray-600">
                    Routing: {maskNumber(account.routingNumber)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator className="mb-8" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Account Type</p>
              <p className="font-medium">{accountTypeLabels[account.accountType] || account.accountType}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Opening Balance</p>
              <p className="font-medium">{formatCurrency(account.openingBalance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</p>
              <p className="font-medium" data-testid="text-current-balance">
                {formatCurrency(account.currentBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
              <Badge variant={account.isActive ? "default" : "secondary"} className="mt-1">
                {account.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 print:text-base">Account Statement</h3>
            <table className="w-full text-sm" data-testid="table-transactions">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Date</th>
                  <th className="text-left py-3 font-medium">Type</th>
                  <th className="text-left py-3 font-medium">Payee/Description</th>
                  <th className="text-left py-3 font-medium">Reference</th>
                  <th className="text-right py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No transactions
                    </td>
                  </tr>
                ) : (
                  sortedTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b" data-testid={`row-transaction-${txn.id}`}>
                      <td className="py-3">
                        {format(new Date(txn.transactionDate), "MM/dd/yyyy")}
                      </td>
                      <td className="py-3 capitalize">{txn.transactionType}</td>
                      <td className="py-3">
                        {txn.payee || txn.description || "-"}
                      </td>
                      <td className="py-3">{txn.reference || "-"}</td>
                      <td
                        className={`py-3 text-right font-medium ${
                          txn.transactionType === "deposit" ? "text-green-600" : ""
                        }`}
                      >
                        {formatCurrency(txn.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Total Deposits</span>
                <span className="text-green-600">{formatCurrency(totalDeposits)}</span>
              </div>
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Total Withdrawals</span>
                <span>{formatCurrency(totalWithdrawals)}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-2 text-lg font-semibold">
                <span>Current Balance</span>
                <span>{formatCurrency(account.currentBalance)}</span>
              </div>
            </div>
          </div>
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
