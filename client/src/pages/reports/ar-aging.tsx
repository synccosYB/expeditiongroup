import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReportShell,
  AsOfControls,
  formatCurrency,
  formatDate,
  reportTableClass,
  downloadCSV,
  exportPDF,
  todayStr,
} from "@/components/report-shell";

interface Buckets { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number }
interface ARInvoice {
  id: number;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  total: number;
  paid: number;
  balance: number;
  daysOverdue: number;
  bucket: keyof Buckets;
}
interface ARRow {
  clientId: number;
  clientName: string;
  invoices: ARInvoice[];
  buckets: Buckets;
  total: number;
}
interface ARData { asOf: string; rows: ARRow[]; totals: { buckets: Buckets; total: number } }

const bucketLabels: Record<keyof Buckets, string> = {
  current: "Current",
  d1_30: "1-30",
  d31_60: "31-60",
  d61_90: "61-90",
  d90plus: "90+",
};

export default function ArAgingPage() {
  const [asOf, setAsOf] = useState(todayStr());
  const { data, isLoading } = useQuery<ARData>({
    queryKey: ["/api/reports/ar-aging", asOf],
    queryFn: async () => {
      const res = await fetch(`/api/reports/ar-aging?asOf=${asOf}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch A/R aging");
      return res.json();
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const isEmpty = !!data && data.rows.length === 0;

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      ["A/R Aging", `As of ${asOf}`],
      [],
      ["Client", "Invoice", "Date", "Due Date", "Days Overdue", "Total", "Paid", "Balance", "Bucket"],
    ];
    data.rows.forEach((r) =>
      r.invoices.forEach((inv) =>
        rows.push([
          r.clientName,
          inv.invoiceNumber,
          new Date(inv.date).toISOString().slice(0, 10),
          new Date(inv.dueDate).toISOString().slice(0, 10),
          inv.daysOverdue,
          inv.total.toFixed(2),
          inv.paid.toFixed(2),
          inv.balance.toFixed(2),
          bucketLabels[inv.bucket],
        ]),
      ),
    );
    rows.push([]);
    rows.push(["", "", "", "", "Totals", "", "", data.totals.total.toFixed(2)]);
    (Object.keys(bucketLabels) as (keyof Buckets)[]).forEach((b) =>
      rows.push([bucketLabels[b], data.totals.buckets[b].toFixed(2)]),
    );
    downloadCSV(`ar-aging-${asOf}.csv`, rows);
  };

  const exportPdf = () => {
    if (!data) return;
    const body: (string | number)[][] = data.rows.map((r) => [
      r.clientName,
      formatCurrency(r.buckets.current),
      formatCurrency(r.buckets.d1_30),
      formatCurrency(r.buckets.d31_60),
      formatCurrency(r.buckets.d61_90),
      formatCurrency(r.buckets.d90plus),
      formatCurrency(r.total),
    ]);
    body.push([
      "Total",
      formatCurrency(data.totals.buckets.current),
      formatCurrency(data.totals.buckets.d1_30),
      formatCurrency(data.totals.buckets.d31_60),
      formatCurrency(data.totals.buckets.d61_90),
      formatCurrency(data.totals.buckets.d90plus),
      formatCurrency(data.totals.total),
    ]);
    exportPDF({
      title: "A/R Aging",
      subtitle: `As of ${asOf}`,
      head: ["Client", "Current", "1-30", "31-60", "61-90", "90+", "Total"],
      body,
      filename: `ar-aging-${asOf}.pdf`,
    });
  };

  return (
    <ReportShell
      title="A/R Aging"
      subtitle={data ? `As of ${asOf}` : undefined}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No outstanding customer invoices."
      onExport={exportCsv}
      onExportPdf={exportPdf}
      controls={<AsOfControls asOf={asOf} onChange={setAsOf} />}
    >
      {data && !isEmpty && (
        <table className={reportTableClass}>
          <thead>
            <tr>
              <th>Client</th>
              <th className="text-right">Current</th>
              <th className="text-right">1-30</th>
              <th className="text-right">31-60</th>
              <th className="text-right">61-90</th>
              <th className="text-right">90+</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.clientId} data-testid={`row-ar-client-${r.clientId}`}>
                <td>{r.clientName}</td>
                <td className="text-right tabular-nums">{formatCurrency(r.buckets.current)}</td>
                <td className="text-right tabular-nums">{formatCurrency(r.buckets.d1_30)}</td>
                <td className="text-right tabular-nums">{formatCurrency(r.buckets.d31_60)}</td>
                <td className="text-right tabular-nums">{formatCurrency(r.buckets.d61_90)}</td>
                <td className="text-right tabular-nums">{formatCurrency(r.buckets.d90plus)}</td>
                <td className="text-right tabular-nums font-semibold">{formatCurrency(r.total)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-primary/10 border-t-2">
              <td className="p-3">Total</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(data.totals.buckets.current)}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(data.totals.buckets.d1_30)}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(data.totals.buckets.d31_60)}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(data.totals.buckets.d61_90)}</td>
              <td className="p-3 text-right tabular-nums">{formatCurrency(data.totals.buckets.d90plus)}</td>
              <td className="p-3 text-right tabular-nums" data-testid="text-ar-total">
                {formatCurrency(data.totals.total)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </ReportShell>
  );
}
