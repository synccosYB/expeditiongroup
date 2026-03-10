import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, FileText, X, DollarSign, Upload, Image, Loader2, ExternalLink, Eye, Copy, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Bill, BillItem, Vendor, Account, BillPayment, BankAccount, Client, Project } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
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
  isRebillable: z.boolean().default(false),
  rebillableClientId: z.string().optional(),
  rebillableProjectId: z.string().optional(),
  markupPercent: z.string().optional(),
});

const billFormSchema = z.object({
  vendorId: z.string().min(1, "Vendor is required"),
  billNumber: z.string().optional(),
  billDate: z.string().min(1, "Bill date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
});

type BillFormData = z.infer<typeof billFormSchema>;

type BillWithRelations = Bill & {
  vendor: Vendor;
  items: BillItem[];
  payments?: BillPayment[];
};

function BillDocumentUploader({
  documentUrl,
  billId,
  onUploadComplete,
  onRemove,
}: {
  documentUrl: string | null | undefined;
  billId?: number;
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
    const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
    if (!isAllowed) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image or PDF file",
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
      const response = await apiRequest("POST", "/api/bills/upload-url", {});
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
      toast({ title: "Document uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
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

  if (documentUrl) {
    const viewUrl = billId ? `/api/bills/document/${billId}` : documentUrl;
    
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2">
            <Image className="h-4 w-4" />
            Document Attached
          </span>
          <div className="flex items-center gap-2">
            {billId && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(viewUrl, "_blank")}
                data-testid="button-view-bill-document"
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
              data-testid="button-remove-bill-document"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {billId && (
          <div className="aspect-video bg-muted rounded-md overflow-hidden">
            <img
              src={viewUrl}
              alt="Bill Document"
              className="w-full h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = '<div class="flex items-center justify-center h-full text-muted-foreground">PDF or non-image document</div>';
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Bill Document
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
          <p className="text-sm text-muted-foreground">Click to upload bill document</p>
          <p className="text-xs text-muted-foreground mt-1">Image or PDF up to 10MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-bill-document-file"
          />
        </div>
      )}
    </div>
  );
}

export default function Bills() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillWithRelations | null>(null);
  const [deletingBill, setDeletingBill] = useState<BillWithRelations | null>(null);
  const [payingBill, setPayingBill] = useState<BillWithRelations | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentBankAccountId, setPaymentBankAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    if (payingBill) {
      const total = parseFloat(payingBill.total || "0");
      const paid = parseFloat(payingBill.amountPaid || "0");
      const balance = total - paid;
      setPaymentAmount(balance > 0 ? balance.toFixed(2) : "");
    }
  }, [payingBill, payingBill?.amountPaid, payingBill?.total]);

  const [viewingPaymentsBill, setViewingPaymentsBill] = useState<BillWithRelations | null>(null);
  const [editingPayment, setEditingPayment] = useState<BillPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<BillPayment | null>(null);

  const { data: bills, isLoading } = useQuery<BillWithRelations[]>({
    queryKey: ["/api/bills"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ["/api/bank-accounts"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm<BillFormData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      vendorId: "",
      billNumber: "",
      billDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      notes: "",
      documentUrl: "",
      items: [{ description: "", quantity: "1", unitPrice: "", accountId: "", isRebillable: false, rebillableClientId: "", rebillableProjectId: "", markupPercent: "0" }],
    },
  });

  const documentUrl = form.watch("documentUrl");
  const watchedItems = form.watch("items");

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
        isRebillable: item.isRebillable || false,
        rebillableClientId: item.isRebillable && item.rebillableClientId ? parseInt(item.rebillableClientId) : null,
        rebillableProjectId: item.isRebillable && item.rebillableProjectId ? parseInt(item.rebillableProjectId) : null,
        markupPercent: item.isRebillable ? (item.markupPercent || "0") : "0",
      }));
      
      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      
      const payload = {
        vendorId: parseInt(data.vendorId),
        billNumber: data.billNumber || undefined,
        billDate: new Date(data.billDate),
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        documentUrl: data.documentUrl || null,
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
        documentUrl: data.documentUrl || null,
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
    mutationFn: async ({ billId, amount, bankAccountId, paymentDate, paymentMethod, reference }: { 
      billId: number; 
      amount: string; 
      bankAccountId: number;
      paymentDate: string;
      paymentMethod: string;
      reference?: string;
    }) => {
      return await apiRequest("POST", `/api/bills/${billId}/payments`, {
        amount,
        bankAccountId,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        reference,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Payment recorded successfully" });
      setPayingBill(null);
      setPaymentAmount("");
      setPaymentBankAccountId("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("check");
      setPaymentReference("");
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

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, amount, bankAccountId, paymentDate, paymentMethod, reference }: { 
      paymentId: number; 
      amount: string; 
      bankAccountId: number;
      paymentDate: string;
      paymentMethod: string;
      reference?: string;
    }) => {
      return await apiRequest("PATCH", `/api/bill-payments/${paymentId}`, {
        amount,
        bankAccountId,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        reference,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Payment updated successfully" });
      setEditingPayment(null);
      setPaymentAmount("");
      setPaymentBankAccountId("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("check");
      setPaymentReference("");
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
        description: "Failed to update payment",
        variant: "destructive",
      });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      return await apiRequest("DELETE", `/api/bill-payments/${paymentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      toast({ title: "Payment deleted successfully" });
      setDeletingPayment(null);
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
        description: "Failed to delete payment",
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
        documentUrl: bill.documentUrl || "",
        items: bill.items?.map(item => ({
          description: item.description || "",
          quantity: item.quantity || "1",
          unitPrice: item.unitPrice || "",
          accountId: item.accountId?.toString() || "",
          isRebillable: item.isRebillable ?? false,
          rebillableClientId: item.rebillableClientId?.toString() || "",
          rebillableProjectId: item.rebillableProjectId?.toString() || "",
          markupPercent: item.markupPercent || "0",
        })) || [{ description: "", quantity: "1", unitPrice: "", accountId: "", isRebillable: false, rebillableClientId: "", rebillableProjectId: "", markupPercent: "0" }],
      });
    } else {
      setEditingBill(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const handleDuplicate = (bill: BillWithRelations) => {
    setEditingBill(null);
    form.reset({
      vendorId: bill.vendorId?.toString() || "",
      billNumber: "",
      billDate: new Date().toISOString().split("T")[0],
      dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split("T")[0] : "",
      notes: bill.notes || "",
      documentUrl: "",
      items: bill.items?.map(item => ({
        description: item.description || "",
        quantity: item.quantity || "1",
        unitPrice: item.unitPrice || "",
        accountId: item.accountId?.toString() || "",
        isRebillable: item.isRebillable ?? false,
        rebillableClientId: item.rebillableClientId?.toString() || "",
        rebillableProjectId: item.rebillableProjectId?.toString() || "",
        markupPercent: item.markupPercent || "0",
      })) || [{ description: "", quantity: "1", unitPrice: "", accountId: "", isRebillable: false, rebillableClientId: "", rebillableProjectId: "", markupPercent: "0" }],
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: BillFormData) => {
    if (editingBill) {
      updateMutation.mutate({ id: editingBill.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredBills = useMemo(() => bills?.filter(Boolean).filter((bill) =>
    bill.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bill.billNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [bills, searchQuery]);

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

  const activeVendors = useMemo(() => vendors?.filter(v => v.isActive), [vendors]);
  const expenseAccounts = useMemo(() => accounts?.filter(a => a.accountType === "expense" && a.isActive), [accounts]);
  const activeBankAccounts = useMemo(() => bankAccounts?.filter(a => a.isActive), [bankAccounts]);
  const activeClients = useMemo(() => clients?.filter(c => c.status === "active"), [clients]);

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
              <DialogDescription className="sr-only">{editingBill ? "Edit bill details" : "Add a new bill"}</DialogDescription>
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
                      onClick={() => append({ description: "", quantity: "1", unitPrice: "", accountId: "", isRebillable: false, rebillableClientId: "", rebillableProjectId: "", markupPercent: "0" })}
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
                      <div className="col-span-12">
                        <div className="flex items-center gap-3 py-1">
                          <FormField
                            control={form.control}
                            name={`items.${index}.isRebillable`}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={(checked) => {
                                      field.onChange(checked);
                                      if (!checked) {
                                        form.setValue(`items.${index}.rebillableClientId`, "");
                                        form.setValue(`items.${index}.rebillableProjectId`, "");
                                        form.setValue(`items.${index}.markupPercent`, "0");
                                      }
                                    }}
                                    data-testid={`switch-bill-item-rebillable-${index}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-xs text-muted-foreground cursor-pointer">Rebillable</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                        {watchedItems?.[index]?.isRebillable && (
                          <div className="grid grid-cols-3 gap-2 pb-2">
                            <FormField
                              control={form.control}
                              name={`items.${index}.rebillableClientId`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Bill to Client</FormLabel>
                                  <Select
                                    onValueChange={(val) => {
                                      field.onChange(val);
                                      form.setValue(`items.${index}.rebillableProjectId`, "");
                                    }}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger data-testid={`select-bill-item-client-${index}`}>
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
                              name={`items.${index}.rebillableProjectId`}
                              render={({ field }) => {
                                const selectedClientId = watchedItems?.[index]?.rebillableClientId;
                                const clientProjects = selectedClientId
                                  ? projects?.filter(p => p.clientId?.toString() === selectedClientId)
                                  : projects;
                                return (
                                  <FormItem>
                                    <FormLabel className="text-xs">Project (Optional)</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || ""}>
                                      <FormControl>
                                        <SelectTrigger data-testid={`select-bill-item-project-${index}`}>
                                          <SelectValue placeholder="No Project / General" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="__none__" data-testid={`select-bill-item-project-none-${index}`}>No Project / General</SelectItem>
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
                            <FormField
                              control={form.control}
                              name={`items.${index}.markupPercent`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Markup %</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      placeholder="0"
                                      {...field}
                                      data-testid={`input-bill-item-markup-${index}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
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

                <BillDocumentUploader
                  documentUrl={documentUrl}
                  billId={editingBill?.id}
                  onUploadComplete={(url) => form.setValue("documentUrl", url)}
                  onRemove={() => form.setValue("documentUrl", "")}
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
                  <Link href={`/bills/${bill.id}`} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{bill.vendor?.name}</p>
                        {getStatusBadge(bill)}
                        {bill.items?.some(item => item.isRebillable) && (
                          <Badge variant="outline" data-testid={`badge-bill-rebillable-${bill.id}`}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Rebillable
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {bill.billNumber && <span>#{bill.billNumber}</span>}
                        <span>Due: {bill.dueDate ? format(new Date(bill.dueDate), "MMM d, yyyy") : "-"}</span>
                      </div>
                    </div>
                  </Link>
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
                        <DropdownMenuItem asChild>
                          <Link href={`/bills/${bill.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {bill.status !== "paid" && (
                          <DropdownMenuItem onSelect={() => {
                            setPayingBill(bill);
                            setPaymentAmount(calculateBalance(bill).toFixed(2));
                          }}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Record Payment
                          </DropdownMenuItem>
                        )}
                        {bill.payments && bill.payments.length > 0 && (
                          <DropdownMenuItem onSelect={() => setViewingPaymentsBill(bill)}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Payments ({bill.payments.length})
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => handleOpenDialog(bill)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDuplicate(bill)} data-testid={`button-duplicate-bill-${bill.id}`}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setDeletingBill(bill)}
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

      <Dialog open={!!payingBill} onOpenChange={() => {
        setPayingBill(null);
        setPaymentBankAccountId("");
        setPaymentDate(new Date().toISOString().split("T")[0]);
        setPaymentMethod("check");
        setPaymentReference("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription className="sr-only">Record a payment for this bill</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {payingBill?.billNumber ? `${payingBill.billNumber} — ` : ""}Bill to {payingBill?.vendor?.name}
              </p>
              <div className="rounded-md border p-3 space-y-1" data-testid="payment-bill-summary">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bill Total</span>
                  <span data-testid="text-bill-total">{formatCurrency(payingBill?.total || "0")}</span>
                </div>
                {parseFloat(payingBill?.amountPaid || "0") > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="text-green-600 dark:text-green-400" data-testid="text-amount-paid">
                      -{formatCurrency(payingBill?.amountPaid || "0")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-semibold border-t pt-1">
                  <span>Remaining Balance</span>
                  <span data-testid="text-remaining-balance">{formatCurrency(calculateBalance(payingBill!).toString())}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Pay From Account *</label>
              <Select value={paymentBankAccountId} onValueChange={setPaymentBankAccountId}>
                <SelectTrigger data-testid="select-payment-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {activeBankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.accountType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Payment Date *</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  data-testid="input-payment-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={calculateBalance(payingBill!).toFixed(2)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-payment-amount"
                />
                <p className="text-xs text-muted-foreground mt-1" data-testid="text-payment-hint">
                  Enter a partial or full amount (max {formatCurrency(calculateBalance(payingBill!).toString())})
                </p>
                {paymentAmount && !isNaN(parseFloat(paymentAmount)) && parseFloat(paymentAmount) > calculateBalance(payingBill!) && (
                  <p className="text-xs text-destructive mt-1" data-testid="text-payment-error">
                    Amount exceeds remaining balance
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="select-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH Transfer</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reference / Check #</label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-payment-reference"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayingBill(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => payingBill && paymentMutation.mutate({ 
                  billId: payingBill.id, 
                  amount: paymentAmount,
                  bankAccountId: parseInt(paymentBankAccountId),
                  paymentDate,
                  paymentMethod,
                  reference: paymentReference || undefined,
                })}
                disabled={paymentMutation.isPending || !paymentAmount || !paymentBankAccountId || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0 || parseFloat(paymentAmount) > calculateBalance(payingBill!)}
                data-testid="button-confirm-payment"
              >
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingPaymentsBill} onOpenChange={() => setViewingPaymentsBill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription className="sr-only">View payment history for this bill</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Bill to {viewingPaymentsBill?.vendor?.name}</p>
              <p className="text-sm">
                Total: {formatCurrency(viewingPaymentsBill?.total || "0")} | 
                Paid: {formatCurrency(viewingPaymentsBill?.amountPaid || "0")} |
                Balance: {formatCurrency(viewingPaymentsBill ? calculateBalance(viewingPaymentsBill).toString() : "0")}
              </p>
            </div>
            <div className="border rounded-md divide-y">
              {viewingPaymentsBill?.payments?.map((payment) => {
                const bankAccount = activeBankAccounts?.find(a => a.id === payment.bankAccountId);
                return (
                  <div key={payment.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.paymentDate), "MMM d, yyyy")} via {payment.paymentMethod}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {bankAccount?.name || "Unknown account"}
                        {payment.reference && ` - Ref: ${payment.reference}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingPayment(payment);
                          setPaymentAmount(payment.amount);
                          setPaymentBankAccountId(payment.bankAccountId.toString());
                          setPaymentDate(new Date(payment.paymentDate).toISOString().split("T")[0]);
                          setPaymentMethod(payment.paymentMethod || "check");
                          setPaymentReference(payment.reference || "");
                        }}
                        data-testid={`button-edit-payment-${payment.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingPayment(payment)}
                        data-testid={`button-delete-payment-${payment.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {(!viewingPaymentsBill?.payments || viewingPaymentsBill.payments.length === 0) && (
                <p className="p-3 text-sm text-muted-foreground text-center">No payments recorded</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPayment} onOpenChange={() => {
        setEditingPayment(null);
        setPaymentBankAccountId("");
        setPaymentDate(new Date().toISOString().split("T")[0]);
        setPaymentMethod("check");
        setPaymentReference("");
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription className="sr-only">Edit payment details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Pay From Account *</label>
              <Select value={paymentBankAccountId} onValueChange={setPaymentBankAccountId}>
                <SelectTrigger data-testid="select-edit-payment-account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {activeBankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.accountType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Payment Date *</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  data-testid="input-edit-payment-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount *</label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-edit-payment-amount"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger data-testid="select-edit-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="ach">ACH Transfer</SelectItem>
                    <SelectItem value="wire">Wire Transfer</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Reference / Check #</label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-edit-payment-reference"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPayment(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => editingPayment && updatePaymentMutation.mutate({ 
                  paymentId: editingPayment.id, 
                  amount: paymentAmount,
                  bankAccountId: parseInt(paymentBankAccountId),
                  paymentDate,
                  paymentMethod,
                  reference: paymentReference || undefined,
                })}
                disabled={updatePaymentMutation.isPending || !paymentAmount || !paymentBankAccountId}
                data-testid="button-confirm-edit-payment"
              >
                Update Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPayment} onOpenChange={() => setDeletingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of {formatCurrency(deletingPayment?.amount || "0")}? 
              This will reverse the bank account balance and update the bill status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPayment && deletePaymentMutation.mutate(deletingPayment.id)}
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
