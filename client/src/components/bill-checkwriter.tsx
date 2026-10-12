import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildCheckPdf } from "@/lib/checkPdf";
import type { BankAccount, Bill, BillPayment } from "@shared/schema";
import type { CheckDetails } from "@shared/checkwriter";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";

async function loadLogo(): Promise<string> {
  const img = new Image();
  img.src = logoUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 780;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to prepare the company logo");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
const refresh = () => {
  for (const key of ["/api/bills", "/api/bank-accounts", "/api/bank-transactions", "/api/bank-reconciliations", "/api/reconciliations", "/api/dashboard"]) queryClient.invalidateQueries({ queryKey: [key] });
};

export function BillCheckwriter({ bill, accounts }: { bill: Bill & { vendor?: { name: string; address?: string | null } }; accounts: BankAccount[] }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState(bill.amountDue || "0");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [memo, setMemo] = useState(bill.billNumber || "");
  const [result, setResult] = useState<BillPayment | null>(null);
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      const account = accounts.find(a => a.id === Number(accountId));
      if (!account) throw new Error("Select a checking account");
      const logo = await loadLogo();
      // Validate print geometry before recording a payment.
      buildCheckPdf({ number, amount, date, memo, companyName: account.checkCompanyName || "", companyAddress: account.checkCompanyAddress || "", bankName: account.bankName || "", payee: bill.vendor?.name || "", payeeAddress: bill.vendor?.address || "", billNumber: bill.billNumber || "", status: "issued", issuedBy: 0 }, logo);
      const response = await apiRequest("POST", `/api/bills/${bill.id}/checks`, { bankAccountId: Number(accountId), number, amount, date, memo });
      const payment: BillPayment = await response.json();
      setResult(payment);
      refresh();
      if (payment.checkDetails) buildCheckPdf(payment.checkDetails, logo).save(`check-${payment.checkDetails.number}.pdf`);
      return payment;
    },
    onSuccess: () => { toast({ title: "Check issued", description: "Bill payment recorded; check is uncleared in bank reconciliation." }); },
    onError: (e: Error) => { refresh(); toast({ title: "Checkwriter", description: e.message, variant: "destructive" }); },
  });
  if (bill.status === "void" || bill.status === "draft" || Number(bill.amountDue) <= 0) return null;
  return <>
    <Button variant="outline" size="sm" onClick={() => { setResult(null); setAmount(bill.amountDue || "0"); setOpen(true); }}>Write check</Button>
    <Dialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value); }}>
      <DialogContent><DialogHeader><DialogTitle>Pay vendor by check</DialogTitle><DialogDescription>Letter-size check on top, two vouchers below, with the Expedition Group logo. Print at 100% on preprinted check stock. Issuing records payment and adds an uncleared check to reconciliation.</DialogDescription></DialogHeader>
        {result ? <div className="space-y-3"><p>Check {result.reference} was issued. Reprint it from this bill's payment history if needed.</p><Button onClick={() => setOpen(false)}>Done</Button></div> : <div className="space-y-3">
          <Label>Checking account</Label><Select value={accountId} onValueChange={v => { setAccountId(v); setNumber(String(accounts.find(a => a.id === Number(v))?.nextCheckNumber || 1)); }}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.filter(a => a.isActive && a.accountType === "checking").map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name} - {a.accountNumber?.slice(-4)}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="check-number">Check number</Label><Input id="check-number" value={number} onChange={e => setNumber(e.target.value)} /></div><div><Label htmlFor="check-date">Date</Label><Input id="check-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div></div>
          <Label htmlFor="check-amount">Amount</Label><Input id="check-amount" type="number" step="0.01" min="0.01" max={bill.amountDue || "0"} value={amount} onChange={e => setAmount(e.target.value)} />
          <Label htmlFor="check-memo">Memo</Label><Input id="check-memo" maxLength={150} value={memo} onChange={e => setMemo(e.target.value)} />
          <Link href="/bank-accounts" className="text-sm underline">Set up bank account and company information</Link>
          <Button className="w-full" disabled={!accountId || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Issuing..." : "Issue check and download PDF"}</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}

export function CheckPaymentActions({ payment }: { payment: BillPayment }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const details = payment.checkDetails;
  if (!details) return null;
  const download = async () => {
    setBusy(true);
    try { buildCheckPdf(details as CheckDetails, await loadLogo()).save(`check-${details.number}.pdf`); }
    catch (e) { toast({ title: "PDF unavailable", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const voidCheck = async () => {
    setBusy(true);
    try { await apiRequest("POST", `/api/bill-payments/${payment.id}/void-check`); refresh(); setConfirm(false); toast({ title: "Check voided", description: "The bill balance was restored. The check number remains in history." }); }
    catch (e) { toast({ title: "Cannot void check", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={download}>{details.status === "void" ? "Void copy" : "Reprint check"}</Button>{details.status !== "void" && <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(true)}>Void check</Button>}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Void check {details.number}?</DialogTitle><DialogDescription>This restores the bill's unpaid balance and keeps the original check in history. Only uncleared checks outside reconciliation can be voided.</DialogDescription></DialogHeader><Button disabled={busy} onClick={voidCheck}>Confirm void</Button></DialogContent></Dialog>
  </div>;
}
