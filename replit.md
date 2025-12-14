# Expedition Plus CRM

## Overview

Expedition Plus is a permit expediting CRM platform designed for construction projects in Orange, Rockland, and Sullivan Counties, NY. The application serves two user types: internal administrators who manage clients, projects, tasks, time logs, and associates, and external clients who access a read-only portal to view their project status and updates.

The system follows a three-layer architecture: a public marketing website for lead generation, an authentication layer using Replit Auth, and an internal CRM with a client portal. All operational data revolves around Projects as the central entity.

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
- **Authentication**: Replit Auth via OpenID Connect with Passport.js
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
- **Clients**: Business entities that hire permit expediting services
- **Projects**: Permit applications linked to clients with status tracking
- **Tasks**: Work items within projects (road/office types)
- **Notes**: Communication log entries on projects
- **Time Logs**: Billable hours tracking per project
- **Associates**: External professionals (engineers, architects, surveyors, consultants)

### Design System
The UI follows productivity tool patterns (Linear, Notion, Asana) with emphasis on information density and data clarity. Typography uses Inter for UI and JetBrains Mono for timestamps. Layout uses a fixed-width sidebar (w-64) with responsive main content area.

## External Dependencies

### Database
- PostgreSQL database (required via DATABASE_URL environment variable)
- Session storage table for authentication persistence

### Authentication
- Replit Auth (OpenID Connect) for user authentication
- Requires REPL_ID, ISSUER_URL, and SESSION_SECRET environment variables

### Third-Party Libraries
- **UI**: Radix UI primitives, Lucide icons, class-variance-authority
- **Forms**: React Hook Form with Zod validation
- **Dates**: date-fns for date formatting
- **HTTP**: Fetch API for client requests, Express for server

### Development Tools
- Vite dev server with Replit-specific plugins (cartographer, dev-banner, error overlay)
- esbuild for production server bundling
- TypeScript for type checking