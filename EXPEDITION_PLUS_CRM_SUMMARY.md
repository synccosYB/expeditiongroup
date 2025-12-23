# Expedition Plus CRM - Project Summary

## Overview

Expedition Plus is a permit expediting CRM platform designed for construction projects in Orange, Rockland, and Sullivan Counties, NY. The application serves two user types:

- **Internal Administrators**: Full access to CRM features including clients, projects, tasks, time logs, invoices, and associates
- **External Clients**: Read-only portal access to view their project status and updates

The system follows a three-layer architecture: a public marketing website for lead generation, an authentication layer using email/password authentication, and an internal CRM with a client portal. All operational data revolves around Projects as the central entity.

---

## Core Features

### Client Management
- Client database with contact information (name, email, phone, address)
- Company association
- Custom hourly billing rate per client (defaults to $75/hour)
- Client portal access for project visibility

### Project Management
- Project creation and tracking linked to clients
- Status workflow: intake, in progress, waiting on client, with DOB, completed, on hold, cancelled
- Property address and jurisdiction tracking
- County-based organization (Orange, Rockland, Sullivan)
- Start date and target end date tracking

### Task Management
- Task creation with titles, descriptions, and due dates
- Subtask support for complex work items
- Task types: office work vs. road work
- Priority levels: low, normal, high, urgent
- Status tracking: to do, in progress, waiting, done
- Task assignment to team members
- Related associate linking
- Client upload requirements flag

### Time Tracking System
Two parallel systems are supported:

**Legacy Time Logs**
- Description-based time entries
- Date, start time, end time tracking
- Duration stored as hours (varchar)
- Type classification (road/office)

**New Time Entries**
- Task-linked time tracking
- Duration stored as total minutes
- Billable flag for invoicing
- Notes field for details

**Time Entry Features**
- Duration input with minutes/hours dropdown selector
- Auto-calculation from start/end times
- Edit existing time logs
- Delete time logs with confirmation
- 12-hour AM/PM time format display

### Invoicing System
- Invoice generation from time logs tab on project detail page
- Invoice number format: INV-YYYY-NNNN (e.g., INV-2024-0001)
- Status tracking: draft, sent, paid, cancelled
- Line items can reference:
  - Time logs
  - Time entries
  - Custom items (filing fees, mileage, permits, etc.)
- Hourly rate defaults to client's configured rate or $75/hour
- Print-friendly invoice view with company branding
- Company logo, address, and contact info on invoices
- Invoice deletion capability
- Dashboard reporting for unpaid invoices

### Document Management
- File upload functionality with 1GB storage limit
- Access control policies:
  - Public documents
  - Private documents
  - Admin-only access
- Folder organization within projects
- Document visibility settings for client portal
- Upload status tracking and error handling

### Associates Management
- External professional tracking (engineers, architects, surveyors, consultants)
- Contact information management
- Project and task linking
- Associate type classification

### Client Portal
- Read-only access for external clients
- Project status and progress viewing
- Task timeline with completion status
- Document access (based on visibility settings)
- Notes and updates visibility
- Action required indicators for pending tasks

### Dashboard
- Project status overview
- Active projects count
- Unbilled hours tracking
- Unpaid invoice summary
- Recent activity feed

---

## Technical Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (supports dark mode)
- **Build Tool**: Vite with hot module replacement
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful JSON API with `/api` prefix
- **Authentication**: Email/password authentication with bcrypt password hashing
- **Session Management**: Express sessions stored in PostgreSQL via connect-pg-simple

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all database tables and types
- **Migrations**: Drizzle Kit for database migrations

### File Storage
- Google Cloud Storage for document uploads
- 1GB storage limit per project
- Signed URLs for secure file access

---

## Development Timeline

### December 23, 2025
- Fixed date timezone issues preventing dates from jumping back a day
- Updated date utility functions across all pages
- Improved ISO date string parsing for consistent display

### December 22, 2025
- Added time log deletion with confirmation dialog
- Implemented duration editing with auto-calculation from times
- Added minutes/hours dropdown selector for time entry
- Improved file uploader layout for long filenames
- Enhanced file upload storage limit checks
- Increased document upload limit to 1GB
- Added admin access to all uploaded documents
- Implemented document access policies

### December 21, 2025
- Added invoice deletion capability
- Updated favicon and branding to match company logo
- Added PNG favicon for browser compatibility

### December 19, 2025
- Built complete invoicing system
- Added invoice generation from time logs
- Implemented print-friendly invoice views
- Added company logo and address to invoices
- Created invoice detail page
- Integrated invoices into client details
- Added unpaid invoice summary to dashboard
- Prevented duplicate invoice generation
- Improved invoice printing layout

### December 18, 2025
- Added ability to edit project notes
- Implemented time entry editing functionality

---

## Data Models

### Users
- Authenticated users with roles (admin/client)
- Email/password authentication
- Session-based authentication

### Clients
- Business entities that hire permit expediting services
- Optional hourly rate configuration
- Linked to projects

### Projects
- Permit applications linked to clients
- Status tracking through workflow
- Address and jurisdiction information

### Tasks
- Work items within projects
- Subtask hierarchy support
- Type classification (road/office)
- Priority and due date tracking

### Time Logs (Legacy)
- Description-based billable hours tracking
- Date and time range tracking
- Type classification

### Time Entries (New)
- Task-linked time tracking
- Minutes-based duration
- Billable flag

### Invoices
- Generated from time logs/entries
- Line items with descriptions and amounts
- Status workflow (draft, sent, paid, cancelled)

### Invoice Items
- Individual line items on invoices
- Can reference time logs, time entries, or be custom items

### Associates
- External professionals (engineers, architects, surveyors, consultants)
- Contact information and type classification

### Documents
- File uploads with metadata
- Access control and visibility settings
- Folder organization

---

## Role-Based Access Control

### Admin Role
- Full access to all CRM features
- Client management
- Project management
- Task management
- Time tracking
- Invoice generation and management
- Associate management
- Document management with full access

### Client Role
- Limited access to client portal
- View only their linked projects
- View project status and tasks
- Access visible documents
- View notes and updates
- No editing capabilities

---

## Design System

The UI follows productivity tool patterns (Linear, Notion, Asana) with emphasis on:
- Information density and data clarity
- Clean, modern interface
- Dark mode support
- Responsive layout

### Typography
- Inter font for UI elements
- JetBrains Mono for timestamps and code

### Layout
- Fixed-width sidebar (w-64)
- Responsive main content area
- Card-based information display
- Tab-based organization for detail views

---

*Document generated: December 23, 2025*
