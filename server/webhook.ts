const SYNKDEX_WEBHOOK_URL = process.env.SYNKDEX_WEBHOOK_URL || "https://synkdex.com/api/webhooks/synkdex/1";
const SYNKDEX_API_KEY = process.env.SYNKDEX_API_KEY || "";

export type WebhookEventType =
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.deleted"
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "task.completed"
  | "invoice.created"
  | "invoice.updated"
  | "invoice.paid"
  | "proposal.created"
  | "proposal.updated"
  | "proposal.accepted"
  | "reminder.created"
  | "reminder.updated"
  | "client.created"
  | "client.updated"
  | "document.uploaded"
  | "time_entry.created"
  | "expense.created"
  | "payment.received";

interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: Record<string, any>;
  actor?: {
    id: string;
    email?: string;
    name?: string;
  };
}

export async function sendWebhook(
  event: WebhookEventType,
  data: Record<string, any>,
  actor?: { id: string; email?: string; name?: string }
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    actor,
  };

  try {
    const response = await fetch(SYNKDEX_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": SYNKDEX_API_KEY,
        "X-Webhook-Event": event,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    console.log(`[Webhook] ${event} -> ${response.status}`);
  } catch (error: any) {
    console.error(`[Webhook] Failed to send ${event}:`, error?.message || error);
  }
}
