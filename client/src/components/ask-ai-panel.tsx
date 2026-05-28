import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Scope = "task" | "project";

interface AskAiPanelProps {
  scope: Scope;
  entityId: number | undefined;
  testIdPrefix?: string;
}

interface QAItem {
  id: number;
  question: string;
  answer: string;
}

const TASK_SUGGESTIONS = [
  "Summarize the current status",
  "What's still outstanding?",
  "Recap the last month",
  "Who has been involved and what did they do?",
];

const PROJECT_SUGGESTIONS = [
  "Summarize the project's current status",
  "What's still outstanding across all tasks?",
  "Recap progress this month",
  "Which milestones are done and which are next?",
  "Who has been involved and what did they do?",
];

const SCOPE_CONFIG: Record<
  Scope,
  {
    availabilityKey: (id: number) => readonly unknown[];
    availabilityUrl: (id: number) => string;
    askUrl: (id: number) => string;
    intro: string;
    emptyText: string;
    loadingText: string;
    suggestions: string[];
    availabilityField: "hasNotes" | "hasData";
  }
> = {
  task: {
    availabilityKey: (id) => ["/api/ai/tasks", id, "note-availability"] as const,
    availabilityUrl: (id) => `/api/ai/tasks/${id}/note-availability`,
    askUrl: (id) => `/api/ai/tasks/${id}/ask`,
    intro:
      "Ask AI a question about this task's notes and history. Answers are based only on what's recorded here and disappear when you close the dialog.",
    emptyText:
      "No notes yet to summarize. Add some notes first and then come back to ask questions.",
    loadingText: "Reading the notes and writing an answer...",
    suggestions: TASK_SUGGESTIONS,
    availabilityField: "hasNotes",
  },
  project: {
    availabilityKey: (id) =>
      ["/api/ai/projects", id, "data-availability"] as const,
    availabilityUrl: (id) => `/api/ai/projects/${id}/data-availability`,
    askUrl: (id) => `/api/ai/projects/${id}/ask`,
    intro:
      "Ask AI a question about this project. Answers are drawn from all of its tasks, notes, milestones, and history, and aren't saved.",
    emptyText:
      "Not enough project info to summarize yet. Add tasks, notes, or milestones and try again.",
    loadingText: "Reading the project and writing an answer...",
    suggestions: PROJECT_SUGGESTIONS,
    availabilityField: "hasData",
  },
};

export function AskAiPanel({
  scope,
  entityId,
  testIdPrefix = "ask-ai",
}: AskAiPanelProps) {
  const cfg = SCOPE_CONFIG[scope];
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QAItem[]>([]);

  const { data: availability, isLoading: availabilityLoading } = useQuery<
    Record<string, boolean>
  >({
    queryKey: entityId ? cfg.availabilityKey(entityId) : ["ask-ai", scope, "no-id"],
    queryFn: async () => {
      const res = await apiRequest("GET", cfg.availabilityUrl(entityId!));
      return res.json();
    },
    enabled: !!entityId,
  });

  const askMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", cfg.askUrl(entityId!), {
        question: q,
      });
      return (await res.json()) as { answer: string };
    },
    onSuccess: (data, q) => {
      setHistory((prev) => [
        ...prev,
        { id: Date.now(), question: q, answer: data.answer },
      ]);
      setQuestion("");
    },
    onError: (err: any) => {
      toast({
        title: "Could not get an answer",
        description:
          err?.message?.replace(/^\d+:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !entityId || askMutation.isPending) return;
    askMutation.mutate(trimmed);
  };

  if (!entityId) return null;

  const hasData = availability?.[cfg.availabilityField] === true;

  return (
    <div className="space-y-4" data-testid={`${testIdPrefix}-panel`}>
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
        <Sparkles className="h-4 w-4 mt-0.5 text-chart-4 shrink-0" />
        <div className="text-sm text-muted-foreground">{cfg.intro}</div>
      </div>

      {availabilityLoading ? (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid={`${testIdPrefix}-availability-loading`}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking...
        </div>
      ) : !hasData ? (
        <div
          className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground"
          data-testid={`${testIdPrefix}-empty`}
        >
          {cfg.emptyText}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">Your question</label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the current status?"
              className="min-h-[80px]"
              data-testid={`${testIdPrefix}-input`}
              disabled={askMutation.isPending}
            />
            <div className="flex flex-wrap gap-2">
              {cfg.suggestions.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => submit(s)}
                  data-testid={`${testIdPrefix}-suggestion-${s
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "")}`}
                >
                  {s}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={() => submit(question)}
                disabled={askMutation.isPending || !question.trim()}
                data-testid={`${testIdPrefix}-submit`}
              >
                {askMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Ask AI
              </Button>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setHistory([])}
                  disabled={askMutation.isPending}
                  data-testid={`${testIdPrefix}-clear`}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {askMutation.isPending && (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid={`${testIdPrefix}-loading`}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {cfg.loadingText}
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-3">
              {history
                .slice()
                .reverse()
                .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border p-3 space-y-2"
                    data-testid={`${testIdPrefix}-qa-${item.id}`}
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      You asked
                    </div>
                    <div className="text-sm">{item.question}</div>
                    <div className="text-xs font-medium text-muted-foreground pt-1">
                      AI answer
                    </div>
                    <div
                      className="text-sm whitespace-pre-wrap"
                      data-testid={`${testIdPrefix}-answer-${item.id}`}
                    >
                      {item.answer}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export interface AskAiTaskPanelProps {
  taskId: number | undefined;
  testIdPrefix?: string;
}

export function AskAiTaskPanel({ taskId, testIdPrefix }: AskAiTaskPanelProps) {
  return (
    <AskAiPanel scope="task" entityId={taskId} testIdPrefix={testIdPrefix} />
  );
}
