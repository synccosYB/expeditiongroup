import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { restoreDemotedAdmins, ensureProtectedSuperAdmins } from "./accountRecovery";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Startup database maintenance (schema migrations, data fixes, account recovery).
// These run in the BACKGROUND after the HTTP port is open so they never delay the
// server from accepting connections. If any of these block on the production
// database (lock contention, heavy joins on large tables), the deployment health
// check could otherwise time out waiting for the port to open.
function runStartupMaintenance() {
  storage.repairOrphanedInvoiceItems()
    .then((count) => {
      if (count > 0) {
        log(`Repaired ${count} orphaned invoice items`);
      }
    })
    .catch((err) => {
      log(`Failed to repair orphaned invoice items: ${err.message}`);
    });

  storage.ensureInvoiceIdColumns()
    .then(async () => {
      log(`Ensured invoice_id columns exist on time_entries and time_logs`);
      const count = await storage.migrateInvoiceIdToTimeEntries();
      if (count > 0) {
        log(`Migrated invoiceId to ${count} time logs/entries`);
      }
    })
    .catch((err: any) =>
      log(`Failed to ensure invoice_id columns or migrate: ${err.message}`),
    );

  // Account recovery writes to account_audit_logs, so ensure that table
  // exists BEFORE running the recovery/enforcement routines.
  storage.ensureAccountAuditLogsTable()
    .then(() => {
      log(`Ensured account_audit_logs table exists`);

      ensureProtectedSuperAdmins()
        .then((n) => {
          if (n > 0) log(`Enforced super_admin on ${n} protected account(s)`);
        })
        .catch((err) =>
          log(`Protected super admin enforcement failed: ${err.message}`),
        );

      restoreDemotedAdmins()
        .then((n) => {
          if (n > 0) log(`Restored ${n} demoted admin account(s)`);
        })
        .catch((err) => log(`Account restoration failed: ${err.message}`));
    })
    .catch((err: any) =>
      log(`Failed to ensure account_audit_logs table: ${err.message}`),
    );
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Open the port first so the deployment health check passes immediately,
      // then run database maintenance in the background.
      runStartupMaintenance();
    },
  );
})();
