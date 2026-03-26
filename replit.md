# Expedition Plus CRM

## Overview
Expedition Plus is a permit expediting CRM platform for construction projects in Orange, Rockland, and Sullivan Counties, NY. It supports internal administrators managing clients, projects, tasks, time, and associates, and external clients with a read-only portal for project status. The system integrates a public marketing website, an authentication layer, and an internal CRM with a client portal, centering all operations around Projects.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui (built on Radix UI)
- **Styling**: Tailwind CSS with CSS variables (dark mode supported)
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful JSON API (`/api` prefix)
- **Authentication**: Email/password with bcrypt
- **Session Management**: Express sessions stored in PostgreSQL via `connect-pg-simple`

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema**: `shared/schema.ts`
- **Migrations**: Drizzle Kit

### Role-Based Access Control
- **Admin**: Full CRM access
- **Client**: Limited client portal access to linked projects

### Core Features
- **Project Management**: Central entity with status tracking, task management (road/office types), notes, and time logging.
- **Project Archiving/Deletion**: Projects with attached data cannot be deleted directly; requires data removal, then archiving, then permanent deletion.
- **Sales Pipeline**: Complete sales workflow management with:
  - **Sales Contacts**: CRM for managing leads and contacts with fields for name, company, email, phone, title, source (referral, website, cold_call, email, social_media, event, other), and estimated value.
  - **Pipeline Stages**: Visual Kanban board with drag-and-drop to move contacts through stages: Lead → Qualified → Meeting → Proposal → Won/Lost.
  - **Contact-to-Proposal Conversion**: Seamlessly convert contacts to proposals with one click, auto-filling contact information.
  - **Proposals**: Manages proposals (PROP-YYYY-NNNN format) through statuses (draft, sent, accepted, rejected, expired) with categorized services.
- **Invoicing System**: Generates invoices (INV-YYYY-NNNN format) from time logs/entries, supports custom items, and allows client viewing. Invoices have statuses (draft, sent, paid, cancelled) and financial summaries. Invoice detail pages (admin and client portal) display payment history with dates, amounts, and methods, remaining balance due, and "Paid in Full" status. Payment info is visible on-screen and in printed invoices. Time logs and time entries have an `invoiceId` column that directly tracks which invoice billed them, preventing previously billed entries from reappearing in the invoice generation dialog. The `invoiceId` is set when an invoice is created, and cleared when an invoice is cancelled or deleted. A startup migration populates `invoiceId` for existing data by matching invoice items (both linked and custom) to time logs/entries.
- **General Journal Entries**: Double-entry bookkeeping with journal entries (JE-YYYY-NNNN format). Each entry has balanced debit/credit line items referencing chart of accounts. Supports draft/posted/void status workflow. Only draft entries can be deleted.
- **Chart of Accounts**: Hierarchical account structure with parent/sub-account relationships (e.g., "Payroll" as parent with "Payroll – Wages", "Payroll – Taxes" as sub-accounts). Supports asset, liability, equity, revenue, and expense account types with automatic numeric code sorting.
- **Client Portal**: Full read-only portal matching admin layout across all modules. Includes dashboard with 7-stage project pipeline and overdue tasks, task detail dialogs with sequential navigation and 3-tab view (Details/Notes/Time Log), time logs with date range filtering and billable tracking, invoices with detail view and print, associates directory, activity logs, reminders, and project detail with documents/messages/timeline tabs.
- **Task Navigation**: Sequential navigation of tasks and subtasks with detailed dialogs and filtering.
- **Document Management**: Supports single and bulk uploads, organization into folders and categories, and metadata tagging. Per-user storage limit is 5GB (enforced server-side in `STORAGE_LIMIT_BYTES` constant in `server/routes.ts`, with matching UI messages in `ObjectUploader.tsx` and `SimpleFileUploader.tsx`).
- **Intake Applications**: Multi-step wizard for permit application intake, including conditional fields, draft saving, and conversion to projects linked to existing clients.
- **Reminders System**: Schedules task reminders with status tracking (read/unread, pending, sent, done, postponed, cancelled, failed).
- **Daily Activity Logs**: Generates daily activity summaries from application data (time entries, tasks completed, documents, audit logs).
- **Expense Receipts**: Allows attaching receipt images to expenses. Receipts are stored in object storage and served through a secure backend proxy that validates user authorization.
- **Bill & Expense Duplication**: Both bills and expenses can be duplicated from their row dropdown menus, opening a pre-filled creation form with the original data (excluding auto-generated fields like IDs, bill numbers, receipts). Date defaults to today.
- **Project-Optional Rebilling**: Bills and expenses can be rebilled to clients without requiring a project. Expenses have an optional project selector with "No Project / General" option. Bill line items support rebillable toggle with client/project/markup per item. The Rebill Center (`rebill-center.tsx`) displays both rebillable expenses and bill items in a unified view, with type filter (Expense/Bill Item) and client filter. Bill items track rebill status via `isRebilled`, `rebilledInvoiceId`, `rebilledAt` columns. Deleting an invoice resets both expense and bill item rebill status.
- **Expense Payment Types**: Expenses can be categorized by payment type (Expense, Pay Bill, Check, Transfer, Other). When payment type is "Pay Bill", the expense is linked to a specific vendor bill, automatically updating the bill's amountPaid, amountDue, and status (pending/partial/paid). Bill balances are correctly maintained when expenses are created, edited, or deleted.
- **Payment Tracking (Undeposited Funds)**: QuickBooks-style payment workflow. When payments are received from customers (PMT-YYYY-NNNN format), they go to "Undeposited Funds" as a holding account. Users can select multiple payments and deposit them together into a bank account. Payments support various methods (cash, check, credit card, debit card, bank transfer). When a payment is created for an invoice, the system automatically updates invoice status to "paid" if total payments meet the invoice total. Deposited payments cannot be deleted. Deleting a deposit reverses the bank balance and returns payments to undeposited funds. **Bulk Payment Allocation**: When a client has multiple unpaid invoices, users can check "Allocate across multiple invoices" to distribute a single payment across multiple invoices with individual amounts per invoice. Backend creates separate payment records for each allocation via POST /api/payments/bulk.
- **Owner's Equity Transactions**: Bank register supports Owner's Contribution (deposit) and Owner's Distribution (withdrawal) transaction types with equity account category selection. Equity accounts (3000-3300) are seeded automatically: Owner's Equity, Owner's Contribution, Owner's Distribution, Retained Earnings.
- **Account Transfers**: When creating a transfer in the bank register, the system automatically creates a counterpart deposit transaction in the destination bank account with a descriptive memo referencing the source account. Transfer and counterpart transactions are linked via `linkedTransactionId` — deleting a transfer also deletes its counterpart, and updating amount/date/reference syncs to the linked transaction.
- **AI Text Improvement**: Task notes, time log descriptions, and project notes have an "AI Fix" button (sparkle icon) next to textarea labels. Clicking it sends the text to `POST /api/ai/improve-text` which uses OpenAI (via Replit AI Integrations) to fix spelling, grammar, and improve clarity. The improved text replaces the textarea content. Integrated in: tasks.tsx (description, internal notes, time log notes), time-logs.tsx (description, notes), project-detail.tsx (note content, edit note, time log description), calendar-task-dialog.tsx (internal notes, time log notes). Component: `client/src/components/ai-improve-button.tsx`.

### UI/UX & Design
- **Design System**: Productivity tool patterns (Linear, Notion) emphasizing information density.
- **Typography**: Inter (UI), JetBrains Mono (timestamps).
- **Layout**: Fixed-width sidebar (w-64), responsive main content.
- **Mobile Responsiveness**: Fully responsive with specific optimizations for dialogs, tabs, forms, grids, and buttons.
- **Dialog Accessibility**: All dialogs include `DialogDescription` (visually hidden via `sr-only`) for screen reader accessibility and to prevent Radix UI console warnings.
- **Focus Stability**: Nested Tooltip/DropdownMenuTrigger patterns removed from TaskHierarchyItem to prevent focus-fighting and scroll jumps. Project detail query uses `placeholderData` to maintain scroll position during data refetches.
- **Hover-Elevate CSS**: The `::after` pseudo-element uses `z-index: -1` (behind card content, above card background) to prevent blocking clicks on interactive elements inside cards. Parent elements use `position: relative; z-index: 0` to establish stacking context.
- **SynkDex Widget**: Z-index lowered to 99999/99998 to stay below dialog overlays (100001/100002) and Radix poppers (200001). MutationObserver cleans orphaned overlay children.
- **Render Optimization**: `useMemo` wraps filter/sort computations in expenses.tsx, bills.tsx, and tasks.tsx. Invoice line items use stable `_key` (crypto.randomUUID) as React keys instead of array index.
- **Dropdown Menu Actions**: All `DropdownMenuItem` components use `onSelect` (not `onClick`) for action handlers. This is the correct Radix UI pattern — `onSelect` fires reliably before the menu unmounts, preventing actions from being swallowed during re-renders on heavy pages.
- **DialogDescription Import**: Every file using `<DialogDescription>` must import it from `@/components/ui/dialog`. Missing this import causes blank page crashes. Fixed across all pages and DocumentManager.tsx.
- **Progressive Web App (PWA)**: Installable PWA with manifest, service worker for offline caching, app shortcuts, and themed branding.

### Date Handling
- **Formats**: MM-DD-YYYY (standard), MMMM d, yyyy (long), MM-DD-YYYY at h:mm AM/PM (datetime).
- **Timezone**: Parses dates in local time to prevent off-by-one errors.

## External Dependencies

### Database
- PostgreSQL (via `DATABASE_URL`)
- `connect-pg-simple` for session storage

### Authentication
- Email/password authentication (`bcrypt`)
- Requires `SESSION_SECRET` environment variable

### Third-Party Libraries
- **UI**: Radix UI, Lucide icons, `class-variance-authority`
- **Forms**: React Hook Form, Zod
- **Dates**: `date-fns`
- **HTTP**: Fetch API (client), Express (server)
- **AI**: OpenAI via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)