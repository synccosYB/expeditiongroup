import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIImproveButtonProps {
  getText: () => string;
  onImproved: (text: string) => void;
  disabled?: boolean;
  context?: string;
}

export function AIImproveButton({ getText, onImproved, disabled, context }: AIImproveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleImprove = async () => {
    const text = getText();
    if (!text || text.trim().length === 0) {
      toast({
        title: "Nothing to improve",
        description: "Please enter some text first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/improve-text", { text });
      const data = await res.json();
      if (data.improved) {
        onImproved(data.improved);
        toast({
          title: "Text improved",
          description: "Spelling, grammar, and clarity have been enhanced.",
        });
      }
    } catch (error: any) {
      toast({
        title: "AI improvement failed",
        description: "Could not improve text. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testId = context ? `button-ai-improve-${context}` : "button-ai-improve";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleImprove}
          disabled={disabled || isLoading}
          className="h-6 w-auto px-1.5 gap-1"
          data-testid={testId}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-normal">AI Fix</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Fix spelling and grammar with AI</p>
      </TooltipContent>
    </Tooltip>
  );
}
