# Vendor PDF checkwriter

Admins can use Write check on an open vendor bill. Bank Accounts contains the full account/routing numbers, company name/address and next check number. The PDF uses the existing Expedition Group logo.

The layout is US Letter with the check in the top third and two vouchers below. It requires preprinted check stock with its own banking/MICR line. It does not generate a MICR line for blank stock. Print at actual size (100%) and verify positioning on the selected stock before issuing real checks.

Issue check and download PDF records an issued payment, not a draft or a cleared bank transaction. The payment and an uncleared check register entry are written in one database transaction, along with the bill/account balances and next number. Reconciliation uses the existing register entry. No separate check register or vendor directory is created.

Reprint check downloads the saved payee, company details, amount, date, bill reference and memo without issuing another payment. Void check reverses the bill payment, restores the book balance and keeps a zero-value register entry and the original check snapshot. Cleared checks and checks assigned to reconciliation cannot be voided by this action. The original number cannot be reused. Older payment/register mutation paths reject changing or deleting printed checks; reconciliation flags remain editable.

## Release requirements

Apply migrations/0006_vendor_checkwriter.sql before starting the updated application, or use the repository's existing Drizzle schema deployment process. This is an additive migration. No production schema was changed while preparing this branch.

Verify issuance, concurrent duplicate submissions, rollback, voiding, and reconciliation against a staging PostgreSQL database before release. No DATABASE_URL or live application session was available in the preparation workspace, so database and browser workflows remain unverified. Confirm physical alignment on the chosen preprinted stock.

## Checks

- node --import tsx --test server/__tests__/checkwriter.test.ts (seven amount and PDF checks).
- DATABASE_URL=postgresql://localhost/checkwriter_unit_tests node --import tsx server/__tests__/accountGuard.test.ts (ten pure policy checks; no database connection).
- node --import tsx script/check-overview.mjs.
- node --import tsx script/build.ts.
- npm run check: the unchanged baseline and branch both report 293 existing diagnostics; no additional diagnostic messages were introduced.

The PDF was rendered with Poppler and visually inspected with sample vendor data, including the real company logo. That verifies the generated page, not physical check-stock alignment.
