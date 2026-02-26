import { useState } from "react";
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
import { Search, Receipt, DollarSign, Calendar, FileText, Check } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Expense, Vendor, Client, Project } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

type ExpenseWithRelations = Expense & {
  vendor?: Vendor;
  rebillableClient?: Client;
  rebillableProject?: Project;
};

export default function RebillCenter() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set());
  const [filterClient, setFilterClient] = useState<string>("all");
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);

  const { data: expenses, isLoading } = useQuery<ExpenseWithRelations[]>({
    queryKey: ["/api/expenses/rebillable"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (expenseIds: number[]) => {
      const selectedExpensesList = expenses?.filter(e => expenseIds.includes(e.id)) || [];
      if (selectedExpensesList.length === 0) return;

      const clientId = selectedExpensesList[0].rebillableClientId;
      
      const projectIds = [...new Set(selectedExpensesList.map(e => e.rebillableProjectId).filter(Boolean))];
      const projectId = projectIds.length === 1 ? projectIds[0] : null;
      
      const items = selectedExpensesList.map(expense => {
        const baseAmount = parseFloat(expense.amount || "0");
        const markup = parseFloat(expense.markupPercent || "0");
        const totalAmount = baseAmount * (1 + markup / 100);
        
        const projectLabel = expense.rebillableProject?.name ? `[${expense.rebillableProject.name}] ` : "";
        return {
          description: `${projectLabel}${expense.description}${expense.vendor ? ` - ${expense.vendor.name}` : ""}`,
          quantity: "1",
          unitPrice: totalAmount.toFixed(2),
          amount: totalAmount.toFixed(2),
        };
      });

      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

      const invoicePayload = {
        clientId,
        projectId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: "Rebillable expenses",
        items,
        subtotal: totalAmount.toFixed(2),
        total: totalAmount.toFixed(2),
      };

      const response = await apiRequest("POST", "/api/invoices", invoicePayload);
      const invoiceData = await response.json();
      
      await apiRequest("POST", "/api/expenses/mark-rebilled", {
        expenseIds,
        invoiceId: invoiceData.id,
      });

      return invoiceData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/rebillable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice created successfully" });
      setSelectedExpenses(new Set());
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
          window.location.href = "/auth";
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

  const filteredExpenses = expenses?.filter((expense) => {
    const matchesSearch = 
      expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expense.rebillableClient?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesClient = filterClient === "all" || expense.rebillableClientId?.toString() === filterClient;
    
    return matchesSearch && matchesClient;
  });

  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const calculateRebillAmount = (expense: ExpenseWithRelations) => {
    const baseAmount = parseFloat(expense.amount || "0");
    const markup = parseFloat(expense.markupPercent || "0");
    return baseAmount * (1 + markup / 100);
  };

  const toggleExpenseSelection = (id: number) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedExpenses(newSelected);
  };

  const selectAllForClient = (clientId: number) => {
    const clientExpenses = filteredExpenses?.filter(e => e.rebillableClientId === clientId) || [];
    const allSelected = clientExpenses.every(e => selectedExpenses.has(e.id));
    
    const newSelected = new Set(selectedExpenses);
    if (allSelected) {
      clientExpenses.forEach(e => newSelected.delete(e.id));
    } else {
      clientExpenses.forEach(e => newSelected.add(e.id));
    }
    setSelectedExpenses(newSelected);
  };

  const selectedExpensesList = expenses?.filter(e => selectedExpenses.has(e.id)) || [];
  const canCreateInvoice = selectedExpensesList.length > 0 && 
    selectedExpensesList.every(e => e.rebillableClientId === selectedExpensesList[0].rebillableClientId);
  
  const selectedTotal = selectedExpensesList.reduce((sum, e) => sum + calculateRebillAmount(e), 0);
  const selectedClient = selectedExpensesList[0]?.rebillableClient;

  const groupedByClient = filteredExpenses?.reduce((groups, expense) => {
    const clientId = expense.rebillableClientId?.toString() || "unknown";
    if (!groups[clientId]) {
      groups[clientId] = {
        client: expense.rebillableClient,
        expenses: [],
      };
    }
    groups[clientId].expenses.push(expense);
    return groups;
  }, {} as Record<string, { client?: Client; expenses: ExpenseWithRelations[] }>);

  const activeClients = clients?.filter(c => c.status === "active");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Rebill Center</h1>
            <p className="text-muted-foreground mt-1">Generate invoices from rebillable expenses</p>
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
          <p className="text-muted-foreground mt-1">Generate invoices from rebillable expenses</p>
        </div>
        {selectedExpenses.size > 0 && (
          <Button
            onClick={() => setIsCreateInvoiceOpen(true)}
            disabled={!canCreateInvoice}
            data-testid="button-create-invoice"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice ({selectedExpenses.size} items)
          </Button>
        )}
      </div>

      {selectedExpenses.size > 0 && !canCreateInvoice && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Please select expenses for only one client at a time to create an invoice.
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
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-rebillable"
              />
            </div>
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
          {!filteredExpenses || filteredExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No unbilled expenses"
              description="All rebillable expenses have been invoiced"
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedByClient || {}).map(([clientId, { client, expenses: clientExpenses }]) => (
                <div key={clientId} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={clientExpenses.every(e => selectedExpenses.has(e.id))}
                        onCheckedChange={() => client && selectAllForClient(client.id)}
                        data-testid={`checkbox-client-${clientId}`}
                      />
                      <div>
                        <p className="font-medium">{client?.name || "Unknown Client"}</p>
                        <p className="text-sm text-muted-foreground">
                          {clientExpenses.length} expense{clientExpenses.length !== 1 ? "s" : ""} • 
                          Total: {formatCurrency(clientExpenses.reduce((sum, e) => sum + calculateRebillAmount(e), 0).toString())}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y">
                    {clientExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-4 hover:bg-muted/30"
                        data-testid={`rebillable-expense-row-${expense.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Checkbox
                            checked={selectedExpenses.has(expense.id)}
                            onCheckedChange={() => toggleExpenseSelection(expense.id)}
                            data-testid={`checkbox-expense-${expense.id}`}
                          />
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {expense.expenseDate ? format(new Date(expense.expenseDate), "MMM d, yyyy") : "No date"}
                              </span>
                              {expense.vendor && (
                                <span>{expense.vendor.name}</span>
                              )}
                              {expense.rebillableProject && (
                                <Badge variant="outline">{expense.rebillableProject.name}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(calculateRebillAmount(expense).toString())}
                          </p>
                          {expense.markupPercent && parseFloat(expense.markupPercent) > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Cost: {formatCurrency(expense.amount)} + {expense.markupPercent}%
                            </p>
                          )}
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
              Create an invoice for the selected expenses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Bill To</p>
              <p className="font-medium text-lg">{selectedClient?.name}</p>
            </div>
            
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {selectedExpensesList.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-sm">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {expense.expenseDate ? format(new Date(expense.expenseDate), "MMM d, yyyy") : ""}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(calculateRebillAmount(expense).toString())}
                  </p>
                </div>
              ))}
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
                onClick={() => createInvoiceMutation.mutate(Array.from(selectedExpenses))}
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
    </div>
  );
}
