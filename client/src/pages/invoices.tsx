import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, invalidateDashboardQueries } from "@/lib/queryClient";
import { formatLocalDate, parseLocalDateFromISO } from "@/lib/dateUtils";
import { DollarSign, FileText, Clock, CheckCircle, AlertCircle, MoreHorizontal, Eye, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import type { Invoice, Project, Client, InvoiceItem } from "@shared/schema";
import { ManualInvoiceDialog } from "@/components/manual-invoice-dialog";

type InvoiceWithDetails = Invoice & { project: Project | null; client: Client | null; items: InvoiceItem[] };

type InvoiceStats = {
  totalInvoiced: number;
  totalPaid: number;
  totalUnpaid: number;
  totalUnbilled: number;
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function Invoices() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showManualDialog, setShowManualDialog] = useState(false);

  const { data: invoices, isLoading: invoicesLoading } = useQuery<InvoiceWithDetails[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<InvoiceStats>({
    queryKey: ["/api/invoices/stats"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
    },
    onSuccess: () => {
      invalidateDashboardQueries();
      toast({ title: "Invoice deleted successfully" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    },
  });

  const filteredInvoices = invoices?.filter(Boolean).filter(inv => {
    if (statusFilter === "all") return true;
    if (statusFilter === "unpaid") {
      return inv.status === "draft" || inv.status === "sent";
    }
    return inv.status === statusFilter;
  }) || [];

  const isLoading = invoicesLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-muted-foreground">Manage invoices and billing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowManualDialog(true)} data-testid="button-create-manual-invoice">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Invoices</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setStatusFilter("all")}
          data-testid="card-total-invoiced"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-invoiced">
              {formatCurrency(stats?.totalInvoiced || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Excludes cancelled</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setStatusFilter("paid")}
          data-testid="card-total-paid"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-paid">
              {formatCurrency(stats?.totalPaid || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Payments received</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setStatusFilter("unpaid")}
          data-testid="card-total-unpaid"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Unpaid</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-total-unpaid">
              {formatCurrency(stats?.totalUnpaid || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding balance</p>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover-elevate" 
          onClick={() => setStatusFilter("all")}
          data-testid="card-unbilled-time"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unbilled Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-total-unbilled">
              {formatCurrency(stats?.totalUnbilled || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Est. at $75/hr</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-invoices">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invoices found</p>
              <p className="text-sm">Create a manual invoice or generate one from project time logs</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                    <TableCell className="font-medium">
                      <Link href={`/invoices/${invoice.id}`} className="hover:underline" data-testid={`link-invoice-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {invoice.client && invoice.clientId ? (
                        <Link href={`/clients/${invoice.clientId}`} className="hover:underline" data-testid={`link-client-${invoice.id}`}>
                          {invoice.client.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground" data-testid={`text-client-${invoice.id}`}>
                          {invoice.recipientName || "No Client"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {invoice.project && invoice.projectId ? (
                        <Link href={`/projects/${invoice.projectId}`} className="hover:underline" data-testid={`link-project-${invoice.id}`}>
                          {invoice.project.name}
                        </Link>
                      ) : invoice.projectId && !invoice.project ? (
                        <span className="text-muted-foreground italic" data-testid={`text-project-deleted-${invoice.id}`}>Deleted project</span>
                      ) : (
                        <span className="text-muted-foreground" data-testid={`text-project-${invoice.id}`}>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[invoice.status] || ""} data-testid={`badge-status-${invoice.id}`}>
                        {statusLabels[invoice.status] || invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium" data-testid={`text-amount-${invoice.id}`}>
                      {formatCurrency(parseFloat(invoice?.total || "0"))}
                    </TableCell>
                    <TableCell>
                      {invoice.dueDate ? formatLocalDate(parseLocalDateFromISO(invoice.dueDate)!) : "-"}
                    </TableCell>
                    <TableCell>
                      {invoice.createdAt ? formatLocalDate(new Date(invoice.createdAt)) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${invoice.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => navigate(`/invoices/${invoice.id}`)} data-testid={`menu-view-${invoice.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => setDeleteId(invoice.id)}
                            data-testid={`menu-delete-${invoice.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ManualInvoiceDialog isOpen={showManualDialog} onClose={() => setShowManualDialog(false)} />

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice and all its line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
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
