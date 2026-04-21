import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

export interface NotesHistoryEntry {
  id: number;
  createdAt: string;
  metadata: {
    oldNotes: string | null;
    newNotes: string | null;
    taskTitle?: string;
  } | null;
  user?: { firstName: string | null; lastName: string | null };
}

interface NotesHistoryListProps {
  taskId: number | undefined;
  enabled?: boolean;
  testIdPrefix?: string;
}

export function NotesHistoryList({
  taskId,
  enabled = true,
  testIdPrefix = "notes-history",
}: NotesHistoryListProps) {
  const { data: notesHistory, isLoading } = useQuery<NotesHistoryEntry[]>({
    queryKey: ["/api/tasks", taskId, "notes-history"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${taskId}/notes-history`);
      return res.json();
    },
    enabled: !!taskId && enabled,
  });

  if (!taskId || isLoading) return null;

  const entries = notesHistory ?? [];

  return (
    <div className="space-y-3 pt-2" data-testid={`${testIdPrefix}-section`}>
      <Separator />
      <h4 className="text-sm font-medium flex items-center gap-2">
        <History className="h-4 w-4" />
        Notes History
      </h4>
      {entries.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid={`${testIdPrefix}-empty`}
        >
          No notes history yet.
        </p>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {entries.map((entry) => {
            const meta = entry.metadata;
            const userName = entry.user
              ? `${entry.user.firstName || ""} ${entry.user.lastName || ""}`.trim() || "Unknown"
              : "Unknown";
            const timestamp = entry.createdAt
              ? format(new Date(entry.createdAt), "MM-dd-yyyy 'at' h:mm a")
              : "";
            return (
              <div
                key={entry.id}
                className="rounded-md border p-3 text-sm space-y-2"
                data-testid={`${testIdPrefix}-entry-${entry.id}`}
              >
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>{userName}</span>
                  <span>{timestamp}</span>
                </div>
                {meta?.oldNotes && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Previous:
                    </span>
                    <p className="text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-2 text-xs">
                      {meta.oldNotes}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-xs font-medium">
                    {meta?.oldNotes ? "Changed to:" : "Added:"}
                  </span>
                  <p className="whitespace-pre-wrap bg-muted/30 rounded p-2 text-xs">
                    {meta?.newNotes || (
                      <span className="italic text-muted-foreground">Notes cleared</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
