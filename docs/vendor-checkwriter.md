# Check writing

Write Check is in the Bookkeeping menu at /write-check. Bill-detail Write check links open the same full-page composer with that bill selected. The entry surface follows the check layout: company logo/information, number/date, payee, numeric amount, automatic words, memo and signature line. Bank selection is above the check; bill selection, expense category and supporting document upload are below it.

## Payment and attachment paths

- Select an existing open bill to pay it fully or partially. Its vendor is the payee, and the bill balance updates. No additional expense is created.
- Leave the existing-bill selection empty for a standalone check. Select an existing vendor or enter a payee, and select an active expense account. Issuance creates one paid expense linked to one uncleared bank transaction; no synthetic bill is created.
- Upload one supporting bill document (PDF, JPG or PNG, maximum 10 MB). Upload reservations belong to the signed-in session, stored files remain private, and downloads are admin-only. The attachment stays with the check and remains viewable after voiding. For a selected existing bill with a previously saved document, check history links to that document unless a new supporting file was uploaded.

Both paths use existing bank accounts, vendors, accounts, expenses, bill payments and bank reconciliation. New check snapshots are stored on the existing bank transaction. The existing bill-payment snapshot is also retained for backwards compatibility with payment history. Previously printed bill checks appear in check history using their existing snapshots.

Check history provides reprinting, attachment viewing, linked-bill and bank-register links, and voiding. Reprinting does not issue another payment. Voiding restores the bank book balance, reverses the standalone expense or restores the linked bill's unpaid balance, and retains the original check number, amount snapshot and document. Reconciled, cleared or reconciliation-assigned checks cannot be voided. Rebilled standalone expenses require accounting review before voiding. Older expense and register mutation paths reject editing or deleting printed checks directly; use Delete check for the coordinated reversal. Reconciliation flags remain editable.

## Print stock

US Letter with a top check and two vouchers; the check ends at the first perforation, 264 points from the top. Checks with saved bank details print the routing and account numbers as E-13B MICR in the bottom band. Use blank top-check stock without an existing banking/MICR line, MICR toner or ink, and actual-size printing (100%). Verify physical alignment and bank acceptance before using real checks.

The MICR line uses original GnuMICR Type 1 outlines at 12 points with a fixed 9-point (1/8-inch) pitch. The baseline is 250.5 points from the sheet top, 3/16 inch above the check edge. Transit symbols enclose the nine routing digits in positions 43 through 33 counted from the right; the account field begins at position 31 and ends with the on-us symbol. Numeric check numbers of up to nine digits print as an auxiliary on-us field to the left. Leading zeros are retained. The saved signature and caption sit above the 45-point (5/8-inch) clear band. Historical snapshots with neither banking field remain printable on their original preprinted bank stock; supplied but incomplete or invalid banking fields stop PDF creation.

GnuMICR is distributed as a separate static font source in client/public/fonts/gnumicr, with its original README and GPL license. Its glyph data is loaded before PDF creation and drawn as vector outlines; it is not compiled into the application bundle or converted through the upstream experimental TTF. A font-load failure stops preview before payment issuance, and reprints can retry a failed load. Deploy the whole public font directory along with the app. See [the original font source and licensing notes](https://github.com/alerque/gnumicr).

## Schema and release

Apply migrations/0007_standalone_checks.sql before starting the new release, after the previously released 0006 migration. The new migration adds only bank_transactions.check_details (nullable JSONB). On Replit, apply it to the development database and review the normal publishing migration; do not copy development data over production data.

## Validation

npm run test:checks runs amount/PDF/attachment tests and database-backed payment lifecycle tests using embedded PostgreSQL (PGlite). Database cases cover standalone expenses, bill payments without duplicate expenses, attachment retention, category validation, vendor mismatch, overpayment, duplicate submissions, voiding/idempotency, reconciliation guards and rollback after an injected expense-insert failure. PGlite serializes its database connections; this does not replace production multi-connection load testing.

Also run node --import tsx server/__tests__/accountGuard.test.ts, node script/check-overview.mjs and node --import tsx script/build.ts. The full typecheck retains 293 existing repository diagnostics; the new check modules have no diagnostics. Check actual browser uploads/downloads and physical print alignment before using real checks.

## Bank details and saved signature
Bank Accounts accepts an optional PNG/JPG signature, normalized to a PNG and saved in the database (migration 0008_check_signature.sql). Admins choose Print saved authorized signature per check; it is selected automatically when choosing a bank account with a saved signature and can be unchecked to sign manually. New issued checks snapshot the bank numbers and selected signature so future settings changes do not change reprints. Bank numbers are visible on the entry and printed in the PDF's MICR line using that saved snapshot. Legacy check snapshots remain printable with their original saved fields. Voided PDFs omit signatures. The bank register, check history and bill payment actions offer reprint, void and delete. Delete permanently removes the check, linked payment/expense and register entry in one transaction, restoring bank and bill balances; an already voided check is removed without reversing twice. Cleared, reconciled, reconciliation-assigned and rebilled checks cannot be deleted.

## Completing older check print details
“Add bank details / signature” explicitly fills missing routing/account numbers and the signature from the check’s original bank account, saves them on both check snapshots and downloads the PDF. Existing saved fields remain unchanged. Reprinting an issued check without bank numbers opens this confirmation instead of silently producing an unsigned banking line. This action never issues another payment. Void copies cannot gain a signature. No new migration is required for these changes; signature storage still requires migration 0008 from the earlier release.

## Checks from existing expenses
Expenses → row menu → Write check opens the shared composer with the original expense, amount, category and receipt. The server locks that expense and updates it in place; it never inserts a second expense. A pending expense gets one bank payment. An existing uncleared check payment on the same checking account is reused, without another register row or bank debit. Already printed checks open their existing reprint/actions. Paid non-check expenses, cleared/reconciled payments, bill-linked expenses, different amounts/vendors/categories and repeated submissions are rejected.

Voiding or deleting a check linked to an original expense restores the bank balance and returns that expense to pending, retaining its amount, receipt, original date, vendor reference, notes and rebill tracking. Deleting an old void check does not alter a replacement payment. Standalone checks retain the prior reversal behavior. All issuance and reversal updates are transactional. No schema migration is required; the original expense ID is kept in the existing check snapshot.
