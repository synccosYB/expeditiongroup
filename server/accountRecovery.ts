import { db } from "./db";
import { users, projects, type User } from "@shared/schema";
import { eq, inArray, and, isNotNull } from "drizzle-orm";
import { applyAccountChange, SYSTEM_ACTOR, logAccountRestoration, type Role } from "./accountGuard";

/**
 * One-time / startup recovery for accounts that were silently demoted from
 * admin/super_admin to client. Heuristic: any user with role=client who is
 * referenced as `assignedAdminId` on a project must have been an admin
 * (the project assignment endpoint only allows admin/super_admin to be
 * assigned). We promote them back to `admin` and clear their clientId.
 *
 * This runs at startup, but is a no-op if no candidates are found. Each
 * restoration is recorded in account_audit_logs with a SYSTEM actor.
 *
 * If you need to restore additional accounts (e.g. by explicit email list
 * from the project owner), set the env var ACCOUNT_RESTORE_EMAILS to a
 * comma-separated list of emails; those users will also be promoted back
 * to admin.
 */
export async function restoreDemotedAdmins(): Promise<number> {
  const candidates = new Map<string, User>();

  // Heuristic 1: users referenced as assignedAdminId on any project.
  const assignedRows = await db
    .selectDistinctOn([projects.assignedAdminId], { id: projects.assignedAdminId })
    .from(projects)
    .where(isNotNull(projects.assignedAdminId));
  const assignedIds = assignedRows
    .map((r) => r.id)
    .filter((v): v is string => typeof v === "string");

  if (assignedIds.length > 0) {
    const demoted = await db
      .select()
      .from(users)
      .where(and(inArray(users.id, assignedIds), eq(users.role, "client")));
    for (const u of demoted) candidates.set(u.id, u);
  }

  // Heuristic 2: explicit email allowlist via env var.
  const list = (process.env.ACCOUNT_RESTORE_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 0) {
    const byEmail = await db
      .select()
      .from(users)
      .where(inArray(users.email, list));
    for (const u of byEmail) {
      if (u.role === "client") candidates.set(u.id, u);
    }
  }

  if (candidates.size === 0) return 0;

  let restored = 0;
  for (const u of candidates.values()) {
    try {
      const beforeClientId = u.clientId ?? null;
      const beforeRole = u.role as Role;
      // Single guarded change: role -> admin AND clientId -> null. Clearing
      // clientId is always permitted by the policy (the guard only rejects
      // *attaching* a non-null clientId to admin/super_admin).
      const updated = await applyAccountChange(
        SYSTEM_ACTOR,
        u.id,
        { role: "admin", clientId: null },
        "Automatic restoration: user was demoted but is referenced as an admin owner",
      );
      await logAccountRestoration(
        SYSTEM_ACTOR,
        u,
        beforeRole,
        updated.role as Role,
        beforeClientId,
        updated.clientId ?? null,
        "Promoted back to admin and cleared stale client link",
      );
      restored += 1;
      console.log(`[account-recovery] Restored admin role for ${u.email}`);
    } catch (err: any) {
      console.error(`[account-recovery] Failed to restore ${u.email}: ${err.message}`);
    }
  }
  return restored;
}
