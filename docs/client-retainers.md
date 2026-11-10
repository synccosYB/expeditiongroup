# Client retainers

Open **Clients → client name → Billing** and select a project. Set its target
and low-balance threshold, then create an initial request. Staff can copy the
request details and share them with the client. Record each receipt as money
arrives, including partial receipts. Deposit those receipts through **Undeposited
Funds**.

Use **Apply retainer** from Billing or an issued invoice. The invoice and
retainer must belong to the same client and project. The invoice shows the
application separately from cash payments. When funds reach the threshold,
Billing displays the amount needed to restore the target. Staff can create one
open replenishment request per project.

Use **Retainer history** to reverse an application or void an undeposited
receipt. Reverse an erroneous bank deposit through **Deposits** before voiding
its receipt. Cleared or reconciled retainer deposits require review in the bank
register. Cancelling a partially funded request leaves its receipts in the
retainer. The client portal displays the effect of applications on invoices
the client can see. Staff manage all retainer requests and receipts.

## Accounting

Funding debits Undeposited Funds and credits the **Client Retainers** liability
account. A deposit moves that cash to the bank. Applying funds debits the
liability and credits Accounts Receivable. Open requests are tracked separately
from issued invoices. The general ledger and A/R aging include the posting and
reversal dates.

## Release

1. Run `npm run db:migrate-client-retainers` against the target database before
   starting the new application. The migration is additive and can be rerun.
   It creates the **Client Retainers** liability account.
2. Confirm the chart has an active **Undeposited Funds** asset account and
   **Accounts Receivable** asset account. The workflow uses these accounts
   when staff record receipts and apply funds. Retainer deposits also use an
   active bank or cash asset account.
3. Build and publish the application. Run the request, receipt, application and
   deposit flow with a test client before posting actual receipts.

The migration adds fields to the shared payments table. Once retainers have
been posted, an older application version will classify the receipts incorrectly
in its reports. Preserve the retainer history when planning a rollback.

Run `npm run test:client-retainers` to exercise the migration and lifecycle.
