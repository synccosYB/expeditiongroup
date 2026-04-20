import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReportShell,
  DateRangeControls,
  formatCurrency,
  reportTableClass,
  downloadCSV,
  exportPDF,
  yearStartStr,
  todayStr,
} from "@/components/report-shell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface PLAccount {
  accountId: number;
  code: string;
  name: string;
  amount: number;
}

interface PLBlock {
  revenue: PLAccount[];
  totalRevenue: number;
  cogs: PLAccount[];
  totalCogs: number;
  grossProfit: number;
  operating: PLAccount[];
  uncategorizedExpense: PLAccount[];
  totalOperating: number;
  operatingIncome: number;
  otherIncome: PLAccount[];
  totalOtherIncome: number;
  otherExpense: PLAccount[];
  totalOtherExpense: number;
  netIncome: number;
}

interface PLData extends PLBlock {
  startDate: string;
  endDate: string;
  compareStartDate: string | null;
  compareEndDate: string | null;
  comparison: PLBlock | null;
  tieOut: {
    netIncome: number;
    retainedEarningsMovement: number;
    difference: number;
    balanced: boolean;
  };
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function VarianceCells({ curr, prev }: { curr: number; prev: number }) {
  const diff = curr - prev;
  const pct = pctChange(curr, prev);
  return (
    <>
      <td className="text-right tabular-nums">{formatCurrency(prev)}</td>
      <td className="text-right tabular-nums">{formatCurrency(diff)}</td>
      <td className="text-right tabular-nums">{pct === null ? "—" : `${pct.toFixed(1)}%`}</td>
    </>
  );
}

function SimpleRow({ label, amount, indent = 0, bold = false, comparison, prev, testId }: {
  label: string; amount: number; indent?: number; bold?: boolean; comparison?: boolean; prev?: number; testId?: string;
}) {
  return (
    <tr className={bold ? "font-semibold bg-muted/30" : ""}>
      <td style={{ paddingLeft: `${12 + indent * 20}px` }} className="p-3">{label}</td>
      <td className="p-3 text-right tabular-nums" data-testid={testId}>{formatCurrency(amount)}</td>
      {comparison && <VarianceCells curr={amount} prev={prev || 0} />}
    </tr>
  );
}

export default function ProfitLossPage() {
  const [start, setStart] = useState(yearStartStr());
  const [end, setEnd] = useState(todayStr());
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compStart, setCompStart] = useState(`${new Date().getFullYear() - 1}-01-01`);
  const [compEnd, setCompEnd] = useState(`${new Date().getFullYear() - 1}-12-31`);

  const compParams = compareEnabled ? `&compareStartDate=${compStart}&compareEndDate=${compEnd}` : "";

  const { data, isLoading } = useQuery<PLData>({
    queryKey: ["/api/reports/profit-loss", start, end, compareEnabled, compStart, compEnd],
    queryFn: async () => {
      const res = await fetch(`/api/reports/profit-loss?startDate=${start}&endDate=${end}${compParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch P&L");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const isEmpty = !!data && data.revenue.length === 0 && data.cogs.length === 0 && data.operating.length === 0 && data.otherIncome.length === 0 && data.otherExpense.length === 0;
  const cmp = compareEnabled ? data?.comparison || null : null;

  const findPrev = (arr: PLAccount[] | undefined, accountId: number) =>
    arr?.find((a) => a.accountId === accountId)?.amount || 0;

  const exportCsv = () => {
    if (!data) return;
    const head = ["Account", "Amount"];
    if (cmp) head.push("Prior", "Variance", "% Var");
    const rows: (string | number)[][] = [["Profit & Loss", `${start} to ${end}${cmp ? ` vs ${compStart} to ${compEnd}` : ""}`], [], head];
    const pushSection = (title: string, items: PLAccount[], prevItems?: PLAccount[]) => {
      rows.push([title]);
      items.forEach((a) => {
        const r: (string | number)[] = [`${a.code} ${a.name}`, a.amount.toFixed(2)];
        if (cmp) {
          const p = findPrev(prevItems, a.accountId);
          const v = a.amount - p;
          const pct = pctChange(a.amount, p);
          r.push(p.toFixed(2), v.toFixed(2), pct === null ? "" : `${pct.toFixed(1)}%`);
        }
        rows.push(r);
      });
    };
    pushSection("REVENUE", data.revenue, cmp?.revenue);
    rows.push(["Total Revenue", data.totalRevenue.toFixed(2)]);
    if (data.cogs.length) {
      pushSection("COGS", data.cogs, cmp?.cogs);
      rows.push(["Total COGS", data.totalCogs.toFixed(2)]);
      rows.push(["Gross Profit", data.grossProfit.toFixed(2)]);
    }
    pushSection("OPERATING EXPENSES", [...data.operating, ...data.uncategorizedExpense], cmp ? [...cmp.operating, ...cmp.uncategorizedExpense] : undefined);
    rows.push(["Total Operating", data.totalOperating.toFixed(2)]);
    rows.push(["Operating Income", data.operatingIncome.toFixed(2)]);
    if (data.otherIncome.length) pushSection("OTHER INCOME", data.otherIncome, cmp?.otherIncome);
    if (data.otherExpense.length) pushSection("OTHER EXPENSES", data.otherExpense, cmp?.otherExpense);
    rows.push(["NET INCOME", data.netIncome.toFixed(2)]);
    downloadCSV(`profit-loss-${start}-to-${end}.csv`, rows);
  };

  const exportPdf = () => {
    if (!data) return;
    const head = cmp ? ["Account", "Amount", "Prior", "Variance", "% Var"] : ["Account", "Amount"];
    const body: (string | number)[][] = [];
    const pushBody = (label: string, amount: number, prev?: number) => {
      const r: (string | number)[] = [label, formatCurrency(amount)];
      if (cmp) {
        const p = prev || 0;
        const pct = pctChange(amount, p);
        r.push(formatCurrency(p), formatCurrency(amount - p), pct === null ? "—" : `${pct.toFixed(1)}%`);
      }
      body.push(r);
    };
    body.push(["REVENUE"]);
    data.revenue.forEach((a) => pushBody(`  ${a.code} ${a.name}`, a.amount, findPrev(cmp?.revenue, a.accountId)));
    pushBody("Total Revenue", data.totalRevenue, cmp?.totalRevenue);
    if (data.cogs.length) {
      body.push(["COST OF GOODS SOLD"]);
      data.cogs.forEach((a) => pushBody(`  ${a.code} ${a.name}`, a.amount, findPrev(cmp?.cogs, a.accountId)));
      pushBody("Total COGS", data.totalCogs, cmp?.totalCogs);
      pushBody("Gross Profit", data.grossProfit, cmp?.grossProfit);
    }
    body.push(["OPERATING EXPENSES"]);
    [...data.operating, ...data.uncategorizedExpense].forEach((a) =>
      pushBody(`  ${a.code} ${a.name}`, a.amount, findPrev(cmp ? [...cmp.operating, ...cmp.uncategorizedExpense] : undefined, a.accountId)),
    );
    pushBody("Total Operating", data.totalOperating, cmp?.totalOperating);
    pushBody("Operating Income", data.operatingIncome, cmp?.operatingIncome);
    if (data.otherIncome.length) {
      body.push(["OTHER INCOME"]);
      data.otherIncome.forEach((a) => pushBody(`  ${a.code} ${a.name}`, a.amount, findPrev(cmp?.otherIncome, a.accountId)));
      pushBody("Total Other Income", data.totalOtherIncome, cmp?.totalOtherIncome);
    }
    if (data.otherExpense.length) {
      body.push(["OTHER EXPENSES"]);
      data.otherExpense.forEach((a) => pushBody(`  ${a.code} ${a.name}`, a.amount, findPrev(cmp?.otherExpense, a.accountId)));
      pushBody("Total Other Expenses", data.totalOtherExpense, cmp?.totalOtherExpense);
    }
    pushBody("NET INCOME", data.netIncome, cmp?.netIncome);
    exportPDF({
      title: "Profit & Loss",
      subtitle: `${start} to ${end}${cmp ? ` vs ${compStart} to ${compEnd}` : ""}`,
      head,
      body,
      filename: `profit-loss-${start}-to-${end}.pdf`,
    });
  };

  const renderRows = (label: string, items: PLAccount[], prevItems?: PLAccount[]) =>
    items.map((a) => (
      <SimpleRow
        key={`${label}-${a.accountId}`}
        label={`${a.code} ${a.name}`}
        amount={a.amount}
        indent={1}
        comparison={!!cmp}
        prev={findPrev(prevItems, a.accountId)}
      />
    ));

  return (
    <ReportShell
      title="Profit & Loss"
      subtitle={data ? `${start} to ${end}${cmp ? ` vs ${compStart} to ${compEnd}` : ""}` : undefined}
      isLoading={isLoading}
      isEmpty={isEmpty}
      onExport={exportCsv}
      onExportPdf={exportPdf}
      controls={
        <>
          <DateRangeControls startDate={start} endDate={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
          <div className="flex items-center gap-2 pb-1">
            <Switch
              id="compare-toggle"
              checked={compareEnabled}
              onCheckedChange={setCompareEnabled}
              data-testid="switch-compare-period"
            />
            <Label htmlFor="compare-toggle" className="text-xs cursor-pointer">Compare period</Label>
          </div>
          {compareEnabled && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Compare Start</Label>
                <Input
                  type="date"
                  value={compStart}
                  onChange={(e) => setCompStart(e.target.value)}
                  className="w-44"
                  data-testid="input-compare-start"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Compare End</Label>
                <Input
                  type="date"
                  value={compEnd}
                  onChange={(e) => setCompEnd(e.target.value)}
                  className="w-44"
                  data-testid="input-compare-end"
                />
              </div>
            </>
          )}
        </>
      }
    >
      {data && !isEmpty && (
        <table className={reportTableClass}>
          <thead>
            <tr>
              <th>Account</th>
              <th className="text-right">Amount</th>
              {cmp && (
                <>
                  <th className="text-right">Prior</th>
                  <th className="text-right">Variance</th>
                  <th className="text-right">% Var</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-muted/40 font-semibold"><td colSpan={cmp ? 5 : 2} className="p-3">Revenue</td></tr>
            {renderRows("rev", data.revenue, cmp?.revenue)}
            <SimpleRow label="Total Revenue" amount={data.totalRevenue} bold testId="text-total-revenue" comparison={!!cmp} prev={cmp?.totalRevenue} />
            {data.cogs.length > 0 && (
              <>
                <tr className="bg-muted/40 font-semibold"><td colSpan={cmp ? 5 : 2} className="p-3">Cost of Goods Sold</td></tr>
                {renderRows("cogs", data.cogs, cmp?.cogs)}
                <SimpleRow label="Total COGS" amount={data.totalCogs} bold comparison={!!cmp} prev={cmp?.totalCogs} />
                <SimpleRow label="Gross Profit" amount={data.grossProfit} bold testId="text-gross-profit" comparison={!!cmp} prev={cmp?.grossProfit} />
              </>
            )}
            <tr className="bg-muted/40 font-semibold"><td colSpan={cmp ? 5 : 2} className="p-3">Operating Expenses</td></tr>
            {renderRows("op", [...data.operating, ...data.uncategorizedExpense], cmp ? [...cmp.operating, ...cmp.uncategorizedExpense] : undefined)}
            <SimpleRow label="Total Operating Expenses" amount={data.totalOperating} bold comparison={!!cmp} prev={cmp?.totalOperating} />
            <SimpleRow label="Operating Income" amount={data.operatingIncome} bold testId="text-operating-income" comparison={!!cmp} prev={cmp?.operatingIncome} />
            {data.otherIncome.length > 0 && (
              <>
                <tr className="bg-muted/40 font-semibold"><td colSpan={cmp ? 5 : 2} className="p-3">Other Income</td></tr>
                {renderRows("oi", data.otherIncome, cmp?.otherIncome)}
                <SimpleRow label="Total Other Income" amount={data.totalOtherIncome} bold comparison={!!cmp} prev={cmp?.totalOtherIncome} />
              </>
            )}
            {data.otherExpense.length > 0 && (
              <>
                <tr className="bg-muted/40 font-semibold"><td colSpan={cmp ? 5 : 2} className="p-3">Other Expenses</td></tr>
                {renderRows("oe", data.otherExpense, cmp?.otherExpense)}
                <SimpleRow label="Total Other Expenses" amount={data.totalOtherExpense} bold comparison={!!cmp} prev={cmp?.totalOtherExpense} />
              </>
            )}
            <tr className="font-bold bg-primary/10 border-t-2">
              <td className="p-3">NET INCOME</td>
              <td className="p-3 text-right tabular-nums" data-testid="text-net-income">{formatCurrency(data.netIncome)}</td>
              {cmp && <VarianceCells curr={data.netIncome} prev={cmp.netIncome} />}
            </tr>
            {data.tieOut && (
              <tr className={data.tieOut.balanced ? "text-muted-foreground text-xs" : "text-destructive text-xs"}>
                <td className="p-3" colSpan={cmp ? 4 : 1}>
                  Retained earnings movement (period): {formatCurrency(data.tieOut.retainedEarningsMovement)}
                  {" — "}
                  {data.tieOut.balanced
                    ? "Tie-out OK (matches net income)"
                    : `Out of tie by ${formatCurrency(data.tieOut.difference)}`}
                </td>
                <td className="p-3 text-right tabular-nums" data-testid="text-tie-out-status">
                  {data.tieOut.balanced ? "✓" : "⚠"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}
