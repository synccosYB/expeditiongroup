# Expedition Plus CRM - Design Guidelines

## Design Approach

**Selected Approach:** Design System with productivity tool inspiration (Linear, Notion, Asana)

**Rationale:** This is a utility-focused CRM platform requiring information density, data clarity, and operational efficiency. Drawing from modern project management tools ensures familiar patterns for product teams while maintaining professional credibility for permit expediting clients.

**Core Principles:**
- Information hierarchy over decoration
- Scannable data displays with clear visual groupings
- Efficient navigation between modules
- Trust-building professionalism for client portal

---

## Typography System

**Font Stack:**
- Primary: Inter (via Google Fonts) - UI, body text, data displays
- Monospace: JetBrains Mono - time logs, technical references, timestamps

**Type Scale:**
- Page Titles: text-3xl font-semibold (36px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Metadata/Labels: text-xs font-medium uppercase tracking-wide (12px)
- Data Tables: text-sm (14px)

**Hierarchy Rules:**
- All headings use font-semibold or font-medium
- Body content uses font-normal
- Critical status indicators use font-medium
- Uppercase labels for categories and metadata only

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4 or p-6
- Section spacing: mb-6 or mb-8
- Card gaps: gap-4 or gap-6
- Tight groupings: gap-2

**Grid Structure:**
- Dashboard: Two-column layout (sidebar + main content)
- Sidebar width: w-64 (fixed)
- Main content: max-w-7xl with responsive padding (px-6 lg:px-8)
- Project detail sections: Single column with max-w-5xl
- Data tables: Full width within container

**Container Strategy:**
- Public pages: max-w-7xl mx-auto
- Dashboard content: Full width with internal max-widths per section
- Forms: max-w-2xl for optimal readability

---

## Component Library

### Navigation

**Public Site Header:**
- Sticky top navigation: h-16
- Logo left, navigation links center, CTA button right
- Links: text-sm font-medium with spacing gap-8
- Mobile: Hamburger menu with slide-out drawer

**Dashboard Sidebar:**
- Fixed left sidebar: w-64 h-screen
- Logo at top: p-6
- Navigation groups with section labels (text-xs uppercase)
- Active state: Subtle background treatment
- Navigation items: py-2 px-4 with icon + text layout

**Breadcrumbs:**
- Display on all internal pages: text-sm with separator icons
- Format: Dashboard / Projects / [Project Name]

### Cards & Data Display

**Project Cards:**
- Rounded corners: rounded-lg
- Padding: p-6
- Border treatment for separation
- Header: Project name (text-lg font-semibold) + status badge
- Meta row: Client name, county, dates (text-sm)
- Action buttons in top-right corner

**Status Badges:**
- Compact pills: px-3 py-1 rounded-full text-xs font-medium
- States: Pending, In Progress, Waiting on Client, Done
- Visual distinction through background treatment

**Data Tables:**
- Header row: Sticky top with subtle background, text-xs uppercase font-medium
- Row height: py-4 for breathing room
- Alternating row backgrounds for scannability
- Sortable columns with arrow indicators
- Action column (right-aligned) with icon buttons

**Task Lists:**
- Checkbox + task description layout
- Task type indicator (Road/Office) as small badge
- Assigned associate shown as initials in circle
- Due date right-aligned
- Hover state reveals action menu

### Forms

**Input Fields:**
- Height: h-10 for text inputs
- Padding: px-4
- Border radius: rounded-md
- Labels: text-sm font-medium mb-2
- Helper text: text-xs below input
- Required indicator: Asterisk in label

**Textarea:**
- Min height: h-32
- Resize vertical only

**Select Dropdowns:**
- Match input styling
- Chevron icon right-aligned

**Form Layout:**
- Single column with max-w-2xl
- Field spacing: mb-6
- Button group: flex justify-end gap-4 mt-8

### Buttons

**Primary Action:**
- Height: h-10
- Padding: px-6
- Rounded: rounded-md
- Font: text-sm font-medium

**Secondary Action:**
- Same dimensions as primary
- Border treatment for distinction

**Icon Buttons:**
- Square: w-8 h-8
- Rounded: rounded-md
- Center icon with p-2

### Timeline View

**Quarter Headers:**
- Full-width sections: Q1 2024, Q2 2024, etc.
- Text: text-lg font-semibold
- Spacing: mb-4

**Initiative Cards (Draggable):**
- Width: Variable based on duration
- Padding: p-4
- Team indicator: 4px left border
- Priority badge: Top-right corner
- Content: Title (font-medium) + owner + dates (text-xs)
- Drag handle: Left side with grip icon

**Timeline Grid:**
- Monthly columns within quarters
- Grid lines for visual alignment
- Cards span across months based on dates

### Modals & Overlays

**Modal Structure:**
- Max width: max-w-2xl
- Padding: p-6
- Header: text-xl font-semibold mb-6
- Footer: Sticky bottom with action buttons
- Backdrop: Semi-transparent overlay

**Slide-over Panels:**
- Fixed right side: w-96
- Full height: h-screen
- Used for quick edits and details

---

## Public Marketing Pages

### Hero Section
- Height: 90vh minimum
- Two-column layout (60/40 split)
- Left: Headline (text-5xl font-bold) + subheading + CTA buttons
- Right: Hero image showing permit/construction documents or local NY landmarks
- Background: Subtle gradient or large background image with overlay

### Services Section
- Three-column grid: grid-cols-1 md:grid-cols-3 gap-6
- Service cards: p-6 with icon, title (text-xl), description
- Icon size: w-12 h-12 at top of each card

### How It Works
- Timeline-style layout with numbered steps
- Four steps in horizontal scroll on mobile, grid on desktop
- Step cards: Minimal design with number badge, title, description

### Who We Serve
- Two-column layout with client types
- Include trust indicators: "Serving Orange, Rockland & Sullivan Counties"
- Client logos or testimonials if available

### Footer
- Three-column layout: Company info, Quick links, Contact
- Service area emphasis
- Social links and copyright row at bottom

---

## Images

**Hero Image (Public Site):**
- Large hero image showing construction/permit documents, blueprints, or recognizable NY county buildings/landmarks
- Professional photography style
- Position: Right side of hero section or full-width background with overlay
- Treatment: Slight blur or overlay to ensure text legibility

**Section Supporting Images:**
- Services section: Icons representing each service (use Heroicons)
- How It Works: Diagram-style illustrations or process photos
- Optional: Team photo in "Who We Serve" section

---

## Dashboard-Specific Guidelines

**Page Structure:**
- Top bar: Breadcrumbs + page actions (right-aligned)
- Content area: Section headers with mb-8 spacing
- Module cards: Each task list, notes section, time logs in separate cards with consistent p-6 padding

**Empty States:**
- Centered content with icon (w-16 h-16)
- Message: text-base font-medium
- Action button below
- Keep within existing card structure

**Loading States:**
- Skeleton screens matching component structure
- Pulse animation for loading indicators

---

## Accessibility & Interaction

- Focus states: Visible outline on all interactive elements
- Click targets: Minimum 44px × 44px for touch
- Form validation: Inline error messages below fields
- Keyboard navigation: Logical tab order throughout
- Screen reader labels: All icon-only buttons include aria-label