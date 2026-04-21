import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  BookOpen,
  X,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, LIST_PAGE_REFETCH_INTERVAL_MS } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { parseLocalDateFromISO, formatDateForInput } from "@/lib/dateUtils";
import type { Account, JournalEntry, JournalEntryLine } from "@shared/schema";

type JournalEntryWithLines = JournalEntry & {
  lines: (JournalEntryLine & { account: Account })[];
};

interface LineItem {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

const emptyLine = (): LineItem => ({
  accountId: "",
  description: "",
  debit: "",
  credit: "",
});

function getStatusBadge(status: string | null) {
  switch (status) {
    case "posted":
      return <Badge variant="default" data-testid={`badge-status-${status}`}>Posted</Badge>;
    case "void":
      return <Badge variant="destructive" data-testid={`badge-status-${status}`}>Void</Badge>;
    default:
      return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Draft</Badge>;
  }
}

function formatCurrency(amount: string | number | null | undefined) {
  const num = parseFloat(String(amount || "0"));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function formatDate(date: string | Date | null) {
  if (!date) return "-";
  const d = typeof date === 'string' ? parseLocalDateFromISO(date) : date;
  if (!d || isNaN(d.getTime())) return "-";
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${month}-${day}-${year}`;
}

export default function JournalEntries() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<JournalEntryWithLines | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<JournalEntryWithLines | null>(null);

  const [entryDate, setEntryDate] = useState(formatDateForInput(new Date()));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine(), emptyLine()]);

  const { data: entries, isLoading } = useQuery<JournalEntryWithLines[]>({
    queryKey: ["/api/journal-entries"],
    refetchInterval: LIST_PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: "always",
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: nextNumber } = useQuery<{ number: string }>({
    queryKey: ["/api/journal-entries/next-number"],
    enabled: isCreateOpen,
  });

  const activeAccounts = accounts?.filter((a) => a.isActive) || [];

  const resetForm = () => {
    setEntryDate(formatDateForInput(new Date()));
    setMemo("");
    setLines([emptyLine(), emptyLine()]);
  };

  const handleError = (error: any, action: string) => {
    if (isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/auth"; }, 500);
      return;
    }
    const errorMessage = error?.message || String(error);
    const jsonMatch = errorMessage.match(/^\d+:\s*([\s\S]*)$/);
    let msg = `Failed to ${action}`;
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        msg = parsed.message || msg;
      } catch (e) {}
    }
    toast({ title: "Error", description: msg, variant: "destructive" });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/journal-entries", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries/next-number"] });
      toast({ title: "Journal entry created successfully" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => handleError(error, "create journal entry"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest("PATCH", `/api/journal-entries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({ title: "Journal entry updated" });
      setViewingEntry(null);
    },
    onError: (error: any) => handleError(error, "update journal entry"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/journal-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries/next-number"] });
      toast({ title: "Journal entry deleted" });
      setDeletingEntry(null);
    },
    onError: (error: any) => handleError(error, "delete journal entry"),
  });

  const updateLine = (index: number, field: keyof LineItem, value: string) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "debit" && parseFloat(value) > 0) {
        updated[index].credit = "";
      } else if (field === "credit" && parseFloat(value) > 0) {
        updated[index].debit = "";
      }
      return updated;
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const hasValidLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)).length >= 2;

  const handleSubmit = () => {
    const validLines = lines
      .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => ({
        accountId: parseInt(l.accountId),
        description: l.description || undefined,
        debit: (parseFloat(l.debit) || 0).toFixed(2),
        credit: (parseFloat(l.credit) || 0).toFixed(2),
      }));

    createMutation.mutate({
      entryNumber: nextNumber?.number || "",
      entryDate,
      memo: memo || undefined,
      status: "draft",
      lines: validLines,
    });
  };

  const filteredEntries = entries?.filter((entry) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.entryNumber.toLowerCase().includes(q) ||
      (entry.memo?.toLowerCase().includes(q)) ||
      entry.lines.some((l) => l.account.name.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q))
    );
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Journal Entries</h1>
        <ListSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Journal Entries</h1>
        <Button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          data-testid="button-new-journal-entry"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Journal Entry
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {!filteredEntries || filteredEntries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No journal entries"
          description="Create your first general journal entry to record accounting transactions."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Entry #</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Memo</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b hover-elevate cursor-pointer"
                      onClick={() => setViewingEntry(entry)}
                      data-testid={`row-journal-entry-${entry.id}`}
                    >
                      <td className="p-3 font-medium" data-testid={`text-entry-number-${entry.id}`}>
                        {entry.entryNumber}
                      </td>
                      <td className="p-3 text-muted-foreground" data-testid={`text-entry-date-${entry.id}`}>
                        {formatDate(entry.entryDate)}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                        {entry.memo || "-"}
                      </td>
                      <td className="p-3 text-right font-medium" data-testid={`text-entry-amount-${entry.id}`}>
                        {formatCurrency(entry.totalAmount)}
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-entry-menu-${entry.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setViewingEntry(entry)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {entry.status === "draft" && (
                              <DropdownMenuItem
                                onSelect={() => updateMutation.mutate({ id: entry.id, data: { status: "posted" } })}
                                data-testid={`button-post-entry-${entry.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Post Entry
                              </DropdownMenuItem>
                            )}
                            {entry.status === "posted" && (
                              <DropdownMenuItem
                                onSelect={() => updateMutation.mutate({ id: entry.id, data: { status: "void" } })}
                                data-testid={`button-void-entry-${entry.id}`}
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Void Entry
                              </DropdownMenuItem>
                            )}
                            {entry.status === "draft" && (
                              <DropdownMenuItem
                                onSelect={() => setDeletingEntry(entry)}
                                className="text-destructive"
                                data-testid={`button-delete-entry-${entry.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">New Journal Entry</DialogTitle>
            <DialogDescription>
              Record a general journal entry with balanced debits and credits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Entry Number</Label>
                <Input
                  value={nextNumber?.number || "Loading..."}
                  disabled
                  data-testid="input-entry-number"
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  data-testid="input-entry-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Memo</Label>
                <Input
                  placeholder="Description of this entry"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  data-testid="input-memo"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button variant="outline" size="sm" onClick={addLine} data-testid="button-add-line">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-2 font-medium">Account</th>
                      <th className="text-left p-2 font-medium">Description</th>
                      <th className="text-right p-2 font-medium w-32">Debit</th>
                      <th className="text-right p-2 font-medium w-32">Credit</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="p-2">
                          <Select
                            value={line.accountId}
                            onValueChange={(val) => updateLine(index, "accountId", val)}
                          >
                            <SelectTrigger data-testid={`select-line-account-${index}`}>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeAccounts.map((acc) => (
                                <SelectItem key={acc.id} value={String(acc.id)}>
                                  {acc.code} - {acc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="Line description"
                            value={line.description}
                            onChange={(e) => updateLine(index, "description", e.target.value)}
                            data-testid={`input-line-description-${index}`}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.debit}
                            onChange={(e) => updateLine(index, "debit", e.target.value)}
                            className="text-right"
                            data-testid={`input-line-debit-${index}`}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={line.credit}
                            onChange={(e) => updateLine(index, "credit", e.target.value)}
                            className="text-right"
                            data-testid={`input-line-credit-${index}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          {lines.length > 2 && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeLine(index)}
                              data-testid={`button-remove-line-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t font-medium">
                      <td className="p-2" colSpan={2} data-testid="text-totals-label">Totals</td>
                      <td className="p-2 text-right" data-testid="text-total-debits">
                        {formatCurrency(totalDebits)}
                      </td>
                      <td className="p-2 text-right" data-testid="text-total-credits">
                        {formatCurrency(totalCredits)}
                      </td>
                      <td className="p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {totalDebits > 0 && totalCredits > 0 && !isBalanced && (
                <p className="text-sm text-destructive" data-testid="text-balance-error">
                  Entry is out of balance. Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}
                </p>
              )}
              {isBalanced && totalDebits > 0 && (
                <p className="text-sm text-green-600 dark:text-green-400" data-testid="text-balance-ok">
                  Entry is balanced.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !isBalanced || !hasValidLines || totalDebits === 0}
                data-testid="button-save-entry"
              >
                {createMutation.isPending ? "Saving..." : "Save Journal Entry"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingEntry} onOpenChange={(open) => { if (!open) setViewingEntry(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-view-entry-title">
              Journal Entry {viewingEntry?.entryNumber}
            </DialogTitle>
            <DialogDescription>
              View the details of this journal entry.
            </DialogDescription>
          </DialogHeader>

          {viewingEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Entry Number</Label>
                  <p className="font-medium" data-testid="text-view-entry-number">{viewingEntry.entryNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Date</Label>
                  <p className="font-medium" data-testid="text-view-entry-date">{formatDate(viewingEntry.entryDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Amount</Label>
                  <p className="font-medium" data-testid="text-view-entry-amount">{formatCurrency(viewingEntry.totalAmount)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-0.5">{getStatusBadge(viewingEntry.status)}</div>
                </div>
              </div>

              {viewingEntry.memo && (
                <div>
                  <Label className="text-muted-foreground text-xs">Memo</Label>
                  <p className="text-sm" data-testid="text-view-entry-memo">{viewingEntry.memo}</p>
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left p-3 font-medium">Account</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Debit</th>
                      <th className="text-right p-3 font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingEntry.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-b-0" data-testid={`row-view-line-${line.id}`}>
                        <td className="p-3">
                          <span className="text-muted-foreground mr-2">{line.account.code}</span>
                          {line.account.name}
                        </td>
                        <td className="p-3 text-muted-foreground">{line.description || "-"}</td>
                        <td className="p-3 text-right">
                          {parseFloat(line.debit || "0") > 0 ? formatCurrency(line.debit) : ""}
                        </td>
                        <td className="p-3 text-right">
                          {parseFloat(line.credit || "0") > 0 ? formatCurrency(line.credit) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t font-medium">
                      <td className="p-3" colSpan={2}>Totals</td>
                      <td className="p-3 text-right">
                        {formatCurrency(
                          viewingEntry.lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0)
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {formatCurrency(
                          viewingEntry.lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                {viewingEntry.status === "draft" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateMutation.mutate({ id: viewingEntry.id, data: { status: "posted" } });
                      }}
                      data-testid="button-view-post"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Post Entry
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setViewingEntry(null);
                        setDeletingEntry(viewingEntry);
                      }}
                      data-testid="button-view-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}
                {viewingEntry.status === "posted" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      updateMutation.mutate({ id: viewingEntry.id, data: { status: "void" } });
                    }}
                    data-testid="button-view-void"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Void Entry
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewingEntry(null)} data-testid="button-view-close">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => { if (!open) setDeletingEntry(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete journal entry {deletingEntry?.entryNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEntry && deleteMutation.mutate(deletingEntry.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
