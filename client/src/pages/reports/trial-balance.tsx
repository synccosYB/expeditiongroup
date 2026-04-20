import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReportShell,
  AsOfControls,
  formatCurrency,
  reportTableClass,
  downloadCSV,
  exportPDF,
  todayStr,
} from "@/components/report-shell";

interface TBRow {
  accountId: number;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}
interface TBData {
  asOf: string;
  rows: TBRow[];
  totals: { debit: number; credit: number };
}

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState(todayStr());
  const { data, isLoading } = useQuery<TBData>({
    queryKey: ["/api/reports/trial-balance", asOf],
    queryFn: async () => {
      const res = await fetch(`/api/reports/trial-balance?asOf=${asOf}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trial balance");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const isEmpty = !!data && data.rows.length === 0;
  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["Trial Balance", `As of ${asOf}`],
      [],
      ["Code", "Account", "Type", "Debit", "Credit"],
    ];
    data.rows.forEach((r) =>
      rows.push([r.code, r.name, r.type, r.debit.toFixed(2), r.credit.toFixed(2)]),
    );
    rows.push(["", "Totals", "", data.totals.debit.toFixed(2), data.totals.credit.toFixed(2)]);
    downloadCSV(`trial-balance-${asOf}.csv`, rows);
  };

  const exportPdf = () => {
    if (!data) return;
    const body: (string | number)[][] = data.rows.map((r) => [
      r.code,
      r.name,
      r.type,
      r.debit > 0 ? formatCurrency(r.debit) : "",
      r.credit > 0 ? formatCurrency(r.credit) : "",
    ]);
    body.push(["", "Totals", "", formatCurrency(data.totals.debit), formatCurrency(data.totals.credit)]);
    const diff2 = data.totals.debit - data.totals.credit;
    if (Math.abs(diff2) > 0.005) body.push(["", "Difference", "", formatCurrency(diff2), ""]);
    exportPDF({
      title: "Trial Balance",
      subtitle: `As of ${asOf}`,
      head: ["Code", "Account", "Type", "Debit", "Credit"],
      body,
      filename: `trial-balance-${asOf}.pdf`,
    });
  };

  const diff = data ? data.totals.debit - data.totals.credit : 0;

  return (
    <ReportShell
      title="Trial Balance"
      subtitle={data ? `As of ${asOf}` : undefined}
      isLoading={isLoading}
      isEmpty={isEmpty}
      onExport={exportCsv}
      onExportPdf={exportPdf}
      controls={<AsOfControls asOf={asOf} onChange={setAsOf} />}
    >
      {data && !isEmpty && (
        <table className={reportTableClass}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.accountId} data-testid={`row-tb-${r.accountId}`}>
                <td>{r.code}</td>
                <td>{r.name}</td>
                <td className="capitalize text-muted-foreground">{r.type}</td>
                <td className="text-right tabular-nums">
                  {r.debit > 0 ? formatCurrency(r.debit) : ""}
                </td>
                <td className="text-right tabular-nums">
                  {r.credit > 0 ? formatCurrency(r.credit) : ""}
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-primary/10 border-t-2">
              <td colSpan={3} className="p-3">Totals</td>
              <td className="p-3 text-right tabular-nums" data-testid="text-tb-total-debit">
                {formatCurrency(data.totals.debit)}
              </td>
              <td className="p-3 text-right tabular-nums" data-testid="text-tb-total-credit">
                {formatCurrency(data.totals.credit)}
              </td>
            </tr>
            {Math.abs(diff) > 0.005 && (
              <tr className="text-destructive">
                <td colSpan={3} className="p-3">Difference (Debits − Credits)</td>
                <td colSpan={2} className="p-3 text-right tabular-nums" data-testid="text-tb-difference">
                  {formatCurrency(diff)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}
