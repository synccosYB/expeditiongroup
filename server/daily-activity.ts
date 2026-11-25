import type { RequestHandler } from "express";
import type { IStorage } from "./storage";

type ActivityStorage = Pick<IStorage,
  | "getUser" | "getTimeEntriesForDateRange" | "getTimeLogsForDateRange"
  | "getNotesCreatedForDateRange" | "getDocumentsProcessedForDateRange"
  | "getTasksCompletedForDateRange" | "getAuditLogsForDateRange"
  | "getProject" | "getTask"
>;

export function createDailyActivityHandler(storage: ActivityStorage): RequestHandler {
  return async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const dateParam = req.query.date as string;
      if (typeof dateParam !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ message: "Valid date parameter required (YYYY-MM-DD)" });
      }

      // Preserve the personal scope for older callers; the admin dialog explicitly
      // requests all users so its time totals match the Time Logs page.
      const scope = req.query.scope ?? "mine";
      if (scope !== "all" && scope !== "mine") {
        return res.status(400).json({ message: "Activity scope must be all or mine" });
      }
      const userId = scope === "all" ? undefined : req.session.userId!;
      const [year, month, day] = dateParam.split('-').map(Number);
      const timeStartOfDay = new Date(`${dateParam}T00:00:00.000Z`);
      if (!Number.isFinite(timeStartOfDay.getTime()) || timeStartOfDay.toISOString().slice(0, 10) !== dateParam) {
        return res.status(400).json({ message: "Valid calendar date required" });
      }
      const timeEndOfDay = new Date(timeStartOfDay.getTime() + 86_400_000 - 1);
      // Time records use calendar dates (the ISO date shown by Time Logs), whereas
      // event timestamps use the application's local day, including DST changes.
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

      // Gather activity data from various sources
      const [timeEntries, timeLogs, notesCreated, documentsProcessed, tasksCompleted, auditLogEntries] = await Promise.all([
        storage.getTimeEntriesForDateRange(userId, timeStartOfDay, timeEndOfDay),
        storage.getTimeLogsForDateRange(userId, timeStartOfDay, timeEndOfDay),
        storage.getNotesCreatedForDateRange(userId, startOfDay, endOfDay),
        storage.getDocumentsProcessedForDateRange(userId, startOfDay, endOfDay),
        storage.getTasksCompletedForDateRange(userId, startOfDay, endOfDay),
        storage.getAuditLogsForDateRange(userId, startOfDay, endOfDay),
      ]);

      // Calculate total hours worked
      let totalMinutes = 0;
      timeEntries.forEach((entry: any) => {
        totalMinutes += entry.totalMinutes || 0;
      });
      timeLogs.forEach((log: any) => {
        const hours = parseFloat(log.totalHours || "0");
        totalMinutes += hours * 60;
      });
      const hoursWorked = totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : "";

      // Generate summary
      const summaryParts: string[] = [];
      if (timeEntries.length > 0 || timeLogs.length > 0) {
        summaryParts.push(`Logged ${(timeEntries.length + timeLogs.length)} time entries`);
      }
      if (tasksCompleted.length > 0) {
        summaryParts.push(`Completed ${tasksCompleted.length} tasks`);
      }
      if (documentsProcessed.length > 0) {
        summaryParts.push(`Processed ${documentsProcessed.length} documents`);
      }
      if (notesCreated.length > 0) {
        summaryParts.push(`Added ${notesCreated.length} notes`);
      }

      const summary = summaryParts.length > 0
        ? summaryParts.join(", ")
        : "No tracked activity for this date";

      const projectCache = new Map<number, ReturnType<ActivityStorage["getProject"]>>();
      const taskCache = new Map<number, ReturnType<ActivityStorage["getTask"]>>();
      const getProject = (id: number) => {
        if (!projectCache.has(id)) projectCache.set(id, storage.getProject(id));
        return projectCache.get(id)!;
      };
      const getTask = (id: number) => {
        if (!taskCache.has(id)) taskCache.set(id, storage.getTask(id));
        return taskCache.get(id)!;
      };

      // Generate detailed breakdown
      const detailLines: string[] = [`Activity scope: ${scope === "all" ? "All users" : "My activity"}`, ""];

      // Time entries details
      if (timeEntries.length > 0) {
        detailLines.push("TIME ENTRIES:");
        for (const entry of timeEntries) {
          const task = await getTask(entry.taskId);
          const project = await getProject(entry.projectId);
          const minutes = entry.totalMinutes || 0;
          const hrs = Math.floor(minutes / 60);
          const mins = minutes % 60;
          const duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          detailLines.push(`• ${project?.name || "Unknown Project"} - ${task?.title || "Task"}: ${duration}${entry.notes ? ` (${entry.notes})` : ""}`);
        }
      }

      // Time logs details (legacy)
      if (timeLogs.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("TIME LOGS:");
        for (const log of timeLogs) {
          const project = await getProject(log.projectId);
          detailLines.push(`• ${project?.name || "Unknown Project"}: ${log.taskDescription} (${log.totalHours}h)`);
        }
      }

      // Tasks completed
      if (tasksCompleted.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("TASKS COMPLETED:");
        for (const task of tasksCompleted) {
          const project = await getProject(task.projectId);
          detailLines.push(`• ${project?.name || "Unknown"}: ${task.title}`);
        }
      }

      // Documents processed
      if (documentsProcessed.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("DOCUMENTS PROCESSED:");
        for (const doc of documentsProcessed) {
          const project = doc.projectId === null ? undefined : await getProject(doc.projectId);
          const status = doc.documentStatus || "uploaded";
          detailLines.push(`• ${project?.name || "Unknown"}: ${doc.fileName} (${status})`);
        }
      }

      // Notes added
      if (notesCreated.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("NOTES ADDED:");
        for (const note of notesCreated) {
          const preview = note.content.substring(0, 60) + (note.content.length > 60 ? "..." : "");
          detailLines.push(`• ${preview}`);
        }
      }

      // Key actions from audit log
      const significantActions = auditLogEntries.filter((log: any) =>
        ["create", "update", "upload", "status_change", "document_accepted", "document_rejected"].includes(log.action)
      );
      if (significantActions.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("KEY ACTIONS:");
        for (const action of significantActions.slice(0, 10)) {
          if (action.description) {
            detailLines.push(`• ${action.description}`);
          }
        }
      }

      const details = detailLines.join("\n");

      res.json({
        scope,
        summary: scope === "all" ? `All users: ${summary}` : summary,
        details,
        hoursWorked,
        stats: {
          timeEntriesCount: timeEntries.length + timeLogs.length,
          tasksCompletedCount: tasksCompleted.length,
          documentsProcessedCount: documentsProcessed.length,
          notesCreatedCount: notesCreated.length,
          totalMinutes,
        },
      });
    } catch (error) {
      console.error("Error generating daily activity:", error);
      res.status(500).json({ message: "Failed to generate daily activity" });
    }
  };
}
