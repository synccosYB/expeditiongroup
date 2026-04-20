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

interface CFItem { label: string; amount: number }
interface CFData {
  startDate: string;
  endDate: string;
  netIncome: number;
  operating: { netIncome: number; adjustments: CFItem[]; total: number };
  investing: { items: CFItem[]; total: number };
  financing: { items: CFItem[]; total: number };
  beginningCash: number;
  endingCash: number;
  netChange: number;
  reconciliation: number;
}

function Row({ label, amount, indent = 0, bold = false, testId }: { label: string; amount: number; indent?: number; bold?: boolean; testId?: string }) {
  return (
    <tr className={bold ? "font-semibold bg-muted/30" : ""}>
      <td style={{ paddingLeft: `${12 + indent * 20}px` }} className="p-3">{label}</td>
      <td className="p-3 text-right tabular-nums" data-testid={testId}>{formatCurrency(amount)}</td>
    </tr>
  );
}

export default function CashFlowPage() {
  const [start, setStart] = useState(yearStartStr());
  const [end, setEnd] = useState(todayStr());

  const { data, isLoading } = useQuery<CFData>({
    queryKey: ["/api/reports/cash-flow", start, end],
    queryFn: async () => {
      const res = await fetch(`/api/reports/cash-flow?startDate=${start}&endDate=${end}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cash flow");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const isEmpty = !!data && data.netIncome === 0 && data.operating.total === 0 && data.investing.total === 0 && data.financing.total === 0 && data.beginningCash === 0 && data.endingCash === 0;

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [["Cash Flow Statement", `${start} to ${end}`], [], ["", "Amount"]];
    rows.push(["OPERATING ACTIVITIES"]);
    rows.push(["Net Income", data.netIncome.toFixed(2)]);
    data.operating.adjustments.forEach((a) => rows.push([a.label, a.amount.toFixed(2)]));
    rows.push(["Net Cash from Operating", data.operating.total.toFixed(2)]);
    rows.push(["INVESTING ACTIVITIES"]);
    data.investing.items.forEach((a) => rows.push([a.label, a.amount.toFixed(2)]));
    rows.push(["Net Cash from Investing", data.investing.total.toFixed(2)]);
    rows.push(["FINANCING ACTIVITIES"]);
    data.financing.items.forEach((a) => rows.push([a.label, a.amount.toFixed(2)]));
    rows.push(["Net Cash from Financing", data.financing.total.toFixed(2)]);
    rows.push(["Net Change in Cash", data.netChange.toFixed(2)]);
    rows.push(["Beginning Cash", data.beginningCash.toFixed(2)]);
    rows.push(["Ending Cash", data.endingCash.toFixed(2)]);
    downloadCSV(`cash-flow-${start}-to-${end}.csv`, rows);
  };

  const exportPdf = () => {
    if (!data) return;
    const body: (string | number)[][] = [];
    body.push(["OPERATING ACTIVITIES", ""]);
    body.push(["  Net Income", formatCurrency(data.netIncome)]);
    data.operating.adjustments.forEach((a) => body.push([`  ${a.label}`, formatCurrency(a.amount)]));
    body.push(["Net Cash from Operating", formatCurrency(data.operating.total)]);
    body.push(["INVESTING ACTIVITIES", ""]);
    data.investing.items.forEach((a) => body.push([`  ${a.label}`, formatCurrency(a.amount)]));
    body.push(["Net Cash from Investing", formatCurrency(data.investing.total)]);
    body.push(["FINANCING ACTIVITIES", ""]);
    data.financing.items.forEach((a) => body.push([`  ${a.label}`, formatCurrency(a.amount)]));
    body.push(["Net Cash from Financing", formatCurrency(data.financing.total)]);
    body.push(["Net Change in Cash", formatCurrency(data.netChange)]);
    body.push(["Beginning Cash", formatCurrency(data.beginningCash)]);
    body.push(["Ending Cash", formatCurrency(data.endingCash)]);
    exportPDF({
      title: "Cash Flow Statement",
      subtitle: `${start} to ${end}`,
      head: ["", "Amount"],
      body,
      filename: `cash-flow-${start}-to-${end}.pdf`,
    });
  };

  return (
    <ReportShell
      title="Cash Flow Statement"
      subtitle={data ? `${start} to ${end}` : undefined}
      isLoading={isLoading}
      isEmpty={isEmpty}
      onExport={exportCsv}
      onExportPdf={exportPdf}
      controls={<DateRangeControls startDate={start} endDate={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />}
    >
      {data && !isEmpty && (
        <table className={reportTableClass}>
          <tbody>
            <tr className="bg-muted/40 font-semibold"><td colSpan={2} className="p-3">Operating Activities</td></tr>
            <Row label="Net Income" amount={data.netIncome} indent={1} />
            {data.operating.adjustments.map((a, i) => (
              <Row key={i} label={a.label} amount={a.amount} indent={1} />
            ))}
            <Row label="Net Cash from Operating Activities" amount={data.operating.total} bold testId="text-operating-cash" />

            <tr className="bg-muted/40 font-semibold"><td colSpan={2} className="p-3">Investing Activities</td></tr>
            {data.investing.items.map((a, i) => (
              <Row key={i} label={a.label} amount={a.amount} indent={1} />
            ))}
            <Row label="Net Cash from Investing Activities" amount={data.investing.total} bold testId="text-investing-cash" />

            <tr className="bg-muted/40 font-semibold"><td colSpan={2} className="p-3">Financing Activities</td></tr>
            {data.financing.items.map((a, i) => (
              <Row key={i} label={a.label} amount={a.amount} indent={1} />
            ))}
            <Row label="Net Cash from Financing Activities" amount={data.financing.total} bold testId="text-financing-cash" />

            <tr className="font-bold bg-primary/10 border-t-2">
              <td className="p-3">Net Change in Cash</td>
              <td className="p-3 text-right tabular-nums" data-testid="text-net-change">{formatCurrency(data.netChange)}</td>
            </tr>
            <Row label="Beginning Cash" amount={data.beginningCash} />
            <Row label="Ending Cash" amount={data.endingCash} bold testId="text-ending-cash" />
            {Math.abs(data.reconciliation - data.netChange) > 0.005 && (
              <tr className="text-destructive">
                <td className="p-3">Reconciliation difference (Δcash − calculated)</td>
                <td className="p-3 text-right tabular-nums">{formatCurrency(data.reconciliation - data.netChange)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}
