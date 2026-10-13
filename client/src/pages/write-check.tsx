import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { CheckComposer, type CheckBill } from "@/components/check-composer";
import { CheckRecordActions } from "@/components/bill-checkwriter";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import type { Account, BankAccount, Vendor } from "@shared/schema";
import type { CheckRecord } from "@shared/checkwriter";

type HistoryCheck = CheckRecord & { linkedBillId?: number | null; hasAttachment?: boolean };
export default function WriteCheck() {
  const search = useSearch(); const initialBillId = Number(new URLSearchParams(search).get("bill")) || undefined;
  const [tab, setTab] = useState("write"); const [filter, setFilter] = useState("");
  const banks = useQuery<BankAccount[]>({ queryKey: ["/api/bank-accounts"] });
  const vendors = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });
  const accounts = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const bills = useQuery<CheckBill[]>({ queryKey: ["/api/bills"] });
  const history = useQuery<HistoryCheck[]>({ queryKey: ["/api/checks"] });
  if ([banks, vendors, accounts, bills].some(q => q.isLoading)) return <DashboardSkeleton />;
  if ([banks, vendors, accounts, bills].some(q => q.isError)) return <p role="alert">Unable to load check writing. Refresh to try again.</p>;
  return <div className="space-y-4 max-w-5xl mx-auto"><div><h1 className="text-2xl font-semibold">Write check</h1><p className="text-sm text-muted-foreground">Pay a bill or write a standalone check. Both go into the same bank register and reconciliation.</p></div><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="write">Write check</TabsTrigger><TabsTrigger value="history">Check history</TabsTrigger></TabsList><TabsContent value="write"><CheckComposer key={initialBillId || "standalone"} banks={banks.data || []} vendors={vendors.data || []} accounts={accounts.data || []} bills={bills.data || []} initialBillId={initialBillId} /></TabsContent><TabsContent value="history" className="space-y-3"><Input aria-label="Search checks" placeholder="Search check number, payee or memo" value={filter} onChange={e => setFilter(e.target.value)} />{history.isLoading ? <p>Loading checks…</p> : history.isError ? <p role="alert">Unable to load check history.</p> : <div className="rounded-lg border divide-y max-h-[65vh] overflow-auto">{(history.data || []).filter(c => `${c.checkDetails.number} ${c.checkDetails.payee} ${c.checkDetails.memo}`.toLowerCase().includes(filter.toLowerCase())).map(c => <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Check {c.checkDetails.number} · {c.checkDetails.payee} · ${c.checkDetails.amount}{c.checkDetails.status === "void" && " · VOID"}</p><p className="text-xs text-muted-foreground">{c.checkDetails.date} · {banks.data?.find(b => b.id === c.bankAccountId)?.name} · {c.checkDetails.memo}</p><div className="text-xs flex gap-3 mt-1"><Link className="underline" href={`/bank-register/${c.bankAccountId}?txn=${c.id}`}>Bank register</Link>{c.linkedBillId && <Link className="underline" href={`/bills/${c.linkedBillId}`}>Linked bill</Link>}{c.hasAttachment && <a href={`/api/checks/${c.id}/attachment`} target="_blank" rel="noopener noreferrer" className="underline">View attached bill</a>}</div></div><CheckRecordActions check={c} /></div>)}{!history.data?.length && <p className="p-4 text-muted-foreground">No printed checks yet.</p>}</div>}</TabsContent></Tabs></div>;
}
