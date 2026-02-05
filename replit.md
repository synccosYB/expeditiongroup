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
- **Invoicing System**: Generates invoices (INV-YYYY-NNNN format) from time logs/entries, supports custom items, and allows client viewing. Invoices have statuses (draft, sent, paid, cancelled) and financial summaries.
- **Chart of Accounts**: Hierarchical account structure with parent/sub-account relationships (e.g., "Payroll" as parent with "Payroll – Wages", "Payroll – Taxes" as sub-accounts). Supports asset, liability, equity, revenue, and expense account types with automatic numeric code sorting.
- **Client Portal**: Provides read-only access to documents, invoices, client-visible notes, and project status with task timelines.
- **Task Navigation**: Sequential navigation of tasks and subtasks with detailed dialogs and filtering.
- **Document Management**: Supports single and bulk uploads, organization into folders and categories, and metadata tagging.
- **Intake Applications**: Multi-step wizard for permit application intake, including conditional fields, draft saving, and conversion to projects linked to existing clients.
- **Reminders System**: Schedules task reminders with status tracking (read/unread, pending, sent, done, postponed, cancelled, failed).
- **Daily Activity Logs**: Generates daily activity summaries from application data (time entries, tasks completed, documents, audit logs).
- **Expense Receipts**: Allows attaching receipt images to expenses. Receipts are stored in object storage and served through a secure backend proxy that validates user authorization.
- **Expense Payment Types**: Expenses can be categorized by payment type (Expense, Pay Bill, Check, Transfer, Other). When payment type is "Pay Bill", the expense is linked to a specific vendor bill, automatically updating the bill's amountPaid, amountDue, and status (pending/partial/paid). Bill balances are correctly maintained when expenses are created, edited, or deleted.
- **Payment Tracking (Undeposited Funds)**: QuickBooks-style payment workflow. When payments are received from customers (PMT-YYYY-NNNN format), they go to "Undeposited Funds" as a holding account. Users can select multiple payments and deposit them together into a bank account. Payments support various methods (cash, check, credit card, debit card, bank transfer). When a payment is created for an invoice, the system automatically updates invoice status to "paid" if total payments meet the invoice total. Deposited payments cannot be deleted. Deleting a deposit reverses the bank balance and returns payments to undeposited funds.

### UI/UX & Design
- **Design System**: Productivity tool patterns (Linear, Notion) emphasizing information density.
- **Typography**: Inter (UI), JetBrains Mono (timestamps).
- **Layout**: Fixed-width sidebar (w-64), responsive main content.
- **Mobile Responsiveness**: Fully responsive with specific optimizations for dialogs, tabs, forms, grids, and buttons.
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