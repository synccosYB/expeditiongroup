import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FormDescription,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, BarChart3, ChevronRight, CornerDownRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, LIST_PAGE_REFETCH_INTERVAL_MS } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Account } from "@shared/schema";
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

const accountFormSchema = z.object({
  code: z.string().min(1, "Account code is required"),
  name: z.string().min(1, "Account name is required"),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  accountSubtype: z.enum(["cash", "bank", "accounts_receivable", "other_current_asset", "fixed_asset", "accounts_payable", "credit_card", "other_current_liability", "long_term_liability", "owner_equity", "retained_earnings", "service_revenue", "other_income", "cost_of_goods", "operating_expense", "payroll_expense", "other_expense"]).optional().nullable(),
  description: z.string().optional(),
  parentAccountId: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
});

type AccountFormData = z.infer<typeof accountFormSchema>;

const accountTypes = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
];

const subtypesByType: Record<string, { value: string; label: string }[]> = {
  asset: [
    { value: "cash", label: "Cash" },
    { value: "bank", label: "Bank" },
    { value: "accounts_receivable", label: "Accounts Receivable" },
    { value: "other_current_asset", label: "Other Current Asset" },
    { value: "fixed_asset", label: "Fixed Asset" },
  ],
  liability: [
    { value: "accounts_payable", label: "Accounts Payable" },
    { value: "credit_card", label: "Credit Card" },
    { value: "other_current_liability", label: "Other Current Liability" },
    { value: "long_term_liability", label: "Long Term Liability" },
  ],
  equity: [
    { value: "owner_equity", label: "Owner's Equity" },
    { value: "retained_earnings", label: "Retained Earnings" },
  ],
  revenue: [
    { value: "service_revenue", label: "Service Revenue" },
    { value: "other_income", label: "Other Income" },
  ],
  expense: [
    { value: "cost_of_goods", label: "Cost of Goods" },
    { value: "operating_expense", label: "Operating Expense" },
    { value: "payroll_expense", label: "Payroll Expense" },
    { value: "other_expense", label: "Other Expense" },
  ],
};

interface AccountWithChildren extends Account {
  children?: AccountWithChildren[];
}

function compareAccountCodes(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }
  return a.localeCompare(b);
}

function sortAccountTreeRecursively(accounts: AccountWithChildren[]): void {
  accounts.sort((a, b) => compareAccountCodes(a.code, b.code));
  accounts.forEach((account) => {
    if (account.children && account.children.length > 0) {
      sortAccountTreeRecursively(account.children);
    }
  });
}

function buildAccountTree(accounts: Account[]): AccountWithChildren[] {
  const accountMap = new Map<number, AccountWithChildren>();
  const rootAccounts: AccountWithChildren[] = [];

  accounts.forEach((account) => {
    accountMap.set(account.id, { ...account, children: [] });
  });

  accounts.forEach((account) => {
    const accountWithChildren = accountMap.get(account.id)!;
    if (account.parentAccountId && accountMap.has(account.parentAccountId)) {
      const parent = accountMap.get(account.parentAccountId)!;
      parent.children = parent.children || [];
      parent.children.push(accountWithChildren);
    } else {
      rootAccounts.push(accountWithChildren);
    }
  });

  sortAccountTreeRecursively(rootAccounts);

  return rootAccounts;
}

function flattenAccountTreeForDisplay(accounts: AccountWithChildren[], depth = 0): { account: AccountWithChildren; depth: number }[] {
  const result: { account: AccountWithChildren; depth: number }[] = [];
  
  accounts.forEach((account) => {
    result.push({ account, depth });
    if (account.children && account.children.length > 0) {
      result.push(...flattenAccountTreeForDisplay(account.children, depth + 1));
    }
  });
  
  return result;
}

export default function ChartOfAccounts() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);

  const { data: accounts, isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    refetchInterval: LIST_PAGE_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: "always",
  });

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      code: "",
      name: "",
      accountType: "expense",
      accountSubtype: null,
      description: "",
      parentAccountId: null,
      isActive: true,
    },
  });

  const selectedType = form.watch("accountType");

  const availableParentAccounts = accounts?.filter((account) => {
    if (!account.isActive) return false;
    if (account.accountType !== selectedType) return false;
    if (editingAccount && account.id === editingAccount.id) return false;
    if (account.parentAccountId) return false;
    return true;
  }) || [];

  const createMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      return await apiRequest("POST", "/api/accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Account created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
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
      // Parse error message (format: "400: {json}")
      let errorData: any = null;
      const errorMessage = error?.message || String(error);
      const jsonMatch = errorMessage.match(/^\d+:\s*(.*)$/s);
      if (jsonMatch) {
        try {
          errorData = JSON.parse(jsonMatch[1]);
        } catch (e) {
          // Not JSON, ignore
        }
      }
      // Handle duplicate code error
      if (errorData?.error === "DUPLICATE_CODE" || errorData?.message === "Duplicate account code") {
        toast({
          title: "Duplicate Account Code",
          description: errorData?.details || "This account code is already in use. Please choose a different code.",
          variant: "destructive",
        });
        form.setError("code", { 
          type: "manual", 
          message: "This code is already in use" 
        });
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: AccountFormData }) => {
      return await apiRequest("PATCH", `/api/accounts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Account updated successfully" });
      setIsDialogOpen(false);
      setEditingAccount(null);
      form.reset();
    },
    onError: (error: any) => {
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
      // Parse error message (format: "400: {json}")
      let errorData: any = null;
      const errorMessage = error?.message || String(error);
      const jsonMatch = errorMessage.match(/^\d+:\s*(.*)$/s);
      if (jsonMatch) {
        try {
          errorData = JSON.parse(jsonMatch[1]);
        } catch (e) {
          // Not JSON, ignore
        }
      }
      // Handle duplicate code error
      if (errorData?.error === "DUPLICATE_CODE" || errorData?.message === "Duplicate account code") {
        toast({
          title: "Duplicate Account Code",
          description: errorData?.details || "This account code is already in use. Please choose a different code.",
          variant: "destructive",
        });
        form.setError("code", { 
          type: "manual", 
          message: "This code is already in use" 
        });
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update account",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: "Account deleted successfully" });
      setDeletingAccount(null);
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
        description: "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      form.reset({
        code: account.code,
        name: account.name,
        accountType: account.accountType as "asset" | "liability" | "equity" | "revenue" | "expense",
        accountSubtype: account.accountSubtype || null,
        description: account.description || "",
        parentAccountId: account.parentAccountId || null,
        isActive: account.isActive ?? true,
      });
    } else {
      setEditingAccount(null);
      const defaultType = "expense";
      const nextCode = generateNextAccountCode(defaultType);
      form.reset({
        code: nextCode,
        name: "",
        accountType: defaultType,
        accountSubtype: null,
        description: "",
        parentAccountId: null,
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleAddSubAccount = (parentAccount: Account) => {
    setEditingAccount(null);
    const nextCode = generateNextSubAccountCode(parentAccount.id);
    form.reset({
      code: nextCode,
      name: "",
      accountType: parentAccount.accountType as "asset" | "liability" | "equity" | "revenue" | "expense",
      accountSubtype: parentAccount.accountSubtype || null,
      description: "",
      parentAccountId: parentAccount.id,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: AccountFormData) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredAccounts = accounts?.filter(Boolean).filter((account) =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedAccountsByType = (typeValue: string) => {
    const typeAccounts = filteredAccounts?.filter((a) => a.accountType === typeValue) || [];
    const tree = buildAccountTree(typeAccounts);
    return flattenAccountTreeForDisplay(tree);
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "asset": return "default";
      case "liability": return "secondary";
      case "equity": return "outline";
      case "revenue": return "default";
      case "expense": return "destructive";
      default: return "secondary";
    }
  };

  const hasChildAccounts = (accountId: number) => {
    return accounts?.some((a) => a.parentAccountId === accountId) || false;
  };

  const generateNextSubAccountCode = (parentAccountId: number): string => {
    const parentAccount = accounts?.find((a) => a.id === parentAccountId);
    if (!parentAccount) return "";
    
    const parentCode = parentAccount.code;
    const childAccounts = accounts?.filter((a) => a.parentAccountId === parentAccountId) || [];
    
    if (childAccounts.length === 0) {
      return `${parentCode}-1`;
    }
    
    const childNumbers = childAccounts
      .map((child) => {
        const match = child.code.match(new RegExp(`^${parentCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num) => num > 0);
    
    const maxNumber = childNumbers.length > 0 ? Math.max(...childNumbers) : 0;
    return `${parentCode}-${maxNumber + 1}`;
  };

  const getAccountTypeStartCode = (accountType: string): number => {
    switch (accountType) {
      case "asset": return 1000;
      case "liability": return 2000;
      case "equity": return 3000;
      case "revenue": return 4000;
      case "expense": return 5000;
      default: return 1000;
    }
  };

  const generateNextAccountCode = (accountType: string): string => {
    const startCode = getAccountTypeStartCode(accountType);
    const endCode = startCode + 999;
    
    const topLevelAccountsOfType = accounts?.filter((a) => 
      a.accountType === accountType && 
      !a.parentAccountId &&
      !a.code.includes("-")
    ) || [];
    
    if (topLevelAccountsOfType.length === 0) {
      return startCode.toString();
    }
    
    const usedCodes = topLevelAccountsOfType
      .map((a) => parseInt(a.code, 10))
      .filter((code) => !isNaN(code) && code >= startCode && code <= endCode)
      .sort((a, b) => a - b);
    
    if (usedCodes.length === 0) {
      return startCode.toString();
    }
    
    for (let code = startCode; code <= endCode; code++) {
      if (!usedCodes.includes(code)) {
        return code.toString();
      }
    }
    
    toast({
      title: "Account Range Full",
      description: `All account codes for ${accountType} accounts (${startCode}-${endCode}) are in use. Please enter a code manually.`,
      variant: "destructive",
    });
    return "";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Chart of Accounts</h1>
            <p className="text-muted-foreground mt-1">Manage your accounting categories</p>
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
          <h1 className="text-3xl font-semibold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage your accounting categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Edit Account" : "Add New Account"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 1000"
                            {...field}
                            data-testid="input-account-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("parentAccountId", null);
                            if (!editingAccount) {
                              const nextCode = generateNextAccountCode(value);
                              form.setValue("code", nextCode);
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-account-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accountTypes.map((type) => (
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
                </div>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter account name"
                          {...field}
                          data-testid="input-account-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parentAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Account</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          const parentId = value === "none" ? null : parseInt(value);
                          field.onChange(parentId);
                          if (parentId && !editingAccount) {
                            const nextCode = generateNextSubAccountCode(parentId);
                            form.setValue("code", nextCode);
                          } else if (!parentId && !editingAccount) {
                            const currentType = form.getValues("accountType");
                            const nextCode = generateNextAccountCode(currentType);
                            form.setValue("code", nextCode);
                          }
                        }} 
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-parent-account">
                            <SelectValue placeholder="Select parent account (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None (Top-level account)</SelectItem>
                          {availableParentAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id.toString()}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Create a sub-account by selecting a parent (e.g., "Payroll - Wages" under "Payroll")
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedType && subtypesByType[selectedType] && (
                  <FormField
                    control={form.control}
                    name="accountSubtype"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subtype</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-account-subtype">
                              <SelectValue placeholder="Select subtype (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subtypesByType[selectedType].map((subtype) => (
                              <SelectItem key={subtype.value} value={subtype.value}>
                                {subtype.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter description (optional)"
                          {...field}
                          data-testid="input-account-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Inactive accounts won't appear in dropdowns
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-account-active"
                        />
                      </FormControl>
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
                    data-testid="button-save-account"
                  >
                    {editingAccount ? "Update" : "Create"}
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
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-accounts"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredAccounts || filteredAccounts.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No accounts yet"
              description="Create your first account to start tracking finances"
            />
          ) : (
            <div className="space-y-6">
              {accountTypes.map((typeInfo) => {
                const flattenedAccounts = groupedAccountsByType(typeInfo.value);
                if (flattenedAccounts.length === 0) return null;
                return (
                  <div key={typeInfo.value}>
                    <h3 className="text-lg font-medium mb-3 capitalize">{typeInfo.label}</h3>
                    <div className="border rounded-lg divide-y">
                      {flattenedAccounts.map(({ account, depth }) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-4 hover-elevate"
                          data-testid={`account-row-${account.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="font-mono text-sm text-muted-foreground w-16">
                              {account.code}
                            </span>
                            <div className="flex items-center gap-2">
                              {depth > 0 && (
                                <div 
                                  className="flex items-center text-muted-foreground"
                                  style={{ paddingLeft: `${(depth - 1) * 16}px` }}
                                >
                                  <CornerDownRight className="h-4 w-4 mr-1" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`font-medium ${depth > 0 ? 'text-sm' : ''}`}>
                                    {account.name}
                                  </p>
                                  {depth === 0 && hasChildAccounts(account.id) && (
                                    <Badge variant="outline" className="text-xs">
                                      Parent
                                    </Badge>
                                  )}
                                  {depth > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      Sub-account
                                    </Badge>
                                  )}
                                </div>
                                {account.description && (
                                  <p className="text-sm text-muted-foreground">{account.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {!account.isActive && (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid={`button-account-menu-${account.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleOpenDialog(account)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {depth === 0 && !account.parentAccountId && (
                                  <DropdownMenuItem 
                                    onSelect={() => handleAddSubAccount(account)}
                                    data-testid={`button-add-subaccount-${account.id}`}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Sub-account
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onSelect={() => setDeletingAccount(account)}
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingAccount} onOpenChange={() => setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAccount?.name}"? 
              {deletingAccount && hasChildAccounts(deletingAccount.id) && (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This account has sub-accounts. They will become top-level accounts.
                </span>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteMutation.mutate(deletingAccount.id)}
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
