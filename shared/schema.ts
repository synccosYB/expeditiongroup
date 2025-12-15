import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "client"]);
export const clientTypeEnum = pgEnum("client_type", ["homeowner", "contractor", "other"]);
export const clientStatusEnum = pgEnum("client_status", ["active", "inactive"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "waiting", "done", "cancelled"]);
export const taskTypeEnum = pgEnum("task_type", ["phone_call", "email", "filing", "research", "site_visit", "document_prep", "other"]);
export const taskLocationEnum = pgEnum("task_location", ["office", "road"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);
export const projectStatusEnum = pgEnum("project_status", ["intake", "in_progress", "waiting_on_client", "with_dob", "completed", "on_hold", "cancelled"]);
export const projectTypeEnum = pgEnum("project_type", ["violation_removal", "permit", "co", "blue_roof", "survey", "other"]);
export const projectPriorityEnum = pgEnum("project_priority", ["low", "normal", "high", "urgent"]);
export const associateTypeEnum = pgEnum("associate_type", ["engineer", "architect", "surveyor", "lawyer", "contractor", "dob_contact", "village_contact", "consultant", "other"]);
export const documentCategoryEnum = pgEnum("document_category", ["plan", "permit", "survey", "dob_letter", "correspondence", "legal", "photo", "inspection", "other"]);
export const reminderChannelEnum = pgEnum("reminder_channel", ["email", "sms", "whatsapp"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "sent", "failed", "cancelled"]);

// Session storage table (IMPORTANT: mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").default("client").notNull(),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  clientType: clientTypeEnum("client_type").default("homeowner"),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  county: varchar("county", { length: 100 }),
  billingAddress: text("billing_address"),
  billingCity: varchar("billing_city", { length: 100 }),
  billingState: varchar("billing_state", { length: 50 }),
  billingZip: varchar("billing_zip", { length: 20 }),
  notes: text("notes"),
  status: clientStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects table (central object - also called Jobs)
export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  county: varchar("county", { length: 100 }),
  jurisdiction: varchar("jurisdiction", { length: 255 }),
  jurisdictionAddress: text("jurisdiction_address"),
  municipality: varchar("municipality", { length: 255 }),
  jobType: projectTypeEnum("job_type").default("other"),
  status: projectStatusEnum("status").default("intake").notNull(),
  priority: projectPriorityEnum("priority").default("normal"),
  internalCode: varchar("internal_code", { length: 50 }),
  assignedAdminId: varchar("assigned_admin_id").references(() => users.id),
  startDate: timestamp("start_date"),
  targetEndDate: timestamp("target_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table (with self-reference for subtasks)
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentTaskId: integer("parent_task_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: taskTypeEnum("type").default("other").notNull(),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("normal"),
  locationType: taskLocationEnum("location_type").default("office"),
  assigneeId: varchar("assignee_id").references(() => users.id),
  relatedClientId: integer("related_client_id").references(() => clients.id),
  relatedAssociateId: integer("related_associate_id").references(() => associates.id),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  internalNotes: text("internal_notes"),
  requiresClientUpload: boolean("requires_client_upload").default(false),
  requestedDocumentType: varchar("requested_document_type", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notes table
export const notes = pgTable("notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  clientId: integer("client_id").references(() => clients.id),
  content: text("content").notNull(),
  isVisibleToClient: boolean("is_visible_to_client").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Time Entries table (linked to tasks)
export const timeEntries = pgTable("time_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  totalMinutes: integer("total_minutes").notNull(),
  isBillable: boolean("is_billable").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Legacy Time Logs table (kept for backward compatibility)
export const timeLogs = pgTable("time_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  taskDescription: text("task_description").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  totalHours: varchar("total_hours", { length: 10 }).notNull(),
  type: taskLocationEnum("type").default("office").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Associates table
export const associates = pgTable("associates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  type: associateTypeEnum("type").notNull(),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project-Associate junction table
export const projectAssociates = pgTable("project_associates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  associateId: integer("associate_id").notNull().references(() => associates.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Folders table
export const folders = pgTable("folders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => folders.id, { onDelete: "set null" }),
  uploadedByUserId: varchar("uploaded_by_user_id").references(() => users.id),
  uploadedByClientId: integer("uploaded_by_client_id").references(() => clients.id),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storagePath: text("storage_path").notNull(),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"),
  category: documentCategoryEnum("category").default("other"),
  tags: text("tags"),
  isVisibleToClient: boolean("is_visible_to_client").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Checklist Templates table
export const checklistTemplates = pgTable("checklist_templates", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Checklist Instances table (per project)
export const checklistInstances = pgTable("checklist_instances", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  templateId: integer("template_id").references(() => checklistTemplates.id),
  name: varchar("name", { length: 255 }).notNull(),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Task Reminders table
export const taskReminders = pgTable("task_reminders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  channel: reminderChannelEnum("channel").notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 50 }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  message: text("message"),
  status: reminderStatusEnum("status").default("pending").notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Newsletter Subscribers table
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  client: one(clients, {
    fields: [users.clientId],
    references: [clients.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
  users: many(users),
  documents: many(documents),
  notes: many(notes),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  assignedAdmin: one(users, {
    fields: [projects.assignedAdminId],
    references: [users.id],
  }),
  tasks: many(tasks),
  notes: many(notes),
  timeLogs: many(timeLogs),
  timeEntries: many(timeEntries),
  projectAssociates: many(projectAssociates),
  folders: many(folders),
  documents: many(documents),
  checklistInstances: many(checklistInstances),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  parentTask: one(tasks, {
    fields: [tasks.parentTaskId],
    references: [tasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(tasks, { relationName: "subtasks" }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  relatedClient: one(clients, {
    fields: [tasks.relatedClientId],
    references: [clients.id],
  }),
  relatedAssociate: one(associates, {
    fields: [tasks.relatedAssociateId],
    references: [associates.id],
  }),
  timeEntries: many(timeEntries),
  reminders: many(taskReminders),
}));

export const taskRemindersRelations = relations(taskReminders, ({ one }) => ({
  task: one(tasks, {
    fields: [taskReminders.taskId],
    references: [tasks.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  project: one(projects, {
    fields: [notes.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [notes.clientId],
    references: [clients.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  task: one(tasks, {
    fields: [timeEntries.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [timeEntries.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
}));

export const timeLogsRelations = relations(timeLogs, ({ one }) => ({
  project: one(projects, {
    fields: [timeLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [timeLogs.userId],
    references: [users.id],
  }),
}));

export const associatesRelations = relations(associates, ({ many }) => ({
  tasks: many(tasks),
  projectAssociates: many(projectAssociates),
}));

export const projectAssociatesRelations = relations(projectAssociates, ({ one }) => ({
  project: one(projects, {
    fields: [projectAssociates.projectId],
    references: [projects.id],
  }),
  associate: one(associates, {
    fields: [projectAssociates.associateId],
    references: [associates.id],
  }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  project: one(projects, {
    fields: [folders.projectId],
    references: [projects.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  folder: one(folders, {
    fields: [documents.folderId],
    references: [folders.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedByUserId],
    references: [users.id],
  }),
  uploadedByClient: one(clients, {
    fields: [documents.uploadedByClientId],
    references: [clients.id],
  }),
}));

export const checklistTemplatesRelations = relations(checklistTemplates, ({ many }) => ({
  instances: many(checklistInstances),
}));

export const checklistInstancesRelations = relations(checklistInstances, ({ one }) => ({
  project: one(projects, {
    fields: [checklistInstances.projectId],
    references: [projects.id],
  }),
  template: one(checklistTemplates, {
    fields: [checklistInstances.templateId],
    references: [checklistTemplates.id],
  }),
}));

// Insert schemas
export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
const dateCoercion = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return val;
}, z.date().nullable().optional());

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  startDate: dateCoercion,
  targetEndDate: dateCoercion,
  actualEndDate: dateCoercion,
});
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  dueDate: dateCoercion,
  completedAt: dateCoercion,
});
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true });
export const insertTimeLogSchema = createInsertSchema(timeLogs).omit({ id: true, createdAt: true });
export const insertAssociateSchema = createInsertSchema(associates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectAssociateSchema = createInsertSchema(projectAssociates).omit({ id: true, createdAt: true });
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChecklistInstanceSchema = createInsertSchema(checklistInstances).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskReminderSchema = createInsertSchema(taskReminders).omit({ id: true, createdAt: true, sentAt: true, errorMessage: true }).extend({
  scheduledAt: z.preprocess((val) => {
    if (val instanceof Date) return val;
    if (typeof val === 'string') return new Date(val);
    return val;
  }, z.date()),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;
export type TimeLog = typeof timeLogs.$inferSelect;
export type InsertAssociate = z.infer<typeof insertAssociateSchema>;
export type Associate = typeof associates.$inferSelect;
export type InsertProjectAssociate = z.infer<typeof insertProjectAssociateSchema>;
export type ProjectAssociate = typeof projectAssociates.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistInstance = z.infer<typeof insertChecklistInstanceSchema>;
export type ChecklistInstance = typeof checklistInstances.$inferSelect;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertTaskReminder = z.infer<typeof insertTaskReminderSchema>;
export type TaskReminder = typeof taskReminders.$inferSelect;
