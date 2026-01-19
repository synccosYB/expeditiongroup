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
export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "sent", "failed", "cancelled", "done", "postponed"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "cancelled"]);

// Client Portal enums
export const documentStatusEnum = pgEnum("document_status", ["uploaded", "under_review", "accepted", "rejected"]);
export const auditActionEnum = pgEnum("audit_action", ["login", "logout", "upload", "download", "view", "create", "update", "delete", "status_change", "document_uploaded", "document_reviewed", "document_accepted", "document_rejected"]);

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

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Password reset requests table (for admin to handle)
export const passwordResetRequestStatusEnum = pgEnum("password_reset_request_status", ["pending", "completed", "expired"]);

export const passwordResetRequests = pgTable("password_reset_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email").notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  status: passwordResetRequestStatusEnum("status").default("pending").notNull(),
  handledBy: varchar("handled_by").references(() => users.id),
  handledAt: timestamp("handled_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  hourlyRate: varchar("hourly_rate", { length: 20 }),
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
  isVisibleToClient: boolean("is_visible_to_client").default(false),
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

// Notes table - can be linked to project, task, associate, or client
export const notes = pgTable("notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  associateId: integer("associate_id").references(() => associates.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
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

// Daily Activity Logs table
export const dailyActivityLogs = pgTable("daily_activity_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  summary: text("summary").notNull(),
  details: text("details"),
  hoursWorked: varchar("hours_worked", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  isVisibleToClient: boolean("is_visible_to_client").default(false),
  documentStatus: documentStatusEnum("document_status").default("uploaded"),
  rejectionReason: text("rejection_reason"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
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
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  message: text("message"),
  status: reminderStatusEnum("status").default("pending").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  actionNote: text("action_note"),
  actionAt: timestamp("action_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Newsletter Subscribers table
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  hourlyRate: varchar("hourly_rate", { length: 20 }).notNull(),
  subtotal: varchar("subtotal", { length: 20 }).notNull(),
  tax: varchar("tax", { length: 20 }),
  total: varchar("total", { length: 20 }).notNull(),
  notes: text("notes"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  isVisibleToClient: boolean("is_visible_to_client").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Items table
export const invoiceItems = pgTable("invoice_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: varchar("quantity", { length: 20 }).notNull(),
  unitPrice: varchar("unit_price", { length: 20 }).notNull(),
  amount: varchar("amount", { length: 20 }).notNull(),
  timeLogId: integer("time_log_id").references(() => timeLogs.id, { onDelete: "set null" }),
  timeEntryId: integer("time_entry_id").references(() => timeEntries.id, { onDelete: "set null" }),
  isCustom: boolean("is_custom").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client Portal Settings table - controls what each client can see
export const clientPortalSettings = pgTable("client_portal_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }).unique(),
  showProjects: boolean("show_projects").default(true),
  showDocuments: boolean("show_documents").default(true),
  showInvoices: boolean("show_invoices").default(true),
  showMessages: boolean("show_messages").default(true),
  showMilestones: boolean("show_milestones").default(true),
  showTimeline: boolean("show_timeline").default(true),
  allowDocumentUpload: boolean("allow_document_upload").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Milestones table - for progress tracking
export const projectMilestones = pgTable("project_milestones", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  dueDate: timestamp("due_date"),
  orderIndex: integer("order_index").default(0),
  isVisibleToClient: boolean("is_visible_to_client").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document Requests table - for requesting specific documents from clients
export const documentRequests = pgTable("document_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  requestedByUserId: varchar("requested_by_user_id").references(() => users.id),
  documentType: varchar("document_type", { length: 100 }).notNull(),
  description: text("description"),
  isRequired: boolean("is_required").default(true),
  isFulfilled: boolean("is_fulfilled").default(false),
  fulfilledDocumentId: integer("fulfilled_document_id").references(() => documents.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit Logs table - for tracking all actions
export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").references(() => users.id),
  clientId: integer("client_id").references(() => clients.id),
  action: auditActionEnum("action").notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }),
  description: text("description"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Intake Application Status enum
export const intakeStatusEnum = pgEnum("intake_status", ["draft", "submitted", "under_review", "approved", "rejected"]);

// Intake Applications table - for planning/permit intake process
export const intakeApplications = pgTable("intake_applications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  
  // Applicant Information - Owner 1
  ownerName: varchar("owner_name", { length: 255 }),
  hasSecondOwner: boolean("has_second_owner").default(false),
  secondOwnerName: varchar("second_owner_name", { length: 255 }),
  businessName: varchar("business_name", { length: 255 }),
  homeNumber: varchar("home_number", { length: 50 }),
  cellNumber: varchar("cell_number", { length: 50 }),
  email: varchar("email", { length: 255 }),
  alternateEmail: varchar("alternate_email", { length: 255 }),
  currentAddress: text("current_address"),
  mailingAddress: text("mailing_address"),
  mailingAddressSameAsCurrent: boolean("mailing_address_same_as_current").default(false),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  ssOrFid: varchar("ss_or_fid", { length: 50 }),
  
  // Second Owner Information (if applicable)
  secondOwnerBusinessName: varchar("second_owner_business_name", { length: 255 }),
  secondOwnerHomeNumber: varchar("second_owner_home_number", { length: 50 }),
  secondOwnerCellNumber: varchar("second_owner_cell_number", { length: 50 }),
  secondOwnerEmail: varchar("second_owner_email", { length: 255 }),
  secondOwnerAlternateEmail: varchar("second_owner_alternate_email", { length: 255 }),
  secondOwnerCurrentAddress: text("second_owner_current_address"),
  secondOwnerMailingAddress: text("second_owner_mailing_address"),
  secondOwnerMailingAddressSameAsCurrent: boolean("second_owner_mailing_address_same_as_current").default(false),
  secondOwnerDateOfBirth: varchar("second_owner_date_of_birth", { length: 20 }),
  secondOwnerSsOrFid: varchar("second_owner_ss_or_fid", { length: 50 }),
  
  // Project Information
  projectName: varchar("project_name", { length: 255 }),
  section: varchar("section", { length: 50 }),
  block: varchar("block", { length: 50 }),
  lot: varchar("lot", { length: 50 }),
  currentZoning: varchar("current_zoning", { length: 100 }),
  
  // Location
  locationSide: varchar("location_side", { length: 100 }),
  locationStreet: varchar("location_street", { length: 255 }),
  locationFeet: varchar("location_feet", { length: 50 }),
  locationOf: varchar("location_of", { length: 255 }),
  locationTown: varchar("location_town", { length: 100 }),
  locationVillage: varchar("location_village", { length: 100 }),
  
  // Districts
  acreageOfParcel: varchar("acreage_of_parcel", { length: 50 }),
  zoningDistrict: varchar("zoning_district", { length: 100 }),
  schoolDistrict: varchar("school_district", { length: 100 }),
  postalDistrict: varchar("postal_district", { length: 100 }),
  fireDistrict: varchar("fire_district", { length: 100 }),
  ambulanceDistrict: varchar("ambulance_district", { length: 100 }),
  waterDistrict: varchar("water_district", { length: 100 }),
  sewerDistrict: varchar("sewer_district", { length: 100 }),
  
  // Project Description
  needDemolishHouse: boolean("need_demolish_house").default(false),
  wellBeingDone: boolean("well_being_done").default(false),
  temporaryElectricGasNeeded: boolean("temporary_electric_gas_needed").default(false),
  
  // Subdivision Questions
  varianceFromSubdivision: text("variance_from_subdivision"),
  openSpaceOffered: boolean("open_space_offered").default(false),
  openSpaceAmount: varchar("open_space_amount", { length: 100 }),
  subdivisionType: varchar("subdivision_type", { length: 100 }),
  
  // Site Plan Questions
  totalBuildingSize: varchar("total_building_size", { length: 100 }),
  proposedAddition: varchar("proposed_addition", { length: 255 }),
  numberOfDwellingUnits: varchar("number_of_dwelling_units", { length: 50 }),
  
  // Special Permit Questions
  specialPermitUse: text("special_permit_use"),
  
  // Site Characteristics
  hasSlopesGreaterThan25: boolean("has_slopes_greater_than_25").default(false),
  slopesDetails: text("slopes_details"),
  hasStreams: boolean("has_streams").default(false),
  streamsNames: text("streams_names"),
  hasWetlands: boolean("has_wetlands").default(false),
  wetlandsDetails: text("wetlands_details"),
  
  // Project History
  hasBeenReviewedBefore: boolean("has_been_reviewed_before").default(false),
  projectHistoryNarrative: text("project_history_narrative"),
  abuttingPropertiesTaxMap: text("abutting_properties_tax_map"),
  
  // Proximity to Features (stored as JSON array of selected options)
  proximityFeatures: jsonb("proximity_features").default([]),
  
  // Referral Agencies (stored as JSON array of selected agencies)
  referralAgencies: jsonb("referral_agencies").default([]),
  adjacentMunicipality: varchar("adjacent_municipality", { length: 255 }),
  
  // Boards / Approvals Needed (stored as JSON)
  boardsApprovals: jsonb("boards_approvals").default({}),
  numberOfLots: varchar("number_of_lots", { length: 50 }),
  
  // DEC/USACOA applications
  nydecApplicationNeeded: boolean("nydec_application_needed").default(false),
  usacoaApplicationNeeded: boolean("usacoa_application_needed").default(false),
  
  // Status and metadata
  status: intakeStatusEnum("status").default("draft").notNull(),
  submittedAt: timestamp("submitted_at"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  
  // Linkage to CRM entities (single source of truth)
  linkedClientId: integer("linked_client_id").references(() => clients.id),
  linkedProjectId: integer("linked_project_id").references(() => projects.id),
  convertedAt: timestamp("converted_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  task: one(tasks, {
    fields: [notes.taskId],
    references: [tasks.id],
  }),
  associate: one(associates, {
    fields: [notes.associateId],
    references: [associates.id],
  }),
  client: one(clients, {
    fields: [notes.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
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

export const dailyActivityLogsRelations = relations(dailyActivityLogs, ({ one }) => ({
  user: one(users, {
    fields: [dailyActivityLogs.userId],
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

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  project: one(projects, {
    fields: [invoices.projectId],
    references: [projects.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  timeLog: one(timeLogs, {
    fields: [invoiceItems.timeLogId],
    references: [timeLogs.id],
  }),
  timeEntry: one(timeEntries, {
    fields: [invoiceItems.timeEntryId],
    references: [timeEntries.id],
  }),
}));

export const clientPortalSettingsRelations = relations(clientPortalSettings, ({ one }) => ({
  client: one(clients, {
    fields: [clientPortalSettings.clientId],
    references: [clients.id],
  }),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one }) => ({
  project: one(projects, {
    fields: [projectMilestones.projectId],
    references: [projects.id],
  }),
}));

export const documentRequestsRelations = relations(documentRequests, ({ one }) => ({
  project: one(projects, {
    fields: [documentRequests.projectId],
    references: [projects.id],
  }),
  client: one(clients, {
    fields: [documentRequests.clientId],
    references: [clients.id],
  }),
  requestedByUser: one(users, {
    fields: [documentRequests.requestedByUserId],
    references: [users.id],
  }),
  fulfilledDocument: one(documents, {
    fields: [documentRequests.fulfilledDocumentId],
    references: [documents.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [auditLogs.clientId],
    references: [clients.id],
  }),
}));

export const intakeApplicationsRelations = relations(intakeApplications, ({ one }) => ({
  createdByUser: one(users, {
    fields: [intakeApplications.createdByUserId],
    references: [users.id],
  }),
  linkedProject: one(projects, {
    fields: [intakeApplications.linkedProjectId],
    references: [projects.id],
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
const requiredDateCoercion = z.preprocess((val) => {
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return val;
}, z.date());

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true }).extend({
  date: requiredDateCoercion,
});
export const insertTimeLogSchema = createInsertSchema(timeLogs).omit({ id: true, createdAt: true }).extend({
  date: requiredDateCoercion,
});
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
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true, paidAt: true }).extend({
  dueDate: dateCoercion,
});
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true });
export const insertDailyActivityLogSchema = createInsertSchema(dailyActivityLogs).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  date: requiredDateCoercion,
});

// Client Portal insert schemas
export const insertClientPortalSettingsSchema = createInsertSchema(clientPortalSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectMilestoneSchema = createInsertSchema(projectMilestones).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  completedAt: dateCoercion,
  dueDate: dateCoercion,
});
export const insertDocumentRequestSchema = createInsertSchema(documentRequests).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  dueDate: dateCoercion,
});
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertIntakeApplicationSchema = createInsertSchema(intakeApplications).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  submittedAt: dateCoercion,
  convertedAt: dateCoercion,
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
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertDailyActivityLog = z.infer<typeof insertDailyActivityLogSchema>;
export type DailyActivityLog = typeof dailyActivityLogs.$inferSelect;

// Client Portal types
export type InsertClientPortalSettings = z.infer<typeof insertClientPortalSettingsSchema>;
export type ClientPortalSettings = typeof clientPortalSettings.$inferSelect;
export type InsertProjectMilestone = z.infer<typeof insertProjectMilestoneSchema>;
export type ProjectMilestone = typeof projectMilestones.$inferSelect;
export type InsertDocumentRequest = z.infer<typeof insertDocumentRequestSchema>;
export type DocumentRequest = typeof documentRequests.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertIntakeApplication = z.infer<typeof insertIntakeApplicationSchema>;
export type IntakeApplication = typeof intakeApplications.$inferSelect;
