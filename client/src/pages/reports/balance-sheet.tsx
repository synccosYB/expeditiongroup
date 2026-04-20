import React, { useState } from "react";
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

interface BSItem {
  accountId: number;
  code: string;
  name: string;
  subtype: string | null;
  balance: number;
}
interface BSGroup {
  subtype: string;
  items: BSItem[];
  subtotal: number;
}
interface BSSection {
  label: string;
  groups: BSGroup[];
  total: number;
}
interface BSData {
  asOf: string;
  sections: { assets: BSSection; liabilities: BSSection; equity: BSSection };
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    liabilitiesPlusEquity: number;
    difference: number;
  };
  netIncome: number;
}

function subtypeLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(todayStr());
  const { data, isLoading } = useQuery<BSData>({
    queryKey: ["/api/reports/balance-sheet", asOf],
    queryFn: async () => {
      const res = await fetch(`/api/reports/balance-sheet?asOf=${asOf}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch balance sheet");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const isEmpty =
    !!data &&
    data.sections.assets.groups.length === 0 &&
    data.sections.liabilities.groups.length === 0 &&
    data.sections.equity.groups.length === 1 &&
    data.sections.equity.groups[0].subtotal === 0;

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [["Balance Sheet", `As of ${asOf}`], [], ["Account", "Balance"]];
    (["assets", "liabilities", "equity"] as const).forEach((k) => {
      rows.push([data.sections[k].label.toUpperCase()]);
      data.sections[k].groups.forEach((g) => {
        rows.push([subtypeLabel(g.subtype)]);
        g.items.forEach((i) => rows.push([`  ${i.code} ${i.name}`, i.balance.toFixed(2)]));
        rows.push([`Total ${subtypeLabel(g.subtype)}`, g.subtotal.toFixed(2)]);
      });
      rows.push([`Total ${data.sections[k].label}`, data.sections[k].total.toFixed(2)]);
      rows.push([]);
    });
    rows.push(["Total Liabilities + Equity", data.totals.liabilitiesPlusEquity.toFixed(2)]);
    rows.push(["Assets - (Liab + Eq) Difference", data.totals.difference.toFixed(2)]);
    downloadCSV(`balance-sheet-${asOf}.csv`, rows);
  };

  const exportPdf = () => {
    if (!data) return;
    const body: (string | number)[][] = [];
    (["assets", "liabilities", "equity"] as const).forEach((k) => {
      body.push([data.sections[k].label.toUpperCase(), ""]);
      data.sections[k].groups.forEach((g) => {
        if (g.items.length > 1) body.push([subtypeLabel(g.subtype), ""]);
        g.items.forEach((i) =>
          body.push([`  ${i.code ? i.code + " " : ""}${i.name}`, formatCurrency(i.balance)]),
        );
        if (g.items.length > 1) body.push([`  Total ${subtypeLabel(g.subtype)}`, formatCurrency(g.subtotal)]);
      });
      body.push([`Total ${data.sections[k].label}`, formatCurrency(data.sections[k].total)]);
    });
    body.push(["Total Liabilities + Equity", formatCurrency(data.totals.liabilitiesPlusEquity)]);
    if (Math.abs(data.totals.difference) > 0.005) {
      body.push(["Out of balance", formatCurrency(data.totals.difference)]);
    }
    exportPDF({
      title: "Balance Sheet",
      subtitle: `As of ${asOf}`,
      head: ["Account", "Balance"],
      body,
      filename: `balance-sheet-${asOf}.pdf`,
    });
  };

  const renderSection = (s: BSSection, key: string) => (
    <>
      <tr className="bg-muted/40 font-semibold">
        <td colSpan={2} className="p-3">{s.label}</td>
      </tr>
      {s.groups.map((g) => (
        <React.Fragment key={`${key}-${g.subtype}`}>
          {g.items.length > 1 && (
            <tr><td colSpan={2} className="p-3 italic text-sm text-muted-foreground">{subtypeLabel(g.subtype)}</td></tr>
          )}
          {g.items.map((i) => (
            <tr key={i.accountId}>
              <td className="p-3 pl-8">{i.code ? `${i.code} ` : ""}{i.name}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(i.balance)}</td>
            </tr>
          ))}
          {g.items.length > 1 && (
            <tr className="font-medium">
              <td className="p-3 pl-6">Total {subtypeLabel(g.subtype)}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(g.subtotal)}</td>
            </tr>
          )}
        </React.Fragment>
      ))}
      <tr className="font-semibold bg-muted/30">
        <td className="p-3">Total {s.label}</td>
        <td className="p-3 text-right tabular-nums" data-testid={`text-total-${key}`}>
          {formatCurrency(s.total)}
        </td>
      </tr>
    </>
  );

  return (
    <ReportShell
      title="Balance Sheet"
      subtitle={data ? `As of ${asOf}` : undefined}
      isLoading={isLoading}
      isEmpty={isEmpty}
      onExport={exportCsv}
      onExportPdf={exportPdf}
      controls={<AsOfControls asOf={asOf} onChange={setAsOf} />}
    >
      {data && !isEmpty && (
        <>
          <table className={reportTableClass}>
            <thead>
              <tr>
                <th>Account</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {renderSection(data.sections.assets, "assets")}
              {renderSection(data.sections.liabilities, "liabilities")}
              {renderSection(data.sections.equity, "equity")}
              <tr className="font-bold bg-primary/10 border-t-2">
                <td className="p-3">Total Liabilities + Equity</td>
                <td className="p-3 text-right tabular-nums" data-testid="text-total-liab-equity">
                  {formatCurrency(data.totals.liabilitiesPlusEquity)}
                </td>
              </tr>
              {Math.abs(data.totals.difference) > 0.005 && (
                <tr className="text-destructive">
                  <td className="p-3">Out of balance (Assets − Liab+Eq)</td>
                  <td className="p-3 text-right tabular-nums" data-testid="text-bs-difference">
                    {formatCurrency(data.totals.difference)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </ReportShell>
  );
}
