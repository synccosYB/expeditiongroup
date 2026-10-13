import { test } from "node:test";
import assert from "node:assert/strict";
import { hasReadablePdfText } from "../pdf-text-quality";
test("page counters alone trigger OCR", () => {
  assert.equal(hasReadablePdfText("-- 1 of 2 --\n\n-- 2 of 2 --"), false);
});
test("readable text layers avoid unnecessary OCR", () => {
  assert.equal(hasReadablePdfText("Department of Health. Please submit revised plans.\n-- 1 of 2 --"), true);
});
test("empty and numeric-only layers trigger OCR", () => {
  assert.equal(hasReadablePdfText(""), false);
  assert.equal(hasReadablePdfText("1234567890123456789012345"), false);
});
test("non-English document text is readable", () => {
  assert.equal(hasReadablePdfText("דער דאקומענט האט א קלארע לעזבארע טעקסט"), true);
});
