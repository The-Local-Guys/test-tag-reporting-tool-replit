# Admin Form Management Design Guidelines

## Design Approach
**Selected System:** Material Design principles adapted for enterprise admin dashboards
**Justification:** Utility-focused data management interface requiring efficiency, clarity, and established patterns for CRUD operations and table interactions.

## Core Design Elements

### Typography
- **Primary Font:** Inter or Roboto via Google Fonts CDN
- **Headings:** 
  - Page title: text-2xl font-semibold (32px)
  - Section headers: text-lg font-medium (18px)
  - Table headers: text-sm font-semibold uppercase tracking-wide (14px)
- **Body Text:**
  - Table cells: text-sm (14px)
  - Descriptions/helpers: text-xs text-gray-600 (12px)
  - Button labels: text-sm font-medium (14px)

### Layout System
**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Container padding: p-6 to p-8
- Component spacing: gap-4 to gap-6
- Card padding: p-6
- Table cell padding: px-4 py-3
- Button padding: px-4 py-2

**Grid Structure:**
- Main container: max-w-7xl mx-auto
- Single column layout for data table (full-width within container)
- Action buttons arranged in horizontal flex rows with gap-3

### Component Library

**1. Page Header**
- Sticky top bar with page title and primary action button
- Title aligned left, "Add New Form Type" button aligned right
- Background with subtle border-bottom for separation
- Height: h-16 with flex items-center

**2. Control Bar (Above Table)**
- Flex container with gap-4 containing:
  - Search input field (left, flex-1)
  - CSV Upload button (secondary style)
  - Filter dropdown (if applicable)
  - Refresh icon button
- Margin-bottom: mb-6

**3. Professional Data Table**
- Full-width card container with rounded corners and shadow
- Table structure:
  - Sticky header row with light background
  - Alternating row backgrounds for readability (subtle stripe pattern)
  - Border-bottom on each row (1px, subtle)
  - Hover state: entire row with light blue tint
- Columns (left to right):
  - Checkbox (w-12 for bulk actions)
  - Form Type Name (flex-1, font-medium)
  - Description (flex-2, text-gray-600)
  - Fields Count (w-24, centered)
  - Status badge (w-32)
  - Created Date (w-40)
  - Actions (w-32, right-aligned)

**4. Table Actions**
- Icon buttons in actions column:
  - Edit (pencil icon)
  - Delete (trash icon)
  - Duplicate (copy icon)
- Buttons display as icon-only, tooltip on hover
- Size: w-8 h-8, rounded hover background

**5. CSV Upload Component**
- Drag-and-drop zone when activated (modal or inline expansion)
- Dashed border container with upload icon
- "Drop CSV file here or click to browse" text
- File format requirements text below (text-xs)
- Preview table after upload with validation feedback
- Confirm/Cancel actions at bottom

**6. Status Badges**
- Pill-shaped with small padding (px-3 py-1)
- Rounded-full
- States: Active (blue), Inactive (gray), Draft (yellow)
- Text-xs font-medium

**7. Modal Overlays**
- For edit/delete confirmations
- Centered overlay with backdrop blur
- Max-width: max-w-lg
- White background, rounded-lg, shadow-xl
- Header with title and close icon
- Body with form/content (p-6)
- Footer with Cancel (secondary) and Confirm (primary) buttons

**8. Empty State**
- Displayed when no form types exist
- Centered content with icon, heading, description
- "Create Your First Form Type" CTA button
- Muted background container

**9. Bulk Actions Bar**
- Appears when checkboxes selected (sticky to table header)
- Shows count of selected items
- Actions: Delete Selected, Export Selected, Duplicate
- Dismissible with X icon

### Icon Library
**Selected:** Material Icons via CDN
- add, edit, delete, file_upload, download, search, filter_list, more_vert, check_circle, cancel, refresh

### Animations
**Minimal, Performance-Focused:**
- Row hover: transition-colors duration-150
- Button interactions: transition-all duration-200
- Modal entrance: fade-in with scale-95 to scale-100
- Loading states: subtle pulse animation on skeleton screens

## Images
**No images required** - This is a data-focused admin interface. Visual hierarchy achieved through typography, spacing, and blue accent system.

## Accessibility Implementation
- All interactive elements have min height of h-10 (40px)
- Clear focus states with blue outline ring-2 ring-blue-500
- ARIA labels on icon-only buttons
- Table headers with proper scope attributes
- Color contrast ratios meet WCAG AA standards
- Keyboard navigation for all table rows and actions

## Professional Polish Details
- Subtle box shadows on cards: shadow-sm for table, shadow-lg for modals
- Consistent border-radius: rounded-lg for cards, rounded-md for inputs/buttons
- Micro-interactions on all clickable elements
- Loading skeleton screens during data fetch
- Toast notifications for success/error feedback (top-right position)
- Pagination component at table bottom (items per page selector + page numbers)
- Responsive: Table scrolls horizontally on mobile, stacks actions vertically