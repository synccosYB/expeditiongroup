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
  dailyActivityLogs,
  clientPortalSettings,
  projectMilestones,
  documentRequests,
  auditLogs,
  intakeApplications,
  salesContacts,
  services,
  proposals,
  proposalItems,
  accounts,
  vendors,
  bankAccounts,
  bankTransactions,
  expenses,
  bills,
  billItems,
  billPayments,
  bankReconciliations,
  payments,
  deposits,
  journalEntries,
  journalEntryLines,
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
  type FolderTemplate,
  type InsertFolderTemplate,
  folderTemplates,
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
  type DailyActivityLog,
  type InsertDailyActivityLog,
  type ClientPortalSettings,
  type InsertClientPortalSettings,
  type ProjectMilestone,
  type InsertProjectMilestone,
  type DocumentRequest,
  type InsertDocumentRequest,
  type AuditLog,
  type InsertAuditLog,
  type IntakeApplication,
  type InsertIntakeApplication,
  type SalesContact,
  type InsertSalesContact,
  type Service,
  type InsertService,
  type Proposal,
  type InsertProposal,
  type ProposalItem,
  type InsertProposalItem,
  type Account,
  type InsertAccount,
  type Vendor,
  type InsertVendor,
  type BankAccount,
  type InsertBankAccount,
  type BankTransaction,
  type InsertBankTransaction,
  type Expense,
  type InsertExpense,
  type Bill,
  type InsertBill,
  type BillItem,
  type InsertBillItem,
  type BillPayment,
  type InsertBillPayment,
  type BankReconciliation,
  type InsertBankReconciliation,
  type Payment,
  type InsertPayment,
  type Deposit,
  type InsertDeposit,
  type JournalEntry,
  type InsertJournalEntry,
  type JournalEntryLine,
  type InsertJournalEntryLine,
} from "@shared/schema";
import { db } from "./db";
export { db };
import { eq, desc, and, count, sql, isNull, isNotNull, ne, or, ilike, inArray, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAdminUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  updateUserRole(id: string, role: "admin" | "client"): Promise<User | undefined>;
  linkUserToClient(userId: string, clientId: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;
  getClientRelatedDataCounts(id: number): Promise<{ projects: number; documents: number; notes: number; tasks: number; timeLogs: number; timeEntries: number; invoices: number } | undefined>;
  archiveClient(id: number): Promise<{ success: boolean; client?: Client; error?: string }>;
  permanentlyDeleteClient(id: number): Promise<{ success: boolean; error?: string }>;
  
  // Projects
  getProjects(): Promise<(Project & { client: Client })[]>;
  getProjectsByClientId(clientId: number): Promise<(Project & { client: Client })[]>;
  getProject(id: number): Promise<(Project & { client: Client; tasks: Task[]; notes: (Note & { user?: User })[]; timeLogs: (TimeLog & { user?: User })[]; timeEntries: TimeEntry[] }) | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  getProjectsByStatus(): Promise<{ status: string; count: number }[]>;
  getProjectRelatedDataCounts(id: number): Promise<{ documents: number; notes: number; tasks: number; timeLogs: number; timeEntries: number } | undefined>;
  archiveProject(id: number): Promise<{ success: boolean; project?: Project; error?: string }>;
  permanentlyDeleteProject(id: number): Promise<{ success: boolean; error?: string }>;
  
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
  getFoldersByAssociateId(associateId: number): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(id: number, folder: Partial<InsertFolder>): Promise<Folder | undefined>;
  deleteFolder(id: number): Promise<boolean>;
  
  // Documents
  getDocumentsByProjectId(projectId: number): Promise<Document[]>;
  getDocumentsByAssociateId(associateId: number): Promise<Document[]>;
  getDocumentsByFolderId(folderId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentByStoragePath(storagePath: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Folder Templates
  getFolderTemplates(entityType?: string): Promise<FolderTemplate[]>;
  getFolderTemplate(id: number): Promise<FolderTemplate | undefined>;
  createFolderTemplate(template: InsertFolderTemplate): Promise<FolderTemplate>;
  updateFolderTemplate(id: number, template: Partial<InsertFolderTemplate>): Promise<FolderTemplate | undefined>;
  deleteFolderTemplate(id: number): Promise<boolean>;

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
  getInvoices(): Promise<(Invoice & { project: Project | null; client: Client | null; items: InvoiceItem[] })[]>;
  getInvoicesByProjectId(projectId: number): Promise<(Invoice & { items: InvoiceItem[] })[]>;
  getInvoicesByClientId(clientId: number): Promise<(Invoice & { project: Project | null; items: InvoiceItem[] })[]>;
  getInvoice(id: number): Promise<(Invoice & { project: Project | null; client: Client | null; items: InvoiceItem[] }) | undefined>;
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice & { items: InvoiceItem[] }>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  replaceInvoiceItems(invoiceId: number, items: InsertInvoiceItem[]): Promise<InvoiceItem[]>;
  getNextInvoiceNumber(): Promise<string>;
  getInvoiceStats(): Promise<{ totalInvoiced: number; totalPaid: number; totalUnpaid: number; totalUnbilled: number }>;
  getUnbilledTimeEntries(): Promise<{ projectId: number; projectName: string; clientName: string; totalMinutes: number; estimatedAmount: number }[]>;
  
  // Daily Activity Logs
  getDailyActivityLogs(userId?: string): Promise<DailyActivityLog[]>;
  getDailyActivityLog(id: number): Promise<DailyActivityLog | undefined>;
  createDailyActivityLog(log: InsertDailyActivityLog): Promise<DailyActivityLog>;
  updateDailyActivityLog(id: number, log: Partial<InsertDailyActivityLog>): Promise<DailyActivityLog | undefined>;
  deleteDailyActivityLog(id: number): Promise<boolean>;
  
  // Client Portal Settings
  getClientPortalSettings(clientId: number): Promise<ClientPortalSettings | undefined>;
  upsertClientPortalSettings(settings: InsertClientPortalSettings): Promise<ClientPortalSettings>;
  
  // Project Milestones
  getMilestonesByProjectId(projectId: number): Promise<ProjectMilestone[]>;
  getClientVisibleMilestones(projectId: number): Promise<ProjectMilestone[]>;
  createMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone>;
  updateMilestone(id: number, milestone: Partial<InsertProjectMilestone>): Promise<ProjectMilestone | undefined>;
  deleteMilestone(id: number): Promise<boolean>;
  
  // Document Requests
  getDocumentRequestsByProjectId(projectId: number): Promise<DocumentRequest[]>;
  getDocumentRequestsByClientId(clientId: number): Promise<(DocumentRequest & { project: Project })[]>;
  createDocumentRequest(request: InsertDocumentRequest): Promise<DocumentRequest>;
  updateDocumentRequest(id: number, request: Partial<InsertDocumentRequest>): Promise<DocumentRequest | undefined>;
  deleteDocumentRequest(id: number): Promise<boolean>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByUserId(userId: string): Promise<AuditLog[]>;
  getAuditLogsByClientId(clientId: number): Promise<AuditLog[]>;
  getRecentActivityByClientId(clientId: number, limit?: number): Promise<AuditLog[]>;
  
  // Date Range Queries for Activity Generation
  getTimeEntriesForDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]>;
  getTimeLogsForDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeLog[]>;
  getNotesCreatedForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Note[]>;
  getDocumentsProcessedForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Document[]>;
  getTasksCompletedForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]>;
  getAuditLogsForDateRange(userId: string, startDate: Date, endDate: Date): Promise<AuditLog[]>;
  
  // Client Portal specific queries
  getClientVisibleProjects(clientId: number): Promise<(Project & { client: Client })[]>;
  getClientVisibleDocuments(projectId: number): Promise<Document[]>;
  getClientVisibleInvoices(clientId: number): Promise<(Invoice & { project: Project | null; items: InvoiceItem[] })[]>;
  getClientVisibleNotes(projectId: number): Promise<(Note & { user?: User })[]>;
  
  // Intake Applications
  getIntakeApplications(): Promise<IntakeApplication[]>;
  getIntakeApplication(id: number): Promise<IntakeApplication | undefined>;
  getIntakeApplicationByProjectId(projectId: number): Promise<IntakeApplication | undefined>;
  createIntakeApplication(application: InsertIntakeApplication): Promise<IntakeApplication>;
  updateIntakeApplication(id: number, application: Partial<InsertIntakeApplication>): Promise<IntakeApplication | undefined>;
  deleteIntakeApplication(id: number): Promise<boolean>;
  
  // Services (for proposals)
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByCategory(category: string): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;
  
  // Proposals (sales pipeline)
  getProposals(): Promise<(Proposal & { client?: Client; items: ProposalItem[] })[]>;
  getProposal(id: number): Promise<(Proposal & { client?: Client; items: ProposalItem[] }) | undefined>;
  createProposal(proposal: InsertProposal, items: InsertProposalItem[]): Promise<Proposal & { items: ProposalItem[] }>;
  updateProposal(id: number, proposal: Partial<InsertProposal>): Promise<Proposal | undefined>;
  deleteProposal(id: number): Promise<boolean>;
  getNextProposalNumber(): Promise<string>;
  
  // Proposal Items
  addProposalItem(item: InsertProposalItem): Promise<ProposalItem>;
  updateProposalItem(id: number, item: Partial<InsertProposalItem>): Promise<ProposalItem | undefined>;
  deleteProposalItem(id: number): Promise<boolean>;
  
  // Bookkeeping - Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  getAccountByCode(code: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: number): Promise<boolean>;

  // Bookkeeping - Vendors
  getVendors(): Promise<Vendor[]>;
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendorBalances(): Promise<{ vendorId: number; balance: string }[]>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: number): Promise<boolean>;

  // Bookkeeping - Bank Accounts
  getBankAccounts(): Promise<BankAccount[]>;
  getBankAccount(id: number): Promise<BankAccount | undefined>;
  createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: number, bankAccount: Partial<InsertBankAccount>): Promise<BankAccount | undefined>;
  deleteBankAccount(id: number): Promise<boolean>;

  // Bookkeeping - Bank Transactions
  getBankTransactions(bankAccountId?: number): Promise<(BankTransaction & { vendor?: Vendor; account?: Account })[]>;
  getBankTransaction(id: number): Promise<BankTransaction | undefined>;
  createBankTransaction(transaction: InsertBankTransaction): Promise<BankTransaction>;
  updateBankTransaction(id: number, transaction: Partial<InsertBankTransaction>): Promise<BankTransaction | undefined>;
  deleteBankTransaction(id: number): Promise<boolean>;

  // Bookkeeping - Expenses
  getExpenses(): Promise<(Expense & { vendor?: Vendor; account?: Account; bankAccount?: BankAccount; rebillableClient?: Client; rebillableProject?: Project; bill?: Bill })[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  getRebillableExpenses(clientId?: number, projectId?: number): Promise<(Expense & { vendor?: Vendor })[]>;
  getUnrebilledExpenses(): Promise<(Expense & { vendor?: Vendor; rebillableClient?: Client; rebillableProject?: Project })[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<boolean>;
  markExpensesAsRebilled(expenseIds: number[], invoiceId: number): Promise<boolean>;

  // Bookkeeping - Bills
  getBills(): Promise<(Bill & { vendor: Vendor; items: BillItem[] })[]>;
  getBill(id: number): Promise<(Bill & { vendor: Vendor; items: BillItem[]; payments: BillPayment[] }) | undefined>;
  createBill(bill: InsertBill, items: InsertBillItem[]): Promise<Bill & { items: BillItem[] }>;
  updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined>;
  deleteBill(id: number): Promise<boolean>;
  getNextBillNumber(): Promise<string>;

  // Bookkeeping - Bill Payments
  getBillPayment(id: number): Promise<BillPayment | undefined>;
  createBillPayment(payment: InsertBillPayment): Promise<BillPayment>;
  updateBillPayment(id: number, payment: Partial<InsertBillPayment>): Promise<BillPayment | undefined>;
  deleteBillPayment(id: number): Promise<boolean>;

  // Bookkeeping - Bank Reconciliations
  getBankReconciliations(bankAccountId: number): Promise<BankReconciliation[]>;
  getBankReconciliation(id: number): Promise<BankReconciliation | undefined>;
  createBankReconciliation(reconciliation: InsertBankReconciliation): Promise<BankReconciliation>;
  updateBankReconciliation(id: number, reconciliation: Partial<InsertBankReconciliation>): Promise<BankReconciliation | undefined>;
  completeBankReconciliation(id: number, userId: string): Promise<BankReconciliation | undefined>;

  // Customer Payments (Undeposited Funds)
  getPayments(): Promise<(Payment & { client: Client; invoice?: Invoice })[]>;
  getPayment(id: number): Promise<(Payment & { client: Client; invoice?: Invoice }) | undefined>;
  getUndepositedPayments(): Promise<(Payment & { client: Client; invoice?: Invoice })[]>;
  getPaymentsByClientId(clientId: number): Promise<(Payment & { invoice?: Invoice })[]>;
  getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  deletePayment(id: number): Promise<boolean>;
  getNextPaymentNumber(): Promise<string>;
  getUndepositedFundsTotal(): Promise<number>;

  // Deposits (Batch payments to bank account)
  getDeposits(): Promise<(Deposit & { bankAccount: BankAccount; payments: Payment[] })[]>;
  getDeposit(id: number): Promise<(Deposit & { bankAccount: BankAccount; payments: (Payment & { client: Client; invoice?: Invoice })[] }) | undefined>;
  createDeposit(deposit: InsertDeposit, paymentIds: number[]): Promise<Deposit & { payments: Payment[] }>;
  deleteDeposit(id: number): Promise<boolean>;

  // General Journal Entries
  getJournalEntries(): Promise<(JournalEntry & { lines: (JournalEntryLine & { account: Account })[] })[]>;
  getJournalEntry(id: number): Promise<(JournalEntry & { lines: (JournalEntryLine & { account: Account })[] }) | undefined>;
  createJournalEntry(entry: InsertJournalEntry, lines: InsertJournalEntryLine[]): Promise<JournalEntry & { lines: JournalEntryLine[] }>;
  updateJournalEntry(id: number, entry: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number): Promise<boolean>;
  getNextJournalEntryNumber(): Promise<string>;
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

  async linkUserToClient(userId: string, clientId: number): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ clientId, role: "client", updatedAt: new Date() })
      .where(eq(users.id, userId))
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

  async getClientRelatedDataCounts(id: number): Promise<{ projects: number; documents: number; notes: number; tasks: number; timeLogs: number; timeEntries: number; invoices: number } | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return undefined;

    const [projectsCount] = await db.select({ count: count() }).from(projects).where(eq(projects.clientId, id));
    const [docsCount] = await db.select({ count: count() }).from(documents).where(
      sql`${documents.projectId} IN (SELECT id FROM projects WHERE client_id = ${id})`
    );
    const [notesCount] = await db.select({ count: count() }).from(notes).where(eq(notes.clientId, id));
    const [tasksCount] = await db.select({ count: count() }).from(tasks).where(
      sql`${tasks.projectId} IN (SELECT id FROM projects WHERE client_id = ${id})`
    );
    const [timeLogsCount] = await db.select({ count: count() }).from(timeLogs).where(
      sql`${timeLogs.projectId} IN (SELECT id FROM projects WHERE client_id = ${id})`
    );
    const [timeEntriesCount] = await db.select({ count: count() }).from(timeEntries).where(
      sql`${timeEntries.projectId} IN (SELECT id FROM projects WHERE client_id = ${id})`
    );
    const [invoicesCount] = await db.select({ count: count() }).from(invoices).where(eq(invoices.clientId, id));

    return {
      projects: projectsCount.count,
      documents: docsCount.count,
      notes: notesCount.count,
      tasks: tasksCount.count,
      timeLogs: timeLogsCount.count,
      timeEntries: timeEntriesCount.count,
      invoices: invoicesCount.count,
    };
  }

  async archiveClient(id: number): Promise<{ success: boolean; client?: Client; error?: string }> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const counts = await this.getClientRelatedDataCounts(id);
    if (counts && (counts.projects > 0 || counts.documents > 0 || counts.notes > 0 || counts.tasks > 0 || counts.timeLogs > 0 || counts.timeEntries > 0 || counts.invoices > 0)) {
      return { success: false, error: "Cannot archive client with attached data. Delete all projects, documents, notes, tasks, time logs, and invoices first." };
    }

    const [updated] = await db
      .update(clients)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return { success: true, client: updated };
  }

  async permanentlyDeleteClient(id: number): Promise<{ success: boolean; error?: string }> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) {
      return { success: false, error: "Client not found" };
    }
    if (client.status !== "archived") {
      return { success: false, error: "Client must be archived before permanent deletion" };
    }

    await db.delete(clients).where(eq(clients.id, id));
    return { success: true };
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

  async getProject(id: number): Promise<(Project & { client: Client; tasks: Task[]; notes: (Note & { user?: User })[]; timeLogs: (TimeLog & { user?: User })[]; timeEntries: TimeEntry[] }) | undefined> {
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
    
    const timeLogsResult = await db
      .select()
      .from(timeLogs)
      .leftJoin(users, eq(timeLogs.userId, users.id))
      .where(eq(timeLogs.projectId, id))
      .orderBy(desc(timeLogs.date));
    const projectTimeLogs = timeLogsResult.map(r => ({
      ...r.time_logs,
      user: r.users || undefined,
    }));
    
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

  async getProjectRelatedDataCounts(id: number): Promise<{ documents: number; notes: number; tasks: number; timeLogs: number; timeEntries: number } | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return undefined;

    const [docsCount] = await db.select({ count: count() }).from(documents).where(eq(documents.projectId, id));
    const [notesCount] = await db.select({ count: count() }).from(notes).where(eq(notes.projectId, id));
    const [tasksCount] = await db.select({ count: count() }).from(tasks).where(eq(tasks.projectId, id));
    const [timeLogsCount] = await db.select({ count: count() }).from(timeLogs).where(eq(timeLogs.projectId, id));
    const [timeEntriesCount] = await db.select({ count: count() }).from(timeEntries).where(eq(timeEntries.projectId, id));

    return {
      documents: docsCount.count,
      notes: notesCount.count,
      tasks: tasksCount.count,
      timeLogs: timeLogsCount.count,
      timeEntries: timeEntriesCount.count,
    };
  }

  async archiveProject(id: number): Promise<{ success: boolean; project?: Project; error?: string }> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    const counts = await this.getProjectRelatedDataCounts(id);
    if (counts && (counts.documents > 0 || counts.notes > 0 || counts.tasks > 0 || counts.timeLogs > 0 || counts.timeEntries > 0)) {
      return { success: false, error: "Cannot archive project with attached data" };
    }

    const [updated] = await db
      .update(projects)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return { success: true, project: updated };
  }

  async permanentlyDeleteProject(id: number): Promise<{ success: boolean; error?: string }> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) {
      return { success: false, error: "Project not found" };
    }
    if (project.status !== "archived") {
      return { success: false, error: "Project must be archived before permanent deletion" };
    }
    const result = await db.delete(projects).where(eq(projects.id, id));
    return { success: (result.rowCount ?? 0) > 0 };
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
        isNotNull(tasks.dueDate),
        sql`DATE(${tasks.dueDate}) <= CURRENT_DATE`
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

  async getFoldersByAssociateId(associateId: number): Promise<Folder[]> {
    return await db.select().from(folders).where(eq(folders.associateId, associateId)).orderBy(folders.name);
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

  async getDocumentsByAssociateId(associateId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.associateId, associateId)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByFolderId(folderId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.folderId, folderId)).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentByStoragePath(storagePath: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.storagePath, storagePath));
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

  // Folder Templates
  async getFolderTemplates(entityType?: string): Promise<FolderTemplate[]> {
    if (entityType) {
      return await db.select().from(folderTemplates).where(eq(folderTemplates.entityType, entityType)).orderBy(folderTemplates.name);
    }
    return await db.select().from(folderTemplates).orderBy(folderTemplates.name);
  }

  async getFolderTemplate(id: number): Promise<FolderTemplate | undefined> {
    const [template] = await db.select().from(folderTemplates).where(eq(folderTemplates.id, id));
    return template;
  }

  async createFolderTemplate(template: InsertFolderTemplate): Promise<FolderTemplate> {
    const [newTemplate] = await db.insert(folderTemplates).values(template).returning();
    return newTemplate;
  }

  async updateFolderTemplate(id: number, template: Partial<InsertFolderTemplate>): Promise<FolderTemplate | undefined> {
    const [updated] = await db.update(folderTemplates).set({ ...template, updatedAt: new Date() }).where(eq(folderTemplates.id, id)).returning();
    return updated;
  }

  async deleteFolderTemplate(id: number): Promise<boolean> {
    const result = await db.delete(folderTemplates).where(eq(folderTemplates.id, id));
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
    // Ensure we return a number (PostgreSQL may return string for aggregates)
    const total = result[0]?.total;
    return typeof total === 'string' ? parseInt(total, 10) : (total ?? 0);
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
  async getInvoices(): Promise<(Invoice & { project: Project | null; client: Client | null; items: InvoiceItem[] })[]> {
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
        project: r.projects || null,
        client: r.clients || null,
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

  async getInvoicesByClientId(clientId: number): Promise<(Invoice & { project: Project | null; items: InvoiceItem[] })[]> {
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
        project: r.projects || null,
        items,
      };
    }));
    
    return result;
  }

  async getInvoice(id: number): Promise<(Invoice & { project: Project | null; client: Client | null; items: InvoiceItem[] }) | undefined> {
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
      project: result.projects || null,
      client: result.clients || null,
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

  async replaceInvoiceItems(invoiceId: number, items: InsertInvoiceItem[]): Promise<InvoiceItem[]> {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    if (items.length === 0) return [];
    const inserted = await db
      .insert(invoiceItems)
      .values(items.map(item => ({ ...item, invoiceId })))
      .returning();
    return inserted;
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

  async getInvoiceStats(): Promise<{ totalInvoiced: number; totalPaid: number; totalUnpaid: number; totalUnbilled: number }> {
    const allInvoices = await db
      .select({ total: invoices.total, status: invoices.status })
      .from(invoices)
      .where(ne(invoices.status, 'cancelled'));
    
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    
    for (const inv of allInvoices) {
      const amount = parseFloat(inv.total || '0');
      totalInvoiced += amount;
      if (inv.status === 'paid') {
        totalPaid += amount;
      } else {
        totalUnpaid += amount;
      }
    }
    
    // Calculate unbilled time entries
    const billedTimeEntryIds = await db
      .select({ timeEntryId: invoiceItems.timeEntryId })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(
        ne(invoices.status, 'cancelled'),
        sql`${invoiceItems.timeEntryId} IS NOT NULL`
      ));
    
    const billedIds = billedTimeEntryIds.map(b => b.timeEntryId).filter(id => id !== null) as number[];
    
    let unbilledEntries;
    if (billedIds.length > 0) {
      unbilledEntries = await db
        .select({ totalMinutes: timeEntries.totalMinutes, projectId: timeEntries.projectId })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
          eq(timeEntries.isBillable, true),
          sql`${timeEntries.id} NOT IN (${sql.raw(billedIds.join(','))})`
        ));
    } else {
      unbilledEntries = await db
        .select({ totalMinutes: timeEntries.totalMinutes, projectId: timeEntries.projectId })
        .from(timeEntries)
        .where(eq(timeEntries.isBillable, true));
    }
    
    // Estimate unbilled at default rate of $75/hour
    const defaultHourlyRate = 75;
    let totalUnbilled = 0;
    for (const entry of unbilledEntries) {
      const hours = (entry.totalMinutes || 0) / 60;
      totalUnbilled += hours * defaultHourlyRate;
    }
    
    return { totalInvoiced, totalPaid, totalUnpaid, totalUnbilled };
  }

  async getUnbilledTimeEntries(): Promise<{ projectId: number; projectName: string; clientName: string; totalMinutes: number; estimatedAmount: number }[]> {
    const billedTimeEntryIds = await db
      .select({ timeEntryId: invoiceItems.timeEntryId })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(and(
        ne(invoices.status, 'cancelled'),
        sql`${invoiceItems.timeEntryId} IS NOT NULL`
      ));
    
    const billedIds = billedTimeEntryIds.map(b => b.timeEntryId).filter(id => id !== null) as number[];
    
    let unbilledQuery;
    if (billedIds.length > 0) {
      unbilledQuery = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          clientName: clients.name,
          totalMinutes: sql<number>`SUM(${timeEntries.totalMinutes})`.as('total_minutes'),
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(and(
          eq(timeEntries.isBillable, true),
          sql`${timeEntries.id} NOT IN (${sql.raw(billedIds.join(','))})`
        ))
        .groupBy(projects.id, projects.name, clients.name);
    } else {
      unbilledQuery = await db
        .select({
          projectId: projects.id,
          projectName: projects.name,
          clientName: clients.name,
          totalMinutes: sql<number>`SUM(${timeEntries.totalMinutes})`.as('total_minutes'),
        })
        .from(timeEntries)
        .innerJoin(projects, eq(timeEntries.projectId, projects.id))
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .where(eq(timeEntries.isBillable, true))
        .groupBy(projects.id, projects.name, clients.name);
    }
    
    const defaultHourlyRate = 75;
    return unbilledQuery.map(row => ({
      projectId: row.projectId,
      projectName: row.projectName,
      clientName: row.clientName,
      totalMinutes: Number(row.totalMinutes) || 0,
      estimatedAmount: ((Number(row.totalMinutes) || 0) / 60) * defaultHourlyRate,
    }));
  }

  async getBilledItemIds(projectId: number): Promise<{ timeLogIds: number[]; timeEntryIds: number[] }> {
    const projectInvoices = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(
        eq(invoices.projectId, projectId),
        ne(invoices.status, 'cancelled')
      ));
    
    if (projectInvoices.length === 0) {
      return { timeLogIds: [], timeEntryIds: [] };
    }

    const invoiceIds = projectInvoices.map(i => i.id);
    const items = await db
      .select({ timeLogId: invoiceItems.timeLogId, timeEntryId: invoiceItems.timeEntryId })
      .from(invoiceItems)
      .where(inArray(invoiceItems.invoiceId, invoiceIds));

    const timeLogIds = items
      .filter(item => item.timeLogId !== null)
      .map(item => item.timeLogId as number);
    const timeEntryIds = items
      .filter(item => item.timeEntryId !== null)
      .map(item => item.timeEntryId as number);

    return { timeLogIds, timeEntryIds };
  }

  // Daily Activity Logs
  async getDailyActivityLogs(userId?: string): Promise<DailyActivityLog[]> {
    if (userId) {
      return await db
        .select()
        .from(dailyActivityLogs)
        .where(eq(dailyActivityLogs.userId, userId))
        .orderBy(desc(dailyActivityLogs.date));
    }
    return await db
      .select()
      .from(dailyActivityLogs)
      .orderBy(desc(dailyActivityLogs.date));
  }

  async getDailyActivityLog(id: number): Promise<DailyActivityLog | undefined> {
    const [log] = await db.select().from(dailyActivityLogs).where(eq(dailyActivityLogs.id, id));
    return log;
  }

  async createDailyActivityLog(log: InsertDailyActivityLog): Promise<DailyActivityLog> {
    const [newLog] = await db.insert(dailyActivityLogs).values(log).returning();
    return newLog;
  }

  async updateDailyActivityLog(id: number, log: Partial<InsertDailyActivityLog>): Promise<DailyActivityLog | undefined> {
    const [updated] = await db
      .update(dailyActivityLogs)
      .set({ ...log, updatedAt: new Date() })
      .where(eq(dailyActivityLogs.id, id))
      .returning();
    return updated;
  }

  async deleteDailyActivityLog(id: number): Promise<boolean> {
    const result = await db.delete(dailyActivityLogs).where(eq(dailyActivityLogs.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Client Portal Settings
  async getClientPortalSettings(clientId: number): Promise<ClientPortalSettings | undefined> {
    const [settings] = await db
      .select()
      .from(clientPortalSettings)
      .where(eq(clientPortalSettings.clientId, clientId));
    return settings;
  }

  async upsertClientPortalSettings(settings: InsertClientPortalSettings): Promise<ClientPortalSettings> {
    const [result] = await db
      .insert(clientPortalSettings)
      .values(settings)
      .onConflictDoUpdate({
        target: clientPortalSettings.clientId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Project Milestones
  async getMilestonesByProjectId(projectId: number): Promise<ProjectMilestone[]> {
    return await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, projectId))
      .orderBy(projectMilestones.orderIndex);
  }

  async getClientVisibleMilestones(projectId: number): Promise<ProjectMilestone[]> {
    return await db
      .select()
      .from(projectMilestones)
      .where(and(
        eq(projectMilestones.projectId, projectId),
        eq(projectMilestones.isVisibleToClient, true)
      ))
      .orderBy(projectMilestones.orderIndex);
  }

  async createMilestone(milestone: InsertProjectMilestone): Promise<ProjectMilestone> {
    const [newMilestone] = await db.insert(projectMilestones).values(milestone).returning();
    return newMilestone;
  }

  async updateMilestone(id: number, milestone: Partial<InsertProjectMilestone>): Promise<ProjectMilestone | undefined> {
    const updateData: any = { ...milestone, updatedAt: new Date() };
    if (milestone.isCompleted && !milestone.completedAt) {
      updateData.completedAt = new Date();
    }
    const [updated] = await db
      .update(projectMilestones)
      .set(updateData)
      .where(eq(projectMilestones.id, id))
      .returning();
    return updated;
  }

  async deleteMilestone(id: number): Promise<boolean> {
    const result = await db.delete(projectMilestones).where(eq(projectMilestones.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Document Requests
  async getDocumentRequestsByProjectId(projectId: number): Promise<DocumentRequest[]> {
    return await db
      .select()
      .from(documentRequests)
      .where(eq(documentRequests.projectId, projectId))
      .orderBy(desc(documentRequests.createdAt));
  }

  async getDocumentRequestsByClientId(clientId: number): Promise<(DocumentRequest & { project: Project })[]> {
    const result = await db
      .select()
      .from(documentRequests)
      .leftJoin(projects, eq(documentRequests.projectId, projects.id))
      .where(eq(documentRequests.clientId, clientId))
      .orderBy(desc(documentRequests.createdAt));
    
    return result.map(r => ({
      ...r.document_requests,
      project: r.projects!,
    }));
  }

  async createDocumentRequest(request: InsertDocumentRequest): Promise<DocumentRequest> {
    const [newRequest] = await db.insert(documentRequests).values(request).returning();
    return newRequest;
  }

  async updateDocumentRequest(id: number, request: Partial<InsertDocumentRequest>): Promise<DocumentRequest | undefined> {
    const [updated] = await db
      .update(documentRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(documentRequests.id, id))
      .returning();
    return updated;
  }

  async deleteDocumentRequest(id: number): Promise<boolean> {
    const result = await db.delete(documentRequests).where(eq(documentRequests.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogsByUserId(userId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getAuditLogsByClientId(clientId: number): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.clientId, clientId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getRecentActivityByClientId(clientId: number, limit: number = 20): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.clientId, clientId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  // Client Portal specific queries
  async getClientVisibleProjects(clientId: number): Promise<(Project & { client: Client })[]> {
    const result = await db
      .select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(
        eq(projects.clientId, clientId),
        eq(projects.isVisibleToClient, true)
      ))
      .orderBy(desc(projects.createdAt));
    
    return result.map(r => ({
      ...r.projects,
      client: r.clients!,
    }));
  }

  async getClientVisibleDocuments(projectId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.projectId, projectId),
        eq(documents.isVisibleToClient, true)
      ))
      .orderBy(desc(documents.createdAt));
  }

  async getClientVisibleInvoices(clientId: number): Promise<(Invoice & { project: Project | null; items: InvoiceItem[] })[]> {
    const invoiceList = await db
      .select()
      .from(invoices)
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .where(and(
        eq(invoices.clientId, clientId),
        eq(invoices.isVisibleToClient, true)
      ))
      .orderBy(desc(invoices.createdAt));
    
    const result = await Promise.all(invoiceList.map(async (r) => {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, r.invoices.id));
      return {
        ...r.invoices,
        project: r.projects || null,
        items,
      };
    }));
    
    return result;
  }

  async getClientVisibleNotes(projectId: number): Promise<(Note & { user?: User })[]> {
    const result = await db
      .select()
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(and(
        eq(notes.projectId, projectId),
        eq(notes.isVisibleToClient, true)
      ))
      .orderBy(desc(notes.createdAt));
    
    return result.map(r => ({
      ...r.notes,
      user: r.users || undefined,
    }));
  }

  // Date Range Queries for Activity Generation
  async getTimeEntriesForDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    return await db
      .select()
      .from(timeEntries)
      .where(and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.date, startDate),
        lte(timeEntries.date, endDate)
      ))
      .orderBy(desc(timeEntries.date));
  }

  async getTimeLogsForDateRange(userId: string, startDate: Date, endDate: Date): Promise<TimeLog[]> {
    return await db
      .select()
      .from(timeLogs)
      .where(and(
        eq(timeLogs.userId, userId),
        gte(timeLogs.date, startDate),
        lte(timeLogs.date, endDate)
      ))
      .orderBy(desc(timeLogs.date));
  }

  async getNotesCreatedForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(and(
        eq(notes.userId, userId),
        gte(notes.createdAt, startDate),
        lte(notes.createdAt, endDate)
      ))
      .orderBy(desc(notes.createdAt));
  }

  async getDocumentsProcessedForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.uploadedByUserId, userId),
        gte(documents.createdAt, startDate),
        lte(documents.createdAt, endDate)
      ))
      .orderBy(desc(documents.createdAt));
  }

  async getTasksCompletedForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.assigneeId, userId),
        isNotNull(tasks.completedAt),
        gte(tasks.completedAt, startDate),
        lte(tasks.completedAt, endDate)
      ))
      .orderBy(desc(tasks.completedAt));
  }

  async getAuditLogsForDateRange(userId: string, startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.userId, userId),
        gte(auditLogs.createdAt, startDate),
        lte(auditLogs.createdAt, endDate)
      ))
      .orderBy(desc(auditLogs.createdAt));
  }

  // Intake Applications
  async getIntakeApplications(): Promise<IntakeApplication[]> {
    return await db.select().from(intakeApplications).orderBy(desc(intakeApplications.createdAt));
  }

  async getIntakeApplication(id: number): Promise<IntakeApplication | undefined> {
    const [application] = await db.select().from(intakeApplications).where(eq(intakeApplications.id, id));
    return application;
  }

  async getIntakeApplicationByProjectId(projectId: number): Promise<IntakeApplication | undefined> {
    const [application] = await db.select().from(intakeApplications).where(eq(intakeApplications.linkedProjectId, projectId));
    return application;
  }

  async createIntakeApplication(application: InsertIntakeApplication): Promise<IntakeApplication> {
    const [newApplication] = await db.insert(intakeApplications).values(application).returning();
    return newApplication;
  }

  async updateIntakeApplication(id: number, application: Partial<InsertIntakeApplication>): Promise<IntakeApplication | undefined> {
    const [updated] = await db
      .update(intakeApplications)
      .set({ ...application, updatedAt: new Date() })
      .where(eq(intakeApplications.id, id))
      .returning();
    return updated;
  }

  async deleteIntakeApplication(id: number): Promise<boolean> {
    const result = await db.delete(intakeApplications).where(eq(intakeApplications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Sales Contacts (pipeline leads)
  async getSalesContacts(): Promise<SalesContact[]> {
    return await db.select().from(salesContacts).orderBy(desc(salesContacts.createdAt));
  }

  async getSalesContactsByStage(stage: string): Promise<SalesContact[]> {
    return await db.select().from(salesContacts).where(eq(salesContacts.stage, stage as any)).orderBy(desc(salesContacts.createdAt));
  }

  async getSalesContact(id: number): Promise<SalesContact | undefined> {
    const [contact] = await db.select().from(salesContacts).where(eq(salesContacts.id, id));
    return contact;
  }

  async createSalesContact(contact: InsertSalesContact): Promise<SalesContact> {
    const [newContact] = await db.insert(salesContacts).values(contact).returning();
    return newContact;
  }

  async updateSalesContact(id: number, contact: Partial<InsertSalesContact>): Promise<SalesContact | undefined> {
    const [updated] = await db
      .update(salesContacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(salesContacts.id, id))
      .returning();
    return updated;
  }

  async deleteSalesContact(id: number): Promise<boolean> {
    const result = await db.delete(salesContacts).where(eq(salesContacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Services (for proposals)
  async getServices(): Promise<Service[]> {
    return await db.select().from(services).orderBy(services.category, services.sortOrder, services.name);
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service;
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return await db.select().from(services).where(eq(services.category, category as any)).orderBy(services.sortOrder, services.name);
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service | undefined> {
    const [updated] = await db
      .update(services)
      .set({ ...service, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return updated;
  }

  async deleteService(id: number): Promise<boolean> {
    const result = await db.delete(services).where(eq(services.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Proposals (sales pipeline)
  async getProposals(): Promise<(Proposal & { client?: Client; items: ProposalItem[] })[]> {
    const allProposals = await db
      .select()
      .from(proposals)
      .leftJoin(clients, eq(proposals.clientId, clients.id))
      .orderBy(desc(proposals.createdAt));
    
    const result = [];
    for (const row of allProposals) {
      const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, row.proposals.id)).orderBy(proposalItems.sortOrder);
      result.push({
        ...row.proposals,
        client: row.clients || undefined,
        items,
      });
    }
    return result;
  }

  async getProposal(id: number): Promise<(Proposal & { client?: Client; items: ProposalItem[] }) | undefined> {
    const [row] = await db
      .select()
      .from(proposals)
      .leftJoin(clients, eq(proposals.clientId, clients.id))
      .where(eq(proposals.id, id));
    
    if (!row) return undefined;

    const items = await db.select().from(proposalItems).where(eq(proposalItems.proposalId, id)).orderBy(proposalItems.sortOrder);
    
    return {
      ...row.proposals,
      client: row.clients || undefined,
      items,
    };
  }

  async createProposal(proposal: InsertProposal, items: InsertProposalItem[]): Promise<Proposal & { items: ProposalItem[] }> {
    const [newProposal] = await db.insert(proposals).values(proposal).returning();
    
    const createdItems: ProposalItem[] = [];
    for (const item of items) {
      const [newItem] = await db.insert(proposalItems).values({ ...item, proposalId: newProposal.id }).returning();
      createdItems.push(newItem);
    }
    
    return { ...newProposal, items: createdItems };
  }

  async updateProposal(id: number, proposal: Partial<InsertProposal>): Promise<Proposal | undefined> {
    const [updated] = await db
      .update(proposals)
      .set({ ...proposal, updatedAt: new Date() })
      .where(eq(proposals.id, id))
      .returning();
    return updated;
  }

  async deleteProposal(id: number): Promise<boolean> {
    const result = await db.delete(proposals).where(eq(proposals.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextProposalNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const [result] = await db
      .select({ count: count() })
      .from(proposals)
      .where(sql`EXTRACT(YEAR FROM ${proposals.createdAt}) = ${year}`);
    
    const nextNum = (result?.count || 0) + 1;
    return `PROP-${year}-${String(nextNum).padStart(4, '0')}`;
  }

  // Proposal Items
  async addProposalItem(item: InsertProposalItem): Promise<ProposalItem> {
    const [newItem] = await db.insert(proposalItems).values(item).returning();
    return newItem;
  }

  async updateProposalItem(id: number, item: Partial<InsertProposalItem>): Promise<ProposalItem | undefined> {
    const [updated] = await db
      .update(proposalItems)
      .set(item)
      .where(eq(proposalItems.id, id))
      .returning();
    return updated;
  }

  async deleteProposalItem(id: number): Promise<boolean> {
    const result = await db.delete(proposalItems).where(eq(proposalItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Accounts
  async getAccounts(): Promise<Account[]> {
    return await db.select().from(accounts).orderBy(accounts.accountType, accounts.code);
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async getAccountByCode(code: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.code, code));
    return account;
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [newAccount] = await db.insert(accounts).values(account).returning();
    return newAccount;
  }

  async updateAccount(id: number, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updated] = await db
      .update(accounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return updated;
  }

  async deleteAccount(id: number): Promise<boolean> {
    const result = await db.delete(accounts).where(eq(accounts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Vendors
  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors).orderBy(vendors.name);
  }

  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor;
  }

  async getVendorBalances(): Promise<{ vendorId: number; balance: string }[]> {
    const result = await db
      .select({
        vendorId: bills.vendorId,
        balance: sql<string>`COALESCE(SUM(CAST(${bills.amountDue} AS DECIMAL(12,2))), 0)::text`,
      })
      .from(bills)
      .where(
        sql`${bills.status} NOT IN ('paid', 'void')`
      )
      .groupBy(bills.vendorId);
    
    return result;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [newVendor] = await db.insert(vendors).values(vendor).returning();
    return newVendor;
  }

  async updateVendor(id: number, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [updated] = await db
      .update(vendors)
      .set({ ...vendor, updatedAt: new Date() })
      .where(eq(vendors.id, id))
      .returning();
    return updated;
  }

  async deleteVendor(id: number): Promise<boolean> {
    const result = await db.delete(vendors).where(eq(vendors.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Bank Accounts
  async getBankAccounts(): Promise<BankAccount[]> {
    return await db.select().from(bankAccounts).orderBy(bankAccounts.name);
  }

  async getBankAccount(id: number): Promise<BankAccount | undefined> {
    const [bankAccount] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id));
    return bankAccount;
  }

  async createBankAccount(bankAccount: InsertBankAccount): Promise<BankAccount> {
    const [newBankAccount] = await db.insert(bankAccounts).values(bankAccount).returning();
    return newBankAccount;
  }

  async updateBankAccount(id: number, bankAccount: Partial<InsertBankAccount>): Promise<BankAccount | undefined> {
    const [updated] = await db
      .update(bankAccounts)
      .set({ ...bankAccount, updatedAt: new Date() })
      .where(eq(bankAccounts.id, id))
      .returning();
    return updated;
  }

  async deleteBankAccount(id: number): Promise<boolean> {
    const result = await db.delete(bankAccounts).where(eq(bankAccounts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Bank Transactions
  async getBankTransactions(bankAccountId?: number): Promise<(BankTransaction & { vendor?: Vendor; account?: Account })[]> {
    let query = db
      .select()
      .from(bankTransactions)
      .leftJoin(vendors, eq(bankTransactions.vendorId, vendors.id))
      .leftJoin(accounts, eq(bankTransactions.accountId, accounts.id))
      .orderBy(desc(bankTransactions.transactionDate));
    
    if (bankAccountId) {
      query = query.where(eq(bankTransactions.bankAccountId, bankAccountId)) as typeof query;
    }
    
    const result = await query;
    return result.map(r => ({
      ...r.bank_transactions,
      vendor: r.vendors || undefined,
      account: r.accounts || undefined,
    }));
  }

  async getBankTransaction(id: number): Promise<BankTransaction | undefined> {
    const [transaction] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, id));
    return transaction;
  }

  async createBankTransaction(transaction: InsertBankTransaction): Promise<BankTransaction> {
    const [newTransaction] = await db.insert(bankTransactions).values(transaction).returning();
    return newTransaction;
  }

  async updateBankTransaction(id: number, transaction: Partial<InsertBankTransaction>): Promise<BankTransaction | undefined> {
    const [updated] = await db
      .update(bankTransactions)
      .set({ ...transaction, updatedAt: new Date() })
      .where(eq(bankTransactions.id, id))
      .returning();
    return updated;
  }

  async deleteBankTransaction(id: number): Promise<boolean> {
    const result = await db.delete(bankTransactions).where(eq(bankTransactions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Expenses
  async getExpenses(): Promise<(Expense & { vendor?: Vendor; account?: Account; bankAccount?: BankAccount; rebillableClient?: Client; rebillableProject?: Project; bill?: Bill })[]> {
    const result = await db
      .select()
      .from(expenses)
      .leftJoin(vendors, eq(expenses.vendorId, vendors.id))
      .leftJoin(accounts, eq(expenses.accountId, accounts.id))
      .leftJoin(bankAccounts, eq(expenses.bankAccountId, bankAccounts.id))
      .leftJoin(clients, eq(expenses.rebillableClientId, clients.id))
      .leftJoin(projects, eq(expenses.rebillableProjectId, projects.id))
      .leftJoin(bills, eq(expenses.billId, bills.id))
      .orderBy(desc(expenses.expenseDate));
    
    return result.map(r => ({
      ...r.expenses,
      vendor: r.vendors || undefined,
      account: r.accounts || undefined,
      bankAccount: r.bank_accounts || undefined,
      rebillableClient: r.clients || undefined,
      rebillableProject: r.projects || undefined,
      bill: r.bills || undefined,
    }));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async getRebillableExpenses(clientId?: number, projectId?: number): Promise<(Expense & { vendor?: Vendor })[]> {
    let conditions = [eq(expenses.isRebillable, true)];
    
    if (clientId) {
      conditions.push(eq(expenses.rebillableClientId, clientId));
    }
    if (projectId) {
      conditions.push(eq(expenses.rebillableProjectId, projectId));
    }
    
    const result = await db
      .select()
      .from(expenses)
      .leftJoin(vendors, eq(expenses.vendorId, vendors.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));
    
    return result.map(r => ({
      ...r.expenses,
      vendor: r.vendors || undefined,
    }));
  }

  async getUnrebilledExpenses(): Promise<(Expense & { vendor?: Vendor; rebillableClient?: Client; rebillableProject?: Project })[]> {
    const result = await db
      .select()
      .from(expenses)
      .leftJoin(vendors, eq(expenses.vendorId, vendors.id))
      .leftJoin(clients, eq(expenses.rebillableClientId, clients.id))
      .leftJoin(projects, eq(expenses.rebillableProjectId, projects.id))
      .where(and(
        eq(expenses.isRebillable, true),
        isNull(expenses.rebilledInvoiceId)
      ))
      .orderBy(desc(expenses.expenseDate));
    
    return result.map(r => ({
      ...r.expenses,
      vendor: r.vendors || undefined,
      rebillableClient: r.clients || undefined,
      rebillableProject: r.projects || undefined,
    }));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [updated] = await db
      .update(expenses)
      .set({ ...expense, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    return updated;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async markExpensesAsRebilled(expenseIds: number[], invoiceId: number): Promise<boolean> {
    if (expenseIds.length === 0) return true;
    
    const result = await db
      .update(expenses)
      .set({ isRebilled: true, rebilledInvoiceId: invoiceId, rebilledAt: new Date(), updatedAt: new Date() })
      .where(inArray(expenses.id, expenseIds));
    
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Bills
  async getBills(): Promise<(Bill & { vendor: Vendor; items: BillItem[] })[]> {
    const billList = await db
      .select()
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .orderBy(desc(bills.createdAt));
    
    const result = await Promise.all(billList.map(async (r) => {
      const items = await db.select().from(billItems).where(eq(billItems.billId, r.bills.id));
      return {
        ...r.bills,
        vendor: r.vendors!,
        items,
      };
    }));
    
    return result;
  }

  async getBill(id: number): Promise<(Bill & { vendor: Vendor; items: BillItem[]; payments: BillPayment[] }) | undefined> {
    const [result] = await db
      .select()
      .from(bills)
      .leftJoin(vendors, eq(bills.vendorId, vendors.id))
      .where(eq(bills.id, id));
    
    if (!result) return undefined;
    
    const items = await db.select().from(billItems).where(eq(billItems.billId, id));
    const payments = await db.select().from(billPayments).where(eq(billPayments.billId, id)).orderBy(desc(billPayments.paymentDate));
    
    return {
      ...result.bills,
      vendor: result.vendors!,
      items,
      payments,
    };
  }

  async createBill(bill: InsertBill, items: InsertBillItem[]): Promise<Bill & { items: BillItem[] }> {
    const [newBill] = await db.insert(bills).values(bill).returning();
    
    const createdItems: BillItem[] = [];
    for (const item of items) {
      const [newItem] = await db.insert(billItems).values({ ...item, billId: newBill.id }).returning();
      createdItems.push(newItem);
    }
    
    return { ...newBill, items: createdItems };
  }

  async updateBill(id: number, bill: Partial<InsertBill>): Promise<Bill | undefined> {
    const [updated] = await db
      .update(bills)
      .set({ ...bill, updatedAt: new Date() })
      .where(eq(bills.id, id))
      .returning();
    return updated;
  }

  async deleteBill(id: number): Promise<boolean> {
    const result = await db.delete(bills).where(eq(bills.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextBillNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const [lastBill] = await db
      .select({ billNumber: bills.billNumber })
      .from(bills)
      .where(sql`${bills.billNumber} LIKE ${`BILL-${currentYear}-%`}`)
      .orderBy(desc(bills.billNumber))
      .limit(1);
    
    if (!lastBill) {
      return `BILL-${currentYear}-0001`;
    }
    
    const lastNumber = parseInt(lastBill.billNumber.split('-')[2] || '0');
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `BILL-${currentYear}-${nextNumber}`;
  }

  // Bookkeeping - Bill Payments
  async getBillPayment(id: number): Promise<BillPayment | undefined> {
    const [payment] = await db.select().from(billPayments).where(eq(billPayments.id, id));
    return payment;
  }

  async createBillPayment(payment: InsertBillPayment): Promise<BillPayment> {
    const [newPayment] = await db.insert(billPayments).values(payment).returning();
    return newPayment;
  }

  async updateBillPayment(id: number, payment: Partial<InsertBillPayment>): Promise<BillPayment | undefined> {
    const [updated] = await db.update(billPayments).set(payment).where(eq(billPayments.id, id)).returning();
    return updated;
  }

  async deleteBillPayment(id: number): Promise<boolean> {
    const result = await db.delete(billPayments).where(eq(billPayments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Bookkeeping - Bank Reconciliations
  async getBankReconciliations(bankAccountId: number): Promise<BankReconciliation[]> {
    return await db
      .select()
      .from(bankReconciliations)
      .where(eq(bankReconciliations.bankAccountId, bankAccountId))
      .orderBy(desc(bankReconciliations.statementDate));
  }

  async getBankReconciliation(id: number): Promise<BankReconciliation | undefined> {
    const [reconciliation] = await db.select().from(bankReconciliations).where(eq(bankReconciliations.id, id));
    return reconciliation;
  }

  async createBankReconciliation(reconciliation: InsertBankReconciliation): Promise<BankReconciliation> {
    const [newReconciliation] = await db.insert(bankReconciliations).values(reconciliation).returning();
    return newReconciliation;
  }

  async updateBankReconciliation(id: number, reconciliation: Partial<InsertBankReconciliation>): Promise<BankReconciliation | undefined> {
    const [updated] = await db
      .update(bankReconciliations)
      .set({ ...reconciliation, updatedAt: new Date() })
      .where(eq(bankReconciliations.id, id))
      .returning();
    return updated;
  }

  async completeBankReconciliation(id: number, userId: string): Promise<BankReconciliation | undefined> {
    const [updated] = await db
      .update(bankReconciliations)
      .set({ status: 'completed', completedAt: new Date(), completedByUserId: userId, updatedAt: new Date() })
      .where(eq(bankReconciliations.id, id))
      .returning();
    return updated;
  }

  // Customer Payments (Undeposited Funds)
  async getPayments(): Promise<(Payment & { client: Client; invoice?: Invoice })[]> {
    const result = await db
      .select()
      .from(payments)
      .leftJoin(clients, eq(payments.clientId, clients.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .orderBy(desc(payments.paymentDate));
    
    return result.map(r => ({
      ...r.payments,
      client: r.clients!,
      invoice: r.invoices || undefined,
    }));
  }

  async getPayment(id: number): Promise<(Payment & { client: Client; invoice?: Invoice }) | undefined> {
    const [result] = await db
      .select()
      .from(payments)
      .leftJoin(clients, eq(payments.clientId, clients.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(payments.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.payments,
      client: result.clients!,
      invoice: result.invoices || undefined,
    };
  }

  async getUndepositedPayments(): Promise<(Payment & { client: Client; invoice?: Invoice })[]> {
    const result = await db
      .select()
      .from(payments)
      .leftJoin(clients, eq(payments.clientId, clients.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(payments.isDeposited, false))
      .orderBy(desc(payments.paymentDate));
    
    return result.map(r => ({
      ...r.payments,
      client: r.clients!,
      invoice: r.invoices || undefined,
    }));
  }

  async getPaymentsByClientId(clientId: number): Promise<(Payment & { invoice?: Invoice })[]> {
    const result = await db
      .select()
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(payments.clientId, clientId))
      .orderBy(desc(payments.paymentDate));
    
    return result.map(r => ({
      ...r.payments,
      invoice: r.invoices || undefined,
    }));
  }

  async getPaymentsByInvoiceId(invoiceId: number): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, invoiceId))
      .orderBy(desc(payments.paymentDate));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: number, payment: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [updated] = await db
      .update(payments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updated;
  }

  async deletePayment(id: number): Promise<boolean> {
    const result = await db.delete(payments).where(eq(payments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextPaymentNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const [lastPayment] = await db
      .select({ paymentNumber: payments.paymentNumber })
      .from(payments)
      .where(sql`${payments.paymentNumber} LIKE ${`PMT-${currentYear}-%`}`)
      .orderBy(desc(payments.paymentNumber))
      .limit(1);
    
    if (!lastPayment) {
      return `PMT-${currentYear}-0001`;
    }
    
    const lastNumber = parseInt(lastPayment.paymentNumber.split('-')[2] || '0');
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `PMT-${currentYear}-${nextNumber}`;
  }

  async getUndepositedFundsTotal(): Promise<number> {
    const result = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS DECIMAL)), 0)` })
      .from(payments)
      .where(eq(payments.isDeposited, false));
    
    return parseFloat(result[0]?.total || '0');
  }

  // Deposits
  async getDeposits(): Promise<(Deposit & { bankAccount: BankAccount; payments: Payment[] })[]> {
    const depositsResult = await db
      .select()
      .from(deposits)
      .leftJoin(bankAccounts, eq(deposits.bankAccountId, bankAccounts.id))
      .orderBy(desc(deposits.depositDate));
    
    const depositsWithPayments = await Promise.all(
      depositsResult.map(async (d) => {
        const depositPayments = await db
          .select()
          .from(payments)
          .where(eq(payments.depositId, d.deposits.id));
        
        return {
          ...d.deposits,
          bankAccount: d.bank_accounts!,
          payments: depositPayments,
        };
      })
    );
    
    return depositsWithPayments;
  }

  async getDeposit(id: number): Promise<(Deposit & { bankAccount: BankAccount; payments: (Payment & { client: Client; invoice?: Invoice })[] }) | undefined> {
    const [depositResult] = await db
      .select()
      .from(deposits)
      .leftJoin(bankAccounts, eq(deposits.bankAccountId, bankAccounts.id))
      .where(eq(deposits.id, id));
    
    if (!depositResult) return undefined;

    const depositPayments = await db
      .select()
      .from(payments)
      .leftJoin(clients, eq(payments.clientId, clients.id))
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .where(eq(payments.depositId, id));
    
    return {
      ...depositResult.deposits,
      bankAccount: depositResult.bank_accounts!,
      payments: depositPayments.map(p => ({
        ...p.payments,
        client: p.clients!,
        invoice: p.invoices || undefined,
      })),
    };
  }

  async createDeposit(deposit: InsertDeposit, paymentIds: number[]): Promise<Deposit & { payments: Payment[] }> {
    const [newDeposit] = await db.insert(deposits).values(deposit).returning();
    
    // Update payments to mark them as deposited
    await db
      .update(payments)
      .set({ 
        isDeposited: true, 
        depositId: newDeposit.id, 
        depositedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(inArray(payments.id, paymentIds));
    
    // Fetch the updated payments
    const depositPayments = await db
      .select()
      .from(payments)
      .where(inArray(payments.id, paymentIds));
    
    return {
      ...newDeposit,
      payments: depositPayments,
    };
  }

  async deleteDeposit(id: number): Promise<boolean> {
    // First, unmark the payments as deposited
    await db
      .update(payments)
      .set({ 
        isDeposited: false, 
        depositId: null, 
        depositedAt: null,
        updatedAt: new Date() 
      })
      .where(eq(payments.depositId, id));
    
    // Then delete the deposit
    const result = await db.delete(deposits).where(eq(deposits.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // General Journal Entries
  async getJournalEntries(): Promise<(JournalEntry & { lines: (JournalEntryLine & { account: Account })[] })[]> {
    const allEntries = await db.select().from(journalEntries).orderBy(desc(journalEntries.entryDate));
    const result = [];
    for (const entry of allEntries) {
      const lines = await db
        .select()
        .from(journalEntryLines)
        .where(eq(journalEntryLines.journalEntryId, entry.id))
        .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id));
      result.push({
        ...entry,
        lines: lines.map(l => ({ ...l.journal_entry_lines, account: l.accounts })),
      });
    }
    return result;
  }

  async getJournalEntry(id: number): Promise<(JournalEntry & { lines: (JournalEntryLine & { account: Account })[] }) | undefined> {
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.id, id));
    if (!entry) return undefined;
    const lines = await db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, id))
      .innerJoin(accounts, eq(journalEntryLines.accountId, accounts.id));
    return {
      ...entry,
      lines: lines.map(l => ({ ...l.journal_entry_lines, account: l.accounts })),
    };
  }

  async createJournalEntry(entry: InsertJournalEntry, lines: InsertJournalEntryLine[]): Promise<JournalEntry & { lines: JournalEntryLine[] }> {
    const [newEntry] = await db.insert(journalEntries).values(entry).returning();
    const createdLines: JournalEntryLine[] = [];
    for (const line of lines) {
      const [newLine] = await db.insert(journalEntryLines).values({ ...line, journalEntryId: newEntry.id }).returning();
      createdLines.push(newLine);
    }
    return { ...newEntry, lines: createdLines };
  }

  async updateJournalEntry(id: number, entry: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const [updated] = await db
      .update(journalEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(eq(journalEntries.id, id))
      .returning();
    return updated;
  }

  async deleteJournalEntry(id: number): Promise<boolean> {
    const result = await db.delete(journalEntries).where(eq(journalEntries.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNextJournalEntryNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const [lastEntry] = await db
      .select({ entryNumber: journalEntries.entryNumber })
      .from(journalEntries)
      .where(sql`${journalEntries.entryNumber} LIKE ${`JE-${currentYear}-%`}`)
      .orderBy(desc(journalEntries.entryNumber))
      .limit(1);
    
    if (!lastEntry) {
      return `JE-${currentYear}-0001`;
    }
    
    const lastNumber = parseInt(lastEntry.entryNumber.split('-')[2] || '0');
    const nextNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `JE-${currentYear}-${nextNumber}`;
  }
}

export const storage = new DatabaseStorage();
