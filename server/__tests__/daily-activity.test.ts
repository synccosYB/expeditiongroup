import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { createDailyActivityHandler } from "../daily-activity";
import { users, timeLogs, timeEntries, notes, documents, tasks, auditLogs } from "../../shared/schema";

test("daily activity totals use the selected scope and the calendar dates shown in Time Logs", async (t) => {
  // Import storage with an unusable connection, then route its read queries to
  // disposable PostgreSQL. Never start the application or use a real database.
  process.env.DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/daily_activity_test";
  const { DatabaseStorage } = await import("../storage");
  const { db, pool } = await import("../db");
  const pg = new PGlite();
  const database = drizzle(pg);
  t.mock.method(db, "select", database.select.bind(database));
  t.after(async () => { await pool.end(); await pg.close(); });

  for (const table of [users, timeLogs, timeEntries, notes, documents, tasks, auditLogs]) {
    const { name, columns } = getTableConfig(table);
    const definitions = columns.map((column) => {
      if (column.primary && column.getSQLType() === "integer") {
        return `"${column.name}" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY`;
      }
      return `"${column.name}" ${column.enumValues ? "text" : column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`;
    });
    await pg.exec(`CREATE TABLE "${name}" (${definitions.join(", ")});`);
  }
  await database.insert(users).values([
    { id: "admin", email: "admin@example.test", role: "admin" },
    { id: "other", email: "other@example.test", role: "super_admin" },
    { id: "client", email: "client@example.test", role: "client" },
  ]);
  const records = Array.from({ length: 95 }, (_, index) => ({
    userId: index < 79 ? "admin" : "other",
    projectId: 1,
    taskDescription: `Recorded work ${index + 1}`,
    date: new Date(`2026-11-23T${index === 0 ? "00:00:00.000" : index === 94 ? "23:59:59.999" : "12:00:00.000"}Z`),
    totalHours: index < 77 ? "0.1" : index === 77 ? "0.2" : index === 78 ? "0.5" : "0.25",
    type: "office" as const,
    invoiceId: index === 0 ? 9 : null,
  }));
  await database.insert(timeLogs).values([
    ...records,
    { ...records[0], date: new Date("2026-11-22T23:59:59.999Z"), totalHours: "100" },
    { ...records[0], date: new Date("2026-11-24T00:00:00.000Z"), totalHours: "100" },
  ]);
  const eventDate = new Date(2026, 10, 23, 12);
  await database.insert(notes).values({ userId: "other", content: "Team note", createdAt: eventDate });
  await database.insert(documents).values({ uploadedByUserId: "other", projectId: 1, fileName: "Team permit", createdAt: eventDate });
  await database.insert(tasks).values({ assigneeId: "other", projectId: 1, title: "Team task", completedAt: eventDate });
  await database.insert(auditLogs).values({ userId: "other", action: "create", description: "Team action", createdAt: eventDate });

  const storage = new DatabaseStorage();
  const projectLookup = t.mock.method(storage, "getProject", async () => ({ name: "Permit project" }) as any);
  t.mock.method(storage, "getTask", async () => ({ title: "Permit task" }) as any);
  const app = express();
  app.use((req, _res, next) => {
    req.session = { userId: req.get("x-test-user") || "admin" } as any;
    next();
  });
  app.get("/generate", createDailyActivityHandler(storage));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const request = (query: string, user = "admin") => fetch(`http://127.0.0.1:${address.port}/generate?${query}`, {
    headers: { "x-test-user": user },
  });

  await t.test("all users includes every one of the 95 records, billed work, and the whole team", async () => {
    const response = await request("date=2026-11-23&scope=all");
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.scope, "all");
    assert.equal(result.stats.timeEntriesCount, 95);
    assert.equal(result.hoursWorked, "12.4");
    assert.ok(Math.abs(result.stats.totalMinutes - 744) < 1e-8);
    assert.match(result.summary, /^All users: Logged 95 time entries/);
    assert.equal(result.stats.notesCreatedCount, 1);
    assert.equal(result.stats.documentsProcessedCount, 1);
    assert.equal(result.stats.tasksCompletedCount, 1);
    assert.match(result.details, /Activity scope: All users/);
    assert.match(result.details, /Team note/);
    assert.match(result.details, /Team action/);
    assert.equal(projectLookup.mock.callCount(), 1, "repeated project lookups are cached");
  });

  await t.test("my activity and older callers keep the 79-entry personal total", async () => {
    for (const suffix of ["&scope=mine", "", "&scope=mine&userId=other"]) {
      const response = await request(`date=2026-11-23${suffix}`);
      const result = await response.json();
      assert.equal(result.scope, "mine");
      assert.equal(result.stats.timeEntriesCount, 79);
      assert.equal(result.hoursWorked, "8.4");
      assert.equal(result.stats.notesCreatedCount, 0);
      assert.equal(result.stats.documentsProcessedCount, 0);
      assert.equal(result.stats.tasksCompletedCount, 0);
      assert.doesNotMatch(result.details, /Team note|Team action/);
    }
  });

  await t.test("task-linked entries are counted together with legacy time logs", async () => {
    await database.insert(timeEntries).values({
      userId: "other", projectId: 1, taskId: 1,
      date: new Date("2026-11-23T00:00:00Z"), totalMinutes: 30, isBillable: false,
    });
    const result = await (await request("date=2026-11-23&scope=all", "other")).json();
    assert.equal(result.stats.timeEntriesCount, 96);
    assert.equal(result.hoursWorked, "12.9");
    assert.match(result.details, /Permit task: 30m/);
  });

  await t.test("empty dates produce zero counts and no invented hours", async () => {
    const result = await (await request("date=2026-11-25&scope=all")).json();
    assert.equal(result.stats.timeEntriesCount, 0);
    assert.equal(result.hoursWorked, "");
    assert.match(result.summary, /No tracked activity/);
  });

  await t.test("rounding happens after summing the stored hours", async () => {
    await database.insert(timeLogs).values(Array.from({ length: 3 }, () => ({
      ...records[0], date: new Date("2026-11-26T12:00:00Z"), totalHours: "0.08",
    })));
    const result = await (await request("date=2026-11-26&scope=all")).json();
    assert.equal(result.hoursWorked, "0.2", "do not sum the individually rounded 0.1-hour labels");
    assert.ok(Math.abs(result.stats.totalMinutes - 14.4) < 1e-8);
  });

  await t.test("documents without a project still appear in the team summary", async () => {
    await database.insert(documents).values({ fileName: "Unassigned permit", createdAt: eventDate });
    const response = await request("date=2026-11-23&scope=all");
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.match(result.details, /Unknown: Unassigned permit/);
  });

  await t.test("invalid dates and scopes are rejected", async () => {
    for (const query of ["date=2026-02-30", "date=2026-13-01", "date=invalid", "date=2026-11-23&scope=other", "date=2026-11-23&scope=all&scope=mine", "date=2026-11-23&date=2026-11-24"]) {
      assert.equal((await request(query)).status, 400, query);
    }
  });

  await t.test("client and unknown accounts cannot generate a team summary", async () => {
    for (const user of ["client", "unknown"]) {
      assert.equal((await request("date=2026-11-23&scope=all", user)).status, 403);
    }
  });
});
