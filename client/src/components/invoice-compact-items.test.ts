import test from "node:test";
import assert from "node:assert/strict";
import { summarizeInvoiceItems } from "./invoice-compact-items";

const line = (id: number, description: string, quantity: string, unitPrice: string, amount: string, catalogItemId: number | null = null) =>
  ({ id, description, quantity, unitPrice, amount, catalogItemId });

test("repeated time entries collapse without losing original descriptions or cents", () => {
  const source = [
    line(1, "6/29/2026 - Building permit needed", "0.17", "120", "20.40"),
    line(2, "6/29/2026 - Building permit needed", "0.08", "120", "9.60"),
    line(3, "7/1/2026 - Building permit needed", "0.17", "120", "20.40"),
  ];
  const grouped = summarizeInvoiceItems(source);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].lines.length, 3);
  assert.equal(grouped[0].name, "Building permit needed");
  assert.equal(grouped[0].cents, 5040);
  assert.equal(grouped[0].qty, 0.42);
  assert.deepEqual(grouped[0].lines, source);
});

test("different agreed rates remain separately billed", () => {
  const grouped = summarizeInvoiceItems([
    line(1, "6/29/2026 - Site Visit", "1", "120", "120.00", 10),
    line(2, "6/30/2026 - Site Visit", "2", "135", "270.00", 10),
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.reduce((total, group) => total + group.cents, 0), 39000);
});

test("catalog classification summarizes original descriptions while preserving details", () => {
  const original = [
    line(1, "6/29/2026 - Phone Call — Spoke to municipal reviewer", "0.50", "120", "60.00", 3),
    line(2, "6/30/2026 - Phone Call — Followed up with engineer", "0.25", "120", "30.00", 3),
  ];
  const [summary] = summarizeInvoiceItems(original);
  assert.equal(summary.name, "Phone Call");
  assert.equal(summary.cents, 9000);
  assert.equal(summary.lines[1].description, original[1].description);
});
