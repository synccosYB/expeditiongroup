import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  ChevronLeft,
  Download,
  Printer,
  Calendar,
  Building,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Invoice, Project, Client, InvoiceItem } from "@shared/schema";
import { format } from "date-fns";

type InvoiceWithRelations = Invoice & {
  project: Project;
  client: Client;
  items: InvoiceItem[];
};

export default function ClientInvoiceDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: invoice, isLoading } = useQuery<InvoiceWithRelations>({
    queryKey: ["/api/client/invoices", id],
    enabled: !!id,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!invoice) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={FileText}
            title="Invoice not found"
            description="The invoice you're looking for doesn't exist"
          />
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-chart-2 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="text-chart-3 border-chart-3 gap-1">
            <Clock className="h-3 w-3" />
            Awaiting Payment
          </Badge>
        );
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "cancelled":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div>
          <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back to Invoices
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground font-mono" data-testid="text-invoice-number">
              {invoice.invoiceNumber}
            </h1>
            {getStatusBadge(invoice.status)}
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4" />
              Bill To
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{invoice.client?.name}</p>
            {invoice.client?.company && (
              <p className="text-muted-foreground">{invoice.client.company}</p>
            )}
            {invoice.client?.email && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-3 w-3" />
                {invoice.client.email}
              </p>
            )}
            {invoice.client?.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3 w-3" />
                {invoice.client.phone}
              </p>
            )}
            {invoice.client?.billingAddress && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {invoice.client.billingAddress}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{invoice.project?.name}</p>
            {invoice.project?.address && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {invoice.project.address}
              </p>
            )}
            {invoice.project?.county && (
              <Badge variant="outline" className="mt-2">
                {invoice.project.county}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoice.createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date</span>
                <span>{format(new Date(invoice.createdAt), "MMM d, yyyy")}</span>
              </div>
            )}
            {invoice.dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{format(new Date(invoice.dueDate), "MMM d, yyyy")}</span>
              </div>
            )}
            {invoice.paidAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid Date</span>
                <span className="text-chart-2">{format(new Date(invoice.paidAt), "MMM d, yyyy")}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-medium">
              <span>Total Due</span>
              <span className="text-lg">${parseFloat(invoice?.total || "0").toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Description</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items?.map((item, index) => (
                <TableRow key={item.id || index}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">${parseFloat(item.unitPrice || "0").toFixed(2)}</TableCell>
                  <TableCell className="text-right">${parseFloat(item.amount || "0").toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">Subtotal</TableCell>
                <TableCell className="text-right">${parseFloat(invoice.subtotal || "0").toFixed(2)}</TableCell>
              </TableRow>
              {invoice.tax && parseFloat(invoice.tax) > 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Tax</TableCell>
                  <TableCell className="text-right">${parseFloat(invoice.tax).toFixed(2)}</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell colSpan={3} className="text-right text-lg font-bold">Total</TableCell>
                <TableCell className="text-right text-lg font-bold">
                  ${parseFloat(invoice?.total || "0").toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
