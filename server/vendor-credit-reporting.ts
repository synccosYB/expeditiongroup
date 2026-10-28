import type {
  vendorCredits,
  vendorCreditApplications,
  vendorRefunds,
} from "@shared/schema";
import type { LedgerLine } from "./reports";
import { moneyToCents } from "@shared/checkwriter";
type Credit = typeof vendorCredits.$inferSelect;
type Application = typeof vendorCreditApplications.$inferSelect;
type Refund = typeof vendorRefunds.$inferSelect;
export function vendorCreditLedger(
  credits: Credit[],
  refunds: Refund[],
  apAccountId: number,
): LedgerLine[] {
  const lines: LedgerLine[] = [];
  for (const credit of credits) {
    const common = {
      date: credit.creditDate,
      source: "vendor_credit",
      sourceId: credit.id,
      ref: credit.reference || `VC-${credit.id}`,
      memo: credit.memo || "Vendor credit",
    };
    const amount = moneyToCents(credit.amount) / 100;
    lines.push(
      { ...common, accountId: apAccountId, debit: amount, credit: 0 },
      { ...common, accountId: credit.accountId, debit: 0, credit: amount },
    );
  }
  // Bank-register entries supply the matching debit. Applications never post twice.
  for (const refund of refunds)
    lines.push({
      accountId: apAccountId,
      date: refund.refundDate,
      debit: 0,
      credit: moneyToCents(refund.amount) / 100,
      source: "vendor_refund",
      sourceId: refund.id,
      ref: refund.reference || `VR-${refund.id}`,
      memo: "Vendor refund received",
    });
  return lines;
}
export function availableCreditAsOf(
  credit: Credit,
  applications: Application[],
  refunds: Refund[],
  asOf: Date,
): number {
  if (credit.creditDate > asOf) return 0;
  const consumed = [
    ...applications.filter(
      (a) => a.creditId === credit.id && a.applicationDate <= asOf,
    ),
    ...refunds.filter((r) => r.creditId === credit.id && r.refundDate <= asOf),
  ].reduce((sum, row) => sum + moneyToCents(row.amount), 0);
  return (moneyToCents(credit.amount) - consumed) / 100;
}
