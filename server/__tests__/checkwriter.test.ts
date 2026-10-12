import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInWords, moneyToCents, validateCheckPayment, type CheckDetails } from "../../shared/checkwriter";
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
