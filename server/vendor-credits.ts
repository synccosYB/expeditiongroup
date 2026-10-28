import type { Express } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import {
  accounts,
  bankAccounts,
  bankTransactions,
  bills,
  vendorCredits,
  vendorCreditApplications,
  vendorRefunds,
  vendors,
} from "@shared/schema";
import { moneyToCents } from "@shared/checkwriter";
import {
  createVendorCredit,
  applyVendorCredit,
  refundVendorCredit,
  removeVendorCreditEntry,
  VendorCreditError,
} from "./vendor-credit-service";
export function registerVendorCreditRoutes(app: Express) {
  const admin = async (req: any, res: any, next: any) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (user?.role !== "admin" && user?.role !== "super_admin")
        return res.status(403).json({ message: "Forbidden" });
      next();
    } catch (e) {
      next(e);
    }
  };
  const fail = (res: any, e: unknown) => {
    if (e instanceof z.ZodError || e instanceof VendorCreditError)
      return res
        .status(400)
        .json({
          message:
            e instanceof z.ZodError
              ? e.issues.map((i) => i.message).join("; ")
              : e.message,
        });
    console.error("Vendor credit operation failed", e);
    return res
      .status(500)
      .json({ message: "Unable to complete vendor credit operation" });
  };
  const id = (value: string) => z.coerce.number().int().positive().parse(value);
  app.get("/api/vendor-credits", isAuthenticated, admin, async (_req, res) => {
    try {
      const credits = await db
        .select({
          credit: vendorCredits,
          vendorName: vendors.name,
          accountName: accounts.name,
        })
        .from(vendorCredits)
        .innerJoin(vendors, eq(vendors.id, vendorCredits.vendorId))
        .innerJoin(accounts, eq(accounts.id, vendorCredits.accountId))
        .orderBy(desc(vendorCredits.creditDate), desc(vendorCredits.id));
      const applications = await db
        .select({
          entry: vendorCreditApplications,
          billNumber: bills.billNumber,
        })
        .from(vendorCreditApplications)
        .innerJoin(bills, eq(bills.id, vendorCreditApplications.billId));
      const refunds = await db
        .select({
          entry: vendorRefunds,
          bankAccountId: bankAccounts.id,
          bankName: bankAccounts.name,
        })
        .from(vendorRefunds)
        .innerJoin(
          bankTransactions,
          eq(bankTransactions.id, vendorRefunds.bankTransactionId),
        )
        .innerJoin(
          bankAccounts,
          eq(bankAccounts.id, bankTransactions.bankAccountId),
        );
      res.json(
        credits.map(({ credit, vendorName, accountName }) => {
          const appliedRows = applications
            .filter((a) => a.entry.creditId === credit.id)
            .map((a) => ({ ...a.entry, billNumber: a.billNumber }));
          const refundRows = refunds
            .filter((r) => r.entry.creditId === credit.id)
            .map((r) => ({
              ...r.entry,
              bankAccountId: r.bankAccountId,
              bankName: r.bankName,
            }));
          const applied = appliedRows.reduce(
            (sum, a) => sum + moneyToCents(a.amount),
            0,
          );
          const refunded = refundRows.reduce(
            (sum, r) => sum + moneyToCents(r.amount),
            0,
          );
          return {
            ...credit,
            vendorName,
            accountName,
            applications: appliedRows,
            refunds: refundRows,
            applied: (applied / 100).toFixed(2),
            refunded: (refunded / 100).toFixed(2),
            available: (
              (moneyToCents(credit.amount) - applied - refunded) /
              100
            ).toFixed(2),
          };
        }),
      );
    } catch (e) {
      fail(res, e);
    }
  });
  app.post(
    "/api/vendor-credits",
    isAuthenticated,
    admin,
    async (req: any, res) => {
      try {
        res
          .status(201)
          .json(await createVendorCredit(db, req.body, req.session.userId));
      } catch (e) {
        fail(res, e);
      }
    },
  );
  app.post(
    "/api/vendor-credits/:id/applications",
    isAuthenticated,
    admin,
    async (req: any, res) => {
      try {
        res
          .status(201)
          .json(
            await applyVendorCredit(
              db,
              id(req.params.id),
              req.body,
              req.session.userId,
            ),
          );
      } catch (e) {
        fail(res, e);
      }
    },
  );
  app.post(
    "/api/vendor-credits/:id/refunds",
    isAuthenticated,
    admin,
    async (req: any, res) => {
      try {
        res
          .status(201)
          .json(
            await refundVendorCredit(
              db,
              id(req.params.id),
              req.body,
              req.session.userId,
            ),
          );
      } catch (e) {
        fail(res, e);
      }
    },
  );
  app.delete(
    "/api/vendor-credits/:id",
    isAuthenticated,
    admin,
    async (req: any, res) => {
      try {
        res.json(
          await removeVendorCreditEntry(
            db,
            id(req.params.id),
            "credit",
            id(req.params.id),
            req.session.userId,
          ),
        );
      } catch (e) {
        fail(res, e);
      }
    },
  );
  for (const [route, kind] of [
    ["applications", "application"],
    ["refunds", "refund"],
  ] as const) {
    app.delete(
      `/api/vendor-credits/:id/${route}/:entryId`,
      isAuthenticated,
      admin,
      async (req: any, res) => {
        try {
          res.json(
            await removeVendorCreditEntry(
              db,
              id(req.params.id),
              kind,
              id(req.params.entryId),
              req.session.userId,
            ),
          );
        } catch (e) {
          fail(res, e);
        }
      },
    );
  }
}
