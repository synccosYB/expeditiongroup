import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, FileText, X, DollarSign } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Bill, BillItem, Vendor, Account, BillPayment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
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
import { format } from "date-fns";

const billItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().default("1"),
  unitPrice: z.string().min(1, "Price is required"),
  accountId: z.string().optional(),
});

const billFormSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  billNumber: z.string().optional(),
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
});

type BillFormData = z.infer<typeof billFormSchema>;

type BillWithRelations = Bill & {
  vendor: Vendor;
  items: BillItem[];
  payments?: BillPayment[];
};

export default function Bills() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillWithRelations | null>(null);
  const [deletingBill, setDeletingBill] = useState<BillWithRelations | null>(null);
  const [payingBill, setPayingBill] = useState<BillWithRelations | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const { data: bills, isLoading } = useQuery<BillWithRelations[]>({
    queryKey: ["/api/bills"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const form = useForm<BillFormData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      vendorId: "",
      billNumber: "",
      billDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      notes: "",
      items: [{ description: "", quantity: "1", unitPrice: "", accountId: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const createMutation = useMutation({
    mutationFn: async (data: BillFormData) => {
      const items = data.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: (parseFloat(item.quantity || "1") * parseFloat(item.unitPrice || "0")).toFixed(2),
        accountId: item.accountId ? parseInt(item.accountId) : null,
      }));
      
      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      
      const payload = {
        vendorId: parseInt(data.vendorId),
        billNumber: data.billNumber || undefined,
        billDate: new Date(data.billDate),
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        subtotal: totalAmount.toFixed(2),
        total: totalAmount.toFixed(2),
        amountDue: totalAmount.toFixed(2),
        items,
      };
      return await apiRequest("POST", "/api/bills", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill created successfully" });
      setIsDialogOpen(false);
      form.reset();
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
        description: "Failed to create bill",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<BillFormData> }) => {
      const payload: any = {
        billNumber: data.billNumber,
        billDate: data.billDate ? new Date(data.billDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
      };
      if (data.vendorId) {
        payload.vendorId = parseInt(data.vendorId);
      }
      return await apiRequest("PATCH", `/api/bills/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill updated successfully" });
      setIsDialogOpen(false);
      setEditingBill(null);
      form.reset();
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
        description: "Failed to update bill",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill deleted successfully" });
      setDeletingBill(null);
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
        description: "Failed to delete bill",
        variant: "destructive",
      });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ billId, amount }: { billId: number; amount: string }) => {
      return await apiRequest("POST", `/api/bills/${billId}/payments`, {
        amount,
        paymentDate: new Date(),
        paymentMethod: "check",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Payment recorded successfully" });
      setPayingBill(null);
      setPaymentAmount("");
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
        description: "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (bill?: BillWithRelations) => {
    if (bill) {
      setEditingBill(bill);
      form.reset({
        vendorId: bill.vendorId?.toString() || "",
        billNumber: bill.billNumber || "",
        billDate: bill.billDate ? new Date(bill.billDate).toISOString().split("T")[0] : "",
        dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split("T")[0] : "",
        notes: bill.notes || "",
        items: bill.items?.map(item => ({
          description: item.description || "",
          quantity: item.quantity || "1",
          unitPrice: item.unitPrice || "",
          accountId: item.accountId?.toString() || "",
        })) || [{ description: "", quantity: "1", unitPrice: "", accountId: "" }],
      });
    } else {
      setEditingBill(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: BillFormData) => {
    if (editingBill) {
      updateMutation.mutate({ id: editingBill.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredBills = bills?.filter(Boolean).filter((bill) =>
    bill.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getStatusBadge = (bill: BillWithRelations) => {
    switch (bill.status) {
      case "paid":
        return <Badge variant="default">Paid</Badge>;
      case "partial":
        return <Badge variant="secondary">Partial</Badge>;
      case "void":
        return <Badge variant="destructive">Void</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const calculateBalance = (bill: BillWithRelations) => {
    const total = parseFloat(bill?.total || "0");
    const paid = parseFloat(bill?.amountPaid || "0");
    return total - paid;
  };

  const activeVendors = vendors?.filter(v => v.isActive);
  const expenseAccounts = accounts?.filter(a => a.accountType === "expense" && a.isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Bills</h1>
            <p className="text-muted-foreground mt-1">Track vendor bills and payments</p>
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
          <h1 className="text-3xl font-semibold text-foreground">Bills</h1>
          <p className="text-muted-foreground mt-1">Track vendor bills and payments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-bill">
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBill ? "Edit Bill" : "Add New Bill"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-bill-vendor">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeVendors?.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id.toString()}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="billNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill / Invoice #</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Vendor's invoice number"
                            {...field}
                            data-testid="input-bill-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bill Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-bill-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-bill-due-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Line Items</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ description: "", quantity: "1", unitPrice: "", accountId: "" })}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.description`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Description</FormLabel>}
                              <FormControl>
                                <Input placeholder="Description" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.accountId`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Category</FormLabel>}
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {expenseAccounts?.map((account) => (
                                    <SelectItem key={account.id} value={account.id.toString()}>
                                      {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Qty</FormLabel>}
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              {index === 0 && <FormLabel>Price</FormLabel>}
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-1 flex items-end">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className={index === 0 ? "mt-6" : ""}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes..."
                          {...field}
                          data-testid="input-bill-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-bill"
                  >
                    {editingBill ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-bills"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredBills || filteredBills.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No bills yet"
              description="Add your first bill to start tracking payables"
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {filteredBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-4 hover-elevate"
                  data-testid={`bill-row-${bill.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{bill.vendor?.name}</p>
                        {getStatusBadge(bill)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {bill.billNumber && <span>#{bill.billNumber}</span>}
                        <span>Due: {bill.dueDate ? format(new Date(bill.dueDate), "MMM d, yyyy") : "-"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-lg">
                        {formatCurrency(bill?.total || "0")}
                      </p>
                      {bill?.status !== "paid" && parseFloat(bill?.amountPaid || "0") > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Balance: {formatCurrency(calculateBalance(bill).toString())}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-bill-menu-${bill.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {bill.status !== "paid" && (
                          <DropdownMenuItem onClick={() => {
                            setPayingBill(bill);
                            setPaymentAmount(calculateBalance(bill).toFixed(2));
                          }}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Record Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleOpenDialog(bill)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingBill(bill)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingBill} onOpenChange={() => setDeletingBill(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bill? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBill && deleteMutation.mutate(deletingBill.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!payingBill} onOpenChange={() => setPayingBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Bill to {payingBill?.vendor?.name}</p>
              <p className="text-lg font-medium">Balance: {formatCurrency(calculateBalance(payingBill!).toString())}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Payment Amount</label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-payment-amount"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayingBill(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => payingBill && paymentMutation.mutate({ billId: payingBill.id, amount: paymentAmount })}
                disabled={paymentMutation.isPending || !paymentAmount}
                data-testid="button-confirm-payment"
              >
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
