import {
  users,
  clients,
  projects,
  tasks,
  notes,
  timeLogs,
  associates,
  projectAssociates,
  newsletterSubscribers,
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
  type Associate,
  type InsertAssociate,
  type ProjectAssociate,
  type InsertProjectAssociate,
  type NewsletterSubscriber,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  
  getProjects(): Promise<(Project & { client: Client })[]>;
  getProjectsByClientId(clientId: number): Promise<(Project & { client: Client })[]>;
  getProject(id: number): Promise<(Project & { client: Client; tasks: Task[]; notes: (Note & { user: User })[]; timeLogs: TimeLog[] }) | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  getTasks(): Promise<(Task & { project: Project })[]>;
  getTasksByProjectId(projectId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<boolean>;
  
  createNote(note: InsertNote): Promise<Note>;
  
  getTimeLogs(): Promise<(TimeLog & { project: Project })[]>;
  getTimeLogsByProjectId(projectId: number): Promise<TimeLog[]>;
  createTimeLog(timeLog: InsertTimeLog): Promise<TimeLog>;
  
  getAssociates(): Promise<Associate[]>;
  getAssociate(id: number): Promise<Associate | undefined>;
  createAssociate(associate: InsertAssociate): Promise<Associate>;
  updateAssociate(id: number, associate: Partial<InsertAssociate>): Promise<Associate | undefined>;
  deleteAssociate(id: number): Promise<boolean>;
  
  getDashboardStats(): Promise<{
    totalClients: number;
    totalProjects: number;
    activeProjects: number;
    pendingTasks: number;
    recentProjects: (Project & { client: Client })[];
    upcomingTasks: (Task & { project: Project })[];
  }>;
  
  addNewsletterSubscriber(email: string): Promise<NewsletterSubscriber>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
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

  async getProject(id: number): Promise<(Project & { client: Client; tasks: Task[]; notes: (Note & { user: User })[]; timeLogs: TimeLog[] }) | undefined> {
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

    return {
      ...projectResult.projects,
      client: projectResult.clients!,
      tasks: projectTasks,
      notes: notesResult.map(r => ({
        ...r.notes,
        user: r.users!,
      })),
      timeLogs: projectTimeLogs,
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

  async getTasks(): Promise<(Task & { project: Project })[]> {
    const result = await db
      .select()
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .orderBy(desc(tasks.createdAt));
    
    return result.map(r => ({
      ...r.tasks,
      project: r.projects!,
    }));
  }

  async getTasksByProjectId(projectId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
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

  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await db.insert(notes).values(note).returning();
    return newNote;
  }

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

  async getAssociates(): Promise<Associate[]> {
    return await db.select().from(associates).orderBy(desc(associates.createdAt));
  }

  async getAssociate(id: number): Promise<Associate | undefined> {
    const [associate] = await db.select().from(associates).where(eq(associates.id, id));
    return associate;
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

  async getDashboardStats(): Promise<{
    totalClients: number;
    totalProjects: number;
    activeProjects: number;
    pendingTasks: number;
    recentProjects: (Project & { client: Client })[];
    upcomingTasks: (Task & { project: Project })[];
  }> {
    const [clientCount] = await db.select({ count: count() }).from(clients);
    const [projectCount] = await db.select({ count: count() }).from(projects);
    const [activeCount] = await db.select({ count: count() }).from(projects).where(eq(projects.status, "active"));
    const [pendingCount] = await db.select({ count: count() }).from(tasks).where(eq(tasks.status, "pending"));

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
        sql`${tasks.status} != 'done'`,
        sql`${tasks.dueDate} IS NOT NULL`
      ))
      .orderBy(tasks.dueDate)
      .limit(5);

    return {
      totalClients: clientCount.count,
      totalProjects: projectCount.count,
      activeProjects: activeCount.count,
      pendingTasks: pendingCount.count,
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

  async addNewsletterSubscriber(email: string): Promise<NewsletterSubscriber> {
    const [subscriber] = await db.insert(newsletterSubscribers).values({ email }).returning();
    return subscriber;
  }
}

export const storage = new DatabaseStorage();
