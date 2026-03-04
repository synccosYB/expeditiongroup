import { useState, useRef, useMemo } from "react";
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
  FormDescription,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Receipt, DollarSign, Calendar, Upload, Image, Loader2, X, ExternalLink, Landmark, FileText, Copy } from "lucide-react";
import { useLocation } from "wouter";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Expense, Vendor, Account, Client, Project, Bill, BankAccount } from "@shared/schema";
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
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { parseLocalDate, formatDateForInput, parseLocalDateFromISO } from "@/lib/dateUtils";
import { Progress } from "@/components/ui/progress";

const PAYMENT_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "pay_bill", label: "Pay Bill" },
  { value: "check", label: "Check" },
  { value: "transfer", label: "Transfer" },
  { value: "other", label: "Other" },
] as const;

const expenseFormSchema = z.object({
  expenseDate: z.string().min(1, "Date is required"),
  vendorId: z.string().optional(),
  accountId: z.string().optional(),
  bankAccountId: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().min(1, "Description is required"),
  reference: z.string().optional(),
  paymentType: z.string().default("expense"),
  billId: z.string().optional(),
  isRebillable: z.boolean().default(false),
  rebillableClientId: z.string().optional(),
  rebillableProjectId: z.string().optional(),
  markupPercent: z.string().optional(),
  notes: z.string().optional(),
  receiptUrl: z.string().optional(),
}).refine((data) => {
  if (data.paymentType === "pay_bill" && !data.billId) {
    return false;
  }
  return true;
}, {
  message: "Please select a bill to pay",
  path: ["billId"],
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

type ExpenseWithRelations = Expense & {
  vendor?: Vendor;
  account?: Account;
  bankAccount?: BankAccount;
  rebillableClient?: Client;
  rebillableProject?: Project;
  bill?: Bill;
};

function ReceiptUploader({
  receiptUrl,
  expenseId,
  onUploadComplete,
  onRemove,
}: {
  receiptUrl: string | null | undefined;
  expenseId?: number;
  onUploadComplete: (url: string) => void;
  onRemove: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/", "application/pdf"];
    if (!allowedTypes.some(t => file.type.startsWith(t))) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image (JPG, PNG) or PDF file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const response = await apiRequest("POST", "/api/expenses/upload-url", {});
      const { url, method } = await response.json();

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.open(method, url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      const uploadedUrl = url.split("?")[0];
      onUploadComplete(uploadedUrl);
      toast({ title: "Receipt uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload receipt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (receiptUrl) {
    // Use backend proxy for viewing if we have an expenseId, otherwise use raw URL for preview during creation
    const viewUrl = expenseId ? `/api/expenses/receipt/${expenseId}` : receiptUrl;
    
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2">
            <Image className="h-4 w-4" />
            Receipt Attached
          </span>
          <div className="flex items-center gap-2">
            {expenseId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(viewUrl, "_blank")}
                data-testid="button-view-receipt"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRemove}
              data-testid="button-remove-receipt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="aspect-video bg-muted rounded-md overflow-hidden">
          {receiptUrl?.toLowerCase().endsWith(".pdf") ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">PDF Receipt</p>
            </div>
          ) : (
            <img
              src={viewUrl}
              alt="Receipt"
              className="w-full h-full object-contain"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Receipt Image
        </span>
      </div>
      {uploading ? (
        <div className="space-y-2">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-4 cursor-pointer hover-elevate rounded-md transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Click to upload receipt</p>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF up to 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-receipt-file"
          />
        </div>
      )}
    </div>
  );
}

export default function Expenses() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithRelations | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseWithRelations | null>(null);

  const { data: expenses, isLoading } = useQuery<ExpenseWithRelations[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: bills } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      expenseDate: new Date().toISOString().split("T")[0],
      vendorId: "",
      accountId: "",
      bankAccountId: "",
      amount: "",
      description: "",
      reference: "",
      paymentType: "expense",
      billId: "",
      isRebillable: false,
      rebillableClientId: "",
      rebillableProjectId: "",
      markupPercent: "0",
      notes: "",
      receiptUrl: "",
    },
  });

  const receiptUrl = form.watch("receiptUrl");

  const isRebillable = form.watch("isRebillable");
  const rebillableClientId = form.watch("rebillableClientId");
  const paymentType = form.watch("paymentType");

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const payload = {
        expenseDate: parseLocalDate(data.expenseDate),
        vendorId: data.vendorId ? parseInt(data.vendorId) : null,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        bankAccountId: data.bankAccountId ? parseInt(data.bankAccountId) : null,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        paymentType: data.paymentType || "expense",
        billId: data.paymentType === "pay_bill" && data.billId ? parseInt(data.billId) : null,
        notes: data.notes,
        isRebillable: data.isRebillable,
        rebillableClientId: data.rebillableClientId ? parseInt(data.rebillableClientId) : null,
        rebillableProjectId: data.rebillableProjectId ? parseInt(data.rebillableProjectId) : null,
        markupPercent: data.markupPercent || "0",
        receiptUrl: data.receiptUrl || null,
      };
      return await apiRequest("POST", "/api/expenses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Expense created successfully" });
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
        description: "Failed to create expense",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ExpenseFormData }) => {
      const payload = {
        expenseDate: parseLocalDate(data.expenseDate),
        vendorId: data.vendorId ? parseInt(data.vendorId) : null,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        bankAccountId: data.bankAccountId ? parseInt(data.bankAccountId) : null,
        amount: data.amount,
        description: data.description,
        reference: data.reference,
        paymentType: data.paymentType || "expense",
        billId: data.paymentType === "pay_bill" && data.billId ? parseInt(data.billId) : null,
        notes: data.notes,
        isRebillable: data.isRebillable,
        rebillableClientId: data.rebillableClientId ? parseInt(data.rebillableClientId) : null,
        rebillableProjectId: data.rebillableProjectId ? parseInt(data.rebillableProjectId) : null,
        markupPercent: data.markupPercent || "0",
        receiptUrl: data.receiptUrl || null,
      };
      return await apiRequest("PATCH", `/api/expenses/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Expense updated successfully" });
      setIsDialogOpen(false);
      setEditingExpense(null);
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
        description: "Failed to update expense",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      toast({ title: "Expense deleted successfully" });
      setDeletingExpense(null);
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
        description: "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (expense?: ExpenseWithRelations) => {
    if (expense) {
      setEditingExpense(expense);
      form.reset({
        expenseDate: expense.expenseDate ? formatDateForInput(expense.expenseDate) : "",
        vendorId: expense.vendorId?.toString() || "",
        accountId: expense.accountId?.toString() || "",
        bankAccountId: expense.bankAccountId?.toString() || "",
        amount: expense.amount || "",
        description: expense.description || "",
        reference: expense.reference || "",
        paymentType: expense.paymentType || "expense",
        billId: expense.billId?.toString() || "",
        isRebillable: expense.isRebillable ?? false,
        rebillableClientId: expense.rebillableClientId?.toString() || "",
        rebillableProjectId: expense.rebillableProjectId?.toString() || "",
        markupPercent: expense.markupPercent || "0",
        notes: expense.notes || "",
        receiptUrl: expense.receiptUrl || "",
      });
    } else {
      setEditingExpense(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const handleDuplicate = (expense: ExpenseWithRelations) => {
    setEditingExpense(null);
    form.reset({
      expenseDate: new Date().toISOString().split("T")[0],
      vendorId: expense.vendorId?.toString() || "",
      accountId: expense.accountId?.toString() || "",
      bankAccountId: expense.bankAccountId?.toString() || "",
      amount: expense.amount || "",
      description: expense.description || "",
      reference: "",
      paymentType: expense.paymentType || "expense",
      billId: expense.billId?.toString() || "",
      isRebillable: expense.isRebillable ?? false,
      rebillableClientId: expense.rebillableClientId?.toString() || "",
      rebillableProjectId: expense.rebillableProjectId?.toString() || "",
      markupPercent: expense.markupPercent || "0",
      notes: expense.notes || "",
      receiptUrl: "",
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ExpenseFormData) => {
    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredExpenses = expenses?.filter(Boolean).filter((expense) =>
    expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    expense.reference?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const getStatusBadge = (expense: ExpenseWithRelations) => {
    if (expense.rebilledInvoiceId) {
      return <Badge variant="default">Rebilled</Badge>;
    }
    if (expense.isRebillable) {
      return <Badge variant="secondary">Rebillable</Badge>;
    }
    return null;
  };

  const getPaymentTypeLabel = (paymentType: string | null | undefined) => {
    const type = PAYMENT_TYPES.find(t => t.value === paymentType);
    return type?.label || "Expense";
  };

  const expenseAccounts = accounts?.filter(a => a.accountType === "expense" && a.isActive);
  const activeVendors = vendors?.filter(v => v.isActive);
  const activeClients = clients?.filter(c => c.status === "active");
  const activeBankAccounts = bankAccounts?.filter(b => b.isActive);

  // Build hierarchical account list with parent accounts first, then children indented
  const hierarchicalAccounts = useMemo(() => {
    if (!expenseAccounts) return [];
    
    // Separate parent accounts (no parentAccountId) and child accounts
    const parentAccounts = expenseAccounts.filter(a => !a.parentAccountId);
    const childAccounts = expenseAccounts.filter(a => a.parentAccountId);
    
    // Build hierarchical list
    const result: { account: Account; isChild: boolean }[] = [];
    
    parentAccounts
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach(parent => {
        result.push({ account: parent, isChild: false });
        
        // Add children immediately after their parent
        const children = childAccounts
          .filter(child => child.parentAccountId === parent.id)
          .sort((a, b) => a.code.localeCompare(b.code));
        
        children.forEach(child => {
          result.push({ account: child, isChild: true });
        });
      });
    
    // Add any orphaned child accounts (parent not found or inactive) at the end
    const orphanedChildren = childAccounts.filter(
      child => !parentAccounts.find(p => p.id === child.parentAccountId)
    );
    orphanedChildren
      .sort((a, b) => a.code.localeCompare(b.code))
      .forEach(orphan => {
        result.push({ account: orphan, isChild: true });
      });
    
    return result;
  }, [expenseAccounts]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Expenses</h1>
            <p className="text-muted-foreground mt-1">Track company expenses and rebillables</p>
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
          <h1 className="text-3xl font-semibold text-foreground">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track company expenses and rebillables</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-expense">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </DialogTitle>
              <DialogDescription className="sr-only">{editingExpense ? "Edit expense details" : "Add a new expense"}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expenseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-expense-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-expense-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="What was this expense for?"
                          {...field}
                          data-testid="input-expense-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vendorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-expense-vendor">
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
                    name="accountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expense Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-expense-account">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {hierarchicalAccounts.map(({ account, isChild }) => (
                              <SelectItem 
                                key={account.id} 
                                value={account.id.toString()}
                                className={isChild ? "pl-8" : ""}
                                data-testid={`select-option-account-${account.id}`}
                              >
                                {isChild ? "└ " : ""}{account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference / Check #</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Receipt or check number"
                          {...field}
                          data-testid="input-expense-reference"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PAYMENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {paymentType === "pay_bill" && (
                    <FormField
                      control={form.control}
                      name="billId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bill to Pay</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-bill">
                                <SelectValue placeholder="Select bill" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {bills?.filter(b => b.status === "pending" || b.status === "partial").map((bill) => (
                                <SelectItem key={bill.id} value={bill.id.toString()}>
                                  {bill.billNumber} - ${bill.amountDue} due
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pay From (Bank Account / Card)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-bank-account">
                            <SelectValue placeholder="Select account to pay from" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeBankAccounts?.map((ba) => (
                            <SelectItem key={ba.id} value={ba.id.toString()} data-testid={`select-option-bank-account-${ba.id}`}>
                              {ba.name} ({ba.accountType === "credit_card" ? "Credit Card" : ba.accountType === "checking" ? "Checking" : ba.accountType === "savings" ? "Savings" : ba.accountType === "cash" ? "Cash" : "Other"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Which bank account or card is this expense paid from?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="border rounded-lg p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="isRebillable"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Rebillable Expense</FormLabel>
                          <FormDescription>
                            Mark this expense to be billed to a client
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-expense-rebillable"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {isRebillable && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="rebillableClientId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bill to Client</FormLabel>
                              <Select onValueChange={(val) => { field.onChange(val); form.setValue("rebillableProjectId", ""); }} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-rebill-client">
                                    <SelectValue placeholder="Select client" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {activeClients?.map((client) => (
                                    <SelectItem key={client.id} value={client.id.toString()}>
                                      {client.name}
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
                          name="rebillableProjectId"
                          render={({ field }) => {
                            const clientProjects = rebillableClientId
                              ? projects?.filter(p => p.clientId?.toString() === rebillableClientId)
                              : projects;
                            return (
                              <FormItem>
                                <FormLabel>Project</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-rebill-project">
                                      <SelectValue placeholder="Select project" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {clientProjects?.map((project) => (
                                      <SelectItem key={project.id} value={project.id.toString()}>
                                        {project.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="markupPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Markup %</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="0"
                                {...field}
                                data-testid="input-expense-markup"
                              />
                            </FormControl>
                            <FormDescription>
                              Optional markup percentage when rebilling
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
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
                          data-testid="input-expense-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <ReceiptUploader
                  receiptUrl={receiptUrl}
                  expenseId={editingExpense?.id}
                  onUploadComplete={(url) => form.setValue("receiptUrl", url)}
                  onRemove={() => form.setValue("receiptUrl", "")}
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
                    data-testid="button-save-expense"
                  >
                    {editingExpense ? "Update" : "Create"}
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
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-expenses"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredExpenses || filteredExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              description="Add your first expense to start tracking"
            />
          ) : (
            <div className="divide-y rounded-lg border">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-4 hover-elevate"
                  data-testid={`expense-row-${expense.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{expense.description}</p>
                        <Badge variant="outline" className="text-xs">
                          {getPaymentTypeLabel(expense.paymentType)}
                        </Badge>
                        {getStatusBadge(expense)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {expense.expenseDate ? format(parseLocalDateFromISO(expense.expenseDate) || new Date(), "MMM d, yyyy") : "No date"}
                        </span>
                        {expense.vendor && (
                          <span>{expense.vendor.name}</span>
                        )}
                        {expense.bill && (
                          <span className="text-blue-600 dark:text-blue-400">
                            Pays: {expense.bill.billNumber}
                          </span>
                        )}
                        {expense.bankAccount && (
                          <span>
                            Paid from: {expense.bankAccount.name}
                          </span>
                        )}
                        {expense.rebillableClient && (
                          <span className="text-primary">
                            Bill to: {expense.rebillableClient.name}
                          </span>
                        )}
                        {expense.receiptUrl && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400" data-testid={`receipt-indicator-${expense.id}`}>
                            <Image className="h-3 w-3" />
                            Receipt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-lg">
                        {formatCurrency(expense.amount)}
                      </p>
                      {expense.isRebillable && expense.markupPercent && parseFloat(expense.markupPercent) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          +{expense.markupPercent}% markup
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-expense-menu-${expense.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(expense)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(expense)} data-testid={`button-duplicate-expense-${expense.id}`}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {expense.bankAccountId && (
                          <DropdownMenuItem 
                            onClick={() => setLocation(`/bank-register/${expense.bankAccountId}`)} 
                            data-testid={`button-view-transaction-${expense.id}`}
                          >
                            <Landmark className="h-4 w-4 mr-2" />
                            View in Bank Register
                          </DropdownMenuItem>
                        )}
                        {expense.receiptUrl && (
                          <DropdownMenuItem onClick={() => window.open(`/api/expenses/receipt/${expense.id}`, "_blank")} data-testid={`button-view-receipt-${expense.id}`}>
                            <Image className="h-4 w-4 mr-2" />
                            View Receipt
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingExpense(expense)}
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

      <AlertDialog open={!!deletingExpense} onOpenChange={() => setDeletingExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingExpense && deleteMutation.mutate(deletingExpense.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
