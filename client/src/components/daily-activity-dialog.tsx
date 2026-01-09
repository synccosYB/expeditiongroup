import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Clock, FileText, Loader2 } from "lucide-react";

interface DailyActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
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

  useEffect(() => {
    if (isOpen) {
      setDate(format(new Date(), "yyyy-MM-dd"));
      setSummary("");
      setDetails("");
      setHoursWorked("");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Log Daily Activity
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="activity-date" className="text-sm font-medium">
                Date
              </Label>
              <Input
                id="activity-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-testid="input-activity-date"
              />
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
                rows={5}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="resize-none"
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
                Total hours worked today (optional)
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
              disabled={createLogMutation.isPending || !summary.trim()}
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
