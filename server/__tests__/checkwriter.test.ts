import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInWords, checkRequestSchema, validateCheckAttachment, moneyToCents, validateCheckPayment, type CheckDetails } from "../../shared/checkwriter";
import { buildCheckPdf } from "../../client/src/lib/checkPdf";

test("money uses exact cents, including decimal boundaries", () => {
  assert.equal(moneyToCents("0.29"), 29);
  assert.equal(validateCheckPayment("0.20", "0.30", "0.10"), 20);
  assert.equal(moneyToCents("100.1"), 10010);
});
test("rejects zero, negative, malformed and excessive payments", () => {
  for (const amount of ["0", "-1", "NaN", "1e2", "0.001", "Infinity", "2.01"]) {
    assert.throws(() => validateCheckPayment(amount, "10", "8"));
  }
});
test("a paid bill cannot be paid again", () => {
  assert.throws(() => validateCheckPayment("1", "100", "100"));
});
test("amount wording preserves cents and large values", () => {
  assert.equal(amountInWords("1234.05"), "One Thousand Two Hundred Thirty Four and 05/100 Dollars");
  assert.equal(amountInWords("0.01"), "Zero and 01/100 Dollars");
  assert.equal(amountInWords("1000000.00"), "One Million and 00/100 Dollars");
});
const check: CheckDetails = { number: "115", date: "2026-10-12", amount: "1234.05", payee: "Sample Vendor LLC", payeeAddress: "100 Vendor Avenue\nSpring Valley, NY 10977", companyName: "Expedition Group", companyAddress: "17 Sandybrook Drive\nSpring Valley, NY 10977", bankName: "Sample Bank", billNumber: "BILL-001", memo: "Vendor services", status: "issued", issuedBy: 1 };
test("PDF is one Letter sheet containing the check and two vouchers", () => {
  const doc = buildCheckPdf(check);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.equal(doc.internal.pageSize.getWidth(), 612);
  assert.equal(doc.internal.pageSize.getHeight(), 792);
  const content = doc.output();
  assert.ok(content.includes("One Thousand Two Hundred Thirty Four"));
  assert.equal((content.match(/Bill: BILL-001/g) || []).length, 2);
});
test("void PDF visibly marks original check void", () => {
  assert.ok(buildCheckPdf({ ...check, status: "void" }).output().includes("(VOID)"));
});
test("overlong payee cannot silently clip or disappear", () => {
  assert.throws(() => buildCheckPdf({ ...check, payee: "Long vendor name ".repeat(30) }), /too long/);
});

test("standalone PDF vouchers do not pretend a bill exists", () => {
  const content = buildCheckPdf({ ...check, billNumber: "" }).output();
  assert.equal((content.match(/Standalone check/g) || []).length, 2);
  assert.ok(!content.includes("(Bill: )"));
});

test("standalone checks require a payee and expense category, while linked bills do not", () => {
  const common = { bankAccountId: 1, number: "100", date: "2026-10-13", amount: "10" };
  assert.equal(checkRequestSchema.safeParse(common).success, false);
  assert.equal(checkRequestSchema.safeParse({ ...common, payee: "Payee", accountId: 1 }).success, true);
  assert.equal(checkRequestSchema.safeParse({ ...common, billId: 1 }).success, true);
});
test("attachment requests reject external URLs and object paths outside check bill storage", () => {
  const common = { bankAccountId: 1, number: "100", date: "2026-10-13", amount: "10", billId: 1 };
  for (const path of ["https://example.com/bill.pdf", "/objects/other/secret", "/objects/check-bills/../../secret"]) assert.equal(checkRequestSchema.safeParse({ ...common, attachment: { path, name: "bill.pdf" } }).success, false);
});
test("attachment validation rejects oversized, empty, unknown and mismatched file metadata", () => {
  validateCheckAttachment("application/pdf", 100, "application/pdf");
  for (const [type, size, reserved] of [["image/svg+xml", 100, "image/svg+xml"], ["application/pdf", 100, "image/png"], ["application/pdf", 0, "application/pdf"], ["application/pdf", 11 * 1024 * 1024, "application/pdf"], ["application/pdf", NaN, "application/pdf"]] as [string, number, string][]) assert.throws(() => validateCheckAttachment(type, size, reserved));
});

test("bank numbers print with leading zeroes and legacy checks remain printable", () => {
  const content = buildCheckPdf({ ...check, routingNumber: "012345678", accountNumber: "000123456789" }).output();
  assert.ok(content.includes("Routing: 012345678"));
  assert.ok(content.includes("Account: 000123456789"));
  assert.ok(!buildCheckPdf(check).output().includes("undefined"));
});

 test("signature inputs reject remote URLs, SVG and oversized values", async () => {
  const { checkSignatureSchema } = await import("../../shared/checkwriter");
  for (const value of ["https://example.com/signature.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,iVBORw0KGgo" + "A".repeat(200000)]) assert.equal(checkSignatureSchema.safeParse(value).success, false);
 });

test("saved signature is embedded in issued PDF and omitted from void copies", () => {
  const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNkYGD4z8DAwMDEAAUADigBA0dwHFEAAAAASUVORK5CYII=";
  assert.ok(buildCheckPdf({ ...check, signature }).output().includes("/Subtype /Image"));
  assert.ok(!buildCheckPdf({ ...check, signature, status: "void" }).output().includes("/Subtype /Image"));
});
