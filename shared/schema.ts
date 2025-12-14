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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "client"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "waiting_on_client", "done"]);
export const taskTypeEnum = pgEnum("task_type", ["road", "office"]);
export const projectStatusEnum = pgEnum("project_status", ["active", "on_hold", "completed", "cancelled"]);
export const associateTypeEnum = pgEnum("associate_type", ["engineer", "architect", "surveyor", "village_contact", "consultant"]);

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

// Users table (IMPORTANT: mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
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
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  county: varchar("county", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects table (central object)
export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  county: varchar("county", { length: 100 }),
  status: projectStatusEnum("status").default("active").notNull(),
  startDate: timestamp("start_date"),
  targetEndDate: timestamp("target_end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  associateId: integer("associate_id").references(() => associates.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: taskTypeEnum("type").default("office").notNull(),
  status: taskStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notes table
export const notes = pgTable("notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Time Logs table
export const timeLogs = pgTable("time_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  taskDescription: text("task_description").notNull(),
  startTime: varchar("start_time", { length: 10 }),
  endTime: varchar("end_time", { length: 10 }),
  totalHours: varchar("total_hours", { length: 10 }).notNull(),
  type: taskTypeEnum("type").default("office").notNull(),
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
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.clientId],
    references: [clients.id],
  }),
  tasks: many(tasks),
  notes: many(notes),
  timeLogs: many(timeLogs),
  projectAssociates: many(projectAssociates),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  associate: one(associates, {
    fields: [tasks.associateId],
    references: [associates.id],
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimeLogSchema = createInsertSchema(timeLogs).omit({ id: true, createdAt: true });
export const insertAssociateSchema = createInsertSchema(associates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectAssociateSchema = createInsertSchema(projectAssociates).omit({ id: true, createdAt: true });

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
export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;
export type TimeLog = typeof timeLogs.$inferSelect;
export type InsertAssociate = z.infer<typeof insertAssociateSchema>;
export type Associate = typeof associates.$inferSelect;
export type InsertProjectAssociate = z.infer<typeof insertProjectAssociateSchema>;
export type ProjectAssociate = typeof projectAssociates.$inferSelect;
