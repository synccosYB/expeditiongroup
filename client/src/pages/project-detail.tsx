import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Plus,
  MapPin,
  Calendar,
  ClipboardList,
  MessageSquare,
  Clock,
  Users,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  FolderOpen,
  ListChecks,
  ChevronRight,
  ChevronDown,
  File,
  Upload,
  Bell,
  Mail,
  Phone,
  MessageCircle,
  X,
  FolderInput,
} from "lucide-react";
import { StatusBadge, TaskTypeBadge, AssociateTypeBadge } from "@/components/status-badge";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { parseLocalDate, formatTimeRange12h } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { format } from "date-fns";
import type { Project, Client, Task, Note, TimeLog, TimeEntry, Associate, User, Folder, Document, ChecklistInstance, ChecklistTemplate, ProjectAssociate, TaskReminder } from "@shared/schema";
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
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ObjectUploader } from "@/components/ObjectUploader";

type TaskWithSubtasks = Task & { 
  subtasks?: TaskWithSubtasks[];
  assignee?: User;
  relatedAssociate?: Associate;
};

type ProjectWithRelations = Project & {
  client: Client;
  tasks: TaskWithSubtasks[];
  notes: (Note & { user: User })[];
  timeLogs: (TimeLog & { user: User })[];
  timeEntries: TimeEntry[];
};

type ProjectAssociateWithDetails = ProjectAssociate & {
  associate: Associate;
};

type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["phone_call", "email", "filing", "research", "site_visit", "document_prep", "other"]).default("other"),
  status: z.enum(["todo", "in_progress", "waiting", "done", "cancelled"]).default("todo"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  locationType: z.enum(["office", "road"]).default("office"),
  parentTaskId: z.number().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  relatedAssociateId: z.number().optional().nullable(),
  dueDate: z.string().optional(),
});

const noteFormSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  isVisibleToClient: z.boolean().default(false),
  entityType: z.enum(["project", "task", "associate", "client"]).default("project"),
  taskId: z.number().optional().nullable(),
  associateId: z.number().optional().nullable(),
  clientId: z.number().optional().nullable(),
});

const timeLogFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  taskDescription: z.string().min(1, "Description is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  totalHours: z.string().min(1, "Hours is required"),
  type: z.enum(["office", "road"]).default("office"),
  notes: z.string().optional(),
});

const folderFormSchema = z.object({
  name: z.string().min(1, "Folder name is required"),
  description: z.string().optional(),
});

const documentFormSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  storagePath: z.string().min(1, "Storage path is required"),
  fileSize: z.number().optional().nullable(),
  category: z.enum(["plan", "permit", "survey", "dob_letter", "correspondence", "legal", "photo", "inspection", "other"]).default("other"),
  folderId: z.number().optional().nullable(),
  isVisibleToClient: z.boolean().default(true),
  notes: z.string().optional(),
});

const checklistFormSchema = z.object({
  name: z.string().min(1, "Checklist name is required"),
  templateId: z.number().optional().nullable(),
});

const reminderFormSchema = z.object({
  channel: z.enum(["email", "sms", "whatsapp"]),
  recipientEmail: z.string().optional(),
  recipientPhone: z.string().optional(),
  scheduledAt: z.string().min(1, "Scheduled time is required"),
  message: z.string().optional(),
}).refine((data) => {
  if (data.channel === "email") {
    return data.recipientEmail && data.recipientEmail.length > 0;
  }
  return true;
}, {
  message: "Email address is required for email reminders",
  path: ["recipientEmail"],
}).refine((data) => {
  if (data.channel === "sms" || data.channel === "whatsapp") {
    return data.recipientPhone && data.recipientPhone.length > 0;
  }
  return true;
}, {
  message: "Phone number is required for SMS/WhatsApp reminders",
  path: ["recipientPhone"],
});

type TaskFormData = z.infer<typeof taskFormSchema>;
type ReminderFormData = z.infer<typeof reminderFormSchema>;
type NoteFormData = z.infer<typeof noteFormSchema>;
type TimeLogFormData = z.infer<typeof timeLogFormSchema>;
type FolderFormData = z.infer<typeof folderFormSchema>;
type DocumentFormData = z.infer<typeof documentFormSchema>;
type ChecklistFormData = z.infer<typeof checklistFormSchema>;

function ReminderDialog({ 
  taskId, 
  isOpen, 
  onClose 
}: { 
  taskId: number; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("email");
  const [expandedReminderId, setExpandedReminderId] = useState<number | null>(null);

  const { data: reminders, isLoading: remindersLoading } = useQuery<TaskReminder[]>({
    queryKey: ["/api/tasks", taskId, "reminders"],
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/reminders`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch reminders');
      return res.json();
    },
    enabled: isOpen,
  });

  const reminderForm = useForm<ReminderFormData>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      channel: "email",
      recipientEmail: "",
      recipientPhone: "",
      scheduledAt: "",
      message: "",
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async (data: ReminderFormData) => {
      const payload = {
        taskId,
        channel: data.channel,
        recipientEmail: data.channel === "email" ? data.recipientEmail : null,
        recipientPhone: data.channel !== "email" ? data.recipientPhone : null,
        scheduledAt: new Date(data.scheduledAt),
        message: data.message || null,
      };
      return await apiRequest("POST", `/api/tasks/${taskId}/reminders`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "reminders"] });
      toast({ title: "Reminder created successfully" });
      reminderForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to create reminder", variant: "destructive" });
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: number) => {
      return await apiRequest("DELETE", `/api/reminders/${reminderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "reminders"] });
      toast({ title: "Reminder deleted" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "Please log in again", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to delete reminder", variant: "destructive" });
    },
  });

  const onSubmit = (data: ReminderFormData) => {
    createReminderMutation.mutate(data);
  };

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <Phone className="h-4 w-4" />;
      case "whatsapp": return <MessageCircle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "secondary";
      case "sent": return "default";
      case "failed": return "destructive";
      case "cancelled": return "outline";
      default: return "secondary";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Task Reminders
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {reminders && reminders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Existing Reminders</h4>
              {reminders.map((reminder) => (
                <div 
                  key={reminder.id} 
                  className="rounded-lg border bg-muted/50 overflow-hidden"
                  data-testid={`reminder-item-${reminder.id}`}
                >
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover-elevate"
                    onClick={() => setExpandedReminderId(expandedReminderId === reminder.id ? null : reminder.id)}
                    data-testid={`button-expand-reminder-${reminder.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {expandedReminderId === reminder.id ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getChannelIcon(reminder.channel)}
                      <div>
                        <p className="text-sm">
                          {reminder.channel === "email" ? reminder.recipientEmail : reminder.recipientPhone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(reminder.scheduledAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusColor(reminder.status) as any} size="sm">
                        {reminder.status}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteReminderMutation.mutate(reminder.id);
                            }}
                            disabled={deleteReminderMutation.isPending}
                            data-testid={`button-delete-reminder-${reminder.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete reminder</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  {expandedReminderId === reminder.id && (
                    <div className="px-3 pb-3 pt-0 border-t bg-background/50 space-y-2">
                      <div className="grid grid-cols-2 gap-2 pt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Channel</p>
                          <p className="text-sm capitalize">{reminder.channel}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="text-sm capitalize">{reminder.status}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Recipient</p>
                          <p className="text-sm">{reminder.channel === "email" ? reminder.recipientEmail : reminder.recipientPhone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Scheduled</p>
                          <p className="text-sm">{format(new Date(reminder.scheduledAt), "PPpp")}</p>
                        </div>
                      </div>
                      {reminder.message && (
                        <div>
                          <p className="text-xs text-muted-foreground">Message</p>
                          <p className="text-sm bg-muted p-2 rounded-md mt-1">{reminder.message}</p>
                        </div>
                      )}
                      {reminder.sentAt && (
                        <div>
                          <p className="text-xs text-muted-foreground">Sent At</p>
                          <p className="text-sm">{format(new Date(reminder.sentAt), "PPpp")}</p>
                        </div>
                      )}
                      {reminder.failureReason && (
                        <div>
                          <p className="text-xs text-muted-foreground text-destructive">Failure Reason</p>
                          <p className="text-sm text-destructive">{reminder.failureReason}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Form {...reminderForm}>
            <form onSubmit={reminderForm.handleSubmit(onSubmit)} className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Add New Reminder</h4>
              
              <FormField
                control={reminderForm.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Channel</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        setChannel(value as typeof channel);
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-reminder-channel">
                          <SelectValue placeholder="Select channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">
                          <span className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Email
                          </span>
                        </SelectItem>
                        <SelectItem value="sms">
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4" /> SMS
                          </span>
                        </SelectItem>
                        <SelectItem value="whatsapp">
                          <span className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4" /> WhatsApp
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {channel === "email" ? (
                <FormField
                  control={reminderForm.control}
                  name="recipientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="email@example.com" 
                          {...field} 
                          data-testid="input-reminder-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={reminderForm.control}
                  name="recipientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Phone</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="+1 555-123-4567" 
                          {...field} 
                          data-testid="input-reminder-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={reminderForm.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Time</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        data-testid="input-reminder-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reminderForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message (optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Custom reminder message..." 
                        className="resize-none" 
                        {...field} 
                        data-testid="textarea-reminder-message"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={createReminderMutation.isPending}
                data-testid="button-create-reminder"
              >
                {createReminderMutation.isPending ? "Creating..." : "Create Reminder"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditNoteDialog({
  note,
  onClose,
  onSave,
  isPending,
}: {
  note: (Note & { user?: User }) | null;
  onClose: () => void;
  onSave: (updates: { content: string; isVisibleToClient: boolean }) => void;
  isPending: boolean;
}) {
  const [content, setContent] = useState("");
  const [isVisibleToClient, setIsVisibleToClient] = useState(false);

  useEffect(() => {
    if (note) {
      setContent(note.content);
      setIsVisibleToClient(note.isVisibleToClient ?? false);
    }
  }, [note]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ content, isVisibleToClient });
  };

  return (
    <Dialog open={!!note} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="edit-note-content" className="text-sm font-medium">
              Content
            </label>
            <Textarea
              id="edit-note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              data-testid="textarea-edit-note-content"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-note-visible"
              checked={isVisibleToClient}
              onCheckedChange={(checked) => setIsVisibleToClient(!!checked)}
              data-testid="checkbox-edit-note-visible"
            />
            <label htmlFor="edit-note-visible" className="text-sm">
              Visible to client
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit-note">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-edit-note">
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskHierarchyItem({ 
  task, 
  level = 0, 
  onEdit, 
  onDelete, 
  onToggle,
  onReminder,
  expandedTasks,
  toggleExpand,
  reminderCounts,
}: { 
  task: TaskWithSubtasks; 
  level?: number;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggle: (task: Task) => void;
  onReminder: (task: Task) => void;
  expandedTasks: Set<number>;
  toggleExpand: (taskId: number) => void;
  reminderCounts?: Map<number, number>;
}) {
  const reminderCount = reminderCounts?.get(task.id) ?? 0;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isExpanded = expandedTasks.has(task.id);

  return (
    <div className="space-y-2">
      <div
        className={`flex items-start gap-3 p-4 rounded-lg border bg-card ${level > 0 ? 'ml-6 border-l-2 border-l-muted' : ''}`}
        data-testid={`task-item-${task.id}`}
      >
        <div className="flex items-center gap-2">
          {hasSubtasks && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => toggleExpand(task.id)}
                  data-testid={`button-expand-task-${task.id}`}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isExpanded ? "Collapse subtasks" : "Expand subtasks"}</TooltipContent>
            </Tooltip>
          )}
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={() => onToggle(task)}
            data-testid={`checkbox-task-${task.id}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </p>
            <Badge variant="outline" size="sm">{task.type.replace(/_/g, ' ')}</Badge>
            <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'} size="sm">
              {task.priority}
            </Badge>
            {task.status !== "done" && task.status !== "todo" && (
              <StatusBadge status={task.status} type="task" />
            )}
            {hasSubtasks && (
              <Badge variant="outline" size="sm">
                {task.subtasks?.filter(s => s.status === 'done').length}/{task.subtasks?.length} subtasks
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            {task.assignee && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {task.assignee.firstName || task.assignee.email}
              </span>
            )}
            {task.relatedAssociate && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {task.relatedAssociate.name}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.dueDate), "MM/dd/yyyy")}
              </span>
            )}
            <Badge variant="outline" size="sm">{task.locationType}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => onReminder(task)}
                  data-testid={`button-task-reminder-${task.id}`}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {reminderCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {reminderCount > 9 ? "9+" : reminderCount}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>Manage reminders</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid={`button-task-menu-${task.id}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasSubtasks && isExpanded && (
        <div className="space-y-2">
          {task.subtasks?.map((subtask) => (
            <TaskHierarchyItem
              key={subtask.id}
              task={subtask}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              onReminder={onReminder}
              expandedTasks={expandedTasks}
              toggleExpand={toggleExpand}
              reminderCounts={reminderCounts}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tasks");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isTimeLogDialogOpen, setIsTimeLogDialogOpen] = useState(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isChecklistDialogOpen, setIsChecklistDialogOpen] = useState(false);
  const [isAddAssociateDialogOpen, setIsAddAssociateDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [reminderTaskId, setReminderTaskId] = useState<number | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [selectedAssociateId, setSelectedAssociateId] = useState<string>("");
  const [selectedAssociateRole, setSelectedAssociateRole] = useState<string>("");
  const [newChecklistItemText, setNewChecklistItemText] = useState<{ [key: number]: string }>({});
  const [uploadedFilePath, setUploadedFilePath] = useState<string>("");
  const [isUploadComplete, setIsUploadComplete] = useState(false);
  const [pendingUploadPath, setPendingUploadPath] = useState<string>("");
  const [pendingFileSize, setPendingFileSize] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("other");
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [movingDocument, setMovingDocument] = useState<Document | null>(null);
  const [moveToFolderId, setMoveToFolderId] = useState<string>("__none__");
  const [editingNote, setEditingNote] = useState<(Note & { user?: User }) | null>(null);

  const { data: project, isLoading } = useQuery<ProjectWithRelations>({
    queryKey: ["/api/projects", id],
  });

  const { data: associates } = useQuery<Associate[]>({
    queryKey: ["/api/associates"],
  });

  const { data: adminUsers } = useQuery<User[]>({
    queryKey: ["/api/users/admins"],
  });

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ["/api/projects", id, "folders"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/folders`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json();
    },
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/projects", id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/documents`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json();
    },
  });

  const { data: projectAssociates } = useQuery<ProjectAssociateWithDetails[]>({
    queryKey: ["/api/projects", id, "associates"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/associates`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch associates');
      return res.json();
    },
  });

  const { data: checklists } = useQuery<ChecklistInstance[]>({
    queryKey: ["/api/projects", id, "checklists"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/checklists`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch checklists');
      return res.json();
    },
  });

  const { data: checklistTemplates } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/checklist-templates"],
  });

  const { data: allReminders } = useQuery<(TaskReminder & { task: Task })[]>({
    queryKey: ["/api/reminders"],
  });

  const taskReminderCounts = new Map<number, number>();
  allReminders?.filter(r => r.status === "pending").forEach(reminder => {
    const count = taskReminderCounts.get(reminder.taskId) || 0;
    taskReminderCounts.set(reminder.taskId, count + 1);
  });

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "other",
      status: "todo",
      priority: "normal",
      locationType: "office",
      parentTaskId: null,
      assigneeId: null,
      relatedAssociateId: null,
      dueDate: "",
    },
  });

  const noteForm = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      content: "",
      isVisibleToClient: false,
      entityType: "project",
      taskId: null,
      associateId: null,
      clientId: null,
    },
  });

  const watchedEntityType = noteForm.watch("entityType");
  const prevEntityTypeRef = useRef(watchedEntityType);

  useEffect(() => {
    if (prevEntityTypeRef.current !== watchedEntityType) {
      noteForm.setValue("taskId", null);
      noteForm.setValue("associateId", null);
      noteForm.setValue("clientId", null);
      prevEntityTypeRef.current = watchedEntityType;
    }
  }, [watchedEntityType, noteForm]);

  const timeLogForm = useForm<TimeLogFormData>({
    resolver: zodResolver(timeLogFormSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      taskDescription: "",
      startTime: "",
      endTime: "",
      totalHours: "",
      type: "office",
      notes: "",
    },
  });

  const watchedStartTime = timeLogForm.watch("startTime");
  const watchedEndTime = timeLogForm.watch("endTime");

  useEffect(() => {
    if (!watchedStartTime || !watchedEndTime) return;
    
    const [startH, startM] = watchedStartTime.split(":").map(Number);
    const [endH, endM] = watchedEndTime.split(":").map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return;
    
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }
    const diffMinutes = endMinutes - startMinutes;
    const hours = (diffMinutes / 60).toFixed(2);
    
    timeLogForm.setValue("totalHours", hours, { shouldValidate: true });
  }, [watchedStartTime, watchedEndTime, timeLogForm]);

  const folderForm = useForm<FolderFormData>({
    resolver: zodResolver(folderFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const documentForm = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      fileName: "",
      storagePath: "",
      fileSize: null,
      category: "other",
      folderId: null,
      isVisibleToClient: true,
      notes: "",
    },
  });

  const checklistForm = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistFormSchema),
    defaultValues: {
      name: "",
      templateId: null,
    },
  });

  const toggleExpand = (taskId: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const payload = {
        ...data,
        projectId: parseInt(id!),
        dueDate: data.dueDate ? parseLocalDate(data.dueDate) : null,
        parentTaskId: data.parentTaskId || null,
        assigneeId: data.assigneeId || null,
        relatedAssociateId: data.relatedAssociateId || null,
      };
      return await apiRequest("POST", "/api/tasks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task created successfully" });
      setIsTaskDialogOpen(false);
      taskForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: Partial<TaskFormData> }) => {
      const payload = {
        ...data,
        dueDate: data.dueDate ? parseLocalDate(data.dueDate) : null,
        parentTaskId: data.parentTaskId || null,
        assigneeId: data.assigneeId || null,
        relatedAssociateId: data.relatedAssociateId || null,
      };
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task updated successfully" });
      setIsTaskDialogOpen(false);
      setEditingTask(null);
      taskForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Task deleted successfully" });
      setDeletingTask(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      const payload: any = {
        content: data.content,
        isVisibleToClient: data.isVisibleToClient,
        userId: user?.id,
      };
      
      switch (data.entityType) {
        case "project":
          payload.projectId = parseInt(id!);
          break;
        case "task":
          payload.taskId = data.taskId;
          payload.projectId = parseInt(id!);
          break;
        case "associate":
          payload.associateId = data.associateId;
          break;
        case "client":
          payload.clientId = project?.clientId;
          break;
      }
      
      return await apiRequest("POST", "/api/notes", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Note added successfully" });
      setIsNoteDialogOpen(false);
      noteForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content, isVisibleToClient }: { noteId: number; content: string; isVisibleToClient: boolean }) => {
      return await apiRequest("PATCH", `/api/notes/${noteId}`, { content, isVisibleToClient });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Note updated successfully" });
      setEditingNote(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update note", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      return await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Note deleted successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete note", variant: "destructive" });
    },
  });

  const createTimeLogMutation = useMutation({
    mutationFn: async (data: TimeLogFormData) => {
      const payload = {
        ...data,
        projectId: parseInt(id!),
        userId: user?.id,
        date: parseLocalDate(data.date),
      };
      return await apiRequest("POST", "/api/time-logs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Time log added successfully" });
      setIsTimeLogDialogOpen(false);
      timeLogForm.reset({ date: format(new Date(), "yyyy-MM-dd"), type: "office" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add time log", variant: "destructive" });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: FolderFormData) => {
      return await apiRequest("POST", `/api/projects/${id}/folders`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "folders"] });
      toast({ title: "Folder created successfully" });
      setIsFolderDialogOpen(false);
      folderForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create folder", variant: "destructive" });
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      return await apiRequest("POST", `/api/projects/${id}/documents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "documents"] });
      toast({ title: "Document added successfully" });
      setIsDocumentDialogOpen(false);
      setUploadedFilePath("");
      setIsUploadComplete(false);
      setPendingUploadPath("");
      setPendingFileSize(null);
      documentForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add document", variant: "destructive" });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Document deleted successfully" });
      setDeletingDocument(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      return await apiRequest("DELETE", `/api/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Folder deleted successfully" });
      setDeletingFolder(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete folder", variant: "destructive" });
    },
  });

  const moveDocumentMutation = useMutation({
    mutationFn: async ({ documentId, folderId }: { documentId: number; folderId: number | null }) => {
      return await apiRequest("PATCH", `/api/documents/${documentId}`, { folderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({ title: "Document moved successfully" });
      setMovingDocument(null);
      setMoveToFolderId("__none__");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to move document", variant: "destructive" });
    },
  });

  const createChecklistMutation = useMutation({
    mutationFn: async (data: ChecklistFormData) => {
      const template = data.templateId ? checklistTemplates?.find(t => t.id === data.templateId) : null;
      const payload = {
        name: data.name,
        templateId: data.templateId || null,
        items: template?.items || [],
      };
      return await apiRequest("POST", `/api/projects/${id}/checklists`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "checklists"] });
      toast({ title: "Checklist created successfully" });
      setIsChecklistDialogOpen(false);
      checklistForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to create checklist", variant: "destructive" });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ checklistId, items }: { checklistId: number; items: ChecklistItem[] }) => {
      return await apiRequest("PATCH", `/api/checklists/${checklistId}`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "checklists"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to update checklist", variant: "destructive" });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: number) => {
      return await apiRequest("DELETE", `/api/checklists/${checklistId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "checklists"] });
      toast({ title: "Checklist deleted successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to delete checklist", variant: "destructive" });
    },
  });

  const addProjectAssociateMutation = useMutation({
    mutationFn: async ({ associateId, role }: { associateId: number; role?: string }) => {
      return await apiRequest("POST", `/api/projects/${id}/associates`, { associateId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "associates"] });
      toast({ title: "Associate added to project" });
      setIsAddAssociateDialogOpen(false);
      setSelectedAssociateId("");
      setSelectedAssociateRole("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to add associate", variant: "destructive" });
    },
  });

  const removeProjectAssociateMutation = useMutation({
    mutationFn: async (associateId: number) => {
      return await apiRequest("DELETE", `/api/projects/${id}/associates/${associateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "associates"] });
      toast({ title: "Associate removed from project" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to remove associate", variant: "destructive" });
    },
  });

  const handleOpenTaskDialog = (task?: Task, parentTaskId?: number) => {
    if (task) {
      setEditingTask(task);
      taskForm.reset({
        title: task.title,
        description: task.description || "",
        type: task.type,
        status: task.status,
        priority: task.priority || "normal",
        locationType: task.locationType || "office",
        parentTaskId: task.parentTaskId,
        assigneeId: task.assigneeId,
        relatedAssociateId: task.relatedAssociateId,
        dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingTask(null);
      taskForm.reset({
        title: "",
        description: "",
        type: "other",
        status: "todo",
        priority: "normal",
        locationType: "office",
        parentTaskId: parentTaskId || null,
        assigneeId: null,
        relatedAssociateId: null,
        dueDate: "",
      });
    }
    setIsTaskDialogOpen(true);
  };

  const onTaskSubmit = (data: TaskFormData) => {
    if (editingTask) {
      updateTaskMutation.mutate({ taskId: editingTask.id, data });
    } else {
      createTaskMutation.mutate(data);
    }
  };

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    updateTaskMutation.mutate({
      taskId: task.id,
      data: { status: newStatus },
    });
  };

  const toggleChecklistItem = (checklist: ChecklistInstance, itemId: string) => {
    const items = (checklist.items as ChecklistItem[]) || [];
    const updatedItems = items.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateChecklistMutation.mutate({ checklistId: checklist.id, items: updatedItems });
  };

  const addChecklistItem = (checklist: ChecklistInstance, text: string) => {
    if (!text.trim()) return;
    const items = (checklist.items as ChecklistItem[]) || [];
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: text.trim(),
      completed: false,
    };
    updateChecklistMutation.mutate({ 
      checklistId: checklist.id, 
      items: [...items, newItem] 
    });
    setNewChecklistItemText(prev => ({ ...prev, [checklist.id]: "" }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>
        </Button>
        <DashboardSkeleton />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Link>
        </Button>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="Project not found"
              description="The project you're looking for doesn't exist"
              actionLabel="View All Projects"
              onAction={() => window.location.href = "/projects"}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build task hierarchy
  const buildTaskHierarchy = (tasks: TaskWithSubtasks[]): TaskWithSubtasks[] => {
    const taskMap = new Map<number, TaskWithSubtasks>();
    const rootTasks: TaskWithSubtasks[] = [];

    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, subtasks: [] });
    });

    tasks.forEach(task => {
      const taskWithSubtasks = taskMap.get(task.id)!;
      if (task.parentTaskId) {
        const parent = taskMap.get(task.parentTaskId);
        if (parent) {
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(taskWithSubtasks);
        } else {
          rootTasks.push(taskWithSubtasks);
        }
      } else {
        rootTasks.push(taskWithSubtasks);
      }
    });

    return rootTasks;
  };

  const hierarchicalTasks = buildTaskHierarchy(project.tasks || []);
  const parentTasks = project.tasks?.filter(t => !t.parentTaskId) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to Projects</TooltipContent>
        </Tooltip>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
            <StatusBadge status={project.status} type="project" />
            {project.priority && project.priority !== 'normal' && (
              <Badge variant={project.priority === 'urgent' ? 'destructive' : project.priority === 'high' ? 'default' : 'secondary'}>
                {project.priority}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            <Link href={`/clients/${project.clientId}`} className="hover:underline">
              {project.client?.name}
            </Link>
            {project.internalCode && <span className="ml-2 text-xs">({project.internalCode})</span>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {project.county && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">County</p>
                <p className="text-sm font-medium">{project.county} County</p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.municipality && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Municipality</p>
                <p className="text-sm font-medium">{project.municipality}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.startDate && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium">
                  {format(new Date(project.startDate), "MM/dd/yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.address && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium truncate">{project.address}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {project.description && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
            <ClipboardList className="h-4 w-4" />
            Tasks ({project.tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
            <FileText className="h-4 w-4" />
            Documents ({documents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="checklists" className="gap-2" data-testid="tab-checklists">
            <ListChecks className="h-4 w-4" />
            Checklists ({checklists?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="associates" className="gap-2" data-testid="tab-associates">
            <Users className="h-4 w-4" />
            Associates ({projectAssociates?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4" />
            Notes ({project.notes?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="time-logs" className="gap-2" data-testid="tab-time-logs">
            <Clock className="h-4 w-4" />
            Time Logs ({(project.timeLogs?.length || 0) + (project.timeEntries?.length || 0)})
          </TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Tasks</h2>
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => handleOpenTaskDialog()} data-testid="button-add-task">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Create a new task</TooltipContent>
              </Tooltip>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingTask ? "Edit Task" : "Add New Task"}</DialogTitle>
                </DialogHeader>
                <Form {...taskForm}>
                  <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                    <FormField
                      control={taskForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title *</FormLabel>
                          <FormControl>
                            <Input placeholder="Task title" {...field} data-testid="input-task-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Task description" className="resize-none min-h-[120px]" {...field} data-testid="textarea-task-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={taskForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="phone_call">Phone Call</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="filing">Filing</SelectItem>
                                <SelectItem value="research">Research</SelectItem>
                                <SelectItem value="site_visit">Site Visit</SelectItem>
                                <SelectItem value="document_prep">Document Prep</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-status">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="waiting">Waiting</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={taskForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-priority">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="locationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-location">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="office">Office</SelectItem>
                                <SelectItem value="road">Road</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={taskForm.control}
                      name="parentTaskId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Parent Task (for subtasks)</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "__none__" ? null : parseInt(val))}
                            value={field.value?.toString() || "__none__"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-task-parent">
                                <SelectValue placeholder="None (top-level task)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">None (top-level task)</SelectItem>
                              {parentTasks.filter(t => t.id !== editingTask?.id).map((task) => (
                                <SelectItem key={task.id} value={task.id.toString()}>
                                  {task.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="assigneeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned To</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                            value={field.value || "__none__"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-task-assignee">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Unassigned</SelectItem>
                              {adminUsers?.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.firstName || u.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="relatedAssociateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Related Associate</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "__none__" ? null : parseInt(val))}
                            value={field.value?.toString() || "__none__"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-task-related-associate">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {associates?.map((associate) => (
                                <SelectItem key={associate.id} value={associate.id.toString()}>
                                  {associate.name} ({associate.type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taskForm.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-task-due-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTaskMutation.isPending || updateTaskMutation.isPending} data-testid="button-save-task">
                        {createTaskMutation.isPending || updateTaskMutation.isPending ? "Saving..." : editingTask ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {hierarchicalTasks.length > 0 ? (
            <div className="space-y-4">
              {hierarchicalTasks.map((task) => (
                <TaskHierarchyItem
                  key={task.id}
                  task={task}
                  onEdit={handleOpenTaskDialog}
                  onDelete={setDeletingTask}
                  onToggle={toggleTaskStatus}
                  onReminder={(task) => setReminderTaskId(task.id)}
                  expandedTasks={expandedTasks}
                  toggleExpand={toggleExpand}
                  reminderCounts={taskReminderCounts}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={ClipboardList}
                  title="No tasks yet"
                  description="Add tasks to track work on this project"
                  actionLabel="Add Task"
                  onAction={() => handleOpenTaskDialog()}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Documents & Folders</h2>
            <div className="flex gap-2">
              <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="button-add-folder">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        New Folder
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Create a new folder</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Folder</DialogTitle>
                  </DialogHeader>
                  <Form {...folderForm}>
                    <form onSubmit={folderForm.handleSubmit((data) => createFolderMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={folderForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Folder Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Permits, Plans" {...field} data-testid="input-folder-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={folderForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Optional description" className="resize-none" {...field} data-testid="textarea-folder-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => setIsFolderDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createFolderMutation.isPending} data-testid="button-save-folder">
                          {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-add-document">
                        <Upload className="h-4 w-4 mr-2" />
                        Add Document
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Upload a document</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Document</DialogTitle>
                  </DialogHeader>
                  <Form {...documentForm}>
                    <form onSubmit={documentForm.handleSubmit((data) => createDocumentMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={documentForm.control}
                        name="fileName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>File Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="document.pdf" {...field} data-testid="input-document-filename" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={documentForm.control}
                        name="storagePath"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Upload File *</FormLabel>
                            <FormControl>
                              <div className="space-y-2">
                                {uploadedFilePath ? (
                                  <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                                    <File className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm truncate flex-1">{uploadedFilePath.split('/').pop()}</span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          type="button" 
                                          size="icon" 
                                          variant="ghost"
                                          onClick={() => {
                                            setUploadedFilePath("");
                                            setIsUploadComplete(false);
                                            setPendingUploadPath("");
                                            setPendingFileSize(null);
                                            field.onChange("");
                                          }}
                                          data-testid="button-remove-upload"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Remove uploaded file</TooltipContent>
                                    </Tooltip>
                                  </div>
                                ) : (
                                  <ObjectUploader
                                    maxNumberOfFiles={1}
                                    onGetUploadParameters={async (file) => {
                                      const category = documentForm.getValues("category") || "other";
                                      const res = await fetch(`/api/projects/${id}/documents/upload`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        credentials: "include",
                                        body: JSON.stringify({ category, fileSize: file?.size || 0 }),
                                      });
                                      if (!res.ok) {
                                        const errorData = await res.json().catch(() => ({}));
                                        if (errorData.code === "STORAGE_LIMIT_EXCEEDED") {
                                          const error: any = new Error("Storage limit exceeded");
                                          error.code = "STORAGE_LIMIT_EXCEEDED";
                                          throw error;
                                        }
                                        throw new Error("Failed to get upload URL");
                                      }
                                      const data = await res.json();
                                      setPendingUploadPath(data.objectPath);
                                      setPendingFileSize(file?.size || null);
                                      setIsUploadComplete(false);
                                      return { method: "PUT" as const, url: data.uploadUrl };
                                    }}
                                    onComplete={(result) => {
                                      if (result.successful && result.successful.length > 0) {
                                        setUploadedFilePath(pendingUploadPath);
                                        documentForm.setValue("storagePath", pendingUploadPath);
                                        documentForm.setValue("fileSize", pendingFileSize);
                                        setIsUploadComplete(true);
                                        toast({ title: "File uploaded successfully" });
                                      }
                                    }}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Choose File
                                  </ObjectUploader>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={documentForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-document-category">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="plan">Plan</SelectItem>
                                  <SelectItem value="permit">Permit</SelectItem>
                                  <SelectItem value="survey">Survey</SelectItem>
                                  <SelectItem value="dob_letter">DOB Letter</SelectItem>
                                  <SelectItem value="correspondence">Correspondence</SelectItem>
                                  <SelectItem value="legal">Legal</SelectItem>
                                  <SelectItem value="photo">Photo</SelectItem>
                                  <SelectItem value="inspection">Inspection</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={documentForm.control}
                          name="folderId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Folder</FormLabel>
                              <Select
                                onValueChange={(val) => field.onChange(val === "__none__" ? null : parseInt(val))}
                                value={field.value?.toString() || "__none__"}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-document-folder">
                                    <SelectValue placeholder="No folder" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none__">No folder</SelectItem>
                                  {folders?.map((folder) => (
                                    <SelectItem key={folder.id} value={folder.id.toString()}>
                                      {folder.name}
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
                        control={documentForm.control}
                        name="isVisibleToClient"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center gap-2">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-document-visible"
                              />
                            </FormControl>
                            <FormLabel className="!mt-0">Visible to client</FormLabel>
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createDocumentMutation.isPending || !isUploadComplete} data-testid="button-save-document">
                          {createDocumentMutation.isPending ? "Adding..." : !isUploadComplete && uploadedFilePath ? "Uploading..." : "Add Document"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Folders */}
          {folders && folders.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Folders</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {folders.map((folder) => (
                  <Card key={folder.id} className="hover-elevate" data-testid={`folder-item-${folder.id}`}>
                    <CardContent className="flex items-center gap-3 py-4">
                      <FolderOpen className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{folder.name}</p>
                        {folder.description && (
                          <p className="text-xs text-muted-foreground truncate">{folder.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {documents?.filter(d => d.folderId === folder.id).length || 0} documents
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-folder-menu-${folder.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => setDeletingFolder(folder)}
                            className="text-destructive"
                            data-testid={`button-delete-folder-${folder.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {documents && documents.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">All Documents</h3>
              {documents.map((doc) => (
                <Card key={doc.id} data-testid={`document-item-${doc.id}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <File className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" size="sm">{doc.category}</Badge>
                        {doc.folderId && folders && (
                          <span>in {folders.find(f => f.id === doc.folderId)?.name}</span>
                        )}
                        {!doc.isVisibleToClient && (
                          <Badge variant="secondary" size="sm">Hidden from client</Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={doc.storagePath} target="_blank" rel="noopener noreferrer" data-testid={`button-view-document-${doc.id}`}>
                        View
                      </a>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-document-menu-${doc.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setMovingDocument(doc);
                            setMoveToFolderId(doc.folderId?.toString() || "__none__");
                          }}
                          data-testid={`button-move-document-${doc.id}`}
                        >
                          <FolderInput className="h-4 w-4 mr-2" />
                          Move to Folder
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingDocument(doc)}
                          className="text-destructive"
                          data-testid={`button-delete-document-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            !folders?.length && (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={FileText}
                    title="No documents yet"
                    description="Add documents and organize them in folders"
                    actionLabel="Add Document"
                    onAction={() => setIsDocumentDialogOpen(true)}
                  />
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>

        {/* Checklists Tab */}
        <TabsContent value="checklists" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Checklists</h2>
            <Dialog open={isChecklistDialogOpen} onOpenChange={setIsChecklistDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-checklist">
                      <Plus className="h-4 w-4 mr-2" />
                      New Checklist
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Create a new checklist</TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Checklist</DialogTitle>
                </DialogHeader>
                <Form {...checklistForm}>
                  <form onSubmit={checklistForm.handleSubmit((data) => createChecklistMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={checklistForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Checklist Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Filing Requirements" {...field} data-testid="input-checklist-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={checklistForm.control}
                      name="templateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From Template (optional)</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "__none__" ? null : parseInt(val))}
                            value={field.value?.toString() || "__none__"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-checklist-template">
                                <SelectValue placeholder="Start from scratch" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Start from scratch</SelectItem>
                              {checklistTemplates?.map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsChecklistDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createChecklistMutation.isPending} data-testid="button-save-checklist">
                        {createChecklistMutation.isPending ? "Creating..." : "Create Checklist"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {checklists && checklists.length > 0 ? (
            <div className="space-y-4">
              {checklists.map((checklist) => {
                const items = (checklist.items as ChecklistItem[]) || [];
                const completedCount = items.filter(i => i.completed).length;
                const totalCount = items.length;
                const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

                return (
                  <Card key={checklist.id} data-testid={`checklist-item-${checklist.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="text-base">{checklist.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {completedCount}/{totalCount}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteChecklistMutation.mutate(checklist.id)}
                                data-testid={`button-delete-checklist-${checklist.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete checklist</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {totalCount > 0 && (
                        <Progress value={progress} className="h-2" />
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleChecklistItem(checklist, item.id)}
                            data-testid={`checkbox-checklist-item-${item.id}`}
                          />
                          <span className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-2">
                        <Input
                          placeholder="Add item..."
                          value={newChecklistItemText[checklist.id] || ""}
                          onChange={(e) => setNewChecklistItemText(prev => ({ ...prev, [checklist.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addChecklistItem(checklist, newChecklistItemText[checklist.id] || "");
                            }
                          }}
                          className="flex-1"
                          data-testid={`input-checklist-item-${checklist.id}`}
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addChecklistItem(checklist, newChecklistItemText[checklist.id] || "")}
                              data-testid={`button-add-checklist-item-${checklist.id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Add item</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={ListChecks}
                  title="No checklists yet"
                  description="Create checklists to track requirements and milestones"
                  actionLabel="New Checklist"
                  onAction={() => setIsChecklistDialogOpen(true)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Associates Tab */}
        <TabsContent value="associates" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Project Associates</h2>
            <Dialog open={isAddAssociateDialogOpen} onOpenChange={setIsAddAssociateDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-associate">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Associate
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Link an associate to this project</TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Associate to Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Associate *</label>
                    <Select value={selectedAssociateId} onValueChange={setSelectedAssociateId}>
                      <SelectTrigger data-testid="select-associate">
                        <SelectValue placeholder="Choose an associate" />
                      </SelectTrigger>
                      <SelectContent>
                        {associates?.filter(a => !projectAssociates?.some(pa => pa.associateId === a.id)).map((associate) => (
                          <SelectItem key={associate.id} value={associate.id.toString()}>
                            {associate.name} ({associate.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role on Project (optional)</label>
                    <Input
                      placeholder="e.g., Lead Engineer"
                      value={selectedAssociateRole}
                      onChange={(e) => setSelectedAssociateRole(e.target.value)}
                      data-testid="input-associate-role"
                    />
                  </div>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={() => setIsAddAssociateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedAssociateId) {
                          addProjectAssociateMutation.mutate({
                            associateId: parseInt(selectedAssociateId),
                            role: selectedAssociateRole || undefined,
                          });
                        }
                      }}
                      disabled={!selectedAssociateId || addProjectAssociateMutation.isPending}
                      data-testid="button-save-associate"
                    >
                      {addProjectAssociateMutation.isPending ? "Adding..." : "Add to Project"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {projectAssociates && projectAssociates.length > 0 ? (
            <div className="space-y-3">
              {projectAssociates.map((pa) => (
                <Card key={pa.id} data-testid={`project-associate-${pa.id}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{pa.associate?.name}</p>
                        <AssociateTypeBadge type={pa.associate?.type || 'other'} />
                        {pa.role && (
                          <Badge variant="outline" size="sm">{pa.role}</Badge>
                        )}
                      </div>
                      {pa.associate?.company && (
                        <p className="text-sm text-muted-foreground">{pa.associate.company}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {pa.associate?.email && <span>{pa.associate.email}</span>}
                        {pa.associate?.phone && <span>{pa.associate.phone}</span>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-associate-menu-${pa.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>More options</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/associates/${pa.associateId}`}>
                            View Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => removeProjectAssociateMutation.mutate(pa.associateId)}
                          data-testid={`button-remove-associate-${pa.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove from Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Users}
                  title="No associates yet"
                  description="Add engineers, architects, and other associates to this project"
                  actionLabel="Add Associate"
                  onAction={() => setIsAddAssociateDialogOpen(true)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Notes</h2>
            <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-note">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Add a note</TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Note</DialogTitle>
                </DialogHeader>
                <Form {...noteForm}>
                  <form onSubmit={noteForm.handleSubmit((data) => createNoteMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={noteForm.control}
                      name="entityType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Attach To</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-note-entity-type">
                                <SelectValue placeholder="Select entity type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="project">This Project</SelectItem>
                              <SelectItem value="task" disabled={!project.tasks || project.tasks.length === 0}>
                                A Task {(!project.tasks || project.tasks.length === 0) && "(none available)"}
                              </SelectItem>
                              <SelectItem value="associate" disabled={!projectAssociates || projectAssociates.length === 0}>
                                An Associate {(!projectAssociates || projectAssociates.length === 0) && "(none available)"}
                              </SelectItem>
                              <SelectItem value="client" disabled={!project.clientId}>
                                The Client {!project.clientId && "(not linked)"}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedEntityType === "task" && project.tasks && project.tasks.length > 0 && (
                      <FormField
                        control={noteForm.control}
                        name="taskId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Task</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-note-task">
                                  <SelectValue placeholder="Select a task" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {project.tasks.map((task) => (
                                  <SelectItem key={task.id} value={task.id.toString()}>{task.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {watchedEntityType === "associate" && projectAssociates && projectAssociates.length > 0 && (
                      <FormField
                        control={noteForm.control}
                        name="associateId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Associate</FormLabel>
                            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-note-associate">
                                  <SelectValue placeholder="Select an associate" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {projectAssociates.map((pa) => (
                                  <SelectItem key={pa.associate.id} value={pa.associate.id.toString()}>{pa.associate.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={noteForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Enter your note..." className="min-h-32 resize-none" {...field} data-testid="textarea-note-content" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={noteForm.control}
                      name="isVisibleToClient"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-note-visible"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">Visible to client</FormLabel>
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createNoteMutation.isPending} data-testid="button-save-note">
                        {createNoteMutation.isPending ? "Saving..." : "Add Note"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {project.notes && project.notes.length > 0 ? (
            <div className="space-y-4">
              {project.notes.map((note) => (
                <Card key={note.id} data-testid={`note-item-${note.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground flex-wrap">
                          <span>{note.user?.firstName || note.user?.email || "Unknown"}</span>
                          <span>-</span>
                          <span>{format(new Date(note.createdAt!), "MM/dd/yyyy 'at' h:mm a")}</span>
                          {note.isVisibleToClient && (
                            <Badge variant="outline" size="sm">Visible to client</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingNote(note)}
                        data-testid={`button-edit-note-${note.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={MessageSquare}
                  title="No notes yet"
                  description="Add notes to keep track of project communications"
                  actionLabel="Add Note"
                  onAction={() => setIsNoteDialogOpen(true)}
                />
              </CardContent>
            </Card>
          )}

          <EditNoteDialog
            note={editingNote}
            onClose={() => setEditingNote(null)}
            onSave={(updates) => {
              if (!editingNote) return;
              updateNoteMutation.mutate({
                noteId: editingNote.id,
                content: updates.content,
                isVisibleToClient: updates.isVisibleToClient,
              });
            }}
            isPending={updateNoteMutation.isPending}
          />
        </TabsContent>

        {/* Time Logs Tab */}
        <TabsContent value="time-logs" className="mt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">Time Logs</h2>
            <Dialog open={isTimeLogDialogOpen} onOpenChange={setIsTimeLogDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-time-log">
                      <Plus className="h-4 w-4 mr-2" />
                      Log Time
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Log time spent</TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Time</DialogTitle>
                </DialogHeader>
                <Form {...timeLogForm}>
                  <form onSubmit={timeLogForm.handleSubmit((data) => createTimeLogMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={timeLogForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-time-log-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timeLogForm.control}
                      name="taskDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="What did you work on?" className="resize-none" {...field} data-testid="textarea-time-log-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={timeLogForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-time-log-start" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={timeLogForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} data-testid="input-time-log-end" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={timeLogForm.control}
                        name="totalHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hours *</FormLabel>
                            <FormControl>
                              <Input placeholder="2.5" {...field} data-testid="input-time-log-hours" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={timeLogForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-time-log-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="office">Office</SelectItem>
                              <SelectItem value="road">Road</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsTimeLogDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTimeLogMutation.isPending} data-testid="button-save-time-log">
                        {createTimeLogMutation.isPending ? "Saving..." : "Log Time"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {((project.timeLogs && project.timeLogs.length > 0) || (project.timeEntries && project.timeEntries.length > 0)) ? (
            <div className="space-y-4">
              {project.timeEntries?.map((entry) => {
                const task = project.tasks?.find(t => t.id === entry.taskId);
                return (
                  <Card key={`entry-${entry.id}`} data-testid={`time-entry-item-${entry.id}`}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{task?.title || "Task"}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span>{format(new Date(entry.date), "MM/dd/yyyy")}</span>
                            {entry.startTime && entry.endTime && (
                              <span>{formatTimeRange12h(entry.startTime, entry.endTime)}</span>
                            )}
                            <span className="font-medium text-foreground">{((entry.totalMinutes || 0) / 60).toFixed(1)} hrs</span>
                            {entry.isBillable && <Badge variant="outline" size="sm">Billable</Badge>}
                          </div>
                          {entry.notes && <p className="text-xs text-muted-foreground mt-2">{entry.notes}</p>}
                        </div>
                        {task?.locationType && <Badge variant="outline">{task.locationType}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {project.timeLogs?.map((log) => (
                <Card key={`log-${log.id}`} data-testid={`time-log-item-${log.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{log.taskDescription}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span>{format(new Date(log.date), "MM/dd/yyyy")}</span>
                          {log.startTime && log.endTime && (
                            <span>{formatTimeRange12h(log.startTime, log.endTime)}</span>
                          )}
                          <span className="font-medium text-foreground">{log.totalHours} hrs</span>
                          <span>{log.user?.firstName || log.user?.email}</span>
                        </div>
                      </div>
                      <Badge variant="outline">{log.type}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={Clock}
                  title="No time logs yet"
                  description="Log time to track work hours on this project"
                  actionLabel="Log Time"
                  onAction={() => setIsTimeLogDialogOpen(true)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
              {deletingTask?.parentTaskId === null && project.tasks?.some(t => t.parentTaskId === deletingTask?.id) && (
                <span className="block mt-2 text-destructive">
                  Warning: This task has subtasks that will also be affected.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTask && deleteTaskMutation.mutate(deletingTask.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {reminderTaskId && (
        <ReminderDialog 
          taskId={reminderTaskId} 
          isOpen={!!reminderTaskId} 
          onClose={() => setReminderTaskId(null)} 
        />
      )}

      {/* Delete Document Dialog */}
      <AlertDialog open={!!deletingDocument} onOpenChange={() => setDeletingDocument(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDocument?.fileName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDocument && deleteDocumentMutation.mutate(deletingDocument.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-document"
            >
              {deleteDocumentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={!!deletingFolder} onOpenChange={() => setDeletingFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the folder "{deletingFolder?.name}"? 
              {deletingFolder && documents?.filter(d => d.folderId === deletingFolder.id).length ? (
                <span className="block mt-2 text-destructive">
                  Warning: This folder contains {documents?.filter(d => d.folderId === deletingFolder.id).length} document(s). 
                  They will be moved to "No folder".
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFolder && deleteFolderMutation.mutate(deletingFolder.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-folder"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Document Dialog */}
      <Dialog open={!!movingDocument} onOpenChange={(open) => !open && setMovingDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move "{movingDocument?.fileName}" to a different folder:
            </p>
            <Select
              value={moveToFolderId}
              onValueChange={setMoveToFolderId}
            >
              <SelectTrigger data-testid="select-move-to-folder">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No folder (root level)</SelectItem>
                {folders?.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}{movingDocument?.folderId === folder.id ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setMovingDocument(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (movingDocument) {
                    const newFolderId = moveToFolderId === "__none__" ? null : parseInt(moveToFolderId);
                    if (newFolderId === movingDocument.folderId) {
                      setMovingDocument(null);
                      return;
                    }
                    moveDocumentMutation.mutate({
                      documentId: movingDocument.id,
                      folderId: newFolderId,
                    });
                  }
                }}
                disabled={moveDocumentMutation.isPending}
                data-testid="button-confirm-move-document"
              >
                {moveDocumentMutation.isPending ? "Moving..." : "Move"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
