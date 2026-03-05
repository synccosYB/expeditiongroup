import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  FolderKanban,
  Users,
  FileText,
  Clock,
  Calendar,
  MoreHorizontal,
  Send,
  CheckCircle,
  XCircle,
  ExternalLink,
  Settings,
  Eye,
  EyeOff,
  Upload,
  UserPlus,
  Key,
  Copy,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Project, Associate, Note, Invoice, InvoiceItem, ClientPortalSettings } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { parseLocalDateFromISO } from "@/lib/dateUtils";

interface ProjectWithClient extends Project {
  client: Client;
}

interface NoteWithUser extends Note {
  user?: { firstName?: string; lastName?: string; email?: string };
}

interface InvoiceWithRelations extends Invoice {
  project?: Project;
  items?: InvoiceItem[];
}

const invoiceStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0");

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch client");
      return response.json();
    },
    enabled: !!clientId,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectWithClient[]>({
    queryKey: ["/api/clients", clientId, "projects"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/projects`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch client projects");
      return response.json();
    },
    enabled: !!clientId,
  });

  const { data: allAssociates } = useQuery<Associate[]>({
    queryKey: ["/api/associates"],
  });

  const { data: invoices } = useQuery<InvoiceWithRelations[]>({
    queryKey: ["/api/clients", clientId, "invoices"],
    enabled: !!clientId,
  });

  const { data: portalSettings, isLoading: portalSettingsLoading } = useQuery<ClientPortalSettings>({
    queryKey: ["/api/clients", clientId, "portal-settings"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/portal-settings`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch portal settings");
      return response.json();
    },
    enabled: !!clientId,
  });

  interface PortalUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    createdAt: string;
  }

  const { data: portalUser, isLoading: portalUserLoading } = useQuery<PortalUser | null>({
    queryKey: ["/api/clients", clientId, "portal-user"],
    queryFn: async () => {
      const response = await fetch(`/api/clients/${clientId}/portal-user`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch portal user");
      return response.json();
    },
    enabled: !!clientId,
  });

  const [portalAccessDialogOpen, setPortalAccessDialogOpen] = useState(false);
  const [portalEmail, setPortalEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [showCredentials, setShowCredentials] = useState<{ email: string; password: string } | null>(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const { toast } = useToast();

  const updatePortalSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<ClientPortalSettings>) => {
      return await apiRequest("PUT", `/api/clients/${clientId}/portal-settings`, updates);
    },
    onSuccess: () => {
      toast({ title: "Portal settings updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "portal-settings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update settings", description: error.message, variant: "destructive" });
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/invoices/${id}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Invoice status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "invoices"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update invoice", description: error.message, variant: "destructive" });
    },
  });

  const updateInvoiceVisibilityMutation = useMutation({
    mutationFn: async ({ id, isVisibleToClient }: { id: number; isVisibleToClient: boolean }) => {
      return await apiRequest("PATCH", `/api/invoices/${id}`, { isVisibleToClient });
    },
    onSuccess: () => {
      toast({ title: "Invoice visibility updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "invoices"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update invoice visibility", description: error.message, variant: "destructive" });
    },
  });

  const createPortalAccessMutation = useMutation({
    mutationFn: async (data: { email: string; password?: string }) => {
      const response = await apiRequest("POST", `/api/clients/${clientId}/portal-access`, data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: data.isNew ? "Portal account created" : "User linked to client" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "portal-user"] });
      if (data.isNew && portalPassword) {
        setShowCredentials({ email: portalEmail, password: portalPassword });
      } else {
        setPortalAccessDialogOpen(false);
      }
      setPortalEmail("");
      setPortalPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create portal access", description: error.message, variant: "destructive" });
    },
  });

  const handleCreatePortalAccess = () => {
    createPortalAccessMutation.mutate({ email: portalEmail, password: portalPassword || undefined });
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      return await apiRequest("PATCH", `/api/clients/${clientId}/portal-password`, { password });
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setResetPasswordDialogOpen(false);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reset password", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const isLoading = clientLoading || projectsLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Client not found</p>
        <Button asChild>
          <Link href="/clients">Back to Clients</Link>
        </Button>
      </div>
    );
  }

  const activeProjects = projects?.filter(p => !["completed", "cancelled"].includes(p.status)) || [];
  const completedProjects = projects?.filter(p => p.status === "completed") || [];

  const clientTypeBadge = client.clientType ? (
    <Badge variant="outline" className="capitalize">
      {client.clientType.replace("_", " ")}
    </Badge>
  ) : null;

  const statusBadge = client.status === "active" ? (
    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients" data-testid="button-back-to-clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-name">
              {client.name}
            </h1>
            {clientTypeBadge}
            {statusBadge}
          </div>
          {client.company && (
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {client.company}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${client.email}`} className="text-sm hover:underline" data-testid="link-client-email">
                  {client.email}
                </a>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${client.phone}`} className="text-sm hover:underline" data-testid="text-client-phone">
                  {client.phone}
                </a>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm" data-testid="text-client-address">{client.address}</span>
              </div>
            )}
            {client.county && (
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.county} County</span>
              </div>
            )}
            {client.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{client.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="jobs" className="w-full">
            <TabsList className="grid w-full grid-cols-5" data-testid="tabs-client-sections">
              <TabsTrigger value="jobs" data-testid="tab-jobs">
                <FolderKanban className="h-4 w-4 mr-2" />
                Jobs ({projects?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="invoices" data-testid="tab-invoices">
                <FileText className="h-4 w-4 mr-2" />
                Invoices ({invoices?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="associates" data-testid="tab-associates">
                <Users className="h-4 w-4 mr-2" />
                Associates
              </TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">
                <Clock className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="portal" data-testid="tab-portal-settings">
                <Settings className="h-4 w-4 mr-2" />
                Portal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="mt-4 space-y-4">
              {activeProjects.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Active Jobs</h3>
                  <div className="space-y-3">
                    {activeProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        data-testid={`link-project-${project.id}`}
                      >
                        <Card className="hover-elevate cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{project.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {project.address || "No address"}
                                </p>
                                {project.municipality && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {project.municipality}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <StatusBadge status={project.status} type="project" />
                                {project.priority && project.priority !== "normal" && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {project.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {completedProjects.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Completed Jobs</h3>
                  <div className="space-y-3">
                    {completedProjects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        data-testid={`link-completed-project-${project.id}`}
                      >
                        <Card className="hover-elevate cursor-pointer opacity-75">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{project.name}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {project.address || "No address"}
                                </p>
                              </div>
                              <StatusBadge status={project.status} type="project" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {(!projects || projects.length === 0) && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No jobs for this client yet</p>
                    <Button size="sm" className="mt-4" asChild>
                      <Link href="/projects">Create Job</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="invoices" className="mt-4 space-y-4">
              {invoices && invoices.filter(Boolean).length > 0 ? (
                <div className="space-y-3">
                  {invoices.filter(Boolean).map((invoice) => {
                    const statusInfo = invoiceStatusConfig[invoice.status] || { label: invoice.status, variant: "outline" as const };
                    return (
                      <Card key={invoice.id} className="hover-elevate" data-testid={`card-invoice-${invoice.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium font-mono">{invoice.invoiceNumber}</p>
                                <Badge variant={statusInfo.variant} className="text-xs">
                                  {statusInfo.label}
                                </Badge>
                                {!invoice.isVisibleToClient && (
                                  <Badge variant="secondary" className="text-xs">
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Hidden
                                  </Badge>
                                )}
                              </div>
                              {invoice.project && (
                                <Link href={`/projects/${invoice.project.id}`} className="text-sm text-muted-foreground hover:underline">
                                  {invoice.project.name}
                                </Link>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>
                                  {invoice.createdAt && format(parseLocalDateFromISO(invoice.createdAt)!, "MMM d, yyyy")}
                                </span>
                                {invoice.dueDate && (
                                  <span>
                                    Due: {format(parseLocalDateFromISO(invoice.dueDate)!, "MMM d, yyyy")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <p className="font-semibold text-lg">
                                ${parseFloat(invoice?.total || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </p>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-invoice-actions-${invoice.id}`}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/invoices/${invoice.id}`}>
                                      <ExternalLink className="h-4 w-4 mr-2" />
                                      View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => updateInvoiceVisibilityMutation.mutate({ 
                                      id: invoice.id, 
                                      isVisibleToClient: !invoice.isVisibleToClient 
                                    })}
                                    data-testid={`button-toggle-visibility-invoice-${invoice.id}`}
                                  >
                                    {invoice.isVisibleToClient ? (
                                      <>
                                        <EyeOff className="h-4 w-4 mr-2" />
                                        Hide from Client
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Show to Client
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  {invoice.status === "draft" && (
                                    <DropdownMenuItem
                                      onSelect={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "sent" })}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      Mark as Sent
                                    </DropdownMenuItem>
                                  )}
                                  {invoice.status === "sent" && (
                                    <DropdownMenuItem
                                      onSelect={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "paid" })}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark as Paid
                                    </DropdownMenuItem>
                                  )}
                                  {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                                    <DropdownMenuItem
                                      onSelect={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "cancelled" })}
                                      className="text-destructive"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel Invoice
                                    </DropdownMenuItem>
                                  )}
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
                  <CardContent className="p-8 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No invoices for this client yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generate invoices from Time Logs on any project
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="associates" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground text-center">
                    Associates linked to this client&apos;s jobs will appear here.
                  </p>
                  {allAssociates && allAssociates.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {allAssociates.slice(0, 5).map((associate) => (
                        <div
                          key={associate.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                          data-testid={`associate-item-${associate.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{associate.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {associate.type.replace("_", " ")}
                              {associate.company && ` - ${associate.company}`}
                            </p>
                          </div>
                          {associate.phone && (
                            <span className="text-xs text-muted-foreground">{associate.phone}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Client created</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {client.createdAt
                          ? formatDistanceToNow(new Date(client.createdAt), { addSuffix: true })
                          : "Unknown"}
                      </span>
                    </div>
                    {projects && projects.length > 0 && (
                      <div className="border-t pt-4 space-y-3">
                        <p className="text-xs text-muted-foreground">Recent job activity</p>
                        {projects.slice(0, 5).map((project) => (
                          <div
                            key={project.id}
                            className="flex items-center gap-3 text-sm"
                          >
                            <FolderKanban className="h-4 w-4 text-muted-foreground" />
                            <Link 
                              href={`/projects/${project.id}`}
                              className="hover:underline truncate flex-1"
                            >
                              {project.name}
                            </Link>
                            <StatusBadge status={project.status} type="project" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="portal" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Portal Access
                  </CardTitle>
                  <CardDescription>
                    Manage this client's login credentials to access their portal.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {portalUserLoading ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : portalUser ? (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Portal Access Active</p>
                          <p className="text-xs text-muted-foreground">{portalUser.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setResetPasswordDialogOpen(true)}
                          data-testid="button-reset-password"
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Reset Password
                        </Button>
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                          Connected
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Key className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">No Portal Access</p>
                          <p className="text-xs text-muted-foreground">This client cannot access the portal yet</p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => {
                          setPortalEmail(client.email || "");
                          setPortalAccessDialogOpen(true);
                        }}
                        data-testid="button-create-portal-access"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create Access
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Client Portal Visibility
                  </CardTitle>
                  <CardDescription>
                    Control what this client can see when they log into their portal. All sections are hidden by default.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {portalSettingsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading settings...</div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Content Sections</h4>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-show-projects">
                          <div className="flex items-center gap-3">
                            <FolderKanban className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Projects</Label>
                              <p className="text-xs text-muted-foreground">Allow client to view their projects</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.showProjects || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ showProjects: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-show-projects"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-show-documents">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Documents</Label>
                              <p className="text-xs text-muted-foreground">Allow client to view shared documents</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.showDocuments || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ showDocuments: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-show-documents"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-show-invoices">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Invoices</Label>
                              <p className="text-xs text-muted-foreground">Allow client to view their invoices</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.showInvoices || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ showInvoices: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-show-invoices"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-show-messages">
                          <div className="flex items-center gap-3">
                            <Send className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Messages</Label>
                              <p className="text-xs text-muted-foreground">Allow client to send and receive messages</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.showMessages || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ showMessages: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-show-messages"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-show-milestones">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Milestones</Label>
                              <p className="text-xs text-muted-foreground">Allow client to view project milestones</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.showMilestones || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ showMilestones: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-show-milestones"
                          />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-show-timeline">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Timeline</Label>
                              <p className="text-xs text-muted-foreground">Allow client to view activity timeline</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.showTimeline || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ showTimeline: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-show-timeline"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="text-sm font-medium">Permissions</h4>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30" data-testid="toggle-allow-upload">
                          <div className="flex items-center gap-3">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <Label className="font-medium">Document Upload</Label>
                              <p className="text-xs text-muted-foreground">Allow client to upload documents for review</p>
                            </div>
                          </div>
                          <Switch
                            checked={portalSettings?.allowDocumentUpload || false}
                            onCheckedChange={(checked) => 
                              updatePortalSettingsMutation.mutate({ allowDocumentUpload: checked })
                            }
                            disabled={updatePortalSettingsMutation.isPending}
                            data-testid="switch-allow-upload"
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-start gap-3">
                          <EyeOff className="h-5 w-5 text-amber-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Visibility Notice</p>
                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                              Even when sections are enabled above, individual projects, documents, and invoices must also be marked as visible for the client to see them.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={portalAccessDialogOpen} onOpenChange={(open) => {
        setPortalAccessDialogOpen(open);
        if (!open) {
          setShowCredentials(null);
          setPortalEmail("");
          setPortalPassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Portal Access</DialogTitle>
            <DialogDescription>
              {showCredentials 
                ? "Portal account created! Share these credentials with your client."
                : "Enter the client's email and create a password for portal access."}
            </DialogDescription>
          </DialogHeader>

          {showCredentials ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">Account Created Successfully</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-background rounded text-sm">{showCredentials.email}</code>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => copyToClipboard(showCredentials.email)}
                        data-testid="button-copy-email"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2 bg-background rounded text-sm">{showCredentials.password}</code>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => copyToClipboard(showCredentials.password)}
                        data-testid="button-copy-password"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  setPortalAccessDialogOpen(false);
                  setShowCredentials(null);
                }} data-testid="button-close-credentials">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portal-email">Email Address</Label>
                <Input
                  id="portal-email"
                  type="email"
                  placeholder="client@example.com"
                  value={portalEmail}
                  onChange={(e) => setPortalEmail(e.target.value)}
                  data-testid="input-portal-email"
                />
                <p className="text-xs text-muted-foreground">
                  If this email already has an account, it will be linked to this client.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-password">Password</Label>
                <Input
                  id="portal-password"
                  type="password"
                  placeholder="Create a password (min 8 characters)"
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  data-testid="input-portal-password"
                />
                <p className="text-xs text-muted-foreground">
                  Required for new accounts. Leave empty if linking an existing user.
                </p>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setPortalAccessDialogOpen(false)}
                  data-testid="button-cancel-portal-access"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreatePortalAccess}
                  disabled={!portalEmail || createPortalAccessMutation.isPending}
                  data-testid="button-submit-portal-access"
                >
                  {createPortalAccessMutation.isPending ? "Creating..." : "Create Access"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetPasswordDialogOpen} onOpenChange={(open) => {
        setResetPasswordDialogOpen(open);
        if (!open) setNewPassword("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Portal Password</DialogTitle>
            <DialogDescription>
              Enter a new password for the client's portal access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="input-new-password"
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setResetPasswordDialogOpen(false)}
                data-testid="button-cancel-reset-password"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => resetPasswordMutation.mutate(newPassword)}
                disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
                data-testid="button-submit-reset-password"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
