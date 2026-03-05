import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Users, Mail, Phone, MapPin, MoreHorizontal, Pencil, Trash2, ExternalLink, Archive, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Client } from "@shared/schema";
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

const clientFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  county: z.string().optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  notes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

const counties = ["Orange", "Rockland", "Sullivan"];

type ClientRelatedCounts = {
  projects: number;
  documents: number;
  notes: number;
  tasks: number;
  timeLogs: number;
  timeEntries: number;
  invoices: number;
};

export default function Clients() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [clientRelatedCounts, setClientRelatedCounts] = useState<ClientRelatedCounts | null>(null);
  const [archivingClient, setArchivingClient] = useState<Client | null>(null);
  const [permanentDeleteClient, setPermanentDeleteClient] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      county: "",
      billingAddress: "",
      billingCity: "",
      billingState: "",
      billingZip: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      return await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Client created successfully" });
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
        description: "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ClientFormData }) => {
      return await apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated successfully" });
      setIsDialogOpen(false);
      setEditingClient(null);
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
        description: "Failed to update client",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Client deleted successfully" });
      setDeletingClient(null);
      setClientRelatedCounts(null);
    },
    onError: async (error: any) => {
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
      try {
        const response = error?.response;
        if (response) {
          const data = await response.json();
          if (data.counts) {
            setClientRelatedCounts(data.counts);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse error response:", e);
      }
      toast({
        title: "Error",
        description: "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/clients/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Client archived successfully" });
      setArchivingClient(null);
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
      toast({
        title: "Error",
        description: "Failed to archive client. Make sure all related data is deleted first.",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/clients/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Client permanently deleted" });
      setPermanentDeleteClient(null);
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
      toast({
        title: "Error",
        description: "Failed to permanently delete client",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = async (client: Client) => {
    if (client.status === "archived") {
      setPermanentDeleteClient(client);
    } else {
      setDeletingClient(client);
      setClientRelatedCounts(null);
      try {
        const response = await fetch(`/api/clients/${client.id}/related-counts`);
        if (response.ok) {
          const counts = await response.json();
          setClientRelatedCounts(counts);
        }
      } catch (e) {
        console.error("Failed to fetch related counts:", e);
      }
    }
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      form.reset({
        name: client.name,
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        city: client.city || "",
        state: client.state || "",
        zip: client.zip || "",
        county: client.county || "",
        billingAddress: client.billingAddress || "",
        billingCity: client.billingCity || "",
        billingState: client.billingState || "",
        billingZip: client.billingZip || "",
        notes: client.notes || "",
      });
    } else {
      setEditingClient(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ClientFormData) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.county?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage your client relationships</p>
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
          <h1 className="text-3xl font-semibold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client relationships</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-client">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
              <DialogDescription className="sr-only">{editingClient ? "Edit client details" : "Add a new client"}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter client name"
                          {...field}
                          data-testid="input-client-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            {...field}
                            data-testid="input-client-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(555) 555-5555"
                            {...field}
                            data-testid="input-client-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Street address"
                          {...field}
                          data-testid="input-client-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="City"
                            {...field}
                            data-testid="input-client-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="NY"
                            {...field}
                            data-testid="input-client-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="12345"
                            {...field}
                            data-testid="input-client-zip"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="county"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>County</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-client-county">
                            <SelectValue placeholder="Select county" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {counties.map((county) => (
                            <SelectItem key={county} value={county}>
                              {county} County
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-medium mb-4">Billing Address</h3>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="billingAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Billing street address"
                              {...field}
                              data-testid="input-client-billing-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="billingCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="City"
                                {...field}
                                data-testid="input-client-billing-city"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billingState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="NY"
                                {...field}
                                data-testid="input-client-billing-state"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="billingZip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zip Code</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="12345"
                                {...field}
                                data-testid="input-client-billing-zip"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about this client"
                          className="resize-none"
                          {...field}
                          data-testid="textarea-client-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-client"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-client"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingClient
                      ? "Update Client"
                      : "Create Client"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-clients"
        />
      </div>

      {filteredClients && filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="hover-elevate" data-testid={`card-client-${client.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold truncate">
                      {client.name}
                    </CardTitle>
                    {client.status === "archived" && (
                      <Badge variant="secondary" className="text-xs">Archived</Badge>
                    )}
                  </div>
                  {client.county && (
                    <p className="text-sm text-muted-foreground">
                      {client.county} County
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid={`button-client-menu-${client.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/clients/${client.id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Profile
                      </Link>
                    </DropdownMenuItem>
                    {client.status !== "archived" && (
                      <DropdownMenuItem onSelect={() => handleOpenDialog(client)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {client.status !== "archived" && (
                      <DropdownMenuItem onSelect={() => setArchivingClient(client)}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => handleDeleteClick(client)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {client.status === "archived" ? "Permanently Delete" : "Delete"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to start managing projects"
              actionLabel="Add Client"
              onAction={() => handleOpenDialog()}
            />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingClient} onOpenChange={() => { setDeletingClient(null); setClientRelatedCounts(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {clientRelatedCounts && (clientRelatedCounts.projects > 0 || clientRelatedCounts.documents > 0 || clientRelatedCounts.notes > 0 || clientRelatedCounts.tasks > 0 || clientRelatedCounts.timeLogs > 0 || clientRelatedCounts.timeEntries > 0 || clientRelatedCounts.invoices > 0) ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Cannot Delete Client
                </>
              ) : (
                "Delete Client"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {clientRelatedCounts && (clientRelatedCounts.projects > 0 || clientRelatedCounts.documents > 0 || clientRelatedCounts.notes > 0 || clientRelatedCounts.tasks > 0 || clientRelatedCounts.timeLogs > 0 || clientRelatedCounts.timeEntries > 0 || clientRelatedCounts.invoices > 0) ? (
                  <>
                    <p>
                      "{deletingClient?.name}" has related data that must be deleted first:
                    </p>
                    <ul className="text-sm space-y-1 ml-4 list-disc">
                      {clientRelatedCounts.projects > 0 && <li>{clientRelatedCounts.projects} project(s)</li>}
                      {clientRelatedCounts.documents > 0 && <li>{clientRelatedCounts.documents} document(s)</li>}
                      {clientRelatedCounts.notes > 0 && <li>{clientRelatedCounts.notes} note(s)</li>}
                      {clientRelatedCounts.tasks > 0 && <li>{clientRelatedCounts.tasks} task(s)</li>}
                      {(clientRelatedCounts.timeLogs > 0 || clientRelatedCounts.timeEntries > 0) && (
                        <li>{clientRelatedCounts.timeLogs + clientRelatedCounts.timeEntries} time log(s)</li>
                      )}
                      {clientRelatedCounts.invoices > 0 && <li>{clientRelatedCounts.invoices} invoice(s)</li>}
                    </ul>
                    <p className="text-sm">
                      Please delete all projects and associated data first, then archive the client. After archiving, you can permanently delete the client.
                    </p>
                  </>
                ) : (
                  <p>
                    Are you sure you want to delete "{deletingClient?.name}"? This action cannot be undone.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {clientRelatedCounts && (clientRelatedCounts.projects > 0 || clientRelatedCounts.documents > 0 || clientRelatedCounts.notes > 0 || clientRelatedCounts.tasks > 0 || clientRelatedCounts.timeLogs > 0 || clientRelatedCounts.timeEntries > 0 || clientRelatedCounts.invoices > 0) ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {(!clientRelatedCounts || (clientRelatedCounts.projects === 0 && clientRelatedCounts.documents === 0 && clientRelatedCounts.notes === 0 && clientRelatedCounts.tasks === 0 && clientRelatedCounts.timeLogs === 0 && clientRelatedCounts.timeEntries === 0 && clientRelatedCounts.invoices === 0)) && (
              <AlertDialogAction
                onClick={() => deletingClient && deleteMutation.mutate(deletingClient.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!archivingClient} onOpenChange={() => setArchivingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{archivingClient?.name}"? Archived clients can be
              permanently deleted later. You can only archive clients that have no related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archivingClient && archiveMutation.mutate(archivingClient.id)}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!permanentDeleteClient} onOpenChange={() => setPermanentDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Client
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{permanentDeleteClient?.name}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-permanent-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteClient && permanentDeleteMutation.mutate(permanentDeleteClient.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-permanent-delete"
            >
              {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
