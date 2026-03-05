import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Search,
  FolderKanban,
  MapPin,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { parseLocalDate, formatDateForInput, parseLocalDateFromISO, formatLocalDate } from "@/lib/dateUtils";
import type { Project, Client } from "@shared/schema";
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
const projectFormSchema = z.object({
  clientId: z.number().min(1, "Client is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  county: z.string().optional(),
  jurisdiction: z.string().optional(),
  jurisdictionAddress: z.string().optional(),
  status: z.enum(["intake", "in_progress", "waiting_on_client", "with_dob", "completed", "on_hold", "cancelled"]).default("intake"),
  startDate: z.string().optional(),
  targetEndDate: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

type RelatedDataCounts = {
  documents: number;
  notes: number;
  tasks: number;
  timeLogs: number;
  timeEntries: number;
};

const counties = ["Orange", "Rockland", "Sullivan"];
const statusOptions = [
  { value: "intake", label: "Intake" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_client", label: "Waiting on Client" },
  { value: "with_dob", label: "With DOB" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
];

const statusOptionsWithArchived = [
  ...statusOptions,
  { value: "archived", label: "Archived" },
];

export default function Projects() {
  const { toast } = useToast();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<(Project & { client: Client }) | null>(null);
  const [deletingProject, setDeletingProject] = useState<(Project & { client: Client }) | null>(null);
  const [relatedDataCounts, setRelatedDataCounts] = useState<RelatedDataCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Read status filter from URL query params on mount
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const urlStatus = params.get("status");
    const validStatuses = ["intake", "in_progress", "waiting_on_client", "with_dob", "completed", "on_hold", "cancelled", "archived"];
    if (urlStatus && validStatuses.includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
  }, [searchString]);

  const [countsError, setCountsError] = useState<string | null>(null);

  const fetchRelatedDataCounts = async (projectId: number) => {
    setIsLoadingCounts(true);
    setCountsError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/related-data-counts`, {
        credentials: 'include'
      });
      if (response.ok) {
        const counts = await response.json();
        setRelatedDataCounts(counts);
      } else if (response.status === 401) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
      } else {
        setCountsError("Failed to load project data. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching related data counts:", error);
      setCountsError("Failed to load project data. Please try again.");
    } finally {
      setIsLoadingCounts(false);
    }
  };

  const handleDeleteClick = async (project: Project & { client: Client }) => {
    setDeletingProject(project);
    setRelatedDataCounts(null);
    setCountsError(null);
    await fetchRelatedDataCounts(project.id);
  };

  const handleCloseDeleteDialog = () => {
    setDeletingProject(null);
    setRelatedDataCounts(null);
    setCountsError(null);
  };

  const { data: projects, isLoading } = useQuery<(Project & { client: Client })[]>({
    queryKey: ["/api/projects"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      clientId: 0,
      name: "",
      description: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      county: "",
      jurisdiction: "",
      jurisdictionAddress: "",
      status: "intake",
      startDate: "",
      targetEndDate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const payload = {
        ...data,
        startDate: data.startDate ? parseLocalDate(data.startDate) : null,
        targetEndDate: data.targetEndDate ? parseLocalDate(data.targetEndDate) : null,
      };
      return await apiRequest("POST", "/api/projects", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Project created successfully" });
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
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProjectFormData }) => {
      const payload = {
        ...data,
        startDate: data.startDate ? parseLocalDate(data.startDate) : null,
        targetEndDate: data.targetEndDate ? parseLocalDate(data.targetEndDate) : null,
      };
      return await apiRequest("PATCH", `/api/projects/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated successfully" });
      setIsDialogOpen(false);
      setEditingProject(null);
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
        description: "Failed to update project",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Project deleted successfully" });
      setDeletingProject(null);
      setRelatedDataCounts(null);
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
        description: "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/projects/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Project archived successfully" });
      setDeletingProject(null);
      setRelatedDataCounts(null);
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
        description: error?.message || "Failed to archive project",
        variant: "destructive",
      });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Project permanently deleted" });
      setDeletingProject(null);
      setRelatedDataCounts(null);
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
        description: "Failed to permanently delete project",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (project?: Project & { client: Client }) => {
    if (project) {
      setEditingProject(project);
      form.reset({
        clientId: project.clientId,
        name: project.name,
        description: project.description || "",
        address: project.address || "",
        city: (project as any).city || "",
        state: (project as any).state || "",
        zip: (project as any).zip || "",
        county: project.county || "",
        jurisdiction: (project as any).jurisdiction || "",
        jurisdictionAddress: (project as any).jurisdictionAddress || "",
        status: project.status === "archived" ? "on_hold" : project.status,
        startDate: formatDateForInput(project.startDate),
        targetEndDate: formatDateForInput(project.targetEndDate),
      });
    } else {
      setEditingProject(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ProjectFormData) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredProjects = projects?.filter(Boolean).filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.county?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your construction projects</p>
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
          <h1 className="text-3xl font-semibold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your construction projects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} data-testid="button-add-project">
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProject ? "Edit Project" : "Add New Project"}
              </DialogTitle>
              <DialogDescription className="sr-only">{editingProject ? "Edit project details" : "Create a new project"}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-project-client">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients?.map((client) => (
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter project name"
                          {...field}
                          data-testid="input-project-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Project description"
                          className="resize-none"
                          {...field}
                          data-testid="textarea-project-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Project location"
                            {...field}
                            data-testid="input-project-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <SelectTrigger data-testid="select-project-county">
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
                </div>
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
                            data-testid="input-project-city"
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
                            placeholder="State"
                            {...field}
                            data-testid="input-project-state"
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
                        <FormLabel>Zip</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Zip code"
                            {...field}
                            data-testid="input-project-zip"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jurisdiction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jurisdiction</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Town or village name"
                            {...field}
                            data-testid="input-project-jurisdiction"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="jurisdictionAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jurisdiction Office Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Address of DOB office"
                            {...field}
                            data-testid="input-project-jurisdiction-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-project-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-project-start-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target End Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-project-end-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-project"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-project"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Saving..."
                      : editingProject
                      ? "Update Project"
                      : "Create Project"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptionsWithArchived.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredProjects && filteredProjects.length > 0 ? (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover-elevate" data-testid={`card-project-${project.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link href={`/projects/${project.id}`}>
                      <CardTitle className="text-lg font-semibold hover:text-primary transition-colors cursor-pointer">
                        {project.name}
                      </CardTitle>
                    </Link>
                    <StatusBadge status={project.status} type="project" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {project.client?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-project-menu-${project.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => handleOpenDialog(project)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {project.status === "archived" ? (
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => handleDeleteClick(project)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Permanently Delete
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => handleDeleteClick(project)}
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive / Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="icon" variant="ghost" asChild>
                    <Link href={`/projects/${project.id}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {project.county && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{project.county} County</span>
                    </div>
                  )}
                  {project.startDate && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Started {formatLocalDate(project.startDate)}</span>
                    </div>
                  )}
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {project.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to start tracking permits"
              actionLabel="Add Project"
              onAction={() => handleOpenDialog()}
            />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingProject} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingProject?.status === "archived" ? "Permanently Delete Project" : "Archive or Delete Project"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {isLoadingCounts ? (
                  <p>Checking project data...</p>
                ) : countsError ? (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">{countsError}</p>
                  </div>
                ) : deletingProject?.status === "archived" ? (
                  <div>
                    <p>Are you sure you want to permanently delete "{deletingProject?.name}"?</p>
                    <p className="mt-2 text-destructive font-medium">This action cannot be undone.</p>
                  </div>
                ) : relatedDataCounts && (relatedDataCounts.documents > 0 || relatedDataCounts.notes > 0 || relatedDataCounts.tasks > 0 || relatedDataCounts.timeLogs > 0 || relatedDataCounts.timeEntries > 0) ? (
                  <div>
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Cannot archive this project yet</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          This project has attached data that must be deleted first:
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm">
                      {relatedDataCounts.tasks > 0 && (
                        <li>• {relatedDataCounts.tasks} task{relatedDataCounts.tasks > 1 ? 's' : ''}</li>
                      )}
                      {relatedDataCounts.documents > 0 && (
                        <li>• {relatedDataCounts.documents} document{relatedDataCounts.documents > 1 ? 's' : ''}</li>
                      )}
                      {relatedDataCounts.notes > 0 && (
                        <li>• {relatedDataCounts.notes} note{relatedDataCounts.notes > 1 ? 's' : ''}</li>
                      )}
                      {(relatedDataCounts.timeLogs > 0 || relatedDataCounts.timeEntries > 0) && (
                        <li>• {relatedDataCounts.timeLogs + relatedDataCounts.timeEntries} time log{(relatedDataCounts.timeLogs + relatedDataCounts.timeEntries) > 1 ? 's' : ''}</li>
                      )}
                    </ul>
                    <p className="mt-3 text-sm">
                      Please delete all documents, notes, tasks, and time logs from the project before archiving.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p>Project "{deletingProject?.name}" has no attached data and is ready to be archived.</p>
                    <p className="mt-2 text-muted-foreground text-sm">
                      Once archived, the project can be permanently deleted.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            {!isLoadingCounts && !countsError && deletingProject?.status === "archived" && (
              <AlertDialogAction
                onClick={() => deletingProject && permanentDeleteMutation.mutate(deletingProject.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-permanent-delete"
              >
                {permanentDeleteMutation.isPending ? "Deleting..." : "Permanently Delete"}
              </AlertDialogAction>
            )}
            {!isLoadingCounts && !countsError && deletingProject?.status !== "archived" && relatedDataCounts && !(relatedDataCounts.documents > 0 || relatedDataCounts.notes > 0 || relatedDataCounts.tasks > 0 || relatedDataCounts.timeLogs > 0 || relatedDataCounts.timeEntries > 0) && (
              <AlertDialogAction
                onClick={() => deletingProject && archiveMutation.mutate(deletingProject.id)}
                data-testid="button-confirm-archive"
              >
                {archiveMutation.isPending ? "Archiving..." : "Archive Project"}
              </AlertDialogAction>
            )}
            {!isLoadingCounts && !countsError && deletingProject?.status !== "archived" && relatedDataCounts && (relatedDataCounts.documents > 0 || relatedDataCounts.notes > 0 || relatedDataCounts.tasks > 0 || relatedDataCounts.timeLogs > 0 || relatedDataCounts.timeEntries > 0) && (
              <Button
                variant="outline"
                onClick={() => setLocation(`/projects/${deletingProject?.id}`)}
                data-testid="button-go-to-project"
              >
                Go to Project
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
