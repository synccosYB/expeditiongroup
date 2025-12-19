import {
  users,
  clients,
  projects,
  tasks,
  notes,
  timeLogs,
  timeEntries,
  associates,
  projectAssociates,
  folders,
  documents,
  checklistTemplates,
  checklistInstances,
  newsletterSubscribers,
  taskReminders,
  invoices,
  invoiceItems,
  type User,
  type UpsertUser,
  type Client,
  type InsertClient,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type Note,
  type InsertNote,
  type TimeLog,
  type InsertTimeLog,
  type TimeEntry,
  type InsertTimeEntry,
  type Associate,
  type InsertAssociate,
  type ProjectAssociate,
  type InsertProjectAssociate,
  type Folder,
  type InsertFolder,
  type Document,
  type InsertDocument,
  type ChecklistTemplate,
  type InsertChecklistTemplate,
  type ChecklistInstance,
  type InsertChecklistInstance,
  type NewsletterSubscriber,
  type TaskReminder,
  type InsertTaskReminder,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql, isNull, ne, or, ilike } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  updateUserRole(id: string, role: "admin" | "client"): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  // Projects
  getProjects(): Promise<(Project & { client: Client })[]>;
  getProjectsByClientId(clientId: number): Promise<(Project & { client: Client })[]>;
  getProject(id: number): Promise<(Project & { client: Client; tasks: Task[]; notes: (Note & { user?: User })[]; timeLogs: TimeLog[]; timeEntries: TimeEntry[] }) | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  getProjectsByStatus(): Promise<{ status: string; count: number }[]>;
  
  // Tasks
  getTasks(): Promise<(Task & { project: Project })[]>;
  getTasksByProjectId(projectId: number): Promise<Task[]>;
  getTasksByAssociateId(associateId: number): Promise<(Task & { project: Project })[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  getOverdueTasks(): Promise<(Task & { project: Project })[]>;
  
  // Notes
  createNote(note: InsertNote): Promise<Note>;
  getNotesByProjectId(projectId: number): Promise<(Note & { user?: User })[]>;
  updateNote(id: number, note: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: number): Promise<boolean>;
  
  // Time Entries
  getTimeEntries(): Promise<(TimeEntry & { task: Task; project: Project })[]>;
  getTimeEntriesByTaskId(taskId: number): Promise<TimeEntry[]>;
  getTimeEntriesByProjectId(projectId: number): Promise<(TimeEntry & { task: Task })[]>;
  createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, timeEntry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;
  
  // Time Logs (legacy)
  getTimeLogs(): Promise<(TimeLog & { project: Project })[]>;
  getTimeLogsByProjectId(projectId: number): Promise<TimeLog[]>;
  createTimeLog(timeLog: InsertTimeLog): Promise<TimeLog>;
  updateTimeLog(id: number, timeLog: Partial<InsertTimeLog>): Promise<TimeLog | undefined>;
  deleteTimeLog(id: number): Promise<boolean>;
  
  // Associates
  getAssociates(): Promise<Associate[]>;
  getAssociate(id: number): Promise<Associate | undefined>;
  getAssociateWithRelations(id: number): Promise<(Associate & { projects: Project[]; tasks: (Task & { project?: Project })[] }) | undefined>;
  createAssociate(associate: InsertAssociate): Promise<Associate>;
  updateAssociate(id: number, associate: Partial<InsertAssociate>): Promise<Associate | undefined>;
  deleteAssociate(id: number): Promise<boolean>;
  
  // Project Associates
  getProjectAssociates(projectId: number): Promise<(ProjectAssociate & { associate: Associate })[]>;
  addProjectAssociate(projectAssociate: InsertProjectAssociate): Promise<ProjectAssociate>;
  removeProjectAssociate(projectId: number, associateId: number): Promise<boolean>;
  
  // Folders
  getFoldersByProjectId(projectId: number): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: number, folder: Partial<InsertFolder>): Promise<Folder | undefined>;
  deleteFolder(id: number): Promise<boolean>;
  
  // Documents
  getDocumentsByProjectId(projectId: number): Promise<Document[]>;
  getDocumentsByFolderId(folderId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Checklist Templates
  getChecklistTemplates(): Promise<ChecklistTemplate[]>;
  getChecklistTemplate(id: number): Promise<ChecklistTemplate | undefined>;
  createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate>;
  updateChecklistTemplate(id: number, template: Partial<InsertChecklistTemplate>): Promise<ChecklistTemplate | undefined>;
  deleteChecklistTemplate(id: number): Promise<boolean>;
  
  // Checklist Instances
  getChecklistInstancesByProjectId(projectId: number): Promise<ChecklistInstance[]>;
  createChecklistInstance(instance: InsertChecklistInstance): Promise<ChecklistInstance>;
  updateChecklistInstance(id: number, instance: Partial<InsertChecklistInstance>): Promise<ChecklistInstance | undefined>;
  deleteChecklistInstance(id: number): Promise<boolean>;
  
  // Dashboard
  getDashboardStats(startDate?: Date, endDate?: Date): Promise<{
    totalClients: number;
    totalProjects: number;
    activeProjects: number;
    pendingTasks: number;
    totalHours: number;
    recentProjects: (Project & { client: Client })[];
    upcomingTasks: (Task & { project: Project })[];
  }>;
  
  // Search
  globalSearch(query: string): Promise<{
    clients: Client[];
    projects: (Project & { client: Client })[];
    associates: Associate[];
  }>;
  
  // Newsletter
  addNewsletterSubscriber(email: string): Promise<NewsletterSubscriber>;
  
  // Storage
  getUserStorageUsage(userId: string): Promise<number>;
  
  // Task Reminders
  getTaskReminders(taskId: number): Promise<TaskReminder[]>;
  createTaskReminder(reminder: InsertTaskReminder): Promise<TaskReminder>;
  updateTaskReminder(id: number, reminder: Partial<InsertTaskReminder>): Promise<TaskReminder | undefined>;
  deleteTaskReminder(id: number): Promise<boolean>;
  
  // Invoices
  getInvoices(): Promise<(Invoice & { project: Project; client: Client; items: InvoiceItem[] })[]>;
  getInvoicesByProjectId(projectId: number): Promise<(Invoice & { items: InvoiceItem[] })[]>;
  getInvoicesByClientId(clientId: number): Promise<(Invoice & { project: Project; items: InvoiceItem[] })[]>;
  getInvoice(id: number): Promise<(Invoice & { project: Project; client: Client; items: InvoiceItem[] }) | undefined>;
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice & { items: InvoiceItem[] }>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  getNextInvoiceNumber(): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(
      or(eq(users.role, "admin"), eq(users.role, "super_admin"))
    );
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: "admin" | "client"): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Projects
  async getProjects(): Promise<(Project & { client: Client })[]> {
    const result = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.createdAt));
    
    return result.map(r => ({
      ...r.projects,
      client: r.clients!,
    }));
  }

  async getProjectsByClientId(clientId: number): Promise<(Project & { client: Client })[]> {
    const result = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.clientId, clientId))
      .orderBy(desc(projects.createdAt));
    
    return result.map(r => ({
      ...r.projects,
      client: r.clients!,
    }));
  }

  async getProject(id: number): Promise<(Project & { client: Client; tasks: Task[]; notes: (Note & { user?: User })[]; timeLogs: TimeLog[]; timeEntries: TimeEntry[] }) | undefined> {
    const [projectResult] = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, id));
    
    if (!projectResult) return undefined;

    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, id)).orderBy(desc(tasks.createdAt));
    
    const notesResult = await db
      .select()
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.projectId, id))
      .orderBy(desc(notes.createdAt));
    
    const projectTimeLogs = await db.select().from(timeLogs).where(eq(timeLogs.projectId, id)).orderBy(desc(timeLogs.date));
    
    const projectTimeEntries = await db.select().from(timeEntries).where(eq(timeEntries.projectId, id)).orderBy(desc(timeEntries.date));

    return {
      ...projectResult.projects,
      client: projectResult.clients!,
      tasks: projectTasks,
      notes: notesResult.map(r => ({
        ...r.notes,
        user: r.users || undefined,
      })),
      timeLogs: projectTimeLogs,
      timeEntries: projectTimeEntries,
    };
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProjectsByStatus(): Promise<{ status: string; count: number }[]> {
    const result = await db
      .select({
        status: projects.status,
        count: count(),
      })
      .from(projects)
      .groupBy(projects.status);
    
    return result.map(r => ({
      status: r.status,
      count: r.count,
    }));
  }

  // Tasks
  async getTasks(): Promise<(Task & { project: Project; assignee?: User })[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .orderBy(desc(tasks.createdAt));
    
    return result.map(r => ({
      ...r.tasks,
      project: r.projects!,
      assignee: r.users || undefined,
    }));
  }

  async getTasksByProjectId(projectId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
  }

  async getTasksByAssociateId(associateId: number): Promise<(Task & { project: Project })[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.relatedAssociateId, associateId))
      .orderBy(desc(tasks.createdAt));
    
    return result.map(r => ({
      ...r.tasks,
      project: r.projects!,
    }));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined> {
    const updateData: any = { ...task, updatedAt: new Date() };
    if (task.status === "done" && !task.completedAt) {
      updateData.completedAt = new Date();
    }
    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: number): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getOverdueTasks(): Promise<(Task & { project: Project })[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        ne(tasks.status, "done"),
        ne(tasks.status, "cancelled"),
        sql`${tasks.dueDate} < NOW()`
      ))
      .orderBy(tasks.dueDate);
    
    return result.map(r => ({
      ...r.tasks,
      project: r.projects!,
    }));
  }

  // Notes
  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await db.insert(notes).values(note).returning();
    return newNote;
  }

  async getNotesByProjectId(projectId: number): Promise<(Note & { user?: User })[]> {
    const result = await db
      .select()
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.projectId, projectId))
      .orderBy(desc(notes.createdAt));
    
    return result.map(r => ({
      ...r.notes,
      user: r.users || undefined,
    }));
  }

  async updateNote(id: number, note: Partial<InsertNote>): Promise<Note | undefined> {
    const [updatedNote] = await db
      .update(notes)
      .set({ ...note, updatedAt: new Date() })
      .where(eq(notes.id, id))
      .returning();
    return updatedNote;
  }

  async deleteNote(id: number): Promise<boolean> {
    const result = await db.delete(notes).where(eq(notes.id, id)).returning();
    return result.length > 0;
  }

  // Time Entries
  async getTimeEntries(): Promise<(TimeEntry & { task: Task; project: Project })[]> {
    const result = await db
      .select()
      .from(timeEntries)
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .leftJoin(projects, eq(timeEntries.projectId, projects.id))
      .orderBy(desc(timeEntries.date));
    
    return result.map(r => ({
      ...r.time_entries,
      task: r.tasks!,
      project: r.projects!,
    }));
  }

  async getTimeEntriesByTaskId(taskId: number): Promise<TimeEntry[]> {
    return await db.select().from(timeEntries).where(eq(timeEntries.taskId, taskId)).orderBy(desc(timeEntries.date));
  }

  async getTimeEntriesByProjectId(projectId: number): Promise<(TimeEntry & { task: Task })[]> {
    const result = await db
      .select()
      .from(timeEntries)
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(eq(timeEntries.projectId, projectId))
      .orderBy(desc(timeEntries.date));
    
    return result.map(r => ({
      ...r.time_entries,
      task: r.tasks!,
    }));
  }

  async createTimeEntry(timeEntry: InsertTimeEntry): Promise<TimeEntry> {
    const [newTimeEntry] = await db.insert(timeEntries).values(timeEntry).returning();
    return newTimeEntry;
  }

  async updateTimeEntry(id: number, timeEntry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const [updated] = await db
      .update(timeEntries)
      .set(timeEntry)
      .where(eq(timeEntries.id, id))
      .returning();
    return updated;
  }

  async deleteTimeEntry(id: number): Promise<boolean> {
    const result = await db.delete(timeEntries).where(eq(timeEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Time Logs (legacy)
  async getTimeLogs(): Promise<(TimeLog & { project: Project })[]> {
    const result = await db
      .select()
      .from(timeLogs)
      .leftJoin(projects, eq(timeLogs.projectId, projects.id))
      .orderBy(desc(timeLogs.date));
    
    return result.map(r => ({
      ...r.time_logs,
      project: r.projects!,
    }));
  }

  async getTimeLogsByProjectId(projectId: number): Promise<TimeLog[]> {
    return await db.select().from(timeLogs).where(eq(timeLogs.projectId, projectId)).orderBy(desc(timeLogs.date));
  }

  async createTimeLog(timeLog: InsertTimeLog): Promise<TimeLog> {
    const [newTimeLog] = await db.insert(timeLogs).values(timeLog).returning();
    return newTimeLog;
  }

  async updateTimeLog(id: number, timeLog: Partial<InsertTimeLog>): Promise<TimeLog | undefined> {
    const processedTimeLog = { ...timeLog };
    if (typeof timeLog.date === 'string') {
      processedTimeLog.date = new Date(timeLog.date);
    }
    const [updated] = await db
      .update(timeLogs)
      .set(processedTimeLog)
      .where(eq(timeLogs.id, id))
      .returning();
    return updated;
  }

  async deleteTimeLog(id: number): Promise<boolean> {
    const result = await db.delete(timeLogs).where(eq(timeLogs.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Associates
  async getAssociates(): Promise<Associate[]> {
    return await db.select().from(associates).orderBy(desc(associates.createdAt));
  }

  async getAssociate(id: number): Promise<Associate | undefined> {
    const [associate] = await db.select().from(associates).where(eq(associates.id, id));
    return associate;
  }

  async getAssociateWithRelations(id: number): Promise<(Associate & { projects: Project[]; tasks: (Task & { project?: Project })[] }) | undefined> {
    const [associate] = await db.select().from(associates).where(eq(associates.id, id));
    if (!associate) return undefined;

    const projectAssociateResults = await db
      .select()
      .from(projectAssociates)
      .leftJoin(projects, eq(projectAssociates.projectId, projects.id))
      .where(eq(projectAssociates.associateId, id));
    
    const associateTasksResult = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.relatedAssociateId, id))
      .orderBy(desc(tasks.createdAt));

    return {
      ...associate,
      projects: projectAssociateResults.map(r => r.projects!).filter(Boolean),
      tasks: associateTasksResult.map(r => ({
        ...r.tasks,
        project: r.projects || undefined,
      })),
    };
  }

  async createAssociate(associate: InsertAssociate): Promise<Associate> {
    const [newAssociate] = await db.insert(associates).values(associate).returning();
    return newAssociate;
  }

  async updateAssociate(id: number, associate: Partial<InsertAssociate>): Promise<Associate | undefined> {
    const [updated] = await db
      .update(associates)
      .set({ ...associate, updatedAt: new Date() })
      .where(eq(associates.id, id))
      .returning();
    return updated;
  }

  async deleteAssociate(id: number): Promise<boolean> {
    const result = await db.delete(associates).where(eq(associates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Project Associates
  async getProjectAssociates(projectId: number): Promise<(ProjectAssociate & { associate: Associate })[]> {
    const result = await db
      .select()
      .from(projectAssociates)
      .leftJoin(associates, eq(projectAssociates.associateId, associates.id))
      .where(eq(projectAssociates.projectId, projectId));
    
    return result.map(r => ({
      ...r.project_associates,
      associate: r.associates!,
    }));
  }

  async addProjectAssociate(projectAssociate: InsertProjectAssociate): Promise<ProjectAssociate> {
    const [newPA] = await db.insert(projectAssociates).values(projectAssociate).returning();
    return newPA;
  }

  async removeProjectAssociate(projectId: number, associateId: number): Promise<boolean> {
    const result = await db.delete(projectAssociates).where(
      and(eq(projectAssociates.projectId, projectId), eq(projectAssociates.associateId, associateId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Folders
  async getFoldersByProjectId(projectId: number): Promise<Folder[]> {
    return await db.select().from(folders).where(eq(folders.projectId, projectId)).orderBy(folders.name);
  }

  async createFolder(folder: InsertFolder): Promise<Folder> {
    const [newFolder] = await db.insert(folders).values(folder).returning();
    return newFolder;
  }

  async updateFolder(id: number, folder: Partial<InsertFolder>): Promise<Folder | undefined> {
    const [updated] = await db
      .update(folders)
      .set({ ...folder, updatedAt: new Date() })
      .where(eq(folders.id, id))
      .returning();
    return updated;
  }

  async deleteFolder(id: number): Promise<boolean> {
    const result = await db.delete(folders).where(eq(folders.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Documents
  async getDocumentsByProjectId(projectId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByFolderId(folderId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.folderId, folderId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updated] = await db
      .update(documents)
      .set(document)
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Checklist Templates
  async getChecklistTemplates(): Promise<ChecklistTemplate[]> {
    return await db.select().from(checklistTemplates).orderBy(desc(checklistTemplates.createdAt));
  }

  async getChecklistTemplate(id: number): Promise<ChecklistTemplate | undefined> {
    const [template] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id));
    return template;
  }

  async createChecklistTemplate(template: InsertChecklistTemplate): Promise<ChecklistTemplate> {
    const [newTemplate] = await db.insert(checklistTemplates).values(template).returning();
    return newTemplate;
  }

  async updateChecklistTemplate(id: number, template: Partial<InsertChecklistTemplate>): Promise<ChecklistTemplate | undefined> {
    const [updated] = await db
      .update(checklistTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(checklistTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistTemplate(id: number): Promise<boolean> {
    const result = await db.delete(checklistTemplates).where(eq(checklistTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Checklist Instances
  async getChecklistInstancesByProjectId(projectId: number): Promise<ChecklistInstance[]> {
    return await db.select().from(checklistInstances).where(eq(checklistInstances.projectId, projectId)).orderBy(desc(checklistInstances.createdAt));
  }

  async createChecklistInstance(instance: InsertChecklistInstance): Promise<ChecklistInstance> {
    const [newInstance] = await db.insert(checklistInstances).values(instance).returning();
    return newInstance;
  }

  async updateChecklistInstance(id: number, instance: Partial<InsertChecklistInstance>): Promise<ChecklistInstance | undefined> {
    const [updated] = await db
      .update(checklistInstances)
      .set({ ...instance, updatedAt: new Date() })
      .where(eq(checklistInstances.id, id))
      .returning();
    return updated;
  }

  async deleteChecklistInstance(id: number): Promise<boolean> {
    const result = await db.delete(checklistInstances).where(eq(checklistInstances.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Dashboard
  async getDashboardStats(startDate?: Date, endDate?: Date): Promise<{
    totalClients: number;
    totalProjects: number;
    activeProjects: number;
    pendingTasks: number;
    totalHours: number;
    recentProjects: (Project & { client: Client })[];
    upcomingTasks: (Task & { project: Project })[];
  }> {
    const [clientCount] = await db.select({ count: count() }).from(clients);
    const [projectCount] = await db.select({ count: count() }).from(projects);
    const [activeCount] = await db.select({ count: count() }).from(projects).where(eq(projects.status, "in_progress"));
    const [pendingCount] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, "todo"));

    // Calculate total hours from BOTH time_entries and time_logs tables with optional date filtering
    
    // Time entries (new system - stores minutes)
    let timeEntriesQuery = db
      .select({ totalMinutes: timeEntries.totalMinutes })
      .from(timeEntries);
    
    if (startDate && endDate) {
      timeEntriesQuery = timeEntriesQuery.where(and(
        sql`${timeEntries.date} >= ${startDate}`,
        sql`${timeEntries.date} <= ${endDate}`
      )) as typeof timeEntriesQuery;
    } else if (startDate) {
      timeEntriesQuery = timeEntriesQuery.where(sql`${timeEntries.date} >= ${startDate}`) as typeof timeEntriesQuery;
    } else if (endDate) {
      timeEntriesQuery = timeEntriesQuery.where(sql`${timeEntries.date} <= ${endDate}`) as typeof timeEntriesQuery;
    }
    
    const allTimeEntries = await timeEntriesQuery;
    const totalMinutesFromEntries = allTimeEntries.reduce((sum, te) => sum + (te.totalMinutes || 0), 0);
    
    // Time logs (legacy system - stores hours as string in totalHours column)
    let timeLogsQuery = db
      .select({ totalHours: timeLogs.totalHours })
      .from(timeLogs);
    
    if (startDate && endDate) {
      timeLogsQuery = timeLogsQuery.where(and(
        sql`${timeLogs.date} >= ${startDate}`,
        sql`${timeLogs.date} <= ${endDate}`
      )) as typeof timeLogsQuery;
    } else if (startDate) {
      timeLogsQuery = timeLogsQuery.where(sql`${timeLogs.date} >= ${startDate}`) as typeof timeLogsQuery;
    } else if (endDate) {
      timeLogsQuery = timeLogsQuery.where(sql`${timeLogs.date} <= ${endDate}`) as typeof timeLogsQuery;
    }
    
    const allTimeLogs = await timeLogsQuery;
    const totalHoursFromLogs = allTimeLogs.reduce((sum, tl) => sum + parseFloat(tl.totalHours || "0"), 0);
    
    // Combine: convert time_entries minutes to hours and add time_logs hours
    const totalHours = Math.round(((totalMinutesFromEntries / 60) + totalHoursFromLogs) * 10) / 10;

    const recentProjectsResult = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.createdAt))
      .limit(5);

    const upcomingTasksResult = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        ne(tasks.status, "done"),
        ne(tasks.status, "cancelled"),
        sql`${tasks.dueDate} IS NOT NULL`
      ))
      .orderBy(tasks.dueDate)
      .limit(5);

    return {
      totalClients: clientCount.count,
      totalProjects: projectCount.count,
      activeProjects: activeCount.count,
      pendingTasks: pendingCount.count,
      totalHours,
      recentProjects: recentProjectsResult.map(r => ({
        ...r.projects,
        client: r.clients!,
      })),
      upcomingTasks: upcomingTasksResult.map(r => ({
        ...r.tasks,
        project: r.projects!,
      })),
    };
  }

  // Search
  async globalSearch(query: string): Promise<{
    clients: Client[];
    projects: (Project & { client: Client })[];
    associates: Associate[];
  }> {
    const searchPattern = `%${query}%`;

    const matchingClients = await db
      .select()
      .from(clients)
      .where(or(
        ilike(clients.name, searchPattern),
        ilike(clients.email, searchPattern),
        ilike(clients.phone, searchPattern),
        ilike(clients.company, searchPattern)
      ))
      .limit(10);

    const matchingProjects = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(or(
        ilike(projects.name, searchPattern),
        ilike(projects.address, searchPattern),
        ilike(projects.internalCode, searchPattern),
        ilike(projects.municipality, searchPattern)
      ))
      .limit(10);

    const matchingAssociates = await db
      .select()
      .from(associates)
      .where(or(
        ilike(associates.name, searchPattern),
        ilike(associates.company, searchPattern),
        ilike(associates.email, searchPattern)
      ))
      .limit(10);

    return {
      clients: matchingClients,
      projects: matchingProjects.map(r => ({
        ...r.projects,
        client: r.clients!,
      })),
      associates: matchingAssociates,
    };
  }

  // Newsletter
  async addNewsletterSubscriber(email: string): Promise<NewsletterSubscriber> {
    const [subscriber] = await db.insert(newsletterSubscribers).values({ email }).returning();
    return subscriber;
  }

  // Storage
  async getUserStorageUsage(userId: string): Promise<number> {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)` })
      .from(documents)
      .where(eq(documents.uploadedByUserId, userId));
    return result[0]?.total ?? 0;
  }

  // Task Reminders
  async getTaskReminders(taskId: number): Promise<TaskReminder[]> {
    return await db.select().from(taskReminders).where(eq(taskReminders.taskId, taskId)).orderBy(desc(taskReminders.scheduledAt));
  }

  async getAllReminders(): Promise<(TaskReminder & { task: Task; project: Project })[]> {
    const result = await db
      .select()
      .from(taskReminders)
      .innerJoin(tasks, eq(taskReminders.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .orderBy(desc(taskReminders.scheduledAt));
    return result.map(r => ({
      ...r.task_reminders,
      task: r.tasks,
      project: r.projects,
    }));
  }

  async createTaskReminder(reminder: InsertTaskReminder): Promise<TaskReminder> {
    const [newReminder] = await db.insert(taskReminders).values(reminder).returning();
    return newReminder;
  }

  async updateTaskReminder(id: number, reminder: Partial<InsertTaskReminder>): Promise<TaskReminder | undefined> {
    const [updated] = await db
      .update(taskReminders)
      .set(reminder)
      .where(eq(taskReminders.id, id))
      .returning();
    return updated;
  }

  async deleteTaskReminder(id: number): Promise<boolean> {
    const result = await db.delete(taskReminders).where(eq(taskReminders.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Invoices
  async getInvoices(): Promise<(Invoice & { project: Project; client: Client; items: InvoiceItem[] })[]> {
    const invoiceList = await db
      .select()
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .orderBy(desc(invoices.createdAt));
    
    const result = await Promise.all(invoiceList.map(async (r) => {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, r.invoices.id));
      return {
        ...r.invoices,
        project: r.projects!,
        client: r.clients!,
        items,
      };
    }));
    
    return result;
  }

  async getInvoicesByProjectId(projectId: number): Promise<(Invoice & { items: InvoiceItem[] })[]> {
    const invoiceList = await db
      .select()
      .from(invoices)
      .where(eq(invoices.projectId, projectId))
      .orderBy(desc(invoices.createdAt));
    
    const result = await Promise.all(invoiceList.map(async (inv) => {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
      return {
        ...inv,
        items,
      };
    }));
    
    return result;
  }

  async getInvoicesByClientId(clientId: number): Promise<(Invoice & { project: Project; items: InvoiceItem[] })[]> {
    const invoiceList = await db
      .select()
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .where(eq(invoices.clientId, clientId))
      .orderBy(desc(invoices.createdAt));
    
    const result = await Promise.all(invoiceList.map(async (r) => {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, r.invoices.id));
      return {
        ...r.invoices,
        project: r.projects!,
        items,
      };
    }));
    
    return result;
  }

  async getInvoice(id: number): Promise<(Invoice & { project: Project; client: Client; items: InvoiceItem[] }) | undefined> {
    const [result] = await db
      .select()
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.id, id));
    
    if (!result) return undefined;
    
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    
    return {
      ...result.invoices,
      project: result.projects!,
      client: result.clients!,
      items,
    };
  }

  async createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice & { items: InvoiceItem[] }> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    
    const createdItems: InvoiceItem[] = [];
    for (const item of items) {
      const [newItem] = await db.insert(invoiceItems).values({ ...item, invoiceId: newInvoice.id }).returning();
      createdItems.push(newItem);
    }
    
    return {
      ...newInvoice,
      items: createdItems,
    };
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    const result = await db.delete(invoices).where(eq(invoices.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const [lastInvoice] = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(sql`${invoices.invoiceNumber} LIKE ${`INV-${currentYear}-%`}`)
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);
    
    if (!lastInvoice) {
      return `INV-${currentYear}-0001`;
    }
    
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0');
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `INV-${currentYear}-${nextNumber}`;
  }
}

export const storage = new DatabaseStorage();
