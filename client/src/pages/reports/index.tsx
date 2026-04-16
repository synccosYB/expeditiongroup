import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3,
  Scale,
  ListChecks,
  BookOpen,
  Waves,
  HandCoins,
  CreditCard,
} from "lucide-react";

const reports = [
  {
    href: "/reports/profit-loss",
    title: "Profit & Loss",
    description: "Income statement showing revenue, expenses, and net income for a period.",
    icon: BarChart3,
    testId: "link-report-profit-loss",
  },
  {
    href: "/reports/balance-sheet",
    title: "Balance Sheet",
    description: "Snapshot of assets, liabilities, and equity as of a given date.",
    icon: Scale,
    testId: "link-report-balance-sheet",
  },
  {
    href: "/reports/trial-balance",
    title: "Trial Balance",
    description: "Debit and credit totals for every account; debits should equal credits.",
    icon: ListChecks,
    testId: "link-report-trial-balance",
  },
  {
    href: "/reports/general-ledger",
    title: "General Ledger",
    description: "Per-account transaction detail with running balance.",
    icon: BookOpen,
    testId: "link-report-general-ledger",
  },
  {
    href: "/reports/cash-flow",
    title: "Cash Flow Statement",
    description: "Operating, investing, and financing cash movements for a period.",
    icon: Waves,
    testId: "link-report-cash-flow",
  },
  {
    href: "/reports/ar-aging",
    title: "A/R Aging",
    description: "Outstanding customer invoices bucketed by age.",
    icon: HandCoins,
    testId: "link-report-ar-aging",
  },
  {
    href: "/reports/ap-aging",
    title: "A/P Aging",
    description: "Outstanding vendor bills bucketed by age.",
    icon: CreditCard,
    testId: "link-report-ap-aging",
  },
];

export default function ReportsLanding() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          Financial Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Standard accounting reports computed from your bookkeeping data.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href} data-testid={r.testId}>
              <Card className="hover-elevate cursor-pointer h-full">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold">{r.title}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
