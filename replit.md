# Electrical Testing System

## Overview

This is a full-stack web application designed for electrical safety testing in Australia and New Zealand. The system allows technicians to conduct portable appliance testing (PAT) and generate compliance reports. It features role-based access control with super admin, support center, and technician roles, along with comprehensive test session management and report generation capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state, React hooks for local state
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: Express sessions with PostgreSQL storage
- **Authentication**: Password-based with bcrypt hashing

### Database Design
- **Provider**: Neon Database (PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations
- **Tables**: Users, sessions, test_sessions, test_results
- **Relationships**: Hierarchical user structure with franchise linking

## Key Components

### Authentication System
- Role-based access control (super_admin, support_center, technician)
- Session-based authentication with PostgreSQL storage
- Password hashing using bcryptjs
- Login mode selection (testing vs admin interface)

### Test Session Management
- Multi-step testing workflow (setup → item selection → testing → results)
- Asset number validation and auto-increment
- Classification support (Class 1, Class 2, EPOD, RCD, 3 Phase)
- Test frequency management (3, 6, 12, 24 monthly, 5 yearly)
- Failure reason tracking and action documentation

### Report Generation
- PDF generation using jsPDF with professional formatting
- Excel export functionality using SheetJS
- Company branding and compliance formatting
- Next due date calculations based on test frequency

### Admin Dashboard
- User management (create, activate/deactivate, password reset)
- Test session oversight and editing capabilities
- Bulk data export and reporting
- System administration tools

## Data Flow

1. **User Authentication**: Login → Session creation → Role verification
2. **Test Session Creation**: Setup form → Database storage → Session tracking
3. **Testing Workflow**: Item selection → Test execution → Result capture → Validation
4. **Report Generation**: Data aggregation → PDF/Excel creation → Download/Share
5. **Admin Operations**: User management → Session oversight → System monitoring

## External Dependencies

### Production Dependencies
- **Database**: @neondatabase/serverless for PostgreSQL connectivity
- **Authentication**: bcryptjs for password hashing
- **Session Storage**: connect-pg-simple for PostgreSQL session store
- **Email**: @sendgrid/mail for email notifications
- **UI Components**: Comprehensive Radix UI component library
- **PDF Generation**: jsPDF for report generation
- **Excel Export**: XLSX library for spreadsheet generation

### Development Tools
- **TypeScript**: Full type safety across frontend and backend
- **Vite**: Fast development server and optimized builds
- **ESBuild**: Production backend bundling
- **Drizzle Kit**: Database schema management and migrations

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with hot reload via Vite
- **Production**: Node.js server with static file serving
- **Database**: Neon PostgreSQL with connection pooling
- **Session Storage**: PostgreSQL-backed sessions for scalability

### Build Process
1. Frontend build using Vite (React → static assets)
2. Backend build using ESBuild (TypeScript → optimized JavaScript)
3. Static file serving integrated into Express server
4. Database migrations via Drizzle Kit

### Replit Integration
- Configured for autoscale deployment
- PostgreSQL module integration
- Environment variable management
- Development workflow optimization

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 18, 2025. Initial setup
- July 11, 2025. Critical data loss bug fixes implemented:
  - Added comprehensive retry logic with exponential backoff to prevent data loss
  - Implemented failed result recovery system with local storage backup
  - Added navigation guards to prevent users from leaving during critical operations
  - Enhanced server-side error handling with detailed logging and request tracking
  - Created diagnostic tool for troubleshooting data loss issues
  - Added comprehensive validation and verification of test result saves
  - Improved comment system integration for both PDF and Excel reports
  - Added pagination system to admin report viewing with 10/50/100 items per page options
- July 16, 2025. Fixed critical asset numbering system bug:
  - Resolved race condition causing random asset numbers instead of sequential numbering
  - Moved asset number generation from frontend to server-side for atomic operations
  - Implemented automatic duplicate detection and correction during test result creation
  - Updated both electrical and emergency test interfaces to use server-side generation
  - Enhanced UI to show auto-generation status instead of manual input fields
  - Fixed modal scrolling issues in admin interface with proper scroll containment
  - Added real-time asset number progress display to testing interface
  - Shows next asset number and count of tested items for each frequency type
  - Fixed 5-yearly asset numbering bug ensuring proper sequence separation
  - Updated 5-yearly asset numbers to start from 10001 instead of 5001
  - Fixed all existing 5-yearly items to use new 10001+ numbering system
  - Added numerical sorting to reports so items display in asset number order (1, 2, 3, 10001, 10002, etc.)
- July 17, 2025. Fixed critical duplicate test result bug:
  - Implemented comprehensive duplicate prevention system to prevent users testing 1 item but getting multiple duplicates
  - Added client-side deduplication with unique request IDs and duplicate detection
  - Removed retry logic that was causing duplicate submissions
  - Added server-side recent duplicate detection (10-second window)
  - Implemented button debouncing to prevent rapid multiple clicks
  - Added request-in-progress tracking to prevent concurrent submissions
  - Enhanced logging to track duplicate detection and prevention
- July 21, 2025. Added comprehensive code documentation:
  - Added detailed JSDoc comments to all major functions throughout the application
  - Documented server-side storage functions with parameters and return types
  - Added comments to API route handlers and middleware functions
  - Documented client-side hooks, mutations, and component functions
  - Added descriptions for PDF and Excel generation functions
  - Enhanced code readability and maintainability for future development
- July 23, 2025. Implemented major architecture refactor to batched local storage system:
  - Completely refactored from individual server requests per item to batched local storage system
  - Created new batch submission endpoint (/api/sessions/:id/batch-results) for single report submission
  - Updated useSession hook to manage local storage batching with addToBatch() function
  - Modified all test pages (test-details.tsx, failure-details.tsx, emergency-test-details.tsx) to use batching
  - Enhanced report-preview.tsx to display batched results and submit entire reports at once
  - Improved performance by eliminating network requests during testing workflow
  - Added comprehensive batch processing with error handling and progress tracking
  - Maintained asset number auto-generation and duplicate prevention on server side
  - Preserved all existing functionality while improving user experience and reducing server load
  - Fixed critical isAddingResult errors by removing all legacy references from test pages
  - Simplified Pass/Fail buttons to work seamlessly with local storage batching system
  - Removed diagnostic tool code and all related components to clean up codebase
  - Implemented client-side asset number tracking using useState counters to prevent jumbled asset numbers
  - Asset counters start at 0 for monthly frequencies (3, 6, 12, 24 monthly) and 10000 for 5-yearly frequency
  - Sequential asset numbering is now maintained across all testing sessions with proper state management
  - Asset numbers are assigned immediately when items are added to batch, eliminating server-side conflicts
  - Added sorting function to display items in proper order: monthly frequencies first (1, 2, 3...), then 5-yearly (10001, 10002, 10003...)
  - Removed server-side duplicate checking and asset number generation to prevent conflicts with client-side batching
  - Batch submission now uses client-provided asset numbers ensuring all items are saved to database correctly
  - Fixed update and delete functions in report preview to correctly handle batched local storage items using proper temporary IDs
- July 24, 2025. Resolved update function issues in report preview:
  - Added comprehensive error handling and logging to updateBatchedResult function
  - Enhanced handleSaveEdit with detailed debugging information
  - Fixed ID handling for batched results with proper temporary ID management
  - Confirmed both update and delete functions working correctly for local storage batching
  - Update function now properly modifies items in local storage before final batch submission
- July 24, 2025. Enhanced admin dashboard asset numbering and sorting:
  - Added automatic asset number reassignment when editing test frequency in admin dashboard
  - Monthly frequencies (3, 6, 12, 24 monthly) use sequential numbering starting from highest existing + 1
  - 5-yearly frequency uses sequential numbering starting from highest existing 10001+ number + 1
  - Implemented sorting function in admin report view to display items in proper asset number order
  - Added sorting to PDF and Excel generators ensuring reports show items in correct sequence
  - Asset numbers now correctly reflect frequency type when edited through admin interface
  - Fixed asset number calculation logic to properly count existing items in target frequency category
  - When changing frequency categories, system now assigns next sequential number based on count of existing items
  - Example: 4 existing 5-yearly items + 1 new = asset #10005, 5 existing monthly items + 1 new = asset #6
- July 24, 2025. Enhanced handleViewReport function in admin dashboard:
  - Confirmed function properly fetches latest data from server before opening modal
  - Added enhanced error handling with detailed HTTP status reporting  
  - Improved logging to track data fetch success and result counts
  - Modal only opens after successful data fetch and state update
  - Function handles both session objects and direct session IDs correctly
- July 31, 2025. Refactored admin dashboard report editing with enhanced asset numbering:
  - Added useState to track monthly and 5-yearly asset number counts for dynamic calculation
  - Created sortAssetNumbers() function for consistent asset number ordering across the interface
  - Implemented calculateAssetCounts() to determine starting asset numbers when viewing reports
  - Enhanced handleUpdateResult() with real-time asset count updates during frequency changes
  - Monthly frequencies (3, 6, 12, 24 monthly) use sequential numbering starting from count + 1
  - 5-yearly frequency uses sequential numbering starting from count + 10001
  - Added proper state management to prevent asset number conflicts during editing
  - Improved sorting consistency throughout admin dashboard report viewing and editing
- July 31, 2025. Enhanced admin dashboard edit functionality with manual asset number entry:
  - Replaced automatic asset number reassignment with manual user input requirement
  - Added real-time validation for duplicate asset numbers and frequency-based range checking
  - Implemented asset number clearing when frequency changes to force user input
  - Added range validation: 5-yearly items must use 10000+, monthly items use 1-9999
  - Enhanced UI with dynamic placeholders and validation error messages
  - Fixed local state updates to ensure edited items display changes immediately on screen
- July 31, 2025. Refactored add item function with same manual asset number validation system:
  - Implemented manual asset number entry requirement for adding new items
  - Added frequency-based range validation (monthly: 1-9999, 5-yearly: 10000+)
  - Implemented automatic asset number clearing when frequency changes during add workflow
  - Added real-time duplicate detection within session to prevent conflicts
  - Enhanced add item modal UI with dynamic placeholders and validation messages
  - Added save button disable functionality when validation errors are present