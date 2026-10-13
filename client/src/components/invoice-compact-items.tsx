import { useState } from "react";
import type { InvoiceItem } from "@shared/schema";

type InvoiceLine = Pick<InvoiceItem, "id" | "description" | "quantity" | "unitPrice" | "amount" | "catalogItemId">;

const cents = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100);
const money = (amountCents: number) => "$" + (amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Preserve original lines; group only identical service descriptions and rates. */
export function summarizeInvoiceItems(items: InvoiceLine[]) {
  const buckets = new Map<string, { name: string; rate: string; qty: number; cents: number; lines: InvoiceLine[] }>();
  for (const entry of items) {
    const raw = entry.description.replace(/^\d{1,2}\/\d{1,2}\/\d{4}\s*-\s*/, "").trim();
    const description = (entry.catalogItemId ? raw.split(" — ")[0] : raw) || "Uncategorized work";
    const key = (entry.catalogItemId ? "catalog:" + entry.catalogItemId : "description:" + description.toLowerCase()) + "|rate:" + entry.unitPrice;
    let group = buckets.get(key);
    if (!group) {
      group = { name: description, rate: entry.unitPrice, qty: 0, cents: 0, lines: [] };
      buckets.set(key, group);
    }
    group.qty += Number(entry.quantity || 0);
    group.cents += cents(entry.amount);
    group.lines.push(entry);
  }
  return Array.from(buckets.values());
}

export function InvoiceSummaryRows({ items }: { items: InvoiceLine[] }) {
  return <>{summarizeInvoiceItems(items).map((item, index) => (
    <tr key={index} className="border-b">
      <td className="py-2 whitespace-pre-wrap break-words">{item.name}</td>
      <td className="py-2 text-right">{Number(item.qty.toFixed(2)).toString()}</td>
      <td className="py-2 text-right">{money(cents(item.rate))}</td>
      <td className="py-2 text-right font-medium">{money(item.cents)}</td>
    </tr>
  ))}</>;
}

export function InvoiceDetailAppendix({ items }: { items: InvoiceLine[] }) {
  const [expanded, setExpanded] = useState(false);
  const [includeInPrint, setIncludeInPrint] = useState(false);
  return <section className="mt-3 text-sm" data-testid="invoice-details-appendix">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <button type="button" className="underline underline-offset-2 font-medium" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Hide" : "View"} all {items.length} original entries
      </button>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={includeInPrint} onChange={(e) => setIncludeInPrint(e.target.checked)} />
        Include full entry breakdown when printing
      </label>
    </div>
    <div className={expanded || includeInPrint ? `mt-3 space-y-3 ${includeInPrint ? "" : "print:hidden"}` : "hidden"}>
      {summarizeInvoiceItems(items).map((group, index) => (
        <div key={index} className="break-inside-avoid border rounded p-2">
          <div className="font-semibold">{group.name} — {money(group.cents)}</div>
          {group.lines.map((line, i) => (
            <div key={line.id || i} className="flex justify-between gap-3 border-t py-1">
              <span className="break-words">{line.description}</span>
              <span className="whitespace-nowrap">{line.quantity} × {money(cents(line.unitPrice))} = {money(cents(line.amount))}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </section>;
}
