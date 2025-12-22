import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { z, ZodError } from "zod";
import { ObjectStorageService, ObjectNotFoundError, objectStorageService } from "./objectStorage";
import { ObjectPermission, setObjectAclPolicy } from "./objectAcl";
import {
  insertClientSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertNoteSchema,
  insertTimeLogSchema,
  insertTimeEntrySchema,
  insertAssociateSchema,
  insertProjectAssociateSchema,
  insertFolderSchema,
  insertDocumentSchema,
  insertChecklistTemplateSchema,
  insertChecklistInstanceSchema,
  insertNewsletterSubscriberSchema,
  insertTaskReminderSchema,
  insertInvoiceSchema,
  insertInvoiceItemSchema,
} from "@shared/schema";

const updateClientSchema = insertClientSchema.partial();
const updateProjectSchema = insertProjectSchema.partial();
const updateTaskSchema = insertTaskSchema.partial();
const updateAssociateSchema = insertAssociateSchema.partial();
const updateTimeEntrySchema = insertTimeEntrySchema.partial();
const updateFolderSchema = insertFolderSchema.partial();
const updateDocumentSchema = insertDocumentSchema.partial();
const updateChecklistTemplateSchema = insertChecklistTemplateSchema.partial();
const updateChecklistInstanceSchema = insertChecklistInstanceSchema.partial();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/dashboard/stats", isAuthenticated, async (req: Request, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const stats = await storage.getDashboardStats(startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const client = await storage.getClient(parseInt(req.params.id));
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertClientSchema.parse(req.body);
      const client = await storage.createClient(parsed);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateClientSchema.parse(req.body);
      const client = await storage.updateClient(parseInt(req.params.id), parsed);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteClient(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Get projects by client ID
  app.get("/api/clients/:id/projects", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const projects = await storage.getProjectsByClientId(parseInt(req.params.id));
      res.json(projects);
    } catch (error) {
      console.error("Error fetching client projects:", error);
      res.status(500).json({ message: "Failed to fetch client projects" });
    }
  });

  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Projects by status - must be before /api/projects/:id to avoid route conflict
  app.get("/api/projects/by-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const statusCounts = await storage.getProjectsByStatus();
      res.json(statusCounts);
    } catch (error) {
      console.error("Error fetching projects by status:", error);
      res.status(500).json({ message: "Failed to fetch projects by status" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (user?.role !== "admin" && user?.clientId !== project.clientId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(parsed);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateProjectSchema.parse(req.body);
      const project = await storage.updateProject(parseInt(req.params.id), parsed);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteProject(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.get("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(parsed);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateTaskSchema.parse(req.body);
      const task = await storage.updateTask(parseInt(req.params.id), parsed);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteTask(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.post("/api/notes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const parsed = insertNoteSchema.parse({ ...req.body, userId });
      const note = await storage.createNote(parsed);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updateNoteSchema = z.object({
        content: z.string().optional(),
        isVisibleToClient: z.boolean().optional(),
      });
      const parsed = updateNoteSchema.parse(req.body);
      const note = await storage.updateNote(parseInt(req.params.id), parsed);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await storage.deleteNote(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  app.get("/api/time-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const timeLogs = await storage.getTimeLogs();
      res.json(timeLogs);
    } catch (error) {
      console.error("Error fetching time logs:", error);
      res.status(500).json({ message: "Failed to fetch time logs" });
    }
  });

  app.post("/api/time-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const userId = req.session.userId!;
      const parsed = insertTimeLogSchema.parse({ ...req.body, userId });
      const timeLog = await storage.createTimeLog(parsed);
      res.status(201).json(timeLog);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating time log:", error);
      res.status(500).json({ message: "Failed to create time log" });
    }
  });

  app.patch("/api/time-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updateTimeLogSchema = insertTimeLogSchema.partial();
      const parsed = updateTimeLogSchema.parse(req.body);
      const timeLog = await storage.updateTimeLog(parseInt(req.params.id), parsed);
      if (!timeLog) {
        return res.status(404).json({ message: "Time log not found" });
      }
      res.json(timeLog);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating time log:", error);
      res.status(500).json({ message: "Failed to update time log" });
    }
  });

  app.delete("/api/time-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteTimeLog(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Time log not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time log:", error);
      res.status(500).json({ message: "Failed to delete time log" });
    }
  });

  app.get("/api/associates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const associates = await storage.getAssociates();
      res.json(associates);
    } catch (error) {
      console.error("Error fetching associates:", error);
      res.status(500).json({ message: "Failed to fetch associates" });
    }
  });

  app.get("/api/associates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const associate = await storage.getAssociate(parseInt(req.params.id));
      if (!associate) {
        return res.status(404).json({ message: "Associate not found" });
      }
      res.json(associate);
    } catch (error) {
      console.error("Error fetching associate:", error);
      res.status(500).json({ message: "Failed to fetch associate" });
    }
  });

  app.post("/api/associates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertAssociateSchema.parse(req.body);
      const associate = await storage.createAssociate(parsed);
      res.status(201).json(associate);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating associate:", error);
      res.status(500).json({ message: "Failed to create associate" });
    }
  });

  app.patch("/api/associates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateAssociateSchema.parse(req.body);
      const associate = await storage.updateAssociate(parseInt(req.params.id), parsed);
      if (!associate) {
        return res.status(404).json({ message: "Associate not found" });
      }
      res.json(associate);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating associate:", error);
      res.status(500).json({ message: "Failed to update associate" });
    }
  });

  app.delete("/api/associates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteAssociate(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Associate not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting associate:", error);
      res.status(500).json({ message: "Failed to delete associate" });
    }
  });

  app.get("/api/client/projects", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const projects = await storage.getProjectsByClientId(user.clientId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching client projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/client/projects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project || project.clientId !== user.clientId) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching client project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Time Entries
  app.get("/api/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const timeEntries = await storage.getTimeEntries();
      res.json(timeEntries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.get("/api/tasks/:taskId/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const timeEntries = await storage.getTimeEntriesByTaskId(parseInt(req.params.taskId));
      res.json(timeEntries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.post("/api/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const userId = req.session.userId!;
      const parsed = insertTimeEntrySchema.parse({ ...req.body, userId });
      const timeEntry = await storage.createTimeEntry(parsed);
      res.status(201).json(timeEntry);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating time entry:", error);
      res.status(500).json({ message: "Failed to create time entry" });
    }
  });

  app.patch("/api/time-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateTimeEntrySchema.parse(req.body);
      const timeEntry = await storage.updateTimeEntry(parseInt(req.params.id), parsed);
      if (!timeEntry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.json(timeEntry);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating time entry:", error);
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteTimeEntry(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time entry:", error);
      res.status(500).json({ message: "Failed to delete time entry" });
    }
  });

  // Folders
  app.get("/api/projects/:projectId/folders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const folders = await storage.getFoldersByProjectId(parseInt(req.params.projectId));
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  app.post("/api/projects/:projectId/folders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertFolderSchema.parse({ ...req.body, projectId: parseInt(req.params.projectId) });
      const folder = await storage.createFolder(parsed);
      res.status(201).json(folder);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating folder:", error);
      res.status(500).json({ message: "Failed to create folder" });
    }
  });

  app.patch("/api/folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateFolderSchema.parse(req.body);
      const folder = await storage.updateFolder(parseInt(req.params.id), parsed);
      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.json(folder);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating folder:", error);
      res.status(500).json({ message: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteFolder(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Folder not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  // Documents
  app.get("/api/projects/:projectId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const documents = await storage.getDocumentsByProjectId(parseInt(req.params.projectId));
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/folders/:folderId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const documents = await storage.getDocumentsByFolderId(parseInt(req.params.folderId));
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/projects/:projectId/documents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const userId = req.session.userId!;
      const parsed = insertDocumentSchema.parse({ ...req.body, projectId: parseInt(req.params.projectId), uploadedByUserId: userId });
      const document = await storage.createDocument(parsed);
      
      // Set ACL policy on the uploaded object so it can be accessed
      if (document.storagePath) {
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(document.storagePath);
          await setObjectAclPolicy(objectFile, {
            owner: userId,
            visibility: document.isVisibleToClient ? "public" : "private",
          });
        } catch (aclError) {
          console.error("Error setting ACL policy on document:", aclError);
          // Don't fail the request - document is created, just ACL failed
        }
      }
      
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating document:", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.patch("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateDocumentSchema.parse(req.body);
      const document = await storage.updateDocument(parseInt(req.params.id), parsed);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteDocument(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Project Associates
  app.get("/api/projects/:projectId/associates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const associates = await storage.getProjectAssociates(parseInt(req.params.projectId));
      res.json(associates);
    } catch (error) {
      console.error("Error fetching project associates:", error);
      res.status(500).json({ message: "Failed to fetch project associates" });
    }
  });

  app.post("/api/projects/:projectId/associates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertProjectAssociateSchema.parse({ ...req.body, projectId: parseInt(req.params.projectId) });
      const projectAssociate = await storage.addProjectAssociate(parsed);
      res.status(201).json(projectAssociate);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error adding project associate:", error);
      res.status(500).json({ message: "Failed to add project associate" });
    }
  });

  app.delete("/api/projects/:projectId/associates/:associateId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.removeProjectAssociate(parseInt(req.params.projectId), parseInt(req.params.associateId));
      if (!deleted) {
        return res.status(404).json({ message: "Project associate not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error removing project associate:", error);
      res.status(500).json({ message: "Failed to remove project associate" });
    }
  });

  // Checklist Templates
  app.get("/api/checklist-templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const templates = await storage.getChecklistTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching checklist templates:", error);
      res.status(500).json({ message: "Failed to fetch checklist templates" });
    }
  });

  app.get("/api/checklist-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const template = await storage.getChecklistTemplate(parseInt(req.params.id));
      if (!template) {
        return res.status(404).json({ message: "Checklist template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching checklist template:", error);
      res.status(500).json({ message: "Failed to fetch checklist template" });
    }
  });

  app.post("/api/checklist-templates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertChecklistTemplateSchema.parse(req.body);
      const template = await storage.createChecklistTemplate(parsed);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating checklist template:", error);
      res.status(500).json({ message: "Failed to create checklist template" });
    }
  });

  app.patch("/api/checklist-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateChecklistTemplateSchema.parse(req.body);
      const template = await storage.updateChecklistTemplate(parseInt(req.params.id), parsed);
      if (!template) {
        return res.status(404).json({ message: "Checklist template not found" });
      }
      res.json(template);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating checklist template:", error);
      res.status(500).json({ message: "Failed to update checklist template" });
    }
  });

  app.delete("/api/checklist-templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteChecklistTemplate(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Checklist template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting checklist template:", error);
      res.status(500).json({ message: "Failed to delete checklist template" });
    }
  });

  // Checklist Instances
  app.get("/api/projects/:projectId/checklists", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const checklists = await storage.getChecklistInstancesByProjectId(parseInt(req.params.projectId));
      res.json(checklists);
    } catch (error) {
      console.error("Error fetching checklists:", error);
      res.status(500).json({ message: "Failed to fetch checklists" });
    }
  });

  app.post("/api/projects/:projectId/checklists", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertChecklistInstanceSchema.parse({ ...req.body, projectId: parseInt(req.params.projectId) });
      const checklist = await storage.createChecklistInstance(parsed);
      res.status(201).json(checklist);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating checklist:", error);
      res.status(500).json({ message: "Failed to create checklist" });
    }
  });

  app.patch("/api/checklists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateChecklistInstanceSchema.parse(req.body);
      const checklist = await storage.updateChecklistInstance(parseInt(req.params.id), parsed);
      if (!checklist) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.json(checklist);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating checklist:", error);
      res.status(500).json({ message: "Failed to update checklist" });
    }
  });

  app.delete("/api/checklists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteChecklistInstance(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Checklist not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting checklist:", error);
      res.status(500).json({ message: "Failed to delete checklist" });
    }
  });

  // Global Search
  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json({ clients: [], projects: [], associates: [] });
      }
      const results = await storage.globalSearch(query);
      res.json(results);
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Overdue tasks
  app.get("/api/tasks/overdue", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const tasks = await storage.getOverdueTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching overdue tasks:", error);
      res.status(500).json({ message: "Failed to fetch overdue tasks" });
    }
  });

  // Associate with relations
  app.get("/api/associates/:id/full", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const associate = await storage.getAssociateWithRelations(parseInt(req.params.id));
      if (!associate) {
        return res.status(404).json({ message: "Associate not found" });
      }
      res.json(associate);
    } catch (error) {
      console.error("Error fetching associate:", error);
      res.status(500).json({ message: "Failed to fetch associate" });
    }
  });

  // Admin users list
  app.get("/api/users/admins", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const admins = await storage.getAdminUsers();
      res.json(admins);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  // All users list (admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create user (admin only)
  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser?.role !== "admin" && currentUser?.role !== "super_admin") {
        return res.status(403).json({ message: "Only admins can create users" });
      }

      const createUserSchema = z.object({
        email: z.string().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.enum(["admin", "client"]),
      });
      const parsed = createUserSchema.parse(req.body);

      // Check if email already exists
      const existingUser = await storage.getUserByEmail(parsed.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Hash password
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(parsed.password, 10);

      const user = await storage.createUser({
        email: parsed.email,
        passwordHash,
        firstName: parsed.firstName || null,
        lastName: parsed.lastName || null,
        role: parsed.role,
      });

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = await storage.getUser(req.session.userId!);
      if (currentUser?.role !== "admin" && currentUser?.role !== "super_admin") {
        return res.status(403).json({ message: "Only admins can change roles" });
      }

      const roleSchema = z.object({
        role: z.enum(["admin", "client"]),
      });
      const parsed = roleSchema.parse(req.body);

      const updatedUser = await storage.updateUserRole(req.params.id, parsed.role);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid role" });
      }
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Client Portal - Add note to project
  app.post("/api/client/projects/:id/notes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project || project.clientId !== user.clientId) {
        return res.status(404).json({ message: "Project not found" });
      }
      const parsed = insertNoteSchema.parse({
        ...req.body,
        projectId: parseInt(req.params.id),
        userId: req.session.userId!,
      });
      const note = await storage.createNote(parsed);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating client note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  // Client Portal - Get documents visible to client
  app.get("/api/client/projects/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project || project.clientId !== user.clientId) {
        return res.status(404).json({ message: "Project not found" });
      }
      const documents = await storage.getDocumentsByProjectId(parseInt(req.params.id));
      const visibleDocs = documents.filter(doc => doc.isVisibleToClient);
      res.json(visibleDocs);
    } catch (error) {
      console.error("Error fetching client documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Client Portal - Get tasks requiring client upload
  app.get("/api/client/todos", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const projects = await storage.getProjectsByClientId(user.clientId);
      const allTasks: any[] = [];
      for (const project of projects) {
        const tasks = await storage.getTasksByProjectId(project.id);
        const clientTasks = tasks.filter(t => t.requiresClientUpload && t.status !== "done");
        clientTasks.forEach(t => allTasks.push({ ...t, project }));
      }
      res.json(allTasks);
    } catch (error) {
      console.error("Error fetching client todos:", error);
      res.status(500).json({ message: "Failed to fetch client todos" });
    }
  });

  // Newsletter subscription (public endpoint)
  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const data = insertNewsletterSubscriberSchema.parse(req.body);
      const subscriber = await storage.addNewsletterSubscriber(data.email);
      res.status(201).json({ message: "Successfully subscribed!", subscriber });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      if ((error as any)?.code === "23505") {
        return res.status(400).json({ message: "This email is already subscribed" });
      }
      console.error("Error subscribing to newsletter:", error);
      res.status(500).json({ message: "Failed to subscribe" });
    }
  });

  // Task Reminders
  app.get("/api/reminders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const reminders = await storage.getAllReminders();
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching all reminders:", error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  app.patch("/api/reminders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { status, actionNote } = req.body;
      const updateData: any = { status };
      if (actionNote !== undefined) updateData.actionNote = actionNote;
      if (status === 'done' || status === 'postponed') updateData.actionAt = new Date();
      
      const updated = await storage.updateTaskReminder(parseInt(req.params.id), updateData);
      if (!updated) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating reminder:", error);
      res.status(500).json({ message: "Failed to update reminder" });
    }
  });

  app.get("/api/tasks/:taskId/reminders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const reminders = await storage.getTaskReminders(parseInt(req.params.taskId));
      res.json(reminders);
    } catch (error) {
      console.error("Error fetching task reminders:", error);
      res.status(500).json({ message: "Failed to fetch task reminders" });
    }
  });

  app.post("/api/tasks/:taskId/reminders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertTaskReminderSchema.parse({
        ...req.body,
        taskId: parseInt(req.params.taskId),
      });
      const reminder = await storage.createTaskReminder(parsed);
      res.status(201).json(reminder);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating task reminder:", error);
      res.status(500).json({ message: "Failed to create task reminder" });
    }
  });

  app.delete("/api/reminders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteTaskReminder(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task reminder:", error);
      res.status(500).json({ message: "Failed to delete task reminder" });
    }
  });

  // Storage Usage
  const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024; // 1GB

  app.get("/api/storage/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId!;
      const usedBytes = await storage.getUserStorageUsage(userId);
      res.json({
        usedBytes,
        limitBytes: STORAGE_LIMIT_BYTES,
        remainingBytes: Math.max(0, STORAGE_LIMIT_BYTES - usedBytes),
      });
    } catch (error) {
      console.error("Error fetching storage usage:", error);
      res.status(500).json({ message: "Failed to fetch storage usage" });
    }
  });

  // Object Storage - File Upload
  const objectStorageService = new ObjectStorageService();

  // Get presigned URL for document upload with folder path based on project/client/category
  app.post("/api/projects/:projectId/documents/upload", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const projectId = parseInt(req.params.projectId);
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const client = await storage.getClient(project.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const { category = "other", fileName, fileSize } = req.body;

      // Check storage limit
      const currentUsage = await storage.getUserStorageUsage(req.session.userId!);
      const fileSizeNum = typeof fileSize === 'number' ? fileSize : 0;
      if (currentUsage + fileSizeNum > STORAGE_LIMIT_BYTES) {
        return res.status(413).json({
          message: "Storage limit exceeded",
          code: "STORAGE_LIMIT_EXCEEDED",
          usedBytes: currentUsage,
          limitBytes: STORAGE_LIMIT_BYTES,
        });
      }

      // Sanitize names for folder path
      const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase() || "unknown";
      const clientSlug = `${client.id}-${sanitize(client.name)}`;
      const projectSlug = `${project.id}-${sanitize(project.name)}`;
      
      // Build folder path: clients/<clientSlug>/projects/<projectSlug>/<category>/
      const folderPath = `clients/${clientSlug}/projects/${projectSlug}/${category}`;

      const uploadUrl = await objectStorageService.getObjectEntityUploadURL(folderPath);
      
      // Normalize the upload URL to get the permanent object path (already prefixed with /objects/)
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

      res.json({
        uploadUrl,
        objectPath,
        folderPath,
        method: "PUT" as const,
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Serve uploaded objects (with ACL check)
  app.get("/objects/*", async (req: any, res) => {
    try {
      const objectPath = req.path;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Check if user is authenticated
      const userId = req.session?.userId?.toString();
      
      // Admins can always access all objects
      if (userId) {
        const user = await storage.getUser(userId);
        if (user?.role === "admin") {
          await objectStorageService.downloadObject(objectFile, res);
          return;
        }
      }
      
      // For non-admin users, check ACL
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Error serving object:", error);
      res.status(500).json({ message: "Failed to serve object" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/next-number", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const nextNumber = await storage.getNextInvoiceNumber();
      res.json({ invoiceNumber: nextNumber });
    } catch (error) {
      console.error("Error generating invoice number:", error);
      res.status(500).json({ message: "Failed to generate invoice number" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const invoice = await storage.getInvoice(parseInt(req.params.id));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.get("/api/projects/:projectId/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const invoices = await storage.getInvoicesByProjectId(parseInt(req.params.projectId));
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching project invoices:", error);
      res.status(500).json({ message: "Failed to fetch project invoices" });
    }
  });

  app.get("/api/projects/:projectId/billed-items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const billedItems = await storage.getBilledItemIds(parseInt(req.params.projectId));
      res.json(billedItems);
    } catch (error) {
      console.error("Error fetching billed items:", error);
      res.status(500).json({ message: "Failed to fetch billed items" });
    }
  });

  app.get("/api/clients/:clientId/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const invoices = await storage.getInvoicesByClientId(parseInt(req.params.clientId));
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch client invoices" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { items, ...invoiceData } = req.body;
      const parsedInvoice = insertInvoiceSchema.parse(invoiceData);
      const parsedItems = z.array(insertInvoiceItemSchema.omit({ invoiceId: true })).parse(items || []);
      
      const invoice = await storage.createInvoice(parsedInvoice, parsedItems as any);
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updateSchema = z.object({
        status: z.enum(["draft", "sent", "paid", "cancelled"]).optional(),
        notes: z.string().optional(),
        dueDate: z.string().optional(),
        paidAt: z.string().optional(),
      });
      
      const parsed = updateSchema.parse(req.body);
      const updateData: any = { ...parsed };
      if (parsed.dueDate) updateData.dueDate = new Date(parsed.dueDate);
      if (parsed.paidAt) updateData.paidAt = new Date(parsed.paidAt);
      
      const invoice = await storage.updateInvoice(parseInt(req.params.id), updateData);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const deleted = await storage.deleteInvoice(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  return httpServer;
}
