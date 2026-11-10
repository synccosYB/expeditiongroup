import type { Account, Payment, clientRetainerApplications } from "@shared/schema";
import { clientRetainersAccountCode } from "@shared/client-retainers";
import type { LedgerLine } from "./reports";

export const getRetainerAccount = (accounts: Account[]) => accounts.find(
  (account) => account.code === clientRetainersAccountCode
    && account.accountType === "liability" && account.accountSubtype === "other_current_liability",
);
export const getUndepositedAccount = (accounts: Account[]) => accounts.find(
  (account) => account.accountType === "asset" && account.isActive !== false
    && account.name.toLowerCase().includes("undeposited"),
);

export function getBankLedgerAccount(accounts: Account[], linkedAccountId: number | null) {
  if (linkedAccountId) return accounts.find((account) => account.id === linkedAccountId);
  const assets = accounts.filter((account) => account.accountType === "asset" && account.isActive !== false);
  return assets.find((account) => account.accountSubtype === "bank")
    ?? assets.find((account) => account.accountSubtype === "cash");
}

type Application = typeof clientRetainerApplications.$inferSelect & { invoiceNumber: string };

export function retainerLedger(
  receipts: Payment[],
  applications: Application[],
  accountIds: { liability?: number; undeposited?: number; ar?: number },
): LedgerLine[] {
  const { liability, undeposited, ar } = accountIds;
  if (!liability) return [];
  const lines: LedgerLine[] = [];
  for (const receipt of receipts) {
    if (!undeposited || !receipt.retainerRequestId) continue;
    const amount = Number(receipt.amount);
    const receiptLine = {
      date: receipt.paymentDate, source: "retainer_receipt", sourceId: receipt.id,
      ref: receipt.paymentNumber, memo: "Client retainer received",
    };
    lines.push(
      { ...receiptLine, accountId: undeposited, debit: amount, credit: 0 },
      { ...receiptLine, accountId: liability, debit: 0, credit: amount },
    );
    if (receipt.retainerVoidedAt) {
      const reversal = { ...receiptLine, date: receipt.retainerVoidedAt, memo: "Client retainer receipt voided" };
      lines.push(
        { ...reversal, accountId: liability, debit: amount, credit: 0 },
        { ...reversal, accountId: undeposited, debit: 0, credit: amount },
      );
    }
  }
  for (const application of applications) {
    if (!ar) break;
    const amount = application.amountCents / 100;
    const applicationLine = {
      date: application.appliedAt, source: "retainer_application", sourceId: application.invoiceId,
      ref: application.invoiceNumber, memo: "Client retainer applied",
    };
    lines.push(
      { ...applicationLine, accountId: liability, debit: amount, credit: 0 },
      { ...applicationLine, accountId: ar, debit: 0, credit: amount },
    );
    if (application.reversedAt) {
      const reversal = { ...applicationLine, date: application.reversedAt, memo: "Client retainer application reversed" };
      lines.push(
        { ...reversal, accountId: ar, debit: amount, credit: 0 },
        { ...reversal, accountId: liability, debit: 0, credit: amount },
      );
    }
  }
  return lines;
}
