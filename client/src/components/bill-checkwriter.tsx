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
  const details = check.checkDetails;
  if (!details) return null;
  const download = async () => {
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
  return <div className="flex flex-wrap gap-2">{details.attachment && <Button size="sm" variant="outline" asChild><a href={`/api/checks/${check.id}/attachment`} target="_blank" rel="noopener noreferrer">View bill document</a></Button>}<Button size="sm" variant="outline" disabled={busy} onClick={download}>{details.status === "void" ? "Void copy" : "Reprint check"}</Button>{details.status !== "void" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(true)}>Void check</Button>}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Void check {details.number}?</DialogTitle><DialogDescription>This reverses the payment and keeps the original check and attachment in history. Only uncleared checks outside reconciliation can be voided.</DialogDescription></DialogHeader><Button disabled={busy} onClick={voidCheck}>Confirm void</Button></DialogContent></Dialog>
  </div>;
}
