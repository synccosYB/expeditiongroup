import type { Express, Request } from "express";
import type { Server } from "http";
import { storage, db } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { z, ZodError } from "zod";
import { ObjectStorageService, ObjectNotFoundError, objectStorageService } from "./objectStorage";
import { ObjectPermission, setObjectAclPolicy } from "./objectAcl";
import { eq } from "drizzle-orm";
import { clients, projects, intakeApplications } from "@shared/schema";
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
  insertDailyActivityLogSchema,
  insertClientPortalSettingsSchema,
  insertProjectMilestoneSchema,
  insertDocumentRequestSchema,
  insertAuditLogSchema,
  insertIntakeApplicationSchema,
  insertServiceSchema,
  insertProposalSchema,
  insertProposalItemSchema,
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
const updateServiceSchema = insertServiceSchema.partial();
const updateProposalSchema = insertProposalSchema.partial();
const updateProposalItemSchema = insertProposalItemSchema.partial();

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
      console.log("[DEBUG] Updating project:", req.params.id, "with data:", JSON.stringify(parsed));
      const project = await storage.updateProject(parseInt(req.params.id), parsed);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      console.log("[DEBUG] Project updated, isVisibleToClient:", project.isVisibleToClient);
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
      
      const counts = await storage.getProjectRelatedDataCounts(parseInt(req.params.id));
      if (!counts) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const hasData = counts.documents > 0 || counts.notes > 0 || counts.tasks > 0 || counts.timeLogs > 0 || counts.timeEntries > 0;
      if (hasData) {
        return res.status(400).json({ 
          message: "Cannot delete project with attached data. Please delete all documents, notes, tasks, and time logs first, then archive the project.",
          counts 
        });
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

  app.get("/api/projects/:id/related-data-counts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const counts = await storage.getProjectRelatedDataCounts(parseInt(req.params.id));
      if (!counts) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(counts);
    } catch (error) {
      console.error("Error fetching project related data counts:", error);
      res.status(500).json({ message: "Failed to fetch project related data counts" });
    }
  });

  app.post("/api/projects/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const result = await storage.archiveProject(parseInt(req.params.id));
      if (!result.success) {
        const statusCode = result.error === "Project not found" ? 404 : 400;
        return res.status(statusCode).json({ message: result.error });
      }
      res.json(result.project);
    } catch (error) {
      console.error("Error archiving project:", error);
      res.status(500).json({ message: "Failed to archive project" });
    }
  });

  app.delete("/api/projects/:id/permanent", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const result = await storage.permanentlyDeleteProject(parseInt(req.params.id));
      if (!result.success) {
        const statusCode = result.error === "Project not found" ? 404 : 400;
        return res.status(statusCode).json({ message: result.error });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error permanently deleting project:", error);
      res.status(500).json({ message: "Failed to permanently delete project" });
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

  app.get("/api/client/portal-settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      let settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings) {
        settings = await storage.upsertClientPortalSettings({ clientId: user.clientId });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching client portal settings:", error);
      res.status(500).json({ message: "Failed to fetch portal settings" });
    }
  });

  app.get("/api/client/projects", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      console.log("[DEBUG] Client projects - user:", user?.email, "clientId:", user?.clientId);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const settings = await storage.getClientPortalSettings(user.clientId);
      console.log("[DEBUG] Portal settings:", settings);
      if (!settings?.showProjects) {
        console.log("[DEBUG] showProjects is false, returning empty array");
        return res.json([]);
      }
      const allProjects = await storage.getProjectsByClientId(user.clientId);
      console.log("[DEBUG] All projects for client:", allProjects.length, allProjects.map(p => ({ id: p.id, name: p.name, visible: p.isVisibleToClient })));
      const visibleProjects = allProjects.filter(p => p.isVisibleToClient);
      console.log("[DEBUG] Visible projects:", visibleProjects.length);
      
      const projectsWithRelations = await Promise.all(
        visibleProjects.map(async (project) => {
          const fullProject = await storage.getProject(project.id);
          return {
            ...project,
            tasks: fullProject?.tasks || [],
            notes: fullProject?.notes || [],
          };
        })
      );
      
      console.log("[DEBUG] Returning projects with relations:", projectsWithRelations.length);
      res.json(projectsWithRelations);
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
      if (!project || project.clientId !== user.clientId || !project.isVisibleToClient) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching client project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.get("/api/client/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings?.showInvoices) {
        return res.json([]);
      }
      const allInvoices = await storage.getInvoicesByClientId(user.clientId);
      const visibleInvoices = allInvoices.filter(inv => inv.isVisibleToClient);
      res.json(visibleInvoices);
    } catch (error) {
      console.error("Error fetching client invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Client Portal - Get single invoice details
  app.get("/api/client/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      const settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings?.showInvoices) {
        return res.status(403).json({ message: "Invoice access is not enabled" });
      }
      const invoiceId = parseInt(req.params.id);
      // getInvoice returns invoice with project, client, and items included
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice || invoice.clientId !== user.clientId || !invoice.isVisibleToClient) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching client invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
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
      const settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings?.showDocuments) {
        return res.json([]);
      }
      const project = await storage.getProject(parseInt(req.params.id));
      if (!project || project.clientId !== user.clientId || !project.isVisibleToClient) {
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

  // Client Portal - Upload document
  app.post("/api/client/projects/:id/documents/upload", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      
      const settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings?.allowDocumentUpload) {
        return res.status(403).json({ message: "Document upload is not enabled for your account" });
      }
      
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project || project.clientId !== user.clientId || !project.isVisibleToClient) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const client = await storage.getClient(user.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const { category = "client_upload", fileName, fileSize } = req.body;

      // Sanitize names for folder path
      const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase() || "unknown";
      const clientSlug = `${client.id}-${sanitize(client.name)}`;
      const projectSlug = `${project.id}-${sanitize(project.name)}`;
      
      // Build folder path for client uploads
      const folderPath = `clients/${clientSlug}/projects/${projectSlug}/client_uploads`;

      const uploadUrl = await objectStorageService.getObjectEntityUploadURL(folderPath);
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);

      res.json({
        uploadUrl,
        objectPath,
        folderPath,
      });
    } catch (error) {
      console.error("Error generating client upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // Client Portal - Create document record after upload
  app.post("/api/client/projects/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }
      
      const settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings?.allowDocumentUpload) {
        return res.status(403).json({ message: "Document upload is not enabled for your account" });
      }
      
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project || project.clientId !== user.clientId || !project.isVisibleToClient) {
        return res.status(404).json({ message: "Project not found" });
      }

      const { fileName, storagePath, fileType, fileSize, category = "client_upload", notes } = req.body;

      const document = await storage.createDocument({
        projectId,
        uploadedByClientId: user.clientId,
        fileName,
        storagePath,
        fileType,
        fileSize,
        category: category as any,
        notes,
        isVisibleToClient: true, // Client uploads are visible to themselves
        documentStatus: "uploaded", // Start with uploaded status
      });

      // Log the document upload
      await storage.createAuditLog({
        clientId: user.clientId,
        action: "document_uploaded",
        entityType: "document",
        entityId: document.id,
        details: JSON.stringify({
          fileName: document.fileName,
          projectId,
        }),
        isVisibleToClient: true,
      });

      res.status(201).json(document);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating client document:", error);
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  // Admin - Create document request
  app.post("/api/projects/:projectId/document-requests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const projectId = parseInt(req.params.projectId);
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const requestSchema = z.object({
        documentType: z.string().min(1),
        description: z.string().optional(),
        isRequired: z.boolean().optional(),
        dueDate: z.string().optional(),
      });

      const parsed = requestSchema.parse(req.body);
      
      const documentRequest = await storage.createDocumentRequest({
        projectId,
        clientId: project.clientId,
        requestedByUserId: req.session.userId,
        documentType: parsed.documentType,
        description: parsed.description,
        isRequired: parsed.isRequired ?? true,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
      });

      res.status(201).json(documentRequest);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating document request:", error);
      res.status(500).json({ message: "Failed to create document request" });
    }
  });

  // Admin - Get document requests for a project
  app.get("/api/projects/:projectId/document-requests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const projectId = parseInt(req.params.projectId);
      const requests = await storage.getDocumentRequestsByProjectId(projectId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching document requests:", error);
      res.status(500).json({ message: "Failed to fetch document requests" });
    }
  });

  // Admin - Update document request
  app.patch("/api/document-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updateSchema = z.object({
        isFulfilled: z.boolean().optional(),
        fulfilledDocumentId: z.number().optional(),
      });

      const parsed = updateSchema.parse(req.body);
      const updated = await storage.updateDocumentRequest(parseInt(req.params.id), parsed);
      if (!updated) {
        return res.status(404).json({ message: "Document request not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating document request:", error);
      res.status(500).json({ message: "Failed to update document request" });
    }
  });

  // Client Portal - Get document requests
  app.get("/api/client/document-requests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const requests = await storage.getDocumentRequestsByClientId(user.clientId);
      // Only return requests for visible projects
      const settings = await storage.getClientPortalSettings(user.clientId);
      if (!settings?.showDocuments) {
        return res.json([]);
      }

      const visibleRequests = [];
      for (const req of requests) {
        const project = await storage.getProject(req.projectId);
        if (project?.isVisibleToClient) {
          visibleRequests.push(req);
        }
      }
      
      res.json(visibleRequests);
    } catch (error) {
      console.error("Error fetching client document requests:", error);
      res.status(500).json({ message: "Failed to fetch document requests" });
    }
  });

  // Admin - Review document (accept/reject)
  app.patch("/api/documents/:id/review", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const reviewSchema = z.object({
        documentStatus: z.enum(["under_review", "accepted", "rejected"]),
        rejectionReason: z.string().optional(),
      });

      const parsed = reviewSchema.parse(req.body);
      
      const updateData: any = {
        documentStatus: parsed.documentStatus,
        reviewedByUserId: req.session.userId,
        reviewedAt: new Date(),
      };

      if (parsed.documentStatus === "rejected" && parsed.rejectionReason) {
        updateData.rejectionReason = parsed.rejectionReason;
      } else {
        updateData.rejectionReason = null;
      }

      const updatedDocument = await storage.updateDocument(documentId, updateData);

      // Log the document review action
      const project = await storage.getProject(document.projectId);
      if (project) {
        await storage.createAuditLog({
          userId: req.session.userId,
          clientId: project.clientId,
          action: parsed.documentStatus === "accepted" ? "document_accepted" : 
                  parsed.documentStatus === "rejected" ? "document_rejected" : "document_reviewed",
          entityType: "document",
          entityId: documentId,
          details: JSON.stringify({
            fileName: document.fileName,
            status: parsed.documentStatus,
            rejectionReason: parsed.rejectionReason,
          }),
          isVisibleToClient: true,
        });
      }

      res.json(updatedDocument);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error reviewing document:", error);
      res.status(500).json({ message: "Failed to review document" });
    }
  });

  // Admin - Get audit logs for a client
  app.get("/api/clients/:clientId/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const clientId = parseInt(req.params.clientId);
      const logs = await storage.getAuditLogsByClientId(clientId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Admin - Get all audit logs for a user
  app.get("/api/audit-logs/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const logs = await storage.getAuditLogsByUserId(req.params.userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Client Portal - Get activity feed (visible audit logs)
  app.get("/api/client/activity", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const logs = await storage.getAuditLogsByClientId(user.clientId);
      // Filter to only show client-visible audit logs
      const visibleLogs = logs.filter(log => log.isVisibleToClient);
      res.json(visibleLogs);
    } catch (error) {
      console.error("Error fetching client activity:", error);
      res.status(500).json({ message: "Failed to fetch activity" });
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

  // Client Portal - Get dashboard stats
  app.get("/api/client/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const projects = await storage.getProjectsByClientId(user.clientId);
      // Filter to only include visible projects for client stats
      const visibleProjects = projects.filter(p => p.isVisibleToClient);
      const visibleProjectIds = visibleProjects.map(p => p.id);
      
      let allTasks: any[] = [];
      for (const projectId of visibleProjectIds) {
        const tasks = await storage.getTasksByProjectId(projectId);
        allTasks = allTasks.concat(tasks);
      }

      const invoices = await storage.getInvoicesByClientId(user.clientId);
      // Filter invoices to only those linked to visible projects
      const visibleInvoices = invoices.filter(inv => 
        !inv.projectId || visibleProjectIds.includes(inv.projectId)
      );

      const activeProjects = visibleProjects.filter(p => 
        p.status !== "completed" && p.status !== "cancelled" && p.status !== "archived"
      ).length;
      
      const pendingTasks = allTasks.filter(t => t.status !== "done").length;
      const completedTasks = allTasks.filter(t => t.status === "done").length;
      
      const unpaidInvoices = visibleInvoices.filter(i => i.status === "sent").length;
      const totalOutstanding = visibleInvoices
        .filter(i => i.status === "sent")
        .reduce((sum, inv) => sum + parseFloat(inv.total || "0"), 0);

      res.json({
        totalProjects: visibleProjects.length,
        activeProjects,
        pendingTasks,
        completedTasks,
        totalInvoices: visibleInvoices.length,
        unpaidInvoices,
        totalOutstanding,
      });
    } catch (error) {
      console.error("Error fetching client dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Client Portal - Get all tasks
  app.get("/api/client/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const projects = await storage.getProjectsByClientId(user.clientId);
      const allTasks: any[] = [];
      
      for (const project of projects) {
        if (project.isVisibleToClient) {
          const tasks = await storage.getTasksByProjectId(project.id);
          tasks.forEach(t => allTasks.push({ ...t, project }));
        }
      }
      
      res.json(allTasks);
    } catch (error) {
      console.error("Error fetching client tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Client Portal - Get projects by status
  app.get("/api/client/projects/by-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const projects = await storage.getProjectsByClientId(user.clientId);
      const visibleProjects = projects.filter(p => p.isVisibleToClient);
      
      const statusCounts = visibleProjects.reduce((acc: Record<string, number>, project) => {
        acc[project.status] = (acc[project.status] || 0) + 1;
        return acc;
      }, {});

      const result = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));

      res.json(result);
    } catch (error) {
      console.error("Error fetching client projects by status:", error);
      res.status(500).json({ message: "Failed to fetch projects by status" });
    }
  });

  // Client Portal - Get reminders
  app.get("/api/client/reminders", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const projects = await storage.getProjectsByClientId(user.clientId);
      const allReminders: any[] = [];
      
      for (const project of projects) {
        if (project.isVisibleToClient) {
          const tasks = await storage.getTasksByProjectId(project.id);
          for (const task of tasks) {
            const reminders = await storage.getTaskReminders(task.id);
            reminders.forEach((r: any) => allReminders.push({ 
              ...r, 
              task: { ...task, project } 
            }));
          }
        }
      }
      
      res.json(allReminders.sort((a, b) => 
        new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime()
      ));
    } catch (error) {
      console.error("Error fetching client reminders:", error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  // Client Portal - Get time entries
  app.get("/api/client/time-entries", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const projects = await storage.getProjectsByClientId(user.clientId);
      const allEntries: any[] = [];
      
      for (const project of projects) {
        if (project.isVisibleToClient) {
          const entries = await storage.getTimeEntriesByProjectId(project.id);
          for (const entry of entries) {
            const task = await storage.getTask(entry.taskId);
            allEntries.push({ 
              ...entry, 
              project,
              task 
            });
          }
        }
      }
      
      res.json(allEntries.sort((a, b) => 
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ));
    } catch (error) {
      console.error("Error fetching client time entries:", error);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  // Client Portal - Get associates
  app.get("/api/client/associates", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user?.clientId) {
        return res.status(403).json({ message: "No client access" });
      }

      const projects = await storage.getProjectsByClientId(user.clientId);
      const associateIds = new Set<number>();
      const associateProjects: Record<number, any[]> = {};
      
      for (const project of projects) {
        if (project.isVisibleToClient) {
          const projectAssociates = await storage.getProjectAssociates(project.id);
          for (const pa of projectAssociates) {
            associateIds.add(pa.associateId);
            if (!associateProjects[pa.associateId]) {
              associateProjects[pa.associateId] = [];
            }
            associateProjects[pa.associateId].push(project);
          }
        }
      }
      
      const associates: any[] = [];
      for (const associateId of associateIds) {
        const associate = await storage.getAssociate(associateId);
        if (associate) {
          associates.push({
            ...associate,
            projects: associateProjects[associateId] || [],
          });
        }
      }
      
      res.json(associates);
    } catch (error) {
      console.error("Error fetching client associates:", error);
      res.status(500).json({ message: "Failed to fetch associates" });
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

  // Calendar Events - Aggregates tasks and reminders for calendar view
  app.get("/api/calendar/events", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get all tasks with due dates
      const allTasks = await storage.getTasks();
      const tasksWithProjects = allTasks.filter(t => t.dueDate);

      // Get all reminders
      const allReminders = await storage.getAllReminders();

      res.json({
        tasks: tasksWithProjects,
        reminders: allReminders,
      });
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
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
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { status, actionNote, isRead, scheduledAt } = req.body;
      const updateData: any = {};
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'done' || status === 'postponed') updateData.actionAt = new Date();
      }
      if (actionNote !== undefined) updateData.actionNote = actionNote;
      if (isRead !== undefined) updateData.isRead = isRead;
      if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt);
      
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
      const fileSizeNum = typeof fileSize === 'number' ? fileSize : parseInt(fileSize as string, 10) || 0;
      console.log(`[Storage Check] User: ${req.session.userId}, Current Usage: ${currentUsage}, File Size: ${fileSizeNum}, Limit: ${STORAGE_LIMIT_BYTES}`);
      if (currentUsage + fileSizeNum > STORAGE_LIMIT_BYTES) {
        console.log(`[Storage Check] EXCEEDED - Total would be: ${currentUsage + fileSizeNum}`);
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
      const inline = req.query.inline === "true";
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Look up the document record to get the original filename
      const document = await storage.getDocumentByStoragePath(objectPath);
      console.log("[Download] Looking up document by path:", objectPath);
      console.log("[Download] Found document:", document ? { id: document.id, fileName: document.fileName, storagePath: document.storagePath } : "NOT FOUND");
      const downloadFilename = document?.fileName || undefined;
      console.log("[Download] Using filename:", downloadFilename, "inline:", inline);
      
      // Check if user is authenticated
      const userId = req.session?.userId?.toString();
      
      // Admins can always access all objects
      if (userId) {
        const user = await storage.getUser(userId);
        if (user?.role === "admin") {
          await objectStorageService.downloadObject(objectFile, res, { inline, filename: downloadFilename });
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

      await objectStorageService.downloadObject(objectFile, res, { inline, filename: downloadFilename });
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

  app.get("/api/invoices/stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const stats = await storage.getInvoiceStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching invoice stats:", error);
      res.status(500).json({ message: "Failed to fetch invoice stats" });
    }
  });

  app.get("/api/invoices/unbilled", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const unbilledEntries = await storage.getUnbilledTimeEntries();
      res.json(unbilledEntries);
    } catch (error) {
      console.error("Error fetching unbilled time entries:", error);
      res.status(500).json({ message: "Failed to fetch unbilled time entries" });
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

  // Client Portal Settings
  app.get("/api/clients/:clientId/portal-settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const clientId = parseInt(req.params.clientId);
      let settings = await storage.getClientPortalSettings(clientId);
      if (!settings) {
        settings = await storage.upsertClientPortalSettings({ clientId });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching client portal settings:", error);
      res.status(500).json({ message: "Failed to fetch client portal settings" });
    }
  });

  app.put("/api/clients/:clientId/portal-settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const clientId = parseInt(req.params.clientId);
      const updateSchema = z.object({
        showProjects: z.boolean().optional(),
        showDocuments: z.boolean().optional(),
        showInvoices: z.boolean().optional(),
        showMessages: z.boolean().optional(),
        showMilestones: z.boolean().optional(),
        showTimeline: z.boolean().optional(),
        allowDocumentUpload: z.boolean().optional(),
      });
      const parsed = updateSchema.parse(req.body);
      const settings = await storage.upsertClientPortalSettings({ clientId, ...parsed });
      res.json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating client portal settings:", error);
      res.status(500).json({ message: "Failed to update client portal settings" });
    }
  });

  // Link or create portal user for a client
  app.post("/api/clients/:clientId/portal-access", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const clientId = parseInt(req.params.clientId);
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      const portalAccessSchema = z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters").optional(),
        createNew: z.boolean().optional(),
      });

      const parsed = portalAccessSchema.parse(req.body);
      
      // Check if client already has a portal user
      const allUsers = await storage.getAllUsers();
      const existingPortalUser = allUsers.find(u => u.clientId === clientId && u.role === "client");
      if (existingPortalUser) {
        return res.status(400).json({ 
          message: "This client already has portal access. Remove the existing account first to create a new one." 
        });
      }

      const existingUser = await storage.getUserByEmail(parsed.email);

      if (existingUser) {
        // Don't allow linking admin/super_admin accounts - this would demote them
        if (existingUser.role === "admin" || existingUser.role === "super_admin") {
          return res.status(400).json({ 
            message: "Cannot link an admin account to a client. Use a different email address." 
          });
        }
        // Link existing user to this client
        if (existingUser.clientId && existingUser.clientId !== clientId) {
          return res.status(400).json({ 
            message: "This email is already linked to a different client" 
          });
        }
        const linkedUser = await storage.linkUserToClient(existingUser.id, clientId);
        return res.json({ 
          message: "Existing user linked to client",
          user: { id: linkedUser?.id, email: linkedUser?.email },
          isNew: false 
        });
      }

      // Create new user
      if (!parsed.password) {
        return res.status(400).json({ 
          message: "Password is required to create a new account" 
        });
      }

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(parsed.password, 10);
      
      const newUser = await storage.createUser({
        email: parsed.email,
        passwordHash,
        firstName: client.name.split(" ")[0] || null,
        lastName: client.name.split(" ").slice(1).join(" ") || null,
        role: "client",
        clientId,
      });

      // Ensure portal settings exist
      await storage.upsertClientPortalSettings({ clientId });

      res.status(201).json({ 
        message: "New portal account created",
        user: { id: newUser.id, email: newUser.email },
        isNew: true 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating portal access:", error);
      res.status(500).json({ message: "Failed to create portal access" });
    }
  });

  // Get portal user for a client
  app.get("/api/clients/:clientId/portal-user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const clientId = parseInt(req.params.clientId);
      const allUsers = await storage.getAllUsers();
      const portalUser = allUsers.find(u => u.clientId === clientId && u.role === "client");
      
      if (!portalUser) {
        return res.json(null);
      }

      res.json({
        id: portalUser.id,
        email: portalUser.email,
        firstName: portalUser.firstName,
        lastName: portalUser.lastName,
        createdAt: portalUser.createdAt,
      });
    } catch (error) {
      console.error("Error fetching portal user:", error);
      res.status(500).json({ message: "Failed to fetch portal user" });
    }
  });

  // Reset client portal password
  app.patch("/api/clients/:clientId/portal-password", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const clientId = parseInt(req.params.clientId);
      const allUsers = await storage.getAllUsers();
      const portalUser = allUsers.find(u => u.clientId === clientId && u.role === "client");
      
      if (!portalUser) {
        return res.status(404).json({ message: "No portal user found for this client" });
      }

      const passwordSchema = z.object({
        password: z.string().min(8, "Password must be at least 8 characters"),
      });
      const parsed = passwordSchema.parse(req.body);

      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(parsed.password, 10);
      
      await storage.updateUserPassword(portalUser.id, passwordHash);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error resetting portal password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Project Milestones
  app.get("/api/projects/:projectId/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const milestones = await storage.getMilestonesByProjectId(parseInt(req.params.projectId));
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).json({ message: "Failed to fetch milestones" });
    }
  });

  app.post("/api/projects/:projectId/milestones", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const projectId = parseInt(req.params.projectId);
      const parsed = insertProjectMilestoneSchema.parse({ ...req.body, projectId });
      const milestone = await storage.createMilestone(parsed);
      res.status(201).json(milestone);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating milestone:", error);
      res.status(500).json({ message: "Failed to create milestone" });
    }
  });

  app.patch("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updateSchema = insertProjectMilestoneSchema.partial();
      const parsed = updateSchema.parse(req.body);
      const milestone = await storage.updateMilestone(parseInt(req.params.id), parsed);
      if (!milestone) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating milestone:", error);
      res.status(500).json({ message: "Failed to update milestone" });
    }
  });

  app.delete("/api/milestones/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteMilestone(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Milestone not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ message: "Failed to delete milestone" });
    }
  });

  // Document Requests
  app.get("/api/projects/:projectId/document-requests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const requests = await storage.getDocumentRequestsByProjectId(parseInt(req.params.projectId));
      res.json(requests);
    } catch (error) {
      console.error("Error fetching document requests:", error);
      res.status(500).json({ message: "Failed to fetch document requests" });
    }
  });

  app.post("/api/projects/:projectId/document-requests", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const projectId = parseInt(req.params.projectId);
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const parsed = insertDocumentRequestSchema.parse({
        ...req.body,
        projectId,
        clientId: project.clientId,
        requestedByUserId: req.session.userId,
      });
      const request = await storage.createDocumentRequest(parsed);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating document request:", error);
      res.status(500).json({ message: "Failed to create document request" });
    }
  });

  app.patch("/api/document-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updateSchema = insertDocumentRequestSchema.partial();
      const parsed = updateSchema.parse(req.body);
      const request = await storage.updateDocumentRequest(parseInt(req.params.id), parsed);
      if (!request) {
        return res.status(404).json({ message: "Document request not found" });
      }
      res.json(request);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating document request:", error);
      res.status(500).json({ message: "Failed to update document request" });
    }
  });

  app.delete("/api/document-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteDocumentRequest(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Document request not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document request:", error);
      res.status(500).json({ message: "Failed to delete document request" });
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
        isVisibleToClient: z.boolean().optional(),
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

  // Daily Activity Logs
  app.get("/api/daily-activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const logs = await storage.getDailyActivityLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching daily activity logs:", error);
      res.status(500).json({ message: "Failed to fetch daily activity logs" });
    }
  });

  app.post("/api/daily-activity-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const userId = req.session.userId!;
      const parsed = insertDailyActivityLogSchema.parse({ ...req.body, userId });
      const log = await storage.createDailyActivityLog(parsed);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating daily activity log:", error);
      res.status(500).json({ message: "Failed to create daily activity log" });
    }
  });

  app.patch("/api/daily-activity-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertDailyActivityLogSchema.partial().parse(req.body);
      const log = await storage.updateDailyActivityLog(parseInt(req.params.id), parsed);
      if (!log) {
        return res.status(404).json({ message: "Daily activity log not found" });
      }
      res.json(log);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating daily activity log:", error);
      res.status(500).json({ message: "Failed to update daily activity log" });
    }
  });

  app.delete("/api/daily-activity-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const deleted = await storage.deleteDailyActivityLog(parseInt(req.params.id));
      if (!deleted) {
        return res.status(404).json({ message: "Daily activity log not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting daily activity log:", error);
      res.status(500).json({ message: "Failed to delete daily activity log" });
    }
  });

  // Generate daily activity from app data
  app.get("/api/daily-activity-logs/generate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const dateParam = req.query.date as string;
      if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ message: "Valid date parameter required (YYYY-MM-DD)" });
      }
      
      const userId = req.session.userId!;
      // Parse date components to avoid timezone issues
      // dateParam is in format "YYYY-MM-DD" - using local time to match user's intent
      const [year, month, day] = dateParam.split('-').map(Number);
      const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
      
      // Gather activity data from various sources
      const [timeEntries, timeLogs, notesCreated, documentsProcessed, tasksCompleted, auditLogEntries] = await Promise.all([
        storage.getTimeEntriesForDateRange(userId, startOfDay, endOfDay),
        storage.getTimeLogsForDateRange(userId, startOfDay, endOfDay),
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
      
      // Generate detailed breakdown
      const detailLines: string[] = [];
      
      // Time entries details
      if (timeEntries.length > 0) {
        detailLines.push("TIME ENTRIES:");
        for (const entry of timeEntries) {
          const task = await storage.getTask(entry.taskId);
          const project = await storage.getProject(entry.projectId);
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
          const project = await storage.getProject(log.projectId);
          detailLines.push(`• ${project?.name || "Unknown Project"}: ${log.taskDescription} (${log.totalHours}h)`);
        }
      }
      
      // Tasks completed
      if (tasksCompleted.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("TASKS COMPLETED:");
        for (const task of tasksCompleted) {
          const project = await storage.getProject(task.projectId);
          detailLines.push(`• ${project?.name || "Unknown"}: ${task.title}`);
        }
      }
      
      // Documents processed
      if (documentsProcessed.length > 0) {
        if (detailLines.length > 0) detailLines.push("");
        detailLines.push("DOCUMENTS PROCESSED:");
        for (const doc of documentsProcessed) {
          const project = await storage.getProject(doc.projectId);
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
        summary,
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
  });

  // Admin diagnostic endpoint to find and fix unlinked portal users
  app.get("/api/admin/portal-diagnostics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allUsers = await storage.getAllUsers();
      const allClients = await storage.getClients();
      
      // Find client users without a valid clientId
      const unlinkedUsers = allUsers.filter(u => 
        u.role === "client" && (!u.clientId || !allClients.find(c => c.id === u.clientId))
      );
      
      // Find clients without portal users
      const clientsWithoutPortal = allClients.filter(c =>
        !allUsers.find(u => u.clientId === c.id && u.role === "client")
      );
      
      // Get linked portal users with stats
      const linkedPortalUsers = allUsers
        .filter(u => u.role === "client" && u.clientId)
        .map(u => {
          const client = allClients.find(c => c.id === u.clientId);
          return {
            userId: u.id,
            email: u.email,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
            clientId: u.clientId,
            clientName: client?.name || 'Unknown',
          };
        });

      res.json({
        summary: {
          totalPortalUsers: allUsers.filter(u => u.role === "client").length,
          linkedUsers: linkedPortalUsers.length,
          unlinkedUsers: unlinkedUsers.length,
          clientsWithoutPortal: clientsWithoutPortal.length,
        },
        unlinkedUsers: unlinkedUsers.map(u => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          clientId: u.clientId,
        })),
        clientsWithoutPortal: clientsWithoutPortal.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
        })),
        linkedPortalUsers,
      });
    } catch (error) {
      console.error("Error fetching portal diagnostics:", error);
      res.status(500).json({ message: "Failed to fetch diagnostics" });
    }
  });

  // Admin endpoint to manually link a portal user to a client
  app.post("/api/admin/link-portal-user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { userId, clientId } = req.body;
      if (!userId || !clientId) {
        return res.status(400).json({ message: "userId and clientId are required" });
      }

      const linkedUser = await storage.linkUserToClient(userId, clientId);
      if (!linkedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Ensure portal settings exist
      await storage.upsertClientPortalSettings({ clientId });

      res.json({ 
        message: "User linked successfully",
        user: { id: linkedUser.id, email: linkedUser.email, clientId: linkedUser.clientId }
      });
    } catch (error) {
      console.error("Error linking portal user:", error);
      res.status(500).json({ message: "Failed to link user" });
    }
  });

  // ============ Intake Applications ============
  
  app.get("/api/intake-applications", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const applications = await storage.getIntakeApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error fetching intake applications:", error);
      res.status(500).json({ message: "Failed to fetch intake applications" });
    }
  });

  app.get("/api/intake-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const application = await storage.getIntakeApplication(parseInt(req.params.id));
      if (!application) {
        return res.status(404).json({ message: "Intake application not found" });
      }
      res.json(application);
    } catch (error) {
      console.error("Error fetching intake application:", error);
      res.status(500).json({ message: "Failed to fetch intake application" });
    }
  });

  app.post("/api/intake-applications", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertIntakeApplicationSchema.parse({
        ...req.body,
        createdByUserId: user.id,
      });
      const application = await storage.createIntakeApplication(parsed);
      res.status(201).json(application);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating intake application:", error);
      res.status(500).json({ message: "Failed to create intake application" });
    }
  });

  app.patch("/api/intake-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertIntakeApplicationSchema.partial().parse(req.body);
      const application = await storage.updateIntakeApplication(parseInt(req.params.id), parsed);
      if (!application) {
        return res.status(404).json({ message: "Intake application not found" });
      }
      res.json(application);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating intake application:", error);
      res.status(500).json({ message: "Failed to update intake application" });
    }
  });

  // Convert intake application to project (links to existing client)
  app.post("/api/intake-applications/:id/convert", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const intakeId = parseInt(req.params.id);
      const { clientId } = req.body;
      
      // Validate clientId is provided
      if (!clientId) {
        return res.status(400).json({ message: "Client ID is required. Please select an existing client to link the project to." });
      }
      
      const intake = await storage.getIntakeApplication(intakeId);
      
      if (!intake) {
        return res.status(404).json({ message: "Intake application not found" });
      }
      
      // Check if already converted
      if (intake.linkedClientId || intake.linkedProjectId) {
        return res.status(400).json({ 
          message: "This intake application has already been converted",
          linkedClientId: intake.linkedClientId,
          linkedProjectId: intake.linkedProjectId
        });
      }
      
      // Verify the client exists
      const existingClient = await storage.getClient(parseInt(clientId));
      if (!existingClient) {
        return res.status(404).json({ message: "Selected client not found" });
      }
      
      // Build project address from intake location fields
      const projectAddress = [
        intake.locationStreet,
        intake.locationTown,
        intake.locationVillage
      ].filter(Boolean).join(", ") || intake.currentAddress || "";
      
      // Create project from intake data, linked to the existing client
      const [newProject] = await db.insert(projects).values({
        clientId: existingClient.id,
        name: intake.projectName || `${intake.ownerName} - New Project`,
        description: intake.varianceFromSubdivision || intake.specialPermitUse || null,
        address: projectAddress,
        city: intake.locationTown || intake.locationVillage || "",
        state: "NY",
        zip: "",
        jobType: "residential",
        status: "intake",
        priority: "normal",
        isVisibleToClient: true,
      }).returning();
      
      // Update intake with linkage to client and project
      await db.update(intakeApplications)
        .set({
          linkedClientId: existingClient.id,
          linkedProjectId: newProject.id,
          convertedAt: new Date(),
          status: "approved",
          updatedAt: new Date(),
        })
        .where(eq(intakeApplications.id, intakeId));
      
      // Log the conversion in audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "create",
        entityType: "intake_conversion",
        entityId: intakeId.toString(),
        description: `Converted intake application to Project #${newProject.id}, linked to existing Client #${existingClient.id}`,
        metadata: { intakeId, clientId: existingClient.id, projectId: newProject.id },
      });
      
      res.json({
        message: "Intake application converted successfully",
        client: existingClient,
        project: newProject,
      });
    } catch (error) {
      console.error("Error converting intake application:", error);
      res.status(500).json({ message: "Failed to convert intake application" });
    }
  });

  app.delete("/api/intake-applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const success = await storage.deleteIntakeApplication(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Intake application not found" });
      }
      res.json({ message: "Intake application deleted successfully" });
    } catch (error) {
      console.error("Error deleting intake application:", error);
      res.status(500).json({ message: "Failed to delete intake application" });
    }
  });

  // Get intake application by project ID (returns null if no intake linked)
  app.get("/api/projects/:projectId/intake", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const projectId = parseInt(req.params.projectId);
      const intake = await storage.getIntakeApplicationByProjectId(projectId);
      // Return null if no intake linked (200 OK with null body to work with default fetcher)
      res.json(intake || null);
    } catch (error) {
      console.error("Error fetching project intake:", error);
      res.status(500).json({ message: "Failed to fetch project intake" });
    }
  });

  // Link an intake to a project
  app.post("/api/projects/:projectId/link-intake", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const projectId = parseInt(req.params.projectId);
      const { intakeId } = req.body;

      if (!intakeId) {
        return res.status(400).json({ message: "Intake ID is required" });
      }

      // Get the project to get the clientId
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get the intake to check it exists and isn't already linked
      const intake = await storage.getIntakeApplication(intakeId);
      if (!intake) {
        return res.status(404).json({ message: "Intake application not found" });
      }

      if (intake.linkedProjectId) {
        return res.status(400).json({ message: "This intake is already linked to another project" });
      }

      // Update intake with linkage to project and client
      const updatedIntake = await storage.updateIntakeApplication(intakeId, {
        linkedProjectId: projectId,
        linkedClientId: project.clientId,
        convertedAt: new Date(),
      });

      // Log the action
      await storage.createAuditLog({
        userId: user.id,
        action: "link_intake",
        entityType: "project",
        entityId: projectId.toString(),
        description: `Linked intake application #${intakeId} to project #${projectId}`,
        metadata: { intakeId, projectId, clientId: project.clientId },
      });

      res.json({ 
        message: "Intake linked successfully", 
        intake: updatedIntake,
        project
      });
    } catch (error) {
      console.error("Error linking intake to project:", error);
      res.status(500).json({ message: "Failed to link intake to project" });
    }
  });

  // ===== Services (for proposals) =====
  app.get("/api/services", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.get("/api/services/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const service = await storage.getService(parseInt(req.params.id));
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.post("/api/services", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = insertServiceSchema.parse(req.body);
      const service = await storage.createService(parsed);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.patch("/api/services/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateServiceSchema.parse(req.body);
      const service = await storage.updateService(parseInt(req.params.id), parsed);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const success = await storage.deleteService(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // ===== Proposals (Sales Pipeline) =====
  app.get("/api/proposals", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const proposals = await storage.getProposals();
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ message: "Failed to fetch proposals" });
    }
  });

  app.get("/api/proposals/next-number", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const proposalNumber = await storage.getNextProposalNumber();
      res.json({ proposalNumber });
    } catch (error) {
      console.error("Error getting next proposal number:", error);
      res.status(500).json({ message: "Failed to get next proposal number" });
    }
  });

  app.get("/api/proposals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const proposal = await storage.getProposal(parseInt(req.params.id));
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal:", error);
      res.status(500).json({ message: "Failed to fetch proposal" });
    }
  });

  app.post("/api/proposals", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const { items, ...proposalData } = req.body;
      const parsed = insertProposalSchema.parse(proposalData);
      const parsedItems = (items || []).map((item: any) => insertProposalItemSchema.parse(item));
      
      const proposal = await storage.createProposal(
        { ...parsed, createdByUserId: user.id },
        parsedItems
      );
      res.status(201).json(proposal);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating proposal:", error);
      res.status(500).json({ message: "Failed to create proposal" });
    }
  });

  app.patch("/api/proposals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateProposalSchema.parse(req.body);
      const proposal = await storage.updateProposal(parseInt(req.params.id), parsed);
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating proposal:", error);
      res.status(500).json({ message: "Failed to update proposal" });
    }
  });

  app.delete("/api/proposals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const success = await storage.deleteProposal(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Proposal not found" });
      }
      res.json({ message: "Proposal deleted successfully" });
    } catch (error) {
      console.error("Error deleting proposal:", error);
      res.status(500).json({ message: "Failed to delete proposal" });
    }
  });

  // ===== Proposal Items =====
  app.post("/api/proposals/:proposalId/items", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const proposalId = parseInt(req.params.proposalId);
      const parsed = insertProposalItemSchema.parse({ ...req.body, proposalId });
      const item = await storage.addProposalItem(parsed);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error adding proposal item:", error);
      res.status(500).json({ message: "Failed to add proposal item" });
    }
  });

  app.patch("/api/proposal-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const parsed = updateProposalItemSchema.parse(req.body);
      const item = await storage.updateProposalItem(parseInt(req.params.id), parsed);
      if (!item) {
        return res.status(404).json({ message: "Proposal item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating proposal item:", error);
      res.status(500).json({ message: "Failed to update proposal item" });
    }
  });

  app.delete("/api/proposal-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const success = await storage.deleteProposalItem(parseInt(req.params.id));
      if (!success) {
        return res.status(404).json({ message: "Proposal item not found" });
      }
      res.json({ message: "Proposal item deleted successfully" });
    } catch (error) {
      console.error("Error deleting proposal item:", error);
      res.status(500).json({ message: "Failed to delete proposal item" });
    }
  });

  // ===== Seed Default Services =====
  app.post("/api/services/seed", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin" && user?.role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const defaultServices = [
        { name: "Business Tax Return", category: "accounting" as const, description: "Preparation and filing of business tax returns", sortOrder: 1 },
        { name: "Personal Tax Return", category: "accounting" as const, description: "Preparation and filing of personal tax returns", sortOrder: 2 },
        { name: "Estimate Tax Payment for Business", category: "accounting" as const, description: "Our team will ensure providing you with best legal tax techniques in order to minimize tax bill", sortOrder: 3 },
        { name: "Tax, Legal, and Financial Questions", category: "accounting" as const, description: "We will be available to answer your tax, legal, and financial questions", sortOrder: 4 },
        
        { name: "Quarterly Meeting with CEO", category: "write_up" as const, description: "Scheduled quarterly meetings with CEO", sortOrder: 1 },
        { name: "Review Books Quarterly with CEO", category: "write_up" as const, description: "Quarterly review of books with CEO", sortOrder: 2 },
        { name: "Quarterly Books", category: "write_up" as const, description: "Quarterly bookkeeping services", sortOrder: 3 },
        { name: "Quarterly Sales Tax Filing", category: "write_up" as const, description: "Quarterly sales tax filing services", sortOrder: 4 },
        { name: "New Corp.", category: "write_up" as const, description: "New corporation setup and filing", sortOrder: 5 },
        
        { name: "Cash Reconciliation", category: "bookkeeping" as const, description: "Regular cash reconciliation services", sortOrder: 1 },
        { name: "Month End Close", category: "bookkeeping" as const, description: "Monthly closing of books", sortOrder: 2 },
        { name: "Review and Analyze P&L and Balance Sheet", category: "bookkeeping" as const, description: "Review and analysis of profit & loss and balance sheet", sortOrder: 3 },
        { name: "Year End Close", category: "bookkeeping" as const, description: "Closing the books at year end for the accountant to prepare financials", sortOrder: 4 },
        { name: "Enter Transactions", category: "bookkeeping" as const, description: "Transaction entry services", sortOrder: 5 },
        
        { name: "Cash Flow Management and Forecasting", category: "cfo" as const, description: "Cash flow management and forecasting services", sortOrder: 1 },
        { name: "Financial Analysis for Business Decisions", category: "cfo" as const, description: "Financial analysis to support smart business decisions", sortOrder: 2 },
        { name: "Monthly Review of P&L and Balance Sheet", category: "cfo" as const, description: "Monthly review of profit & loss and balance sheet", sortOrder: 3 },
        { name: "Bi-Monthly Meetings with CEO", category: "cfo" as const, description: "Bi-monthly strategic meetings with CEO", sortOrder: 4 },
        { name: "Set Up AP/AR Processes and Policies", category: "cfo" as const, description: "Accounts payable and receivable process setup", sortOrder: 5 },
        { name: "Build Reserve Accounts", category: "cfo" as const, description: "Building and managing reserve accounts", sortOrder: 6 },
        { name: "Budget vs Actual Reporting", category: "cfo" as const, description: "Budget vs actual performance reporting", sortOrder: 7 },
        { name: "Support Sustainable Growth Planning", category: "cfo" as const, description: "Support for sustainable growth planning", sortOrder: 8 },
        { name: "Identify and Resolve Financial Issues", category: "cfo" as const, description: "Identify and resolve financial issues", sortOrder: 9 },
        { name: "Review and Optimize Pricing Models", category: "cfo" as const, description: "Review and optimize pricing models", sortOrder: 10 },
      ];

      const createdServices = [];
      for (const service of defaultServices) {
        const newService = await storage.createService(service);
        createdServices.push(newService);
      }

      res.status(201).json({ message: "Services seeded successfully", count: createdServices.length });
    } catch (error) {
      console.error("Error seeding services:", error);
      res.status(500).json({ message: "Failed to seed services" });
    }
  });

  return httpServer;
}
