import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client, Project, Associate, Note, Invoice, InvoiceItem } from "@shared/schema";
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

  const { toast } = useToast();

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
            <TabsList className="grid w-full grid-cols-4" data-testid="tabs-client-sections">
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
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice) => {
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
                                ${parseFloat(invoice.total || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
                                  {invoice.status === "draft" && (
                                    <DropdownMenuItem
                                      onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "sent" })}
                                    >
                                      <Send className="h-4 w-4 mr-2" />
                                      Mark as Sent
                                    </DropdownMenuItem>
                                  )}
                                  {invoice.status === "sent" && (
                                    <DropdownMenuItem
                                      onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "paid" })}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark as Paid
                                    </DropdownMenuItem>
                                  )}
                                  {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                                    <DropdownMenuItem
                                      onClick={() => updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "cancelled" })}
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
