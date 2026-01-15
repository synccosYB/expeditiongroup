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

### Invoicing System
- Invoice number format: INV-YYYY-NNNN (e.g., INV-2024-0001)
- Invoices can be generated from the Time Logs tab on project detail page
- Each invoice has a status: draft, sent, paid, cancelled
- Line items can reference time_logs, time_entries, or be custom items (filing fees, mileage, etc.)
- Hourly rate defaults to client's configured rate or $75/hour
- Client portal: Clients can view invoices via `/invoice/:id` route with detailed line items

### Client Portal Features
- Documents: Clients can view and download documents via `/objects/*` endpoint (uses storagePath field)
- Invoices: Viewable via "View Invoice" button, shows line items, subtotal, tax, total
- Messages: Clients see notes marked as `isVisibleToClient=true`
- Projects: View-only project status with task timeline
- Task status values: "todo", "waiting", "in_progress", "done", "cancelled"

### Intake Applications (Permit Application Intake)
- Multi-step wizard form (6 steps) for comprehensive permit application intake
- Steps: Applicant Info → Project Info → Project Details → Site Characteristics → History & Proximity → Boards & Approvals
- Features:
  - Second owner toggle functionality
  - Conditional fields that appear based on selections
  - JSON fields for arrays (proximityFeatures, referralAgencies, boardsApprovals)
  - Draft saving and submission workflow
- Status workflow: draft → submitted → under_review → approved/rejected
- Database: intake_applications table with 100+ fields
- API Routes: GET/POST /api/intake-applications, GET/PATCH/DELETE /api/intake-applications/:id
- Frontend Routes: /intake (list), /intake/new (create), /intake/:id (view/edit)

### Daily Activity Logs
- Log Daily Activity dialog accessible from dashboard
- "Generate from Activity" button auto-populates fields from application data:
  - Time entries and time logs for hours worked calculation
  - Tasks completed, documents processed, notes added
  - Audit log entries for key actions
- Endpoint: GET /api/daily-activity-logs/generate?date=YYYY-MM-DD
- Admin-only feature

### Design System
The UI follows productivity tool patterns (Linear, Notion, Asana) with emphasis on information density and data clarity. Typography uses Inter for UI and JetBrains Mono for timestamps. Layout uses a fixed-width sidebar (w-64) with responsive main content area.

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