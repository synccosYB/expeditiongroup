# Expedition Plus CRM

## Overview

Expedition Plus is a permit expediting CRM platform designed for construction projects in Orange, Rockland, and Sullivan Counties, NY. The application serves two user types: internal administrators who manage clients, projects, tasks, time logs, and associates, and external clients who access a read-only portal to view their project status and updates.

The system follows a three-layer architecture: a public marketing website for lead generation, an authentication layer using email/password authentication, and an internal CRM with a client portal. All operational data revolves around Projects as the central entity.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (supports dark mode)
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API with `/api` prefix
- **Authentication**: Email/password authentication with bcrypt password hashing
- **Session Management**: Express sessions stored in PostgreSQL via connect-pg-simple

### Data Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all database tables and types
- **Migrations**: Drizzle Kit for database migrations (`npm run db:push`)

### Role-Based Access Control
- **Admin Role**: Full access to CRM features (clients, projects, tasks, time logs, associates)
- **Client Role**: Limited access to client portal showing only their linked projects

### Key Data Models
- **Users**: Authenticated users with roles (admin/client)
- **Clients**: Business entities that hire permit expediting services with optional hourlyRate
- **Projects**: Permit applications linked to clients with status tracking
- **Tasks**: Work items within projects (road/office types)
- **Notes**: Communication log entries on projects
- **Time Logs**: Legacy billable hours tracking per project (description-based, totalHours as varchar)
- **Time Entries**: New task-based time tracking (totalMinutes, linked to tasks)
- **Invoices**: Generated invoices from time logs/entries with line items
- **Invoice Items**: Individual line items referencing time logs, time entries, or custom items
- **Associates**: External professionals (engineers, architects, surveyors, consultants)
- **Services**: Service catalog items organized by category for proposals
- **Proposals**: Sales proposals with line items, totals, and status tracking
- **Proposal Items**: Individual service line items within proposals

### Sales Pipeline
- Proposal number format: PROP-YYYY-NNNN (e.g., PROP-2026-0001)
- Proposals can be created from the Sales Pipeline page (/sales-pipeline)
- Each proposal has a status: draft, sent, accepted, rejected, expired
- Services are organized into 4 categories:
  - **Accounting**: Business/Personal Tax Returns, Estimate Tax Payments, Tax/Legal/Financial Questions
  - **Write Up**: Quarterly Meetings, Review Books, Quarterly Sales Tax Filing, New Corp
  - **Bookkeeping**: Cash Reconciliation, Month/Year End Close, P&L/Balance Sheet Review, Enter Transactions
  - **CFO**: Cash Flow Management, Financial Analysis, Budget vs Actual, Growth Planning, AP/AR Setup
- Default services can be seeded via POST /api/services/seed endpoint
- Line items include quantity, unit price, and calculated amounts
- Routes: /sales-pipeline (list), /proposals/new (create), /proposals/:id (view/edit)

### Invoicing System
- Invoice number format: INV-YYYY-NNNN (e.g., INV-2024-0001)
- Invoices can be generated from the Time Logs tab on project detail page
- Each invoice has a status: draft, sent, paid, cancelled
- Line items can reference time_logs, time_entries, or be custom items (filing fees, mileage, etc.)
- Hourly rate defaults to client's configured rate or $75/hour
- Client portal: Clients can view invoices via `/invoice/:id` route with detailed line items
- **Invoices Page** (/invoices):
  - Dedicated page for viewing all invoices with financial summaries
  - Stats cards: Total Invoiced, Total Paid, Total Unpaid, Unbilled Time
  - Status filter dropdown to filter by draft, sent, paid, cancelled
  - Invoice table with client/project links, status badges, amounts, due dates
  - Delete functionality with confirmation dialog
  - Unbilled time estimated at $75/hour default rate
- API Endpoints:
  - GET /api/invoices/stats - returns totalInvoiced, totalPaid, totalUnpaid, totalUnbilled
  - GET /api/invoices/unbilled - returns unbilled time entries grouped by project

### Client Portal Features
- Documents: Clients can view and download documents via `/objects/*` endpoint (uses storagePath field)
- Invoices: Viewable via "View Invoice" button, shows line items, subtotal, tax, total
- Messages: Clients see notes marked as `isVisibleToClient=true`
- Projects: View-only project status with task timeline
- Task status values: "todo", "waiting", "in_progress", "done", "cancelled"

### Document Management
- **Single Upload**: Add Document button for uploading one document at a time with full metadata
- **Bulk Upload**: Bulk Upload button for uploading up to 20 documents at once
  - Uses Uppy library via ObjectUploader component
  - Allows setting shared category, folder, and visibility for all files
  - Files are tracked by unique Uppy file ID to handle duplicate filenames
  - Creates document records after all files are uploaded to storage
- **Folders**: Documents can be organized into folders
- **Categories**: plan, permit, survey, dob_letter, correspondence, legal, photo, inspection, other

### Intake Applications (Permit Application Intake)
- Multi-step wizard form (6 steps) for comprehensive permit application intake
- Steps: Applicant Info → Project Info → Project Details → Site Characteristics → History & Proximity → Boards & Approvals
- Features:
  - Second owner toggle functionality
  - Conditional fields that appear based on selections
  - JSON fields for arrays (proximityFeatures, referralAgencies, boardsApprovals)
  - Draft saving and submission workflow
  - Form validation using insertIntakeApplicationSchema with required ownerName field
  - Automatic step navigation to validation errors on submit
- Status workflow: draft → submitted → under_review → approved/rejected
- **Conversion to Project** (links to existing client): 
  - POST /api/intake-applications/:id/convert endpoint with `{ clientId }` in request body
  - Requires selecting an existing client - does NOT create a new client
  - Creates Project from property data (projectName, location) linked to the selected client
  - Shows a client selection dialog with search functionality
  - Sets linkedClientId, linkedProjectId, convertedAt on intake record
  - Changes status to "approved"
  - Idempotent: rejects with 400 if already converted
  - Single source of truth: intake becomes immutable reference, linked project becomes active record
- Database: intake_applications table with 100+ fields including linkedClientId, linkedProjectId, convertedAt
- API Routes: GET/POST /api/intake-applications, GET/PATCH/DELETE /api/intake-applications/:id, POST /api/intake-applications/:id/convert
- Frontend Routes: /intake (list), /intake/new (create), /intake/:id (view read-only with Convert button), /intake/:id/edit (edit)

### Reminders System
- Task reminders can be created and scheduled for future dates
- Reminders page at /reminders shows all reminders with task and project context
- Features:
  - Grouped by read/unread status for easy triage
  - Toggle read/unread to revisit later (click eye icon)
  - Shows status (pending, sent, done, postponed, cancelled, failed)
  - Links to related project for quick navigation
  - Displays recipient email/phone and scheduled time
- API: GET /api/reminders (all), PATCH /api/reminders/:id (update status, isRead)
- Database: task_reminders table with isRead boolean field

### Daily Activity Logs
- Log Daily Activity dialog accessible from dashboard
- "Generate from Activity" button auto-populates fields from application data:
  - Time entries and time logs for hours worked calculation
  - Tasks completed, documents processed, notes added
  - Audit log entries for key actions
- Endpoint: GET /api/daily-activity-logs/generate?date=YYYY-MM-DD
- Admin-only feature

### Date Formatting
- **Standard Format**: MM-DD-YYYY (e.g., 01-19-2026) for all date displays (US standard)
- **Long Format**: MMMM d, yyyy (e.g., January 19, 2026) for formal displays like invoices
- **DateTime Format**: MM-DD-YYYY at h:mm AM/PM for timestamps with time
- **Utility Functions** (client/src/lib/dateUtils.ts):
  - `formatLocalDate()` - Standard MM-DD-YYYY format
  - `formatLocalDateLong()` - Formal long format (January 19, 2026)
  - `formatLocalDateTime()` - Date with time
  - `parseLocalDateFromISO()` - Parse ISO dates in local time to avoid timezone shifts
  - `formatDateForInput()` - YYYY-MM-DD for HTML date inputs
- **Timezone Handling**: Dates are parsed in local time using component extraction (not UTC) to prevent off-by-one day errors

### Design System
The UI follows productivity tool patterns (Linear, Notion, Asana) with emphasis on information density and data clarity. Typography uses Inter for UI and JetBrains Mono for timestamps. Layout uses a fixed-width sidebar (w-64) with responsive main content area.

### Mobile Responsiveness
The application is fully responsive with specific optimizations for mobile devices:
- **Dialogs**: Constrained to max-h-[85vh] with overflow-y-auto for proper scrolling on mobile
- **Tabs**: Horizontally scrollable with hidden scrollbars using scrollbar-hide utility class
- **Headers**: Responsive text sizes (text-xl on mobile, text-3xl on desktop) with flex-wrap for badges
- **Forms**: Time log forms use 2-column grid on mobile with inputMode="numeric" for proper mobile keyboard
- **Grids**: Info cards use 2 columns on mobile, 4 columns on desktop
- **Buttons**: Shortened text labels on mobile with icons hidden on smaller screens
- **Utility Classes**: scrollbar-hide CSS class in index.css for smooth horizontal scrolling

### Progressive Web App (PWA)
The application is a fully installable PWA with the following features:
- **Manifest**: `client/public/manifest.json` defines app metadata, icons, and shortcuts
- **Service Worker**: `client/public/sw.js` provides offline caching with network-first strategy for API calls
- **Installation**: Users can install the app from their browser's install prompt or address bar
- **Offline Support**: Static assets are cached for offline viewing; API calls show friendly offline message
- **App Shortcuts**: Dashboard and Projects pages available as quick shortcuts
- **Theme Color**: #1e40af (blue) matches the app branding
- **Icons**: SVG icon (`pwa-icon.svg`) with fallback to favicon.png

## External Dependencies

### Database
- PostgreSQL database (required via DATABASE_URL environment variable)
- Session storage table for authentication persistence

### Authentication
- Email/password authentication with bcrypt password hashing
- Sessions stored in PostgreSQL via connect-pg-simple
- Requires SESSION_SECRET environment variable
- Auth routes: POST /api/auth/register, /api/auth/login, /api/auth/logout
- Frontend auth page at /auth with login and registration forms

### Third-Party Libraries
- **UI**: Radix UI primitives, Lucide icons, class-variance-authority
- **Forms**: React Hook Form with Zod validation
- **Dates**: date-fns for date formatting
- **HTTP**: Fetch API for client requests, Express for server

### Development Tools
- Vite dev server with Replit-specific plugins (cartographer, dev-banner, error overlay)
- esbuild for production server bundling
- TypeScript for type checking