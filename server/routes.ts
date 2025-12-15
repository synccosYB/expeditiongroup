import type { Express, Request } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { ZodError } from "zod";
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
      const stats = await storage.getDashboardStats();
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

  // Projects by status
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

  return httpServer;
}
