# Vendor credits and refunds

Go to **Bookkeeping → Vendor Credits → New Vendor Credit**. Choose the vendor,
credit date, original expense category, amount, and optional reference/memo.

After saving:

- **Apply to Bill** reduces an open bill for the same vendor. Partial applications
  and splitting a credit across bills are supported. No bank payment is created.
- **Record Refund** records money already received in a bank or credit-card account.
  It does not initiate a bank transfer. For a vendor that returned money directly,
  create the credit first, then record its refund.
- **Reverse** restores the available credit and linked bill/bank balance. Cleared
  or reconciled refunds must be reviewed through reconciliation first.
- An unused credit can be deleted. Used credits require reversing their
  applications/refunds first. Creation and reversal snapshots remain in Audit Logs.

The bill detail and payment dialog display credits separately from cash payments.
The credit screen links applications to bills and refunds to their bank entries.
Edits to credited bills require reversing the applications first. Linked bill payments must be edited/deleted from their original Bills or Expenses
screen to keep balances synchronized. Linked refunds cannot be edited/deleted through generic bank-register actions; use Vendor Credits.

## Accounting and integrity

Recognition debits A/P and credits the selected expense category. Applying a
credit only allocates it to a bill. A refund credits A/P and uses one bank-register
refund entry for the corresponding debit to cash/card liability. It is not income.
A/P aging subtracts applications and displays remaining vendor credits as negative
current balances, using the report's as-of date.

`bills.amount_paid` remains cash paid; `amount_credited` stores applied credit;
`amount_due` reflects both. Bill/check payments use the remaining balance.
Applications and refunds lock the credit row and run in a database transaction.
Normal bill payments, checkwriter payments and Expenses → Pay Bill lock the bill row as well. Amounts use integer cents.
Request UUIDs prevent duplicate credit/application/refund submissions.
All routes require an authenticated admin or super-admin.

## Deployment

1. Apply the additive migration to the target database before starting the new
   application code: `npm run db:migrate-vendor-credits` with `DATABASE_URL` set.
   The migration is transactional and can be rerun.
2. Build and deploy the application normally.
3. Verify the Vendor Credits menu, create/apply/refund flow, bank register, bill
   balances, A/P aging, and reconciliation in a non-production test account first.

The SQL migration includes a bill-balance trigger. `drizzle-kit push` alone does
not install that trigger; run the migration command. No existing monetary rows
are rewritten. Rolling the application back does not require dropping the tables;
retain them and the trigger to preserve posted credit history.

## Validation

- `npm run test:vendor-credits`: PostgreSQL-compatible PGlite lifecycle tests,
  migration rerun, validation, duplicate/competing submissions, separate cash and
  credit balances, checkwriter integration, bank/card refunds, reversal safeguards,
  reporting date boundaries and UI rendering.
- `npm run test:checks`: existing checkwriter regression suite.
- `npm run build`: client and server production build.
- `npm run check`: repository-wide TypeScript baseline remains failing. The
  implementation was compared against the unchanged source to ensure no additional
  diagnostic messages. The unchanged source had 294 errors; this version had 275.

PGlite serializes transactions; its competing-request tests are not a substitute
for a multi-connection PostgreSQL load test. Production migration and live UI
verification are deployment steps, not performed by these tests.
