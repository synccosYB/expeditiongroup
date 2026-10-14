import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildCheckPdf } from "@/lib/checkPdf";
import { amountInWords, checkRequestSchema, type CheckRecord } from "@shared/checkwriter";
import type { Account, BankAccount, Bill, Vendor } from "@shared/schema";
import logoUrl from "@/assets/logo-expedition-group-checkbox.svg";
export type CheckBill = Bill & { vendor?: Vendor };
export async function checkLogo(): Promise<string> {
  const img = new Image(); img.src = logoUrl; await img.decode();
  const canvas = document.createElement("canvas"); canvas.width = 780; canvas.height = 120;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Unable to prepare company logo");
  context.drawImage(img, 0, 0, canvas.width, canvas.height); return canvas.toDataURL("image/png");
}
export function refreshChecks() {
  for (const key of ["/api/checks", "/api/bills", "/api/expenses", "/api/bank-accounts", "/api/bank-transactions", "/api/reconciliations", "/api/dashboard", "/api/reports"]) queryClient.invalidateQueries({ queryKey: [key] });
}
export function CheckComposer({ banks, vendors, accounts, bills, initialBillId }: { banks: BankAccount[]; vendors: Vendor[]; accounts: Account[]; bills: CheckBill[]; initialBillId?: number }) {
  const [bankId, setBankId] = useState("");
  const [printSignature, setPrintSignature] = useState(false);
  const [billId, setBillId] = useState(initialBillId ? String(initialBillId) : "none");
  const [vendorId, setVendorId] = useState("manual");
  const [payee, setPayee] = useState("");
  const [payeeAddress, setPayeeAddress] = useState("");
  const [accountId, setAccountId] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const initialBill = bills.find(b => b.id === initialBillId);
  const [amount, setAmount] = useState(initialBill?.amountDue || "");
  const [memo, setMemo] = useState(initialBill?.billNumber || "");
  const [attachment, setAttachment] = useState<{ path: string; name: string }>();
  const [uploading, setUploading] = useState(false);
  const [issued, setIssued] = useState<CheckRecord>();
  const { toast } = useToast();
  const bank = banks.find(b => b.id === Number(bankId));
  const bill = bills.find(b => b.id === Number(billId));
  const vendor = bill ? vendors.find(v => v.id === bill.vendorId) || bill.vendor : vendors.find(v => v.id === Number(vendorId));
  const chosenPayee = vendor?.name || payee;
  const chosenAddress = vendor ? [vendor.address, [vendor.city, vendor.state, vendor.zip].filter(Boolean).join(", ")].filter(Boolean).join("\n") : payeeAddress;
  let words = "Amount in words fills automatically"; try { if (amount) words = amountInWords(amount); } catch { words = "Enter an amount with up to two decimal places"; }
  const openBills = bills.filter(b => b.status !== "void" && b.status !== "draft" && Number(b.amountDue) > 0);
  const submit = useMutation({
    mutationFn: async () => {
      if (!bank) throw new Error("Select a checking account");
      const data = checkRequestSchema.parse({ bankAccountId: bank.id, number, date, amount, memo, billId: bill?.id, vendorId: vendor?.id, payee: chosenPayee, payeeAddress: chosenAddress, accountId: bill ? undefined : Number(accountId) || undefined, printSignature, attachment });
      const logo = await checkLogo();
      buildCheckPdf({ number, date, amount, memo, payee: chosenPayee, payeeAddress: chosenAddress, companyName: bank.checkCompanyName || "", companyAddress: bank.checkCompanyAddress || "", bankName: bank.bankName || "", routingNumber: bank.routingNumber || "", accountNumber: bank.accountNumber || "", signature: printSignature ? bank.checkSignature || undefined : undefined, billNumber: bill?.billNumber || "", status: "issued", issuedBy: "preview" }, logo);
      const response = await apiRequest("POST", "/api/checks", data);
      const record: CheckRecord = await response.json();
      setIssued(record); refreshChecks();
      // Keep issuance success separate from a failed browser download, so retrying cannot issue another payment.
      try { buildCheckPdf(record.checkDetails, logo).save(`check-${record.checkDetails.number}.pdf`); }
      catch { toast({ title: "Check issued", description: "PDF download failed. Use Reprint check in history to download the same check." }); }
      return record;
    },
    onSuccess: () => toast({ title: "Check issued", description: "Payment recorded and added to reconciliation as uncleared." }),
    onError: (e: Error) => toast({ title: "Cannot issue check", description: e.message, variant: "destructive" }),
  });
  const upload = async (file: File) => {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) { toast({ title: "Attach a PDF, JPG or PNG smaller than 10 MB", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const response = await apiRequest("POST", "/api/checks/upload-url", { name: file.name, contentType: file.type });
      const { url, path, method } = await response.json();
      const transfer = await fetch(url, { method, headers: { "Content-Type": file.type }, body: file });
      if (!transfer.ok) throw new Error("Bill upload failed");
      setAttachment({ path, name: file.name });
    } catch (e) { toast({ title: "Cannot attach bill", description: (e as Error).message, variant: "destructive" }); }
    finally { setUploading(false); }
  };
  if (issued) return <div className="rounded-xl border bg-card p-6 space-y-4"><h2 className="text-xl font-semibold">Check {issued.checkDetails.number} issued</h2><p>{issued.checkDetails.payee} · ${issued.checkDetails.amount}</p><p className="text-sm text-muted-foreground">The payment is uncleared in the bank register and ready for reconciliation.</p><div className="flex flex-wrap gap-3"><Button onClick={() => { setIssued(undefined); setPrintSignature(false); setBillId("none"); setAmount(""); setMemo(""); setAttachment(undefined); setNumber(String(bank?.nextCheckNumber || 1)); }}>Write another check</Button><Button variant="outline" asChild><Link href={`/bank-register/${issued.bankAccountId}?txn=${issued.id}`}>View bank register</Link></Button></div></div>;
  const busy = submit.isPending || uploading;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-4"><div className="w-full sm:w-80"><Label>Checking account</Label><Select disabled={busy} value={bankId} onValueChange={value => { setBankId(value); setPrintSignature(false); setNumber(String(banks.find(b => b.id === Number(value))?.nextCheckNumber || 1)); }}><SelectTrigger><SelectValue placeholder="Choose bank account" /></SelectTrigger><SelectContent>{banks.filter(b => b.isActive && b.accountType === "checking").map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name} · {b.accountNumber?.slice(-4)}</SelectItem>)}</SelectContent></Select></div><Link href="/bank-accounts" className="text-sm underline pb-2">Bank and company settings</Link></div>
    <fieldset disabled={busy} aria-label="Check entry" className="rounded-xl border border-teal-800/25 bg-white text-slate-900 shadow-sm p-5 sm:p-7 space-y-5" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(13,148,136,.025) 5px,rgba(13,148,136,.025) 6px)" }}>
      <div className="flex flex-col sm:flex-row justify-between gap-5"><div><img src={logoUrl} alt="Expedition Group" className="h-8 mb-3" /><p className="font-semibold">{bank?.checkCompanyName || "Company name"}</p><p className="whitespace-pre-line text-xs text-slate-600">{bank?.checkCompanyAddress || "Select a bank account to fill company information"}</p></div><div className="grid grid-cols-2 gap-3 sm:w-72"><div><Label htmlFor="check-number">Check no.</Label><Input id="check-number" className="bg-transparent border-0 border-b rounded-none" value={number} onChange={e => setNumber(e.target.value)} /></div><div><Label htmlFor="check-date">Date</Label><Input id="check-date" type="date" className="bg-transparent border-0 border-b rounded-none" value={date} onChange={e => setDate(e.target.value)} /></div><p className="col-span-2 text-right text-xs text-slate-600">{bank?.bankName}</p></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr_160px] items-end gap-3"><Label className="text-xs uppercase tracking-wide">Pay to the<br />order of</Label><div>{bill ? <Input aria-label="Payee" readOnly value={chosenPayee} className="bg-transparent border-0 border-b rounded-none text-lg" /> : <><Select value={vendorId} onValueChange={setVendorId}><SelectTrigger className="bg-transparent border-0 border-b rounded-none"><SelectValue placeholder="Select payee" /></SelectTrigger><SelectContent><SelectItem value="manual">Enter payee name</SelectItem>{vendors.filter(v => v.isActive).map(v => <SelectItem value={String(v.id)} key={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>{vendorId === "manual" && <Input aria-label="Payee name" placeholder="Payee name" maxLength={255} value={payee} onChange={e => setPayee(e.target.value)} className="bg-transparent border-0 border-b rounded-none" />}</>}</div><div><Label htmlFor="check-amount">$ Amount</Label><Input id="check-amount" type="number" min="0.01" step="0.01" max={bill?.amountDue || undefined} className="bg-transparent border-0 border-b rounded-none text-lg" value={amount} onChange={e => setAmount(e.target.value)} /></div></div>
      <p aria-live="polite" className="border-b border-slate-300 pb-2 text-sm min-h-8">{words}</p>
      <div className="text-xs text-slate-600 whitespace-pre-line min-h-8">{!vendor && !bill ? <Input aria-label="Payee address" placeholder="Payee address (optional)" value={payeeAddress} onChange={e => setPayeeAddress(e.target.value)} className="bg-transparent border-0 border-b rounded-none" /> : chosenAddress}</div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px] gap-8 items-end"><div><Label htmlFor="check-memo">Memo</Label><Input id="check-memo" maxLength={150} className="bg-transparent border-0 border-b rounded-none" value={memo} onChange={e => setMemo(e.target.value)} /></div><div className="text-center">{printSignature && bank?.checkSignature && <img src={bank.checkSignature} alt="Authorized signature" className="h-12 w-full object-contain" />}<div className="border-t border-slate-500 pt-2 text-[10px] uppercase tracking-wider text-slate-500">Authorized signature{!printSignature && " · sign after printing"}</div></div></div>
      {bank && <p className="text-sm font-mono">Routing: {bank.routingNumber || "Not configured"} · Account: {bank.accountNumber || "Not configured"}</p>}
      {bank?.checkSignature && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={printSignature} onChange={e => setPrintSignature(e.target.checked)} />Print saved authorized signature</label>}
      <p className="text-xs text-slate-400">Preprinted check stock · print at actual size (100%)</p>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label>Attach an existing bill</Label><Select disabled={busy} value={billId} onValueChange={value => { setBillId(value); const b = bills.find(b => b.id === Number(value)); if (b) { setAmount(b.amountDue); setMemo(b.billNumber); setVendorId(String(b.vendorId)); } }}><SelectTrigger><SelectValue placeholder="No existing bill" /></SelectTrigger><SelectContent><SelectItem value="none">No existing bill — standalone check</SelectItem>{openBills.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.billNumber} · {b.vendor?.name || vendors.find(v => v.id === b.vendorId)?.name} · ${b.amountDue}</SelectItem>)}</SelectContent></Select>{bill && <Link className="text-xs underline" href={`/bills/${bill.id}`}>Open linked bill</Link>}</div><div>{!bill && <><Label>Expense category / account</Label><Select disabled={busy} value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Choose expense account" /></SelectTrigger><SelectContent>{accounts.filter(a => a.isActive && a.accountType === "expense").map(a => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></>}</div></div>
    <div className="flex flex-wrap items-center gap-3"><Label htmlFor="check-bill-file" className="shrink-0">Upload bill document</Label><Input id="check-bill-file" className="max-w-sm" type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />{uploading && <span className="text-sm">Uploading…</span>}{attachment && <span className="text-sm flex items-center gap-2">{attachment.name}<Button size="sm" variant="ghost" disabled={busy} onClick={() => setAttachment(undefined)}>Remove attachment</Button></span>}</div>
    <div className="flex justify-end"><Button disabled={busy || !bankId || !chosenPayee || !amount || (!bill && !accountId) || (billId !== "none" && !bill)} onClick={() => submit.mutate()}>{submit.isPending ? "Issuing…" : "Issue check and download PDF"}</Button></div>
  </div>;
}
