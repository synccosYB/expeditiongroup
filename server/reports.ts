import type { Express, Request } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { and, eq, gte, lte, sql, asc, inArray, ne } from "drizzle-orm";
import {
  accounts,
  bankAccounts,
  bankTransactions,
  bills,
  billItems,
  billPayments,
  clients,
  deposits,
  expenses,
  invoices,
  journalEntries,
  journalEntryLines,
  payments,
  vendors,
  type Account,
} from "@shared/schema";

type DebitCredit = "debit" | "credit";

export interface LedgerLine {
  accountId: number;
  date: Date;
  debit: number;
  credit: number;
  source: string;
  sourceId: number;
  ref: string;
  memo: string;
}

const num = (v: any): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
};

function pickAccountByPriority(
  all: Account[],
  matchType: string,
  matchSubtype?: string,
): Account | undefined {
  if (matchSubtype) {
    const match = all.find(
      (a) =>
        a.isActive !== false &&
        a.accountType === matchType &&
        a.accountSubtype === matchSubtype,
    );
    if (match) return match;
  }
  return all.find(
    (a) => a.isActive !== false && a.accountType === matchType,
  );
}

interface SystemAccounts {
  ar?: Account;
  ap?: Account;
  undeposited?: Account;
  retainedEarnings?: Account;
  defaultRevenue?: Account;
  defaultExpense?: Account;
  defaultOtherIncome?: Account;
  defaultOtherExpense?: Account;
  bankCashByBankId: Map<number, Account | undefined>;
}

async function buildSystemAccounts(
  allAccounts: Account[],
  allBanks: { id: number; linkedAccountId: number | null }[],
): Promise<SystemAccounts> {
  const bankCashByBankId = new Map<number, Account | undefined>();
  for (const b of allBanks) {
    const acc = b.linkedAccountId
      ? allAccounts.find((a) => a.id === b.linkedAccountId)
      : pickAccountByPriority(allAccounts, "asset", "bank") ||
        pickAccountByPriority(allAccounts, "asset", "cash");
    bankCashByBankId.set(b.id, acc);
  }
  const undeposited =
    allAccounts.find(
      (a) => a.name.toLowerCase().includes("undeposited"),
    ) ||
    pickAccountByPriority(allAccounts, "asset", "other_current_asset");
  return {
    ar: pickAccountByPriority(allAccounts, "asset", "accounts_receivable"),
    ap: pickAccountByPriority(allAccounts, "liability", "accounts_payable"),
    undeposited,
    retainedEarnings: pickAccountByPriority(
      allAccounts,
      "equity",
      "retained_earnings",
    ),
    defaultRevenue: pickAccountByPriority(
      allAccounts,
      "revenue",
      "service_revenue",
    ) || pickAccountByPriority(allAccounts, "revenue"),
    defaultExpense: pickAccountByPriority(
      allAccounts,
      "expense",
      "operating_expense",
    ) || pickAccountByPriority(allAccounts, "expense"),
    defaultOtherIncome:
      pickAccountByPriority(allAccounts, "revenue", "other_income") ||
      pickAccountByPriority(allAccounts, "revenue"),
    defaultOtherExpense:
      pickAccountByPriority(allAccounts, "expense", "other_expense") ||
      pickAccountByPriority(allAccounts, "expense"),
    bankCashByBankId,
  };
}

function inRange(d: Date, start?: Date, end?: Date) {
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

/**
 * Build the unified ledger by deriving from source documents and posted journal entries.
 *
 * Convention to avoid double counting:
 * - Bank transactions handle the cash side of all real cash movements (deposits, bill
 *   payments, expenses paid by check, transfers, raw bank entries). Their other side
 *   uses the categorical accountId on the bank transaction (or a default).
 * - Source documents (invoices, bills) only contribute the AR/AP/Revenue/Expense legs.
 * - Customer payments and Deposits move money between AR -> Undeposited -> Cash without
 *   touching cash directly (the deposit's bank transaction handles cash).
 */
async function buildLedger(opts: {
  endDate?: Date;
  startDate?: Date;
} = {}): Promise<{ lines: LedgerLine[]; sys: SystemAccounts; allAccounts: Account[] }> {
  const allAccounts = await db.select().from(accounts);
  const allBanks = await db.select().from(bankAccounts);
  const sys = await buildSystemAccounts(allAccounts, allBanks);

  const lines: LedgerLine[] = [];
  const push = (l: Partial<LedgerLine> & { accountId?: number; date: Date; debit?: number; credit?: number; source: string; sourceId: number; ref?: string; memo?: string }) => {
    if (!l.accountId) return;
    if (!l.debit && !l.credit) return;
    lines.push({
      accountId: l.accountId,
      date: l.date,
      debit: l.debit || 0,
      credit: l.credit || 0,
      source: l.source,
      sourceId: l.sourceId,
      ref: l.ref || "",
      memo: l.memo || "",
    });
  };

  // 1) Posted journal entries
  const journalRows = await db
    .select({
      jeId: journalEntries.id,
      jeNumber: journalEntries.entryNumber,
      jeDate: journalEntries.entryDate,
      jeMemo: journalEntries.memo,
      jeStatus: journalEntries.status,
      lineAccountId: journalEntryLines.accountId,
      lineDescription: journalEntryLines.description,
      lineDebit: journalEntryLines.debit,
      lineCredit: journalEntryLines.credit,
    })
    .from(journalEntries)
    .innerJoin(
      journalEntryLines,
      eq(journalEntryLines.journalEntryId, journalEntries.id),
    )
    .where(eq(journalEntries.status, "posted"));
  for (const r of journalRows) {
    push({
      accountId: r.lineAccountId,
      date: r.jeDate,
      debit: num(r.lineDebit),
      credit: num(r.lineCredit),
      source: "journal_entry",
      sourceId: r.jeId,
      ref: r.jeNumber,
      memo: r.lineDescription || r.jeMemo || "",
    });
  }

  // 2) Invoices (sent or paid contribute revenue + AR)
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(inArray(invoices.status, ["sent", "paid"] as const));
  for (const inv of invoiceRows) {
    const total = num(inv.total);
    const date = inv.createdAt || new Date();
    if (sys.ar) {
      push({
        accountId: sys.ar.id,
        date,
        debit: total,
        source: "invoice",
        sourceId: inv.id,
        ref: inv.invoiceNumber,
        memo: `Invoice ${inv.invoiceNumber}`,
      });
    }
    if (sys.defaultRevenue) {
      push({
        accountId: sys.defaultRevenue.id,
        date,
        credit: total,
        source: "invoice",
        sourceId: inv.id,
        ref: inv.invoiceNumber,
        memo: `Invoice ${inv.invoiceNumber}`,
      });
    }
  }

  // 3) Customer payments: Debit Undeposited, Credit AR
  const paymentRows = await db.select().from(payments);
  for (const p of paymentRows) {
    const amt = num(p.amount);
    if (sys.undeposited && sys.ar) {
      push({
        accountId: sys.undeposited.id,
        date: p.paymentDate,
        debit: amt,
        source: "payment",
        sourceId: p.id,
        ref: p.paymentNumber,
        memo: `Payment ${p.paymentNumber}`,
      });
      push({
        accountId: sys.ar.id,
        date: p.paymentDate,
        credit: amt,
        source: "payment",
        sourceId: p.id,
        ref: p.paymentNumber,
        memo: `Payment ${p.paymentNumber}`,
      });
    }
  }

  // 4) Deposits: Credit Undeposited (cash side handled by bank transaction)
  const depositRows = await db.select().from(deposits);
  for (const d of depositRows) {
    const amt = num(d.totalAmount);
    if (sys.undeposited) {
      push({
        accountId: sys.undeposited.id,
        date: d.depositDate,
        credit: amt,
        source: "deposit",
        sourceId: d.id,
        ref: `DEP-${d.id}`,
        memo: d.memo || `Deposit ${d.id}`,
      });
    }
  }

  // 5) Bills (non-draft, non-void): Debit expense by item.accountId, Credit AP
  const billRows = await db
    .select()
    .from(bills)
    .where(inArray(bills.status, ["pending", "partial", "paid"] as const));
  if (billRows.length > 0) {
    const billIds = billRows.map((b) => b.id);
    const itemRows = await db
      .select()
      .from(billItems)
      .where(inArray(billItems.billId, billIds));
    const itemsByBill = new Map<number, typeof itemRows>();
    for (const it of itemRows) {
      const arr = itemsByBill.get(it.billId) || [];
      arr.push(it);
      itemsByBill.set(it.billId, arr);
    }
    for (const b of billRows) {
      const total = num(b.total);
      if (sys.ap) {
        push({
          accountId: sys.ap.id,
          date: b.billDate,
          credit: total,
          source: "bill",
          sourceId: b.id,
          ref: b.billNumber,
          memo: `Bill ${b.billNumber}`,
        });
      }
      const items = itemsByBill.get(b.id) || [];
      let allocated = 0;
      for (const it of items) {
        const amt = num(it.amount);
        allocated += amt;
        const accId = it.accountId || sys.defaultExpense?.id;
        if (!accId) continue;
        push({
          accountId: accId,
          date: b.billDate,
          debit: amt,
          source: "bill_item",
          sourceId: it.id,
          ref: b.billNumber,
          memo: it.description,
        });
      }
      // Allocate any unaccounted residual (tax) to default expense to keep balanced
      const residual = total - allocated;
      if (Math.abs(residual) > 0.005 && sys.defaultExpense) {
        push({
          accountId: sys.defaultExpense.id,
          date: b.billDate,
          debit: residual,
          source: "bill",
          sourceId: b.id,
          ref: b.billNumber,
          memo: `Bill ${b.billNumber} tax/adj`,
        });
      }
    }
  }

  // 6) Bill payments: Debit AP, Credit Cash via bank transaction
  // The cash side comes from the bank transaction; here we only record the AP debit.
  const billPaymentRows = await db.select().from(billPayments);
  for (const bp of billPaymentRows) {
    if (sys.ap) {
      push({
        accountId: sys.ap.id,
        date: bp.paymentDate,
        debit: num(bp.amount),
        source: "bill_payment",
        sourceId: bp.id,
        ref: bp.reference || `BP-${bp.id}`,
        memo: `Bill payment`,
      });
    }
  }

  // 7) Direct expenses (no bill): Debit expense.accountId. Cash side via bank transaction.
  const expenseRows = await db.select().from(expenses);
  for (const e of expenseRows) {
    if (e.billId) continue; // covered by bill
    if (e.status === "void") continue;
    const amt = num(e.amount);
    const accId = e.accountId || sys.defaultExpense?.id;
    if (!accId) continue;
    push({
      accountId: accId,
      date: e.expenseDate,
      debit: amt,
      source: "expense",
      sourceId: e.id,
      ref: e.reference || `EXP-${e.id}`,
      memo: e.description || "Expense",
    });
  }

  // 8) Bank transactions - cash side for ALL bank movements
  const bankTxRows = await db.select().from(bankTransactions);
  for (const t of bankTxRows) {
    const cashAcc = sys.bankCashByBankId.get(t.bankAccountId);
    if (!cashAcc) continue;
    const amt = num(t.amount);
    const ref = t.checkNumber || t.reference || `BT-${t.id}`;
    const memo = t.description || t.payee || "";
    const isInflow = t.transactionType === "deposit" || t.transactionType === "refund";
    if (t.transactionType === "transfer") {
      const isOutgoing = amt < 0 || (t.transferToBankAccountId != null);
      const absAmt = Math.abs(amt);
      if (isOutgoing) {
        push({
          accountId: cashAcc.id,
          date: t.transactionDate,
          credit: absAmt,
          source: "bank_transaction",
          sourceId: t.id,
          ref,
          memo: `Transfer out: ${memo}`,
        });
        const destBankId = t.transferToBankAccountId;
        const destCash = destBankId ? sys.bankCashByBankId.get(destBankId) : null;
        const hasCounterpart = bankTxRows.some(
          (b) => b.id !== t.id && (b.linkedTransactionId === t.id || t.linkedTransactionId === b.id),
        );
        if (destCash && !hasCounterpart) {
          push({
            accountId: destCash.id,
            date: t.transactionDate,
            debit: absAmt,
            source: "bank_transaction",
            sourceId: t.id,
            ref,
            memo: `Transfer in: ${memo}`,
          });
        } else if (!hasCounterpart) {
          const fallback = t.accountId || sys.defaultOtherExpense?.id;
          if (fallback) {
            push({
              accountId: fallback,
              date: t.transactionDate,
              debit: absAmt,
              source: "bank_transaction",
              sourceId: t.id,
              ref,
              memo: `Transfer (unmatched): ${memo}`,
            });
          }
        }
      } else {
        push({
          accountId: cashAcc.id,
          date: t.transactionDate,
          debit: absAmt,
          source: "bank_transaction",
          sourceId: t.id,
          ref,
          memo: `Transfer in: ${memo}`,
        });
      }
      continue;
    }
    if (isInflow) {
      push({
        accountId: cashAcc.id,
        date: t.transactionDate,
        debit: amt,
        source: "bank_transaction",
        sourceId: t.id,
        ref,
        memo,
      });
    } else {
      push({
        accountId: cashAcc.id,
        date: t.transactionDate,
        credit: amt,
        source: "bank_transaction",
        sourceId: t.id,
        ref,
        memo,
      });
    }

    // Categorical other-side ONLY for raw bank entries (not linked to a bill payment,
    // expense, or deposit which already book the other side above).
    const linkedToDeposit = depositRows.some((d) => d.bankTransactionId === t.id);
    const linkedToBillPmt = billPaymentRows.some((bp) => bp.bankTransactionId === t.id);
    const linkedToExpense = expenseRows.some((e) => e.bankTransactionId === t.id);
    if (linkedToDeposit || linkedToBillPmt || linkedToExpense) continue;

    const otherAccId = t.accountId
      || (isInflow ? sys.defaultOtherIncome?.id : sys.defaultOtherExpense?.id);
    if (!otherAccId) continue;
    if (isInflow) {
      push({
        accountId: otherAccId,
        date: t.transactionDate,
        credit: amt,
        source: "bank_transaction",
        sourceId: t.id,
        ref,
        memo,
      });
    } else {
      push({
        accountId: otherAccId,
        date: t.transactionDate,
        debit: amt,
        source: "bank_transaction",
        sourceId: t.id,
        ref,
        memo,
      });
    }
  }

  // Apply date filtering after generation (we need full ledger for some reports;
  // filtering happens per-report).
  return { lines, sys, allAccounts };
}

const NORMAL_DEBIT = new Set(["asset", "expense"]);

function balanceFor(
  accountType: string,
  totalDebit: number,
  totalCredit: number,
): number {
  return NORMAL_DEBIT.has(accountType)
    ? totalDebit - totalCredit
    : totalCredit - totalDebit;
}

function aggregateByAccount(
  lines: LedgerLine[],
  asOf?: Date,
  start?: Date,
): Map<number, { debit: number; credit: number }> {
  const m = new Map<number, { debit: number; credit: number }>();
  for (const l of lines) {
    if (asOf && l.date > asOf) continue;
    if (start && l.date < start) continue;
    const cur = m.get(l.accountId) || { debit: 0, credit: 0 };
    cur.debit += l.debit;
    cur.credit += l.credit;
    m.set(l.accountId, cur);
  }
  return m;
}

function parseDate(v: any): Date | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function registerReportRoutes(app: Express) {
  const requireAdmin = async (req: Request, res: any): Promise<boolean> => {
    const user = await storage.getUser((req as any).session?.userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  };

  // Trial Balance - asOf
  app.get("/api/reports/trial-balance", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const asOf = parseDate(req.query.asOf) || new Date();
      const asOfEnd = endOfDay(asOf);
      const { lines, allAccounts } = await buildLedger();
      const agg = aggregateByAccount(lines, asOfEnd);
      const rows = allAccounts
        .filter((a) => a.isActive !== false)
        .map((a) => {
          const t = agg.get(a.id) || { debit: 0, credit: 0 };
          const bal = balanceFor(a.accountType, t.debit, t.credit);
          return {
            accountId: a.id,
            code: a.code,
            name: a.name,
            type: a.accountType,
            debit: t.debit,
            credit: t.credit,
            balance: bal,
          };
        })
        .sort((a, b) => a.code.localeCompare(b.code));
      const totals = rows.reduce(
        (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
        { debit: 0, credit: 0 },
      );
      res.json({ asOf: asOfEnd.toISOString(), rows, totals });
    } catch (err) {
      console.error("trial-balance error", err);
      res.status(500).json({ message: "Failed to build trial balance" });
    }
  });

  // Balance Sheet - asOf
  app.get("/api/reports/balance-sheet", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const asOf = parseDate(req.query.asOf) || new Date();
      const asOfEnd = endOfDay(asOf);
      const { lines, allAccounts } = await buildLedger();
      const agg = aggregateByAccount(lines, asOfEnd);

      // Net income for the current year up to asOf (revenue - expense)
      const yearStart = startOfYear(asOfEnd);
      const yearAgg = aggregateByAccount(lines, asOfEnd, yearStart);
      let yearRevenue = 0;
      let yearExpense = 0;
      for (const a of allAccounts) {
        const t = yearAgg.get(a.id);
        if (!t) continue;
        if (a.accountType === "revenue") yearRevenue += balanceFor("revenue", t.debit, t.credit);
        if (a.accountType === "expense") yearExpense += balanceFor("expense", t.debit, t.credit);
      }
      const netIncome = yearRevenue - yearExpense;

      const sectionsConfig: Array<{ key: string; label: string; type: string }> = [
        { key: "assets", label: "Assets", type: "asset" },
        { key: "liabilities", label: "Liabilities", type: "liability" },
        { key: "equity", label: "Equity", type: "equity" },
      ];
      const sections: Record<string, { label: string; groups: any[]; total: number }> = {};
      for (const cfg of sectionsConfig) {
        const accs = allAccounts
          .filter((a) => a.accountType === cfg.type && a.isActive !== false)
          .map((a) => {
            const t = agg.get(a.id) || { debit: 0, credit: 0 };
            const bal = balanceFor(a.accountType, t.debit, t.credit);
            return { accountId: a.id, code: a.code, name: a.name, subtype: a.accountSubtype, balance: bal };
          })
          .filter((r) => Math.abs(r.balance) > 0.005)
          .sort((a, b) => a.code.localeCompare(b.code));
        // Group by subtype
        const groupMap = new Map<string, any[]>();
        for (const r of accs) {
          const key = r.subtype || "other";
          const arr = groupMap.get(key) || [];
          arr.push(r);
          groupMap.set(key, arr);
        }
        const groups = Array.from(groupMap.entries()).map(([subtype, items]) => ({
          subtype,
          items,
          subtotal: items.reduce((s, x) => s + x.balance, 0),
        }));
        sections[cfg.key] = {
          label: cfg.label,
          groups,
          total: accs.reduce((s, x) => s + x.balance, 0),
        };
      }

      // Add Net Income row to equity
      sections.equity.groups.push({
        subtype: "net_income",
        items: [
          {
            accountId: 0,
            code: "",
            name: "Net Income (current period)",
            subtype: "net_income",
            balance: netIncome,
          },
        ],
        subtotal: netIncome,
      });
      sections.equity.total += netIncome;

      const liabPlusEq = sections.liabilities.total + sections.equity.total;

      res.json({
        asOf: asOfEnd.toISOString(),
        sections,
        totals: {
          assets: sections.assets.total,
          liabilities: sections.liabilities.total,
          equity: sections.equity.total,
          liabilitiesPlusEquity: liabPlusEq,
          difference: sections.assets.total - liabPlusEq,
        },
        netIncome,
      });
    } catch (err) {
      console.error("balance-sheet error", err);
      res.status(500).json({ message: "Failed to build balance sheet" });
    }
  });

  // Profit & Loss - date range
  app.get("/api/reports/profit-loss", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const today = new Date();
      const start = parseDate(req.query.startDate) || startOfYear(today);
      const end = parseDate(req.query.endDate) || today;
      const startD = startOfDay(start);
      const endD = endOfDay(end);
      const compStart = parseDate(req.query.compareStartDate);
      const compEnd = parseDate(req.query.compareEndDate);
      const { lines, allAccounts } = await buildLedger();

      const computePL = (sD: Date, eD: Date) => {
        const agg = aggregateByAccount(lines, eD, sD);
        const sectionFor = (type: string) =>
          allAccounts
            .filter((a) => a.accountType === type && a.isActive !== false)
            .map((a) => {
              const t = agg.get(a.id) || { debit: 0, credit: 0 };
              const bal = balanceFor(a.accountType, t.debit, t.credit);
              return { accountId: a.id, code: a.code, name: a.name, subtype: a.accountSubtype, amount: bal };
            })
            .filter((r) => Math.abs(r.amount) > 0.005)
            .sort((a, b) => a.code.localeCompare(b.code));
        const revenueAccts = sectionFor("revenue");
        const expenseAccts = sectionFor("expense");
        const by = (arr: any[], st: string) => arr.filter((a) => a.subtype === st);
        const sum = (arr: any[]) => arr.reduce((s, x) => s + x.amount, 0);
        const revenue = by(revenueAccts, "service_revenue");
        const otherIncome = by(revenueAccts, "other_income");
        const cogs = by(expenseAccts, "cost_of_goods");
        const operating = [...by(expenseAccts, "operating_expense"), ...by(expenseAccts, "payroll_expense")];
        const otherExpense = by(expenseAccts, "other_expense");
        const uncategorizedRev = revenueAccts.filter((a) => !["service_revenue", "other_income"].includes(a.subtype || ""));
        const uncategorizedExp = expenseAccts.filter((a) => !["cost_of_goods", "operating_expense", "payroll_expense", "other_expense"].includes(a.subtype || ""));
        const totalRevenue = sum(revenue) + sum(uncategorizedRev);
        const totalCogs = sum(cogs);
        const grossProfit = totalRevenue - totalCogs;
        const totalOperating = sum(operating) + sum(uncategorizedExp);
        const operatingIncome = grossProfit - totalOperating;
        const totalOtherIncome = sum(otherIncome);
        const totalOtherExpense = sum(otherExpense);
        const netIncome = operatingIncome + totalOtherIncome - totalOtherExpense;
        return {
          revenue: [...revenue, ...uncategorizedRev],
          totalRevenue,
          cogs,
          totalCogs,
          grossProfit,
          operating,
          uncategorizedExpense: uncategorizedExp,
          totalOperating,
          operatingIncome,
          otherIncome,
          totalOtherIncome,
          otherExpense,
          totalOtherExpense,
          netIncome,
        };
      };

      const current = computePL(startD, endD);
      let comparison: ReturnType<typeof computePL> | null = null;
      if (compStart && compEnd) {
        comparison = computePL(startOfDay(compStart), endOfDay(compEnd));
      }

      // Tie-out: compare period net income (P&L) against an INDEPENDENT measure
      // derived from the equity-side of the ledger.
      //
      // For a pure double-entry ledger with no contributed capital / draws activity:
      //   delta_equity (period) = net income (period)
      // To make this fully independent of any contributions/draws posted to
      // explicit equity accounts (e.g., owner_capital, owner_draws), we subtract
      // the period movement on those non-retained-earnings equity accounts:
      //   independentMovement = delta_equity_total - delta_other_equity_postings
      const balanceAt = (asOf: Date) => {
        const a = aggregateByAccount(lines, asOf);
        let equityTotal = 0;
        let otherEquityTotal = 0; // contributed capital, draws, etc.
        for (const acc of allAccounts) {
          if (acc.accountType !== "equity") continue;
          const t = a.get(acc.id);
          if (!t) continue;
          const bal = balanceFor("equity", t.debit, t.credit);
          equityTotal += bal;
          if (acc.accountSubtype !== "retained_earnings") {
            otherEquityTotal += bal;
          }
        }
        return { equityTotal, otherEquityTotal };
      };
      const beforeStart = new Date(startD.getTime() - 1);
      const begin = balanceAt(beforeStart);
      const finish = balanceAt(endD);
      const equityMovement = finish.equityTotal - begin.equityTotal;
      const otherEquityMovement = finish.otherEquityTotal - begin.otherEquityTotal;
      const retainedEarningsMovement = equityMovement - otherEquityMovement;
      const tieOut = {
        netIncome: current.netIncome,
        retainedEarningsMovement,
        equityMovement,
        otherEquityMovement,
        difference: current.netIncome - retainedEarningsMovement,
        balanced: Math.abs(current.netIncome - retainedEarningsMovement) < 0.005,
      };

      res.json({
        startDate: startD.toISOString(),
        endDate: endD.toISOString(),
        compareStartDate: compStart ? startOfDay(compStart).toISOString() : null,
        compareEndDate: compEnd ? endOfDay(compEnd).toISOString() : null,
        ...current,
        comparison,
        tieOut,
      });
    } catch (err) {
      console.error("profit-loss error", err);
      res.status(500).json({ message: "Failed to build P&L" });
    }
  });

  // General Ledger - date range, optional accountId
  app.get("/api/reports/general-ledger", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const today = new Date();
      const start = parseDate(req.query.startDate) || startOfYear(today);
      const end = parseDate(req.query.endDate) || today;
      const startD = startOfDay(start);
      const endD = endOfDay(end);
      const accountIdFilter = req.query.accountId
        ? parseInt(req.query.accountId, 10)
        : undefined;
      const { lines, allAccounts } = await buildLedger();
      const accountsToShow = accountIdFilter
        ? allAccounts.filter((a) => a.id === accountIdFilter)
        : allAccounts.filter((a) => a.isActive !== false);

      const result = accountsToShow
        .map((a) => {
          // Opening balance = activity strictly before startD
          let opening = 0;
          let runningDebit = 0;
          let runningCredit = 0;
          const accLines = lines.filter((l) => l.accountId === a.id);
          for (const l of accLines) {
            if (l.date < startD) {
              opening += NORMAL_DEBIT.has(a.accountType)
                ? l.debit - l.credit
                : l.credit - l.debit;
            }
          }
          const inRange = accLines
            .filter((l) => l.date >= startD && l.date <= endD)
            .sort((x, y) => x.date.getTime() - y.date.getTime());
          let running = opening;
          const entries = inRange.map((l) => {
            const delta = NORMAL_DEBIT.has(a.accountType)
              ? l.debit - l.credit
              : l.credit - l.debit;
            running += delta;
            runningDebit += l.debit;
            runningCredit += l.credit;
            return {
              date: l.date.toISOString(),
              ref: l.ref,
              source: l.source,
              memo: l.memo,
              debit: l.debit,
              credit: l.credit,
              balance: running,
            };
          });
          return {
            accountId: a.id,
            code: a.code,
            name: a.name,
            type: a.accountType,
            opening,
            entries,
            totalDebit: runningDebit,
            totalCredit: runningCredit,
            closing: running,
          };
        })
        .filter((r) => r.entries.length > 0 || Math.abs(r.opening) > 0.005)
        .sort((a, b) => a.code.localeCompare(b.code));

      res.json({
        startDate: startD.toISOString(),
        endDate: endD.toISOString(),
        accounts: result,
      });
    } catch (err) {
      console.error("general-ledger error", err);
      res.status(500).json({ message: "Failed to build general ledger" });
    }
  });

  // Cash Flow - indirect method
  app.get("/api/reports/cash-flow", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const today = new Date();
      const start = parseDate(req.query.startDate) || startOfYear(today);
      const end = parseDate(req.query.endDate) || today;
      const startD = startOfDay(start);
      const endD = endOfDay(end);
      const { lines, allAccounts } = await buildLedger();

      // Net income for period
      const periodAgg = aggregateByAccount(lines, endD, startD);
      let revenueTotal = 0, expenseTotal = 0;
      for (const a of allAccounts) {
        const t = periodAgg.get(a.id);
        if (!t) continue;
        if (a.accountType === "revenue") revenueTotal += balanceFor("revenue", t.debit, t.credit);
        if (a.accountType === "expense") expenseTotal += balanceFor("expense", t.debit, t.credit);
      }
      const netIncome = revenueTotal - expenseTotal;

      // Balance changes for working capital accounts
      const beforeStart = new Date(startD.getTime() - 1);
      const aggBefore = aggregateByAccount(lines, beforeStart);
      const aggEnd = aggregateByAccount(lines, endD);
      const balOf = (a: Account, m: Map<number, { debit: number; credit: number }>) => {
        const t = m.get(a.id) || { debit: 0, credit: 0 };
        return balanceFor(a.accountType, t.debit, t.credit);
      };
      const change = (a: Account) => balOf(a, aggEnd) - balOf(a, aggBefore);

      // Operating: changes in AR, AP, Other current assets/liabilities
      const arAccts = allAccounts.filter((a) => a.accountSubtype === "accounts_receivable");
      const apAccts = allAccounts.filter((a) => a.accountSubtype === "accounts_payable");
      const otherCurAssets = allAccounts.filter(
        (a) => a.accountType === "asset" && a.accountSubtype !== "accounts_receivable" && a.accountSubtype !== "cash" && a.accountSubtype !== "bank" && a.accountSubtype !== "fixed_asset",
      );
      const otherCurLiab = allAccounts.filter(
        (a) => a.accountType === "liability" && a.accountSubtype !== "accounts_payable" && a.accountSubtype !== "long_term_liability",
      );
      const fixedAssetsAcc = allAccounts.filter((a) => a.accountSubtype === "fixed_asset");
      const longTermLiab = allAccounts.filter((a) => a.accountSubtype === "long_term_liability");
      const equityAccts = allAccounts.filter((a) => a.accountType === "equity" && a.accountSubtype !== "retained_earnings");

      const sumChange = (arr: Account[]) => arr.reduce((s, a) => s + change(a), 0);
      const arChange = sumChange(arAccts);
      const apChange = sumChange(apAccts);
      const otherCurAssetsChange = sumChange(otherCurAssets);
      const otherCurLiabChange = sumChange(otherCurLiab);

      // Adjustments: Decrease in AR/Other Asset = +cash; Increase in AP/Other Liab = +cash
      const operatingAdj = -arChange - otherCurAssetsChange + apChange + otherCurLiabChange;
      const operatingCash = netIncome + operatingAdj;

      const investingCash = -sumChange(fixedAssetsAcc); // increase in fixed assets reduces cash
      const financingCash = sumChange(longTermLiab) + sumChange(equityAccts);

      const cashAccts = allAccounts.filter((a) => a.accountSubtype === "cash" || a.accountSubtype === "bank");
      const beginningCash = cashAccts.reduce((s, a) => s + balOf(a, aggBefore), 0);
      const endingCash = cashAccts.reduce((s, a) => s + balOf(a, aggEnd), 0);
      const netChange = operatingCash + investingCash + financingCash;

      res.json({
        startDate: startD.toISOString(),
        endDate: endD.toISOString(),
        netIncome,
        operating: {
          netIncome,
          adjustments: [
            { label: "(Increase)/Decrease in Accounts Receivable", amount: -arChange },
            { label: "(Increase)/Decrease in Other Current Assets", amount: -otherCurAssetsChange },
            { label: "Increase/(Decrease) in Accounts Payable", amount: apChange },
            { label: "Increase/(Decrease) in Other Current Liabilities", amount: otherCurLiabChange },
          ],
          total: operatingCash,
        },
        investing: {
          items: [{ label: "Purchase/Sale of Fixed Assets", amount: -sumChange(fixedAssetsAcc) }],
          total: investingCash,
        },
        financing: {
          items: [
            { label: "Long-Term Debt Change", amount: sumChange(longTermLiab) },
            { label: "Owner Equity Change", amount: sumChange(equityAccts) },
          ],
          total: financingCash,
        },
        beginningCash,
        endingCash,
        netChange,
        reconciliation: endingCash - beginningCash,
      });
    } catch (err) {
      console.error("cash-flow error", err);
      res.status(500).json({ message: "Failed to build cash flow" });
    }
  });

  // A/R Aging - asOf
  app.get("/api/reports/ar-aging", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const asOf = parseDate(req.query.asOf) || new Date();
      const asOfEnd = endOfDay(asOf);
      const allInvoices = await db.select().from(invoices);
      const allClients = await db.select().from(clients);
      const allPayments = await db.select().from(payments);

      const paidByInvoice = new Map<number, number>();
      for (const p of allPayments) {
        if (!p.invoiceId) continue;
        if (p.paymentDate > asOfEnd) continue;
        paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) || 0) + num(p.amount));
      }

      type Bucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";
      const bucketOrder: Bucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90plus"];
      const bucketize = (daysOverdue: number): Bucket => {
        if (daysOverdue <= 0) return "current";
        if (daysOverdue <= 30) return "d1_30";
        if (daysOverdue <= 60) return "d31_60";
        if (daysOverdue <= 90) return "d61_90";
        return "d90plus";
      };

      const byClient = new Map<number, any>();
      for (const inv of allInvoices) {
        if (inv.status === "cancelled" || inv.status === "draft") continue;
        const created = inv.createdAt || new Date();
        if (created > asOfEnd) continue;
        const total = num(inv.total);
        const paid = paidByInvoice.get(inv.id) || 0;
        const balance = total - paid;
        if (balance <= 0.005) continue;
        const due = inv.dueDate || created;
        const daysOverdue = Math.floor((asOfEnd.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        const bucket = bucketize(daysOverdue);
        const clientId = inv.clientId || 0;
        const client = allClients.find((c) => c.id === clientId);
        const clientName = client?.name || inv.recipientName || "Unknown";
        const cur = byClient.get(clientId) || {
          clientId,
          clientName,
          invoices: [],
          buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 },
          total: 0,
        };
        cur.invoices.push({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: created.toISOString(),
          dueDate: due.toISOString(),
          total,
          paid,
          balance,
          daysOverdue,
          bucket,
        });
        cur.buckets[bucket] += balance;
        cur.total += balance;
        byClient.set(clientId, cur);
      }
      const rows = Array.from(byClient.values()).sort((a, b) =>
        a.clientName.localeCompare(b.clientName),
      );
      const totals = rows.reduce(
        (acc, r) => {
          for (const b of bucketOrder) acc.buckets[b] += r.buckets[b];
          acc.total += r.total;
          return acc;
        },
        { buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }, total: 0 },
      );
      res.json({ asOf: asOfEnd.toISOString(), rows, totals });
    } catch (err) {
      console.error("ar-aging error", err);
      res.status(500).json({ message: "Failed to build A/R aging" });
    }
  });

  // A/P Aging - asOf
  app.get("/api/reports/ap-aging", isAuthenticated, async (req: any, res) => {
    try {
      if (!(await requireAdmin(req, res))) return;
      const asOf = parseDate(req.query.asOf) || new Date();
      const asOfEnd = endOfDay(asOf);
      const allBills = await db.select().from(bills);
      const allVendors = await db.select().from(vendors);
      const allBillPayments = await db.select().from(billPayments);

      const paidByBill = new Map<number, number>();
      for (const bp of allBillPayments) {
        if (bp.paymentDate > asOfEnd) continue;
        paidByBill.set(bp.billId, (paidByBill.get(bp.billId) || 0) + num(bp.amount));
      }

      type Bucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";
      const bucketOrder: Bucket[] = ["current", "d1_30", "d31_60", "d61_90", "d90plus"];
      const bucketize = (daysOverdue: number): Bucket => {
        if (daysOverdue <= 0) return "current";
        if (daysOverdue <= 30) return "d1_30";
        if (daysOverdue <= 60) return "d31_60";
        if (daysOverdue <= 90) return "d61_90";
        return "d90plus";
      };

      const byVendor = new Map<number, any>();
      for (const b of allBills) {
        if (b.status === "draft" || b.status === "void") continue;
        if (b.billDate > asOfEnd) continue;
        const total = num(b.total);
        const paid = paidByBill.get(b.id) || 0;
        const balance = total - paid;
        if (balance <= 0.005) continue;
        const due = b.dueDate || b.billDate;
        const daysOverdue = Math.floor((asOfEnd.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        const bucket = bucketize(daysOverdue);
        const vendor = allVendors.find((v) => v.id === b.vendorId);
        const cur = byVendor.get(b.vendorId) || {
          vendorId: b.vendorId,
          vendorName: vendor?.name || "Unknown",
          bills: [],
          buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 },
          total: 0,
        };
        cur.bills.push({
          id: b.id,
          billNumber: b.billNumber,
          date: b.billDate.toISOString(),
          dueDate: due.toISOString(),
          total,
          paid,
          balance,
          daysOverdue,
          bucket,
        });
        cur.buckets[bucket] += balance;
        cur.total += balance;
        byVendor.set(b.vendorId, cur);
      }
      const rows = Array.from(byVendor.values()).sort((a, b) =>
        a.vendorName.localeCompare(b.vendorName),
      );
      const totals = rows.reduce(
        (acc, r) => {
          for (const b of bucketOrder) acc.buckets[b] += r.buckets[b];
          acc.total += r.total;
          return acc;
        },
        { buckets: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }, total: 0 },
      );
      res.json({ asOf: asOfEnd.toISOString(), rows, totals });
    } catch (err) {
      console.error("ap-aging error", err);
      res.status(500).json({ message: "Failed to build A/P aging" });
    }
  });
}
