import { jsPDF } from "jspdf";
import { amountInWords, type CheckDetails } from "@shared/checkwriter";
import { prepareCheckMicr } from "./checkMicr";

// Letter sheet, top check + two vouchers. The bottom 5/8 inch is reserved for MICR.
// Non-browser callers may supply the separately distributed font source.
export async function buildCheckPdf(check: CheckDetails, logoPng?: string, micrFontSource?: string): Promise<jsPDF> {
  const drawMicr = await prepareCheckMicr(check, micrFontSource);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const text = (value: string, x: number, y: number, width: number, size = 10, maxLines = 2, align: "left" | "right" = "left") => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, width);
    if (lines.length > maxLines) throw new Error("Check text is too long for this layout. Shorten the company information, payee, or memo before printing.");
    doc.text(lines, align === "right" ? x + width : x, y, { align });
  };
  if (logoPng) doc.addImage(logoPng, "PNG", 30, 20, 130, 20);
  text(check.companyName, 30, 65, 300, 11, 1);
  text(check.companyAddress, 30, 80, 300, 9, 3);
  text(check.bankName, 355, 40, 160, 9, 2);
  text(check.number, 520, 30, 70, 12, 1, "right");
  text(`Date: ${check.date}`, 420, 88, 165, 10, 1);
  text("PAY TO THE ORDER OF", 30, 125, 120, 8, 1);
  text(check.payee, 150, 125, 290, 11, 2);
  text(`$${Number(check.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 455, 126, 130, 12, 1);
  text(amountInWords(check.amount), 30, 160, 550, 10, 2);
  text(check.payeeAddress, 150, 184, 260, 9, 2);
  text(`Memo: ${check.memo || check.billNumber}`, 30, 213, 340, 9, 1);
  if (check.signature && check.status !== "void") doc.addImage(check.signature, "PNG", 420, 164, 160, 40);
  doc.line(420, 204, 580, 204);
  text("AUTHORIZED SIGNATURE", 440, 216, 140, 7, 1);
  drawMicr(doc);
  for (const y of [264, 528]) {
    doc.setDrawColor(180);
    doc.line(25, y, 587, y);
    text(check.companyName, 30, y + 30, 350, 12, 1);
    text(`Check ${check.number}  |  ${check.date}`, 360, y + 30, 220, 10, 1);
    text(`Payee: ${check.payee}`, 30, y + 60, 540, 11, 2);
    text(check.billNumber ? `Bill: ${check.billNumber}` : check.expenseId ? `Expense: #${check.expenseId}` : "Standalone check", 30, y + 98, 340, 10, 1);
    text(`Payment: $${check.amount}`, 420, y + 98, 160, 11, 1);
    text(`Memo: ${check.memo || check.billNumber}`, 30, y + 128, 540, 10, 2);
    text(check.status === "void" ? "VOID - original amount shown for reference" : "Check payment - retain this voucher", 30, y + 205, 530, 9, 1);
  }
  if (check.status === "void") {
    doc.setTextColor(180, 30, 30);
    doc.setFontSize(50);
    doc.text("VOID", 240, 205, { angle: 20 });
  }
  return doc;
}
