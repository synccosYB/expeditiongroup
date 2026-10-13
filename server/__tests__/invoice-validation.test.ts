import test from "node:test";
import assert from "node:assert/strict";
import { invoiceUpdateSchema } from "../invoice-validation";

test("invoice update validation preserves catalog item associations", () => {
  const parsed = invoiceUpdateSchema.parse({
    subtotal: "180.00",
    total: "180.00",
    items: [{
      description: "Site Visit",
      quantity: "1.50",
      unitPrice: "120.00",
      amount: "180.00",
      isCustom: true,
      timeLogId: null,
      timeEntryId: null,
      catalogItemId: 7,
    }],
  });

  assert.equal(parsed.items?.[0].catalogItemId, 7);
});
