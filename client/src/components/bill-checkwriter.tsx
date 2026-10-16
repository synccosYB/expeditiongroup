import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildCheckPdf } from "@/lib/checkPdf";
import { checkLogo, refreshChecks } from "@/components/check-composer";
import type { BankAccount, Bill, BillPayment } from "@shared/schema";
import type { CheckDetails, CheckRecord } from "@shared/checkwriter";

export function BillCheckwriter({ bill }: { bill: Bill; accounts?: BankAccount[] }) {
  if (bill.status === "void" || bill.status === "draft" || Number(bill.amountDue) <= 0) return null;
  return <Button variant="outline" size="sm" asChild><Link href={`/write-check?bill=${bill.id}`}>Write check</Link></Button>;
}

export function CheckPaymentActions({ payment }: { payment: BillPayment }) {
  if (!payment.checkDetails) return null;
  return <CheckRecordActions check={{ id: payment.bankTransactionId || payment.id, bankAccountId: payment.bankAccountId, amount: payment.amount, checkDetails: payment.checkDetails }} paymentId={payment.id} />;
}

export function CheckRecordActions({ check, paymentId }: { check: CheckRecord; paymentId?: number }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [action, setAction] = useState<"void" | "delete" | "print">("void");
  const details = check.checkDetails;
  if (!details) return null;
  const download = async () => {
    if (details.status !== "void" && (!details.routingNumber || !details.accountNumber)) { setAction("print"); setConfirm(true); return; }
    setBusy(true);
    try { (await buildCheckPdf(details as CheckDetails, await checkLogo())).save(`check-${details.number}.pdf`); }
    catch (e) { toast({ title: "PDF unavailable", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const voidCheck = async () => {
    setBusy(true);
    try { await apiRequest("POST", paymentId ? `/api/bill-payments/${paymentId}/void-check` : `/api/checks/${check.id}/void`); refreshChecks(); setConfirm(false); toast({ title: "Check voided", description: "The payment was reversed. The check number and attached document remain in history." }); }
    catch (e) { toast({ title: "Cannot void check", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const confirmAction = async () => {
    if (action === "void") return voidCheck();
    setBusy(true);
    try {
      if (action === "delete") {
        await apiRequest("DELETE", `/api/checks/${check.id}`);
        toast({ title: "Check deleted", description: "The check and linked payment or expense were removed. The bank and bill balances were restored." });
      } else {
        const response = await apiRequest("POST", `/api/checks/${check.id}/print-details`);
        const updated: CheckDetails = await response.json();
        refreshChecks();
        (await buildCheckPdf(updated, await checkLogo())).save(`check-${updated.number}.pdf`);
        toast({ title: "Check PDF ready", description: updated.signature ? "Includes MICR banking details and the saved signature." : "Includes MICR banking details. Save a signature in Bank Accounts to add one." });
      }
      refreshChecks(); setConfirm(false);
    } catch (e) { toast({ title: action === "delete" ? "Cannot delete check" : "Cannot prepare check", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap gap-2">{details.attachment && <Button size="sm" variant="outline" asChild><a href={`/api/checks/${check.id}/attachment`} target="_blank" rel="noopener noreferrer">View bill document</a></Button>}<Button size="sm" variant="outline" disabled={busy} onClick={download}>{details.status === "void" ? "Void copy" : "Reprint check"}</Button>{details.status !== "void" && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setAction("void"); setConfirm(true); }}>Void check</Button>}
    {details.status !== "void" && (!details.routingNumber || !details.accountNumber || !details.signature) && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setAction("print"); setConfirm(true); }}>Add bank details / signature</Button>}
    <Button size="sm" variant="destructive" disabled={busy} onClick={() => { setAction("delete"); setConfirm(true); }}>Delete check</Button>
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>{action === "delete" ? "Delete" : action === "print" ? "Complete print details for" : "Void"} check {details.number}?</DialogTitle><DialogDescription>{action === "delete" ? "This permanently removes the check, its linked payment or expense, and its register entry, and restores the bank and bill balances. Already voided checks are removed without reversing twice. Cleared or reconciled checks cannot be deleted." : action === "print" ? "Fill missing routing/account numbers and signature from this check’s bank account, save them on this check, and download the PDF. Existing saved numbers and signatures stay as they are. Verify the selected bank account before proceeding." : "This reverses the payment and keeps the original check and attachment in history. Only uncleared checks outside reconciliation can be voided."}</DialogDescription></DialogHeader><Button variant={action === "delete" ? "destructive" : "default"} disabled={busy} onClick={confirmAction}>{action === "delete" ? "Confirm delete" : action === "print" ? "Save details and download" : "Confirm void"}</Button></DialogContent></Dialog>
  </div>;
}
