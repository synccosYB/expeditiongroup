import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReportShell,
  DateRangeControls,
  formatCurrency,
  formatDate,
  reportTableClass,
  downloadCSV,
  exportPDF,
  yearStartStr,
  todayStr,
} from "@/components/report-shell";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@shared/schema";

interface GLEntry {
  date: string;
  ref: string;
  source: string;
  memo: string;
  debit: number;
  credit: number;
  balance: number;
}
interface GLAccount {
  accountId: number;
  code: string;
  name: string;
  type: string;
  opening: number;
  entries: GLEntry[];
  totalDebit: number;
  totalCredit: number;
  closing: number;
}
interface GLData {
  startDate: string;
  endDate: string;
  accounts: GLAccount[];
}

export default function GeneralLedgerPage() {
  const [start, setStart] = useState(yearStartStr());
  const [end, setEnd] = useState(todayStr());
  const [accountId, setAccountId] = useState<string>("all");

  const { data: accounts } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const accFilter = accountId === "all" ? "" : `&accountId=${accountId}`;
  const { data, isLoading } = useQuery<GLData>({
    queryKey: ["/api/reports/general-ledger", start, end, accountId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/general-ledger?startDate=${start}&endDate=${end}${accFilter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch general ledger");
      return res.json();
    },
  });

  const isEmpty = !!data && data.accounts.length === 0;

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [["General Ledger", `${start} to ${end}`], [], ["Account", "Date", "Ref", "Source", "Memo", "Debit", "Credit", "Balance"]];
    data.accounts.forEach((acc) => {
      rows.push([`${acc.code} ${acc.name}`, "", "", "", "Opening Balance", "", "", acc.opening.toFixed(2)]);
      acc.entries.forEach((e) =>
        rows.push([
          `${acc.code} ${acc.name}`,
          new Date(e.date).toISOString().slice(0, 10),
          e.ref,
          e.source,
          e.memo,
          e.debit ? e.debit.toFixed(2) : "",
          e.credit ? e.credit.toFixed(2) : "",
          e.balance.toFixed(2),
        ]),
      );
      rows.push([`${acc.code} ${acc.name}`, "", "", "", "Closing Balance", acc.totalDebit.toFixed(2), acc.totalCredit.toFixed(2), acc.closing.toFixed(2)]);
    });
    downloadCSV(`general-ledger-${start}-to-${end}.csv`, rows);
  };

  const exportPdf = () => {
    if (!data) return;
    const body: (string | number)[][] = [];
    data.accounts.forEach((acc) => {
      body.push([`${acc.code} ${acc.name}`, "", "", "", "", "", ""]);
      body.push(["", "", "", "Opening Balance", "", "", formatCurrency(acc.opening)]);
      acc.entries.forEach((e) =>
        body.push([
          new Date(e.date).toLocaleDateString(),
          e.ref,
          e.source.replace(/_/g, " "),
          e.memo.length > 40 ? e.memo.slice(0, 37) + "..." : e.memo,
          e.debit ? formatCurrency(e.debit) : "",
          e.credit ? formatCurrency(e.credit) : "",
          formatCurrency(e.balance),
        ]),
      );
      body.push(["", "", "", "Closing Balance", formatCurrency(acc.totalDebit), formatCurrency(acc.totalCredit), formatCurrency(acc.closing)]);
      body.push(["", "", "", "", "", "", ""]);
    });
    exportPDF({
      title: "General Ledger",
      subtitle: `${start} to ${end}`,
      head: ["Date", "Ref", "Source", "Memo", "Debit", "Credit", "Balance"],
      body,
      filename: `general-ledger-${start}-to-${end}.pdf`,
    });
  };

  return (
    <ReportShell
      title="General Ledger"
      subtitle={data ? `${start} to ${end}` : undefined}
      isLoading={isLoading}
      isEmpty={isEmpty}
      onExport={exportCsv}
      onExportPdf={exportPdf}
      controls={
        <>
          <DateRangeControls startDate={start} endDate={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
          <div className="space-y-1">
            <Label className="text-xs">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-64" data-testid="select-account-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts?.filter((a) => a.isActive !== false).sort((a, b) => a.code.localeCompare(b.code)).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.code} - {a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      }
    >
      {data && !isEmpty && (
        <div className="divide-y">
          {data.accounts.map((acc) => (
            <div key={acc.accountId} className="p-4" data-testid={`section-account-${acc.accountId}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{acc.code} - {acc.name}</h3>
                <span className="text-xs text-muted-foreground capitalize">{acc.type}</span>
              </div>
              <table className={reportTableClass}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ref</th>
                    <th>Source</th>
                    <th>Memo</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-muted/30">
                    <td colSpan={6} className="italic">Opening balance</td>
                    <td className="text-right tabular-nums">{formatCurrency(acc.opening)}</td>
                  </tr>
                  {acc.entries.map((e, i) => (
                    <tr key={i}>
                      <td>{formatDate(e.date)}</td>
                      <td>{e.ref}</td>
                      <td className="text-xs text-muted-foreground">{e.source.replace(/_/g, " ")}</td>
                      <td className="max-w-xs truncate">{e.memo}</td>
                      <td className="text-right tabular-nums">{e.debit ? formatCurrency(e.debit) : ""}</td>
                      <td className="text-right tabular-nums">{e.credit ? formatCurrency(e.credit) : ""}</td>
                      <td className="text-right tabular-nums">{formatCurrency(e.balance)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold bg-muted/30">
                    <td colSpan={4}>Closing balance</td>
                    <td className="text-right tabular-nums">{formatCurrency(acc.totalDebit)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(acc.totalCredit)}</td>
                    <td className="text-right tabular-nums" data-testid={`text-closing-${acc.accountId}`}>{formatCurrency(acc.closing)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </ReportShell>
  );
}
