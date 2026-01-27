import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "waiting" | "done" | "cancelled";
type ProjectStatus = "intake" | "in_progress" | "waiting_on_client" | "with_dob" | "completed" | "on_hold" | "cancelled" | "archived";

interface StatusBadgeProps {
  status: TaskStatus | ProjectStatus;
  type?: "task" | "project";
  className?: string;
}

const taskStatusConfig: Record<TaskStatus, { label: string; className: string }> = {
  todo: {
    label: "To Do",
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-chart-1/10 text-chart-1 dark:bg-chart-1/20",
  },
  waiting: {
    label: "Waiting",
    className: "bg-chart-3/10 text-chart-3 dark:bg-chart-3/20",
  },
  done: {
    label: "Done",
    className: "bg-chart-2/10 text-chart-2 dark:bg-chart-2/20",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
};

const projectStatusConfig: Record<ProjectStatus, { label: string; className: string }> = {
  intake: {
    label: "Intake",
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-chart-1/10 text-chart-1 dark:bg-chart-1/20",
  },
  waiting_on_client: {
    label: "Waiting on Client",
    className: "bg-chart-3/10 text-chart-3 dark:bg-chart-3/20",
  },
  with_dob: {
    label: "With DOB",
    className: "bg-chart-4/10 text-chart-4 dark:bg-chart-4/20",
  },
  completed: {
    label: "Completed",
    className: "bg-chart-2/10 text-chart-2 dark:bg-chart-2/20",
  },
  on_hold: {
    label: "On Hold",
    className: "bg-chart-5/10 text-chart-5 dark:bg-chart-5/20",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground opacity-70",
  },
};

export function StatusBadge({ status, type = "task", className }: StatusBadgeProps) {
  const config = type === "task" 
    ? taskStatusConfig[status as TaskStatus] 
    : projectStatusConfig[status as ProjectStatus];

  const fallbackConfig = { label: status, className: "bg-muted text-muted-foreground" };
  const finalConfig = config || fallbackConfig;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "no-default-hover-elevate no-default-active-elevate font-medium",
        finalConfig.className,
        className
      )}
    >
      {finalConfig.label}
    </Badge>
  );
}

export function TaskTypeBadge({ type }: { type: "road" | "office" }) {
  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn(
        "no-default-hover-elevate no-default-active-elevate text-xs",
        type === "road" 
          ? "border-chart-1/30 text-chart-1" 
          : "border-chart-4/30 text-chart-4"
      )}
    >
      {type === "road" ? "Road" : "Office"}
    </Badge>
  );
}

export function AssociateTypeBadge({ type }: { type: string }) {
  const typeLabels: Record<string, string> = {
    engineer: "Engineer",
    architect: "Architect",
    surveyor: "Surveyor",
    village_contact: "Village Contact",
    consultant: "Consultant",
  };

  return (
    <Badge
      variant="secondary"
      size="sm"
      className="no-default-hover-elevate no-default-active-elevate"
    >
      {typeLabels[type] || type}
    </Badge>
  );
}
