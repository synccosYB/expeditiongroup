import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { FileText, Search, MoreHorizontal, Eye, Send, CheckCircle, XCircle, Trash2, ExternalLink } from "lucide-react";
import type { Invoice, InvoiceItem, Project, Client } from "@shared/schema";

type InvoiceWithRelations = Invoice & {
  project?: Project;
  client?: Client;
  items?: InvoiceItem[];
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export default function InvoicesPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceWithRelations | null>(null);

  const { data: invoices, isLoading } = useQuery<InvoiceWithRelations[]>({
    queryKey: ["/api/invoices"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/invoices/${id}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Invoice status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update invoice", description: error.message, variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Invoice deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDeletingInvoice(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete invoice", description: error.message, variant: "destructive" });
    },
  });

  const filteredInvoices = invoices?.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage and track all your invoices</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-invoices"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredInvoices && filteredInvoices.length > 0 ? (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => {
            const config = statusConfig[invoice.status] || statusConfig.draft;
            return (
              <Card key={invoice.id} data-testid={`invoice-card-${invoice.id}`}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold" data-testid={`text-invoice-number-${invoice.id}`}>
                            {invoice.invoiceNumber}
                          </span>
                          <Badge variant={config.variant}>
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                          {invoice.project && (
                            <Link href={`/projects/${invoice.projectId}`}>
                              <span className="hover:underline cursor-pointer flex items-center gap-1">
                                {invoice.project.name}
                                <ExternalLink className="h-3 w-3" />
                              </span>
                            </Link>
                          )}
                          {invoice.client && (
                            <>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{invoice.client.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-lg" data-testid={`text-invoice-total-${invoice.id}`}>
                          ${invoice.total}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.createdAt && format(new Date(invoice.createdAt), "MMM d, yyyy")}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-invoice-menu-${invoice.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {invoice.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "sent" })}
                              data-testid={`menu-send-invoice-${invoice.id}`}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {invoice.status === "sent" && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "paid" })}
                              data-testid={`menu-paid-invoice-${invoice.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: invoice.id, status: "cancelled" })}
                              data-testid={`menu-cancel-invoice-${invoice.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeletingInvoice(invoice)}
                            className="text-destructive"
                            data-testid={`menu-delete-invoice-${invoice.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Invoices will appear here when you generate them from project time logs"
            />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingInvoice} onOpenChange={() => setDeletingInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{deletingInvoice?.invoiceNumber}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingInvoice && deleteInvoiceMutation.mutate(deletingInvoice.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
