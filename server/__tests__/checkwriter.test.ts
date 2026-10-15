import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { getDocument, OPS, Util } from "pdfjs-dist/legacy/build/pdf.mjs";
import { amountInWords, checkRequestSchema, validateCheckAttachment, moneyToCents, validateCheckPayment, type CheckDetails } from "../../shared/checkwriter";
import { buildCheckPdf } from "../../client/src/lib/checkPdf";

const micrFontSource = readFileSync(new URL("../../client/public/fonts/gnumicr/GnuMICR.raw", import.meta.url), "utf8");
// These silhouettes were independently rendered by PDF.js's Type 1 font engine,
// rather than the application's PostScript outline parser. They contain only
// synthetic digits and the transit/on-us symbols from the licensed GnuMICR font.
const micrReference: { scale: number; width: number; height: number; glyphs: Record<string, string> } = JSON.parse(readFileSync(new URL("./fixtures/micr-glyphs.json", import.meta.url), "utf8"));

async function inspectCheckPdf(details: CheckDetails) {
  const doc = await buildCheckPdf(details, undefined, micrFontSource);
  const pdf = await getDocument({ data: new Uint8Array(doc.output("arraybuffer")), verbosity: 0 }).promise;
  try {
    const page = await pdf.getPage(1);
    const text = await page.getTextContent();
    const operators = await page.getOperatorList();
    const viewport = page.getViewport({ scale: micrReference.scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
    return { raw: doc.output(), text: text.items.filter((item): item is Extract<typeof item, { str: string }> => "str" in item), operators, context };
  } finally {
    await pdf.destroy();
  }
}

function assertMicrGlyphs(context: SKRSContext2D, value: string, origin: number) {
  for (const [index, character] of [...value].entries()) {
    const { data } = context.getImageData((origin + index * 9) * micrReference.scale, (250.5 - 12) * micrReference.scale, micrReference.width, micrReference.height);
    const reference = micrReference.glyphs[character];
    assert.ok(reference, `Missing independently rendered E-13B reference for ${character}`);
    let differences = 0, inkPixels = 0;
    for (let y = 0; y < micrReference.height; y++) {
      const row = BigInt(`0x${reference.slice(y * 9, (y + 1) * 9)}`);
      for (let x = 0; x < micrReference.width; x++) {
        const expected = (row & (1n << BigInt(x))) !== 0n;
        const offset = (y * micrReference.width + x) * 4;
        const actual = data[offset] < 128 && data[offset + 1] < 128 && data[offset + 2] < 128;
        differences += Number(expected !== actual);
        inkPixels += Number(expected || actual);
      }
    }
    assert.ok(inkPixels > 0 && differences / inkPixels < 0.03, `E-13B ${character} at x=${origin + index * 9}, baseline=250.5 differs from the authentic glyph (${differences}/${inkPixels} ink pixels)`);
  }
}

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
test("PDF is one Letter sheet containing the check and two vouchers", async () => {
  const doc = await buildCheckPdf(check);
  assert.equal(doc.getNumberOfPages(), 1);
  assert.equal(doc.internal.pageSize.getWidth(), 612);
  assert.equal(doc.internal.pageSize.getHeight(), 792);
  const content = doc.output();
  assert.ok(content.includes("One Thousand Two Hundred Thirty Four"));
  assert.equal((content.match(/Bill: BILL-001/g) || []).length, 2);
});
test("void PDF visibly marks original check void", async () => {
  assert.ok((await buildCheckPdf({ ...check, status: "void" })).output().includes("(VOID)"));
});
test("overlong payee cannot silently clip or disappear", async () => {
  await assert.rejects(() => buildCheckPdf({ ...check, payee: "Long vendor name ".repeat(30) }), /too long/);
});

test("standalone PDF vouchers do not pretend a bill exists", async () => {
  const content = (await buildCheckPdf({ ...check, billNumber: "" })).output();
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

test("PDF prints authentic E-13B routing, account and check glyphs with leading zeroes in the first panel", async () => {
  const pdf = await inspectCheckPdf({ ...check, number: "00115", routingNumber: "012345678", accountNumber: "000123456789" });
  assertMicrGlyphs(pdf.context, "C00115C", 130.5);
  assertMicrGlyphs(pdf.context, "A012345678A", 202.5);
  assertMicrGlyphs(pdf.context, "000123456789C", 310.5);
  assert.ok(!pdf.raw.includes("Routing:") && !pdf.raw.includes("Account:"));
  assert.ok(!pdf.raw.includes("/Subtype /Image"), "MICR glyphs must remain sharp vector output");
  assert.match(pdf.raw, /25(?:\.0*)? 528(?:\.0*)? m\s+587(?:\.0*)? 528(?:\.0*)? l/, "The first check must end at 264pt on the 792pt sheet");
  assert.ok(pdf.text.every(item => 792 - item.transform[5] <= 219 || 792 - item.transform[5] >= 264), "Ordinary text must stay outside the 45pt MICR band");
});

test("maximum account and check numbers fit their MICR fields without changing pitch or baseline", async () => {
  const pdf = await inspectCheckPdf({ ...check, number: "123456789", routingNumber: "987654321", accountNumber: "00012345678901234" });
  assertMicrGlyphs(pdf.context, "C123456789C", 94.5);
  assertMicrGlyphs(pdf.context, "A987654321A", 202.5);
  assertMicrGlyphs(pdf.context, "00012345678901234C", 310.5);
});

test("legacy snapshots with no bank fields remain printable without loading a font", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("A legacy check must not fetch a font"); });
  const doc = await buildCheckPdf(check);
  assert.ok(!doc.output().includes("undefined"));
  assert.equal(fetch.mock.callCount(), 0);
  const pdf = await inspectCheckPdf(check);
  const band = pdf.context.getImageData(0, 219 * micrReference.scale, 612 * micrReference.scale, 45 * micrReference.scale).data;
  assert.ok(band.every((channel, index) => index % 4 === 3 || channel > 128), "A legacy snapshot must leave the MICR band blank for preprinted stock");
});

test("partial, blank or malformed bank snapshots fail before printing", async () => {
  for (const fields of [
    { routingNumber: "012345678" },
    { accountNumber: "000123456789" },
    { routingNumber: "", accountNumber: "" },
    { routingNumber: "12345678", accountNumber: "000123456789" },
    { routingNumber: "012345678", accountNumber: "1234" },
    { routingNumber: "012345678", accountNumber: "123456789012345678" },
    { routingNumber: "012345678", accountNumber: "00123A456" },
  ]) await assert.rejects(() => buildCheckPdf({ ...check, ...fields }, undefined, micrFontSource), /routing number|account number/i);
});

test("font download and invalid asset responses block printing and allow a retry", async (t) => {
  let attempt = 0;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "/fonts/gnumicr/GnuMICR.raw");
    attempt++;
    if (attempt === 1) throw new Error("Font server unavailable");
    if (attempt === 2) return new Response("<html>Application fallback page</html>", { status: 200 });
    return new Response(micrFontSource, { status: 200 });
  });
  const details = { ...check, routingNumber: "012345678", accountNumber: "000123456789" };
  await assert.rejects(() => buildCheckPdf(details), /load the MICR print font/i);
  await assert.rejects(() => buildCheckPdf(details), /load the MICR print font/i);
  assert.equal((await buildCheckPdf(details)).getNumberOfPages(), 1);
  assert.equal(fetch.mock.callCount(), 3);
});

 test("signature inputs reject remote URLs, SVG and oversized values", async () => {
  const { checkSignatureSchema } = await import("../../shared/checkwriter");
  for (const value of ["https://example.com/signature.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,iVBORw0KGgo" + "A".repeat(200000)]) assert.equal(checkSignatureSchema.safeParse(value).success, false);
 });

test("saved signature stays above the MICR band and is omitted from void copies", async () => {
  const signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNkYGD4z8DAwMDEAAUADigBA0dwHFEAAAAASUVORK5CYII=";
  const fields = { ...check, signature, routingNumber: "012345678", accountNumber: "000123456789" };
  const issued = await inspectCheckPdf(fields);
  const voided = await inspectCheckPdf({ ...fields, status: "void" });
  assert.ok(issued.raw.includes("/Subtype /Image"));
  assert.ok(!voided.raw.includes("/Subtype /Image"));
  assert.ok(voided.text.some(item => item.str === "VOID"));
  assertMicrGlyphs(issued.context, "A012345678A", 202.5);
  assertMicrGlyphs(issued.context, "000123456789C", 310.5);
  assertMicrGlyphs(voided.context, "A012345678A", 202.5);
  assertMicrGlyphs(voided.context, "000123456789C", 310.5);
  let transform = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  let signatureCount = 0;
  for (const [index, operation] of issued.operators.fnArray.entries()) {
    const args = issued.operators.argsArray[index];
    if (operation === OPS.save) stack.push([...transform]);
    else if (operation === OPS.restore) transform = stack.pop()!;
    else if (operation === OPS.transform) transform = Util.transform(transform, args);
    else if (operation === OPS.paintImageXObject || operation === OPS.paintInlineImageXObject) {
      signatureCount++;
      assert.equal(792 - transform[5] - transform[3], 164);
      assert.ok(792 - transform[5] <= 219, "The signature image must end above the reserved MICR band");
    }
  }
  assert.equal(signatureCount, 1);
});
