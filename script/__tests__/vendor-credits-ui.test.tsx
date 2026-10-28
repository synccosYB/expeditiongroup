import React from "react";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import VendorCredits from "@/pages/vendor-credits";
const credit = {
  id: 1,
  vendorId: 2,
  accountId: 3,
  vendorName: "Sample Vendor",
  accountName: "Permit Services",
  creditDate: "2026-10-28",
  amount: "100",
  reference: "VC-TEST",
  memo: "Returned services",
  available: "40",
  applied: "30",
  refunded: "30",
  applications: [
    {
      id: 1,
      billId: 5,
      billNumber: "BILL-5",
      applicationDate: "2026-10-28",
      amount: "30",
    },
  ],
  refunds: [
    {
      id: 1,
      bankTransactionId: 7,
      bankAccountId: 9,
      bankName: "Checking",
      refundDate: "2026-10-28",
      amount: "30",
      reference: "R-1",
    },
  ],
};
for (const key of [
  "/api/vendors",
  "/api/accounts",
  "/api/bank-accounts",
  "/api/bills",
])
  queryClient.setQueryData([key], []);
const render = () =>
  renderToString(
    <Router ssrPath="/vendor-credits">
      <QueryClientProvider client={queryClient}>
        <VendorCredits />
      </QueryClientProvider>
    </Router>,
  );
queryClient.setQueryData(["/api/vendor-credits"], []);
assert.ok(render().includes("No vendor credits yet"));
queryClient.setQueryData(["/api/vendor-credits"], [credit]);
let html = render();
for (const text of [
  "Sample Vendor",
  "$100.00",
  "$40.00",
  "Apply to Bill",
  "Record Refund",
  "Permit Services",
  "VC-TEST",
])
  assert.ok(html.includes(text), text);
assert.ok(html.includes('href="/bills/5"'));
assert.ok(html.includes('href="/bank-register/9?txn=7"'));
queryClient.setQueryData(
  ["/api/vendor-credits"],
  [{ ...credit, available: "0", applied: "70" }],
);
html = render();
assert.match(html, /<button[^>]*disabled=""[^>]*>Apply to Bill<\/button>/);
assert.match(html, /<button[^>]*disabled=""[^>]*>Record Refund<\/button>/);
queryClient.clear();
console.log("Vendor credit UI rendering checks passed");
