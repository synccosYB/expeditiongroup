/**
 * Run with: npx tsx server/__tests__/accountGuard.test.ts
 *
 * Pure unit tests for the account guard policy (no DB).
 */
import assert from "node:assert/strict";
import { validateAccountChange, AccountGuardError, type ActorContext } from "../accountGuard";

const superAdmin: ActorContext = { userId: "u1", email: "su@x", role: "super_admin" };
const admin: ActorContext = { userId: "u2", email: "a@x", role: "admin" };
const system: ActorContext = { userId: null, email: null, role: null };

function expectThrow(fn: () => void, status: number, msgPart: string) {
  try {
    fn();
    assert.fail("expected to throw");
  } catch (e: any) {
    assert.ok(e instanceof AccountGuardError, `not AccountGuardError: ${e}`);
    assert.equal(e.status, status, `status: ${e.status}`);
    assert.ok(
      e.message.toLowerCase().includes(msgPart.toLowerCase()),
      `message: ${e.message}`,
    );
  }
}

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (e: any) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("validateAccountChange");

test("rejects demoting admin to client (portal-access)", () => {
  expectThrow(
    () => validateAccountChange(admin, { role: "admin", clientId: null }, { role: "client" }),
    400,
    "admin",
  );
});

test("rejects demoting super_admin to client", () => {
  expectThrow(
    () => validateAccountChange(superAdmin, { role: "super_admin", clientId: null }, { role: "client" }),
    400,
    "admin",
  );
});

test("rejects attaching clientId to an admin (link endpoint)", () => {
  expectThrow(
    () => validateAccountChange(admin, { role: "admin", clientId: null }, { clientId: 5 }),
    400,
    "link",
  );
});

test("rejects attaching clientId to a super_admin", () => {
  expectThrow(
    () => validateAccountChange(superAdmin, { role: "super_admin", clientId: null }, { clientId: 5 }),
    400,
    "link",
  );
});

test("rejects regular admin lowering a super_admin's role", () => {
  expectThrow(
    () => validateAccountChange(admin, { role: "super_admin", clientId: null }, { role: "admin" }),
    403,
    "super admin",
  );
});

test("allows super_admin to lower another super_admin", () => {
  validateAccountChange(superAdmin, { role: "super_admin", clientId: null }, { role: "admin" });
});

test("rejects regular admin granting super_admin", () => {
  expectThrow(
    () => validateAccountChange(admin, { role: "admin", clientId: null }, { role: "super_admin" }),
    403,
    "super admin",
  );
});

test("allows admin to change a client's role to admin", () => {
  validateAccountChange(admin, { role: "client", clientId: 1 }, { role: "admin" });
});

test("allows admin to link a brand-new (client-role) user", () => {
  validateAccountChange(admin, { role: "client", clientId: null }, { clientId: 7, role: "client" });
});

test("system actor can do anything (used for startup recovery)", () => {
  validateAccountChange(system, { role: "client", clientId: 2 }, { role: "super_admin" });
});

console.log(`\n${passed} passed`);
