import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Clock, FileText, Loader2, Sparkles } from "lucide-react";

interface DailyActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GeneratedActivity {
  scope: "all" | "mine";
  summary: string;
  details: string;
  hoursWorked: string;
  stats: {
    timeEntriesCount: number;
    tasksCompletedCount: number;
    documentsProcessedCount: number;
    notesCreatedCount: number;
    totalMinutes: number;
  };
}

export function DailyActivityDialog({
  isOpen,
  onClose,
}: DailyActivityDialogProps) {
  const { toast } = useToast();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [generatedStats, setGeneratedStats] = useState<GeneratedActivity["stats"] | null>(null);
  const generationId = useRef(0);

  const clearGeneratedActivity = () => {
    generationId.current++;
    setSummary("");
    setDetails("");
    setHoursWorked("");
    setGeneratedStats(null);
  };

  useEffect(() => {
    generationId.current++;
    if (isOpen) {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setScope("all");
      setSummary("");
      setDetails("");
      setHoursWorked("");
      setGeneratedStats(null);
    }
  }, [isOpen]);

  const createLogMutation = useMutation({
    mutationFn: async (data: {
      date: string;
      summary: string;
      details?: string;
      hoursWorked?: string;
    }) => {
      return await apiRequest("POST", "/api/daily-activity-logs", data);
    },
    onSuccess: () => {
      toast({ title: "Daily activity logged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-activity-logs"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to log activity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (selection: { date: string; scope: "all" | "mine"; generationId: number }): Promise<GeneratedActivity> => {
      const params = new URLSearchParams({ date: selection.date, scope: selection.scope });
      const response = await fetch(`/api/daily-activity-logs/generate?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to generate activity");
      }
      return response.json();
    },
    onSuccess: (data, selection) => {
      if (selection.generationId !== generationId.current) return;
      setSummary(data.summary);
      setDetails(data.details);
      setHoursWorked(data.hoursWorked);
      setGeneratedStats(data.stats);
      
      const { stats } = data;
      const hasActivity = stats.timeEntriesCount > 0 || stats.tasksCompletedCount > 0 || 
                          stats.documentsProcessedCount > 0 || stats.notesCreatedCount > 0;
      
      if (hasActivity) {
        toast({
          title: "Activity generated",
          description: `Found ${stats.timeEntriesCount} time entries, ${stats.tasksCompletedCount} tasks, ${stats.documentsProcessedCount} documents, ${stats.notesCreatedCount} notes`,
        });
      } else {
        toast({
          title: "No activity found",
          description: "No tracked activity for the selected date. You can still enter details manually.",
        });
      }
    },
    onError: (error: Error, selection) => {
      if (selection.generationId !== generationId.current) return;
      toast({
        title: "Failed to generate activity",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({ date, scope, generationId: ++generationId.current });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      toast({
        title: "Summary required",
        description: "Please enter a summary of your activities",
        variant: "destructive",
      });
      return;
    }
    createLogMutation.mutate({
      date,
      summary: summary.trim(),
      details: details.trim() || undefined,
      hoursWorked: hoursWorked.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Log Daily Activity
          </DialogTitle>
          <DialogDescription>
            Record daily work activities and hours.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="activity-date" className="text-sm font-medium">
                  Date
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !date}
                  data-testid="button-generate-activity"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate from Activity
                </Button>
              </div>
              <Input
                id="activity-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  clearGeneratedActivity();
                }}
                disabled={generateMutation.isPending}
                data-testid="input-activity-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-scope">Include activity from</Label>
              <Select value={scope} disabled={generateMutation.isPending} onValueChange={(value: "all" | "mine") => {
                setScope(value);
                clearGeneratedActivity();
              }}>
                <SelectTrigger id="activity-scope" data-testid="select-activity-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="mine">My activity</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {scope === "all" ? "Includes the same time entries as Time Logs for this date." : "Includes only activity linked to your account."}
              </p>
              {generatedStats && (
                <p className="text-sm" role="status" data-testid="text-generated-activity-total">
                  {generatedStats.timeEntriesCount} time entries · {(generatedStats.totalMinutes / 60).toFixed(1)} recorded hours
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-summary" className="text-sm font-medium">
                Summary
              </Label>
              <Input
                id="activity-summary"
                placeholder="Brief summary of today's work..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                data-testid="input-activity-summary"
              />
              <p className="text-xs text-muted-foreground">
                A short overview of your main activities
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-details" className="text-sm font-medium">
                Activity Details
              </Label>
              <Textarea
                id="activity-details"
                placeholder="Describe your activities in more detail..."
                rows={8}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="resize-none font-mono text-sm"
                data-testid="input-activity-details"
              />
              <p className="text-xs text-muted-foreground">
                Include specific tasks completed, calls made, files processed, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours-worked" className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hours Worked
              </Label>
              <Input
                id="hours-worked"
                type="text"
                placeholder="e.g., 8.5"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                className="max-w-[120px]"
                data-testid="input-hours-worked"
              />
              <p className="text-xs text-muted-foreground">
                Recorded hours in decimal form (8.5 = 8 hours 30 minutes). Overlapping entries are included.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel-activity"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLogMutation.isPending || generateMutation.isPending || !date || !summary.trim()}
              data-testid="button-save-activity"
            >
              {createLogMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Activity Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
