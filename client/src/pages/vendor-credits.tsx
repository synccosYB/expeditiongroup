import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/dateUtils";
import type { Account, BankAccount, Bill, Vendor } from "@shared/schema";
import {
  vendorCreditSchema,
  creditApplicationSchema,
  vendorRefundSchema,
  type VendorCreditView,
} from "@shared/vendor-credits";
const currency = (value: string | number) =>
  Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (value: string) => value.slice(0, 10);
type Mode =
  { kind: "create" } | { kind: "apply" | "refund"; credit: VendorCreditView };
export default function VendorCredits() {
  const { toast } = useToast();
  const initialVendor =
    new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    ).get("vendorId") || "all";
  const [vendorFilter, setVendorFilter] = useState(initialVendor);
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState({
    vendorId: "",
    accountId: "",
    bankAccountId: "",
    billId: "",
    date: "",
    amount: "",
    reference: "",
    memo: "",
    requestId: "",
  });
  const [remove, setRemove] = useState<{ path: string; title: string } | null>(
    null,
  );
  const {
    data: credits = [],
    isLoading,
    error,
  } = useQuery<VendorCreditView[]>({ queryKey: ["/api/vendor-credits"] });
  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });
  const { data: banks = [] } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });
  const { data: bills = [] } = useQuery<Bill[]>({ queryKey: ["/api/bills"] });
  const refresh = async () => {
    await Promise.all(
      [
        "/api/vendor-credits",
        "/api/bills",
        "/api/bank-accounts",
        "/api/bank-transactions",
        "/api/reports",
      ].map((key) =>
        queryClient.invalidateQueries({
          predicate: (q) => String(q.queryKey[0]).startsWith(key),
        }),
      ),
    );
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!mode) return;
      const shared = {
        date: form.date,
        amount: form.amount,
        requestId: form.requestId,
      };
      if (mode.kind === "create")
        return apiRequest(
          "POST",
          "/api/vendor-credits",
          vendorCreditSchema.parse({
            ...shared,
            vendorId: Number(form.vendorId),
            accountId: Number(form.accountId),
            reference: form.reference,
            memo: form.memo,
          }),
        );
      if (mode.kind === "apply")
        return apiRequest(
          "POST",
          `/api/vendor-credits/${mode.credit.id}/applications`,
          creditApplicationSchema.parse({
            ...shared,
            billId: Number(form.billId),
          }),
        );
      return apiRequest(
        "POST",
        `/api/vendor-credits/${mode.credit.id}/refunds`,
        vendorRefundSchema.parse({
          ...shared,
          bankAccountId: Number(form.bankAccountId),
          reference: form.reference,
        }),
      );
    },
    onSuccess: async () => {
      await refresh();
      setMode(null);
      toast({ title: "Saved successfully" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to save",
        description: error.message,
        variant: "destructive",
      }),
  });
  const reverse = useMutation({
    mutationFn: async () => {
      if (remove) return apiRequest("DELETE", remove.path);
    },
    onSuccess: async () => {
      await refresh();
      setRemove(null);
      toast({ title: "Entry reversed" });
    },
    onError: (error: Error) =>
      toast({
        title: "Unable to reverse entry",
        description: error.message,
        variant: "destructive",
      }),
  });
  const open = (next: Mode) => {
    setForm({
      vendorId: vendorFilter === "all" ? "" : vendorFilter,
      accountId: "",
      bankAccountId: "",
      billId: "",
      date: formatDateForInput(new Date()),
      amount: next.kind === "create" ? "" : next.credit.available,
      reference: "",
      memo: "",
      requestId: crypto.randomUUID(),
    });
    setMode(next);
  };
  const field = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const select = (
    key: keyof typeof form,
    label: string,
    options: { id: number; name: string }[],
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`credit-${key}`}>{label}</Label>
      <Select value={form[key]} onValueChange={(value) => field(key, value)}>
        <SelectTrigger id={`credit-${key}`}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const visible = credits.filter(
    (c) => vendorFilter === "all" || String(c.vendorId) === vendorFilter,
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Vendor Credits</h1>
          <p className="text-muted-foreground mt-1">
            Record a vendor credit, apply it to bills, or record money the
            vendor returned.
          </p>
        </div>
        <Button onClick={() => open({ kind: "create" })}>
          New Vendor Credit
        </Button>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="w-64">
            <Label>Vendor</Label>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available credit</p>
            <p className="text-2xl font-semibold">
              {currency(
                visible.reduce((sum, c) => sum + Number(c.available), 0),
              )}
            </p>
          </div>
        </CardContent>
      </Card>
      {isLoading ? (
        <p>Loading vendor credits…</p>
      ) : error ? (
        <p role="alert" className="text-destructive">
          Unable to load vendor credits. Please try again.
        </p>
      ) : !visible.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="font-semibold">No vendor credits yet</h2>
            <p className="text-muted-foreground mt-2">
              Start with New Vendor Credit. If the vendor already returned
              money, save the credit and choose Record Refund.
            </p>
          </CardContent>
        </Card>
      ) : (
        visible.map((credit) => (
          <Card key={credit.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <CardTitle>{credit.vendorName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Credit #{credit.id} · {day(credit.creditDate)}
                    {credit.reference ? ` · ${credit.reference}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={Number(credit.available) <= 0}
                    onClick={() => open({ kind: "apply", credit })}
                  >
                    Apply to Bill
                  </Button>
                  <Button
                    variant="outline"
                    disabled={Number(credit.available) <= 0}
                    onClick={() => open({ kind: "refund", credit })}
                  >
                    Record Refund
                  </Button>
                  {!credit.applications.length && !credit.refunds.length && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setRemove({
                          path: `/api/vendor-credits/${credit.id}`,
                          title: "Delete unused vendor credit?",
                        })
                      }
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ["Original credit", credit.amount],
                  ["Applied to bills", credit.applied],
                  ["Refunded", credit.refunded],
                  ["Available", credit.available],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="font-semibold">{currency(value)}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                {credit.accountName}
                {credit.memo ? ` · ${credit.memo}` : ""}
              </p>
              {!!(credit.applications.length + credit.refunds.length) && (
                <div className="border-t pt-3 space-y-2">
                  <h3 className="font-medium">Activity</h3>
                  {credit.applications.map((a) => (
                    <div
                      key={`a${a.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {day(a.applicationDate)} · Applied {currency(a.amount)}{" "}
                        to{" "}
                        <Link className="underline" href={`/bills/${a.billId}`}>
                          {a.billNumber}
                        </Link>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setRemove({
                            path: `/api/vendor-credits/${credit.id}/applications/${a.id}`,
                            title: "Reverse credit application?",
                          })
                        }
                      >
                        Reverse
                      </Button>
                    </div>
                  ))}
                  {credit.refunds.map((r) => (
                    <div
                      key={`r${r.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        {day(r.refundDate)} · Refunded {currency(r.amount)} to{" "}
                        <Link
                          className="underline"
                          href={`/bank-register/${r.bankAccountId}?txn=${r.bankTransactionId}`}
                        >
                          {r.bankName}
                        </Link>
                        {r.reference ? ` · ${r.reference}` : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setRemove({
                            path: `/api/vendor-credits/${credit.id}/refunds/${r.id}`,
                            title: "Reverse recorded refund?",
                          })
                        }
                      >
                        Reverse
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
      <Dialog
        open={!!mode}
        onOpenChange={(value) => {
          if (!value && !save.isPending) setMode(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode?.kind === "create"
                ? "New Vendor Credit"
                : mode?.kind === "apply"
                  ? "Apply Credit to Bill"
                  : "Record Vendor Refund"}
            </DialogTitle>
            <DialogDescription>
              {mode?.kind === "create"
                ? "Choose the original expense category. After saving, apply the credit to a bill or record a refund."
                : `${mode?.credit.vendorName} · Available ${currency(mode?.credit.available || 0)}. ${mode?.kind === "refund" ? "Record money already received. This does not initiate a bank transfer." : "This reduces the bill balance without creating a bank payment."}`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            {mode?.kind === "create" && (
              <>
                {select(
                  "vendorId",
                  "Vendor",
                  vendors.filter((v) => v.isActive),
                )}
                {select(
                  "accountId",
                  "Expense category",
                  accounts.filter(
                    (a) => a.isActive && a.accountType === "expense",
                  ),
                )}
              </>
            )}
            {mode?.kind === "apply" &&
              select(
                "billId",
                "Bill",
                bills
                  .filter(
                    (b) =>
                      b.vendorId === mode.credit.vendorId &&
                      b.status !== "void" &&
                      b.status !== "draft" &&
                      Number(b.amountDue) > 0,
                  )
                  .map((b) => ({
                    id: b.id,
                    name: `${b.billNumber} · Due ${currency(b.amountDue)}`,
                  })),
              )}
            {mode?.kind === "refund" &&
              select(
                "bankAccountId",
                "Received into",
                banks.filter((b) => b.isActive),
              )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credit-date">Date</Label>
                <Input
                  id="credit-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => field("date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credit-amount">Amount</Label>
                <Input
                  id="credit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={
                    mode?.kind === "create" ? undefined : mode?.credit.available
                  }
                  required
                  value={form.amount}
                  onChange={(e) => field("amount", e.target.value)}
                />
              </div>
            </div>
            {mode?.kind !== "apply" && (
              <div className="space-y-2">
                <Label htmlFor="credit-reference">Reference</Label>
                <Input
                  id="credit-reference"
                  maxLength={100}
                  value={form.reference}
                  onChange={(e) => field("reference", e.target.value)}
                />
              </div>
            )}
            {mode?.kind === "create" && (
              <div className="space-y-2">
                <Label htmlFor="credit-memo">Memo</Label>
                <Input
                  id="credit-memo"
                  maxLength={2000}
                  value={form.memo}
                  onChange={(e) => field("memo", e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => setMode(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!remove}
        onOpenChange={(value) => {
          if (!value && !reverse.isPending) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{remove?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              This updates the credit balance and any linked bill or bank
              balance. Cleared or reconciled refunds cannot be reversed here.
              The change remains in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reverse.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={reverse.isPending}
              onClick={(e) => {
                e.preventDefault();
                reverse.mutate();
              }}
            >
              {reverse.isPending ? "Reversing…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
