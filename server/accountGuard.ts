import { db } from "./db";
import { users, accountAuditLogs, type User, type AccountAuditLog } from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";

export type Role = "super_admin" | "admin" | "client";

export class AccountGuardError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "AccountGuardError";
  }
}

export interface AccountChange {
  role?: Role;
  clientId?: number | null;
}

export interface ActorContext {
  userId: string | null;
  email: string | null;
  role: Role | null;
}

export const SYSTEM_ACTOR: ActorContext = { userId: null, email: null, role: null };

/**
 * Accounts that must always remain super_admin and can never be demoted by
 * anyone (including other super admins or the automatic recovery routine).
 * yoel@synccos.com is the permanent project owner. Additional protected
 * emails can be supplied via the PROTECTED_SUPER_ADMIN_EMAILS env var
 * (comma-separated).
 */
export function protectedSuperAdminEmails(): string[] {
  const base = ["yoel@synccos.com"];
  const extra = (process.env.PROTECTED_SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...base, ...extra]));
}

export function isProtectedSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return protectedSuperAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Pure validator (no DB). Throws AccountGuardError when the change is not
 * permitted by the policy:
 *
 *  - a protected super_admin (see protectedSuperAdminEmails) can never be
 *    demoted or relinked, by anyone
 *  - admins/super_admins cannot be silently demoted to `client`
 *  - admins/super_admins cannot have a clientId attached
 *  - only a super_admin can lower another super_admin
 *  - non-super_admin actors cannot grant super_admin
 */
export function validateAccountChange(
  actor: ActorContext,
  target: Pick<User, "role" | "clientId"> & { email?: string | null },
  changes: AccountChange,
): void {
  const isSystem = actor.userId === null;
  const actorRole = actor.role;
  const targetRole = target.role as Role;

  if (isProtectedSuperAdmin(target.email)) {
    if (changes.role !== undefined && changes.role !== "super_admin") {
      throw new AccountGuardError(
        "This account is a protected super admin and cannot be demoted.",
        403,
      );
    }
    if (changes.clientId !== undefined && changes.clientId !== null) {
      throw new AccountGuardError(
        "This account is a protected super admin and cannot be linked to a client.",
        403,
      );
    }
  }

  if (changes.role !== undefined) {
    const newRole = changes.role;

    if (
      newRole === "client" &&
      (targetRole === "admin" || targetRole === "super_admin")
    ) {
      throw new AccountGuardError(
        "Cannot demote an admin or super admin account to a client. Use a different email address or change the role explicitly first.",
        400,
      );
    }

    if (
      targetRole === "super_admin" &&
      newRole !== "super_admin" &&
      !isSystem &&
      actorRole !== "super_admin"
    ) {
      throw new AccountGuardError(
        "Only a super admin can change a super admin's role.",
        403,
      );
    }

    if (newRole === "super_admin" && !isSystem && actorRole !== "super_admin") {
      throw new AccountGuardError(
        "Only a super admin can grant the super admin role.",
        403,
      );
    }
  }

  if (changes.clientId !== undefined && changes.clientId !== null) {
    if (targetRole === "admin" || targetRole === "super_admin") {
      throw new AccountGuardError(
        "Cannot link an admin or super admin account to a client.",
        400,
      );
    }
  }
}

/**
 * Apply a sensitive change to a user (role and/or clientId), writing an audit
 * log entry for every successful change. Validates via validateAccountChange.
 */
export async function applyAccountChange(
  actor: ActorContext,
  targetUserId: string,
  changes: AccountChange,
  reason?: string,
): Promise<User> {
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) {
    throw new AccountGuardError("User not found", 404);
  }

  validateAccountChange(actor, target, changes);

  const update: Partial<Pick<User, "role" | "clientId">> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  let roleChanged = false;
  let linkChanged = false;

  if (changes.role !== undefined && changes.role !== target.role) {
    update.role = changes.role;
    roleChanged = true;
  }
  if (
    changes.clientId !== undefined &&
    (changes.clientId ?? null) !== (target.clientId ?? null)
  ) {
    update.clientId = changes.clientId;
    linkChanged = true;
  }

  if (!roleChanged && !linkChanged) {
    return target;
  }

  const [updated] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, targetUserId))
    .returning();

  const entries: Parameters<typeof db.insert>[0] extends never ? never : any[] = [];
  if (roleChanged) {
    entries.push({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetUserId,
      targetEmail: target.email,
      action: "role_change" as const,
      beforeRole: target.role,
      afterRole: updated.role,
      beforeClientId: target.clientId ?? null,
      afterClientId: updated.clientId ?? null,
      reason: reason ?? null,
    });
  }
  if (linkChanged) {
    entries.push({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      targetUserId,
      targetEmail: target.email,
      action: "client_link_change" as const,
      beforeRole: target.role,
      afterRole: updated.role,
      beforeClientId: target.clientId ?? null,
      afterClientId: updated.clientId ?? null,
      reason: reason ?? null,
    });
  }
  if (entries.length > 0) {
    await db.insert(accountAuditLogs).values(entries);
  }

  return updated;
}

export async function logAccountDeletion(
  actor: ActorContext,
  target: Pick<User, "id" | "email" | "role" | "clientId">,
  reason?: string,
): Promise<void> {
  await db.insert(accountAuditLogs).values({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    targetUserId: target.id,
    targetEmail: target.email,
    action: "account_deleted",
    beforeRole: target.role,
    afterRole: null,
    beforeClientId: target.clientId ?? null,
    afterClientId: null,
    reason: reason ?? null,
  });
}

export async function logAccountRestoration(
  actor: ActorContext,
  target: Pick<User, "id" | "email">,
  beforeRole: Role | string,
  afterRole: Role,
  beforeClientId: number | null,
  afterClientId: number | null,
  reason: string,
): Promise<void> {
  await db.insert(accountAuditLogs).values({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    targetUserId: target.id,
    targetEmail: target.email,
    action: "account_restored",
    beforeRole: beforeRole as string,
    afterRole,
    beforeClientId,
    afterClientId,
    reason,
  });
}

export interface AccountAuditFilters {
  targetUserId?: string;
  actorUserId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export async function listAccountAuditLogs(
  filters: AccountAuditFilters = {},
): Promise<AccountAuditLog[]> {
  const where = [] as any[];
  if (filters.targetUserId) where.push(eq(accountAuditLogs.targetUserId, filters.targetUserId));
  if (filters.actorUserId) where.push(eq(accountAuditLogs.actorUserId, filters.actorUserId));
  if (filters.startDate) where.push(gte(accountAuditLogs.createdAt, filters.startDate));
  if (filters.endDate) where.push(lte(accountAuditLogs.createdAt, filters.endDate));

  const query = db
    .select()
    .from(accountAuditLogs)
    .orderBy(desc(accountAuditLogs.createdAt))
    .limit(Math.min(filters.limit ?? 500, 1000));

  if (where.length > 0) {
    return await query.where(and(...where));
  }
  return await query;
}

export async function actorFromUserId(userId: string | null): Promise<ActorContext> {
  if (!userId) return SYSTEM_ACTOR;
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return SYSTEM_ACTOR;
  return { userId: u.id, email: u.email, role: u.role as Role };
}
