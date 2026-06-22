import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Receipt, DollarSign, Calendar, FileText, Check, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, LIST_PAGE_REFETCH_INTERVAL_MS } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Expense, Vendor, Client, Project, Bill, BillItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

type ExpenseWithRelations = Expense & {
  vendor?: Vendor;
  rebillableClient?: Client;
  rebillableProject?: Project;
};

type BillItemWithRelations = BillItem & {
  bill?: Bill;
  vendor?: Vendor;
  rebillableClient?: Client;
  rebillableProject?: Project;
};

type RebillableItem = {
  id: string;
  type: "expense" | "bill_item";
  sourceId: number;
  description: string | null;
  amount: string;
  markupPercent: string | null;
  date: string | Date | null;
  vendorName?: string;
  clientId: number | null;
  clientName?: string;
  projectId: number | null;
  projectName?: string;
  rebillableProject?: Project;
};

function toRebillableItem(expense: ExpenseWithRelations): RebillableItem {
  return {
    id: `expense-${expense.id}`,
    type: "expense",
    sourceId: expense.id,
    description: expense.description,
    amount: expense.amount,
    markupPercent: expense.markupPercent,
    date: expense.expenseDate,
    vendorName: expense.vendor?.name,
    clientId: expense.rebillableClientId,
    clientName: expense.rebillableClient?.name,
    projectId: expense.rebillableProjectId,
    projectName: expense.rebillableProject?.name,
    rebillableProject: expense.rebillableProject,
  };
}

function toRebillableItemFromBill(item: BillItemWithRelations): RebillableItem {
  return {
    id: `bill-item-${item.id}`,
    type: "bill_item",
    sourceId: item.id,
    description: item.description,
    amount: item.amount,
    markupPercent: item.markupPercent,
    date: item.bill?.billDate || null,
    vendorName: item.vendor?.name,
    clientId: item.rebillableClientId,
    clientName: item.rebillableClient?.name,
    projectId: item.rebillableProjectId,
    projectName: item.rebillableProject?.name,
    rebillableProject: item.rebillableProject,
  };
}

export default function RebillCenter() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<RebillableItem | null>(null);
  const [rebillInvoiceDate, setRebillInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rebillDueDate, setRebillDueDate] = useState(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

  const { data: expenses, isLoading: expensesLoading } = useQuery<ExpenseWithRelations[]>({
    queryKey: ["/api/expenses/rebillable"],
    refetchInterval: LIST_PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: "always",
  });

  const { data: billItems, isLoading: billItemsLoading } = useQuery<BillItemWithRelations[]>({
    queryKey: ["/api/bill-items/rebillable"],
    refetchInterval: LIST_PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: "always",
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const isLoading = expensesLoading || billItemsLoading;

  const allItems: RebillableItem[] = [
    ...(expenses?.map(toRebillableItem) || []),
    ...(billItems?.map(toRebillableItemFromBill) || []),
  ];

  const createInvoiceMutation = useMutation({
    mutationFn: async (selectedIds: string[]) => {
      const selectedItemsList = allItems.filter(item => selectedIds.includes(item.id));
      if (selectedItemsList.length === 0) return;

      const clientId = selectedItemsList[0].clientId;

      const groupedByProject = selectedItemsList.reduce((groups, item) => {
        const projectId = item.projectId || 0;
        if (!groups[projectId]) {
          groups[projectId] = [];
        }
        groups[projectId].push(item);
        return groups;
      }, {} as Record<number, RebillableItem[]>);

      const createdInvoices = [];

      for (const [projectIdStr, projectItems] of Object.entries(groupedByProject)) {
        const projectId = parseInt(projectIdStr) || null;

        const items = projectItems.map(item => {
          const baseAmount = parseFloat(item.amount || "0");
          const markup = parseFloat(item.markupPercent || "0");
          const totalAmount = baseAmount * (1 + markup / 100);

          const projectLabel = item.projectName ? `[${item.projectName}] ` : "";
          const typeLabel = item.type === "bill_item" ? "[Bill] " : "";
          return {
            description: `${typeLabel}${projectLabel}${item.description}${item.vendorName ? ` - ${item.vendorName}` : ""}`,
            quantity: "1",
            unitPrice: totalAmount.toFixed(2),
            amount: totalAmount.toFixed(2),
          };
        });

        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        const invoicePayload = {
          clientId,
          projectId,
          createdAt: rebillInvoiceDate || null,
          dueDate: rebillDueDate || null,
          notes: "Rebillable expenses",
          items,
          subtotal: totalAmount.toFixed(2),
          total: totalAmount.toFixed(2),
        };

        const response = await apiRequest("POST", "/api/invoices", invoicePayload);
        const invoiceData = await response.json();

        const expenseIds = projectItems.filter(i => i.type === "expense").map(i => i.sourceId);
        const billItemIds = projectItems.filter(i => i.type === "bill_item").map(i => i.sourceId);

        if (expenseIds.length > 0) {
          await apiRequest("POST", "/api/expenses/mark-rebilled", {
            expenseIds,
            invoiceId: invoiceData.id,
          });
        }

        if (billItemIds.length > 0) {
          await apiRequest("POST", "/api/bill-items/mark-rebilled", {
            billItemIds,
            invoiceId: invoiceData.id,
          });
        }

        createdInvoices.push(invoiceData);
      }

      return createdInvoices;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/rebillable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bill-items/rebillable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const count = Array.isArray(data) ? data.length : 1;
      toast({ title: count > 1 ? `${count} invoices created successfully` : "Invoice created successfully" });
      setSelectedItems(new Set());
      setIsCreateInvoiceOpen(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/auth");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const removeRebillableMutation = useMutation({
    mutationFn: async (item: RebillableItem) => {
      const endpoint =
        item.type === "expense"
          ? `/api/expenses/${item.sourceId}/remove-rebillable`
          : `/api/bill-items/${item.sourceId}/remove-rebillable`;
      await apiRequest("POST", endpoint);
    },
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/rebillable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bill-items/rebillable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setItemToRemove(null);
      toast({ title: "Removed from Rebill Center" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          setLocation("/auth");
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to remove item from Rebill Center",
        variant: "destructive",
      });
    },
  });

  const filteredItems = allItems.filter((item) => {
    const matchesSearch =
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clientName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClient = filterClient === "all" || item.clientId?.toString() === filterClient;
    const matchesType = filterType === "all" || item.type === filterType;

    return matchesSearch && matchesClient && matchesType;
  });

  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const calculateRebillAmount = (item: RebillableItem) => {
    const baseAmount = parseFloat(item.amount || "0");
    const markup = parseFloat(item.markupPercent || "0");
    return baseAmount * (1 + markup / 100);
  };

  const toggleItemSelection = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const selectAllForClient = (clientId: number) => {
    const clientItems = filteredItems.filter(e => e.clientId === clientId);
    const allSelected = clientItems.every(e => selectedItems.has(e.id));

    const newSelected = new Set(selectedItems);
    if (allSelected) {
      clientItems.forEach(e => newSelected.delete(e.id));
    } else {
      clientItems.forEach(e => newSelected.add(e.id));
    }
    setSelectedItems(newSelected);
  };

  const selectedItemsList = allItems.filter(item => selectedItems.has(item.id));
  const canCreateInvoice = selectedItemsList.length > 0 &&
    selectedItemsList.every(e => e.clientId === selectedItemsList[0].clientId);

  const selectedTotal = selectedItemsList.reduce((sum, e) => sum + calculateRebillAmount(e), 0);
  const selectedClient = selectedItemsList[0]?.clientName;

  const groupedByClient = filteredItems.reduce((groups, item) => {
    const clientId = item.clientId?.toString() || "unknown";
    if (!groups[clientId]) {
      groups[clientId] = {
        clientName: item.clientName,
        clientId: item.clientId,
        items: [],
      };
    }
    groups[clientId].items.push(item);
    return groups;
  }, {} as Record<string, { clientName?: string; clientId: number | null; items: RebillableItem[] }>);

  const activeClients = clients?.filter(c => c.status === "active");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Rebill Center</h1>
            <p className="text-muted-foreground mt-1">Generate invoices from rebillable expenses and bill items</p>
          </div>
        </div>
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Rebill Center</h1>
          <p className="text-muted-foreground mt-1">Generate invoices from rebillable expenses and bill items</p>
        </div>
        {selectedItems.size > 0 && (
          <Button
            onClick={() => setIsCreateInvoiceOpen(true)}
            disabled={!canCreateInvoice}
            data-testid="button-create-invoice"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice ({selectedItems.size} items)
          </Button>
        )}
      </div>

      {selectedItems.size > 0 && !canCreateInvoice && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Please select items for only one client at a time to create an invoice.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses and bill items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-rebillable"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="bill_item">Bill Items</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[200px]" data-testid="select-filter-client">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {activeClients?.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No unbilled items"
              description="All rebillable expenses and bill items have been invoiced"
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByClient).map(([clientId, { clientName, clientId: numClientId, items: clientItems }]) => (
                <div key={clientId} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={clientItems.every(e => selectedItems.has(e.id))}
                        onCheckedChange={() => numClientId && selectAllForClient(numClientId)}
                        data-testid={`checkbox-client-${clientId}`}
                      />
                      <div>
                        <p className="font-medium">{clientName || "Unknown Client"}</p>
                        <p className="text-sm text-muted-foreground">
                          {clientItems.length} item{clientItems.length !== 1 ? "s" : ""} •
                          Total: {formatCurrency(clientItems.reduce((sum, e) => sum + calculateRebillAmount(e), 0).toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {clientItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/30"
                        data-testid={`rebillable-item-row-${item.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleItemSelection(item.id)}
                            data-testid={`checkbox-item-${item.id}`}
                          />
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{item.description}</p>
                              <Badge variant={item.type === "expense" ? "secondary" : "outline"} className="text-xs">
                                {item.type === "expense" ? "Expense" : "Bill Item"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {item.date ? format(parseLocalDateFromISO(item.date) || new Date(), "MMM d, yyyy") : "No date"}
                              </span>
                              {item.vendorName && (
                                <span>{item.vendorName}</span>
                              )}
                              {item.projectName && (
                                <Badge variant="outline">{item.projectName}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(calculateRebillAmount(item).toString())}
                            </p>
                            {item.markupPercent && parseFloat(item.markupPercent) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Cost: {formatCurrency(item.amount)} + {item.markupPercent}%
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setItemToRemove(item)}
                            data-testid={`button-remove-item-${item.id}`}
                            aria-label="Remove from Rebill Center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateInvoiceOpen} onOpenChange={setIsCreateInvoiceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Create an invoice for the selected items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Bill To</p>
              <p className="font-medium text-lg">{selectedClient}</p>
            </div>

            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {selectedItemsList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{item.description}</p>
                      <Badge variant={item.type === "expense" ? "secondary" : "outline"} className="text-xs">
                        {item.type === "expense" ? "Expense" : "Bill"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.date ? format(parseLocalDateFromISO(item.date)!, "MMM d, yyyy") : ""}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(calculateRebillAmount(item).toString())}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rebill-invoice-date">Invoice Date</Label>
                <Input
                  id="rebill-invoice-date"
                  type="date"
                  value={rebillInvoiceDate}
                  onChange={(e) => setRebillInvoiceDate(e.target.value)}
                  data-testid="input-rebill-invoice-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rebill-due-date">Due Date</Label>
                <Input
                  id="rebill-due-date"
                  type="date"
                  value={rebillDueDate}
                  onChange={(e) => setRebillDueDate(e.target.value)}
                  data-testid="input-rebill-due-date"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <p className="font-medium">Total</p>
              <p className="text-xl font-bold">{formatCurrency(selectedTotal.toString())}</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateInvoiceOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createInvoiceMutation.mutate(Array.from(selectedItems))}
                disabled={createInvoiceMutation.isPending}
                data-testid="button-confirm-create-invoice"
              >
                <Check className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToRemove} onOpenChange={(open) => !open && setItemToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Rebill Center?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes "{itemToRemove?.description}" off the Rebill Center so it
              can no longer be rebilled to a client. The underlying{" "}
              {itemToRemove?.type === "expense" ? "expense" : "vendor bill"} record
              will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-item">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (itemToRemove) removeRebillableMutation.mutate(itemToRemove);
              }}
              disabled={removeRebillableMutation.isPending}
              data-testid="button-confirm-remove-item"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
