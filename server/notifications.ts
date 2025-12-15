import type { TaskReminder } from "@shared/schema";

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationService {
  sendEmail(to: string, subject: string, body: string): Promise<NotificationResult>;
  sendSms(to: string, message: string): Promise<NotificationResult>;
  sendWhatsApp(to: string, message: string): Promise<NotificationResult>;
}

class NotificationServicePlaceholder implements NotificationService {
  async sendEmail(to: string, subject: string, body: string): Promise<NotificationResult> {
    console.log(`[EMAIL PLACEHOLDER] To: ${to}, Subject: ${subject}, Body: ${body}`);
    return { success: true, messageId: `email_${Date.now()}` };
  }

  async sendSms(to: string, message: string): Promise<NotificationResult> {
    console.log(`[SMS PLACEHOLDER] To: ${to}, Message: ${message}`);
    return { success: true, messageId: `sms_${Date.now()}` };
  }

  async sendWhatsApp(to: string, message: string): Promise<NotificationResult> {
    console.log(`[WHATSAPP PLACEHOLDER] To: ${to}, Message: ${message}`);
    return { success: true, messageId: `whatsapp_${Date.now()}` };
  }
}

export const notificationService = new NotificationServicePlaceholder();

export async function processReminder(reminder: TaskReminder): Promise<NotificationResult> {
  const message = reminder.message || "You have a task reminder";
  
  switch (reminder.channel) {
    case "email":
      if (!reminder.recipientEmail) {
        return { success: false, error: "No recipient email provided" };
      }
      return notificationService.sendEmail(
        reminder.recipientEmail,
        "Task Reminder",
        message
      );
    
    case "sms":
      if (!reminder.recipientPhone) {
        return { success: false, error: "No recipient phone provided" };
      }
      return notificationService.sendSms(reminder.recipientPhone, message);
    
    case "whatsapp":
      if (!reminder.recipientPhone) {
        return { success: false, error: "No recipient phone provided" };
      }
      return notificationService.sendWhatsApp(reminder.recipientPhone, message);
    
    default:
      return { success: false, error: `Unknown channel: ${reminder.channel}` };
  }
}
