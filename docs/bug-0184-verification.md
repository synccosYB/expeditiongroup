# BUG-0184 — Deploy & Verify Report (Task #57)

## Summary

The Task #55 fix (route ordering for `GET /api/client/projects/by-status` so it
isn't shadowed by `GET /api/client/projects/:id`) is present in `main` and is
correct. However, **the original BUG-0184 reproduction (the affected
ExpeditionGroup contact seeing all zeros) will NOT be resolved by a redeploy
alone**. Production data shows the affected user record is not linked to any
client, so the endpoint correctly returns 403 and the dashboard renders zeros.

This report captures what was checked, what was found, and what should happen
next. Personally-identifying details (emails, full user UUIDs) have been
redacted; the unredacted values are available via the production database
skill if needed.

## Deployment status

- `.replit` already declares the correct production config:
  - `deploymentTarget = "autoscale"`
  - `build = ["npm", "run", "build"]`
  - `run = ["npm", "run", "start"]`
- No deployment config changes were needed.
- Publishing must be triggered by the user from the main project (task agents
  cannot trigger a publish). After this task is merged, the user should click
  **Publish** to push the Task #55 fix live.

## Code on `main` that is being deployed

`server/routes.ts` (≈ lines 1507–1553) defines the routes in the correct order
— `/api/client/projects/by-status` is registered **before**
`/api/client/projects/:id`, so Express routes the literal path correctly:

```ts
app.get("/api/client/projects/by-status", isAuthenticated, async (req, res) => { ... });
app.get("/api/client/projects/:id", isAuthenticated, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (!Number.isInteger(projectId) || String(projectId) !== req.params.id) {
    return res.status(400).json({ message: "Invalid project id" });
  }
  ...
});
```

`server/storage.ts#getProjectsByClientId` (≈ line 702) returns all projects for
the caller's client; the route then filters on `isVisibleToClient` and groups
by status. That logic is correct and unchanged.

## Production database findings (read-only)

All checks were run via the database skill against the production read replica.
PII is masked below.

### 1. There is no "ExpeditionGroup" client in production

```
SELECT id, name FROM clients ORDER BY id;
-- 6 rows returned. None match `name ILIKE '%expedition%'` or '%braun%'.
```

The bug ticket's client name does not exist in the live data. There are 6
clients in production, none corresponding to "ExpeditionGroup".

### 2. The affected user has no client linkage

```
SELECT id, email, first_name, last_name, client_id, role
FROM users
WHERE first_name ILIKE '%yitz%' OR last_name ILIKE '%braun%';
```

Two rows are returned for the same person (duplicate accounts):

| user id (redacted) | email (redacted)              | client_id | has 'client' role |
| ------------------ | ----------------------------- | --------- | ----------------- |
| `7aa727e0-…`       | `s***@gmail.com`              | NULL      | no                |
| `a5518e34-…`       | `r***@gmail.com`              | NULL      | no                |

Only 5 users in the entire system have the `client` role, one each for
clients 1, 2, 3, and 20. The affected user is not one of them. Combined with
the NULL `client_id`, the portal middleware
(`if (!user?.clientId) return 403`) short-circuits every client-portal
endpoint for this user — including the pipeline endpoint — regardless of
whether the route-ordering fix is deployed.

### 3. The pipeline endpoint will work for properly-linked client users

Visible (`is_visible_to_client = true`), multi-status project distribution
per client (counts only):

| client_id | statuses with visible projects | total visible |
| --------- | ------------------------------ | ------------- |
| 1         | 2                              | 3             |
| 2         | 5                              | 25            |
| 3         | 5                              | 30            |

Clients 2 and 3 have visible projects spread across multiple pipeline
statuses, and their primary contacts are properly linked client users with
`role = 'client'`. Once `main` is published, those users' Job Pipeline cards
will show non-zero counts that match their "My Projects" total.

## Root cause for BUG-0184 (matches Step 5 cause "c")

The pipeline endpoint is fine. The reason the affected user keeps seeing
zeros is that the signed-in user record has no `clientId` (and is not
`role = 'client'`), so `/api/client/projects/by-status` returns
`403 No client access`, which the dashboard renders as an empty list → all
stages show `0`. A hard refresh, and even a redeploy, cannot fix this — it's
a data/admin linkage problem.

## What needs to happen next

1. **User action**: Publish current `main` from the main project so the
   route-ordering fix goes live for the already-linked client users
   (clients 2 and 3 in particular).
2. **Follow-up #58**: Confirm with the team which client and which email the
   affected user should be using, set that user's `client_id` and
   `role = 'client'`, and verify with him that the Job Pipeline now shows
   real numbers.
3. **Follow-up #59**: Address the duplicate-account hygiene issue so this
   class of confusion doesn't recur (two separate rows for the same person
   is part of why this took multiple bug reports to triage).

## Files reviewed (no changes made)

- `server/routes.ts` (lines 1476–1553)
- `server/storage.ts` (line 702 — `getProjectsByClientId`)
- `client/src/pages/client/dashboard.tsx` (lines 40–204)
- `shared/schema.ts` (`users.clientId`, `projects.isVisibleToClient`)
- `.replit` (deployment block)
