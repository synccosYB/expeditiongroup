# Automation Foundation — M01

## Scope
Introduce one shared automation engine across the existing CRM, intake, projects,
tasks, documents, proposals, and accounting modules. Preserve existing tables
and existing business behavior; do not create parallel task, invoice, or payment
records.

## Implemented in this first commit
- Typed, versioned event envelope and registry in `shared/automation-events.ts`.
- Pure validation helpers and regression tests.
- **No event publishing, background jobs, database migrations, or production changes.**

## Next implementation steps (not yet implemented)
1. Audit every write path and identify the actual commit point for each event.
2. Add append-only `automation_outbox` with unique event ID and transactional
   insertion alongside the original business write.
3. Add workflow definitions, immutable definition versions, workflow instances,
   step instances, execution attempts, and manual override history.
4. Add a bounded worker with retries, dead-letter handling, idempotency keys,
   authorization checks, and a disabled-by-default execution flag.
5. Connect read-only project and administration views before enabling actions.
6. Enable only low-risk operations (task creation and internal notifications)
   after explicit review. Require approval for outbound messages, invoice sends,
   journal posting, check printing, payment operations, and deletions.

## Invariants
- Existing records remain the single source of truth.
- Every event originates from a committed business transaction.
- Event replay must not duplicate a task, request, invoice, or accounting entry.
- Existing user permissions apply to every action; documents cannot grant rights.
- Human overrides are durable, attributed, and not silently undone.
- No historical automation is triggered by deploying a migration.
- Existing time logs and time entries must not both become billable from one event.

## Verification
Run `node --import tsx --test server/__tests__/automation-events.test.ts`,
`npm run check`, and `npm run build` before merging. Report any pre-existing
TypeScript failures separately. This change has not yet been runtime-tested.
