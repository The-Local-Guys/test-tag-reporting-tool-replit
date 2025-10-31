# Electrical Testing System

## Overview
This is a full-stack web application for electrical safety testing in Australia and New Zealand. It enables technicians to perform portable appliance testing (PAT), emergency exit light testing, fire equipment testing, and RCD testing with automated compliance report generation. The system features role-based access control (super admin, support center, technician), comprehensive test session management, and automated report generation, addressing critical safety and compliance needs in the electrical testing market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (server state), React hooks (local state)
- **UI Library**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM (PostgreSQL dialect)
- **Session Management**: Express sessions with PostgreSQL storage
- **Authentication**: Password-based with bcrypt hashing

### Database
- **Provider**: Neon Database (PostgreSQL)
- **Schema Management**: Drizzle Kit
- **Core Entities**: Users, sessions, test_sessions, test_results, environments, custom_form_types

### Key Features
- **Authentication**: Role-based access control (super_admin, support_center, technician), session-based.
- **Test Session Management**: Multi-step workflow (setup → item selection → testing → results), asset number validation, classification support (Class 1, Class 2, EPOD, RCD, 3 Phase), test frequency management, failure reason tracking. Features client-side batching for improved performance, ensuring atomic submission of results.
- **Report Generation**: PDF (jsPDF) and Excel (SheetJS) export with company branding, compliance formatting, and next due date calculations.
- **Admin Dashboard**: User management, test session oversight, bulk data export, system administration.
- **ARA Compliance Support**: Items display with standardized codes in "code - item name" format (e.g., "1122 - 3D Printer") throughout item selection, report preview, delete confirmations, and all generated reports (PDF/Excel). Codes are embedded directly in item names at selection time. Custom items for ARA Compliance use code "532" and format as "532 Other (custom_item_name)" (e.g., "532 Other (Electric Kettle)").
- **Data Flow**: User authentication, test session creation, testing workflow, report generation, and admin operations are managed via a client-side batched local storage system. Users can add results, preview reports (including PDF downloads), and continue adding more results. Batch submission occurs only when clicking "Finish Job" on the report preview page, enabling flexible testing workflows. Asset numbering is handled client-side with intelligent allocation and duplicate prevention, then validated server-side upon batch submission.
- **Mobile Navigation**: Persistent site-wide header with mobile-responsive hamburger menu, accessible from all pages with global sign out functionality.
- **Session Cancellation**: Comprehensive cancel report functionality available on both item-selection and report-preview pages with database deletion, ownership verification, and proper cleanup of all associated test results.
- **Single Page Application (SPA)**: True client-side routing with no full page reloads, custom loading screens with 500ms minimum display time, and seamless navigation between testing and admin modes. Uses wouter for routing with custom SPA navigation hooks for consistent loading states.
- **Custom Environments**: Technicians can create and manage custom item sets per testing type. Each environment is account-specific (only visible to creator), filtered by service type (electrical, emergency exit light, fire testing). Environment dropdown in item selection page allows switching between default items and custom environments. Includes full CRUD operations with ownership verification and security against ownership reassignment.
- **Custom Form Types**: Admin and support-center roles can create dynamic custom form types via CSV file upload. Custom forms appear as country/form selection options in the setup page alongside standard country selections (Australia, New Zealand). Available for all service types (electrical, emergency exit light, fire testing, RCD reporting) without filtering. Features CSV file upload interface, validation, and CRUD operations for managing custom test item sets. Implementation: Single-table design (custom_form_types) with CSV data stored in csvData column. Table automatically created on server startup using raw SQL to ensure compatibility across environments.
- **RCD Reporting**: Dedicated testing workflow for Residual Current Devices (RCDs) with support for both Fixed RCD and Portable RCD testing. Features manual asset number entry, location tracking, equipment type identification (with automatic item name synchronization), distribution board number field (Fixed RCD only), and comprehensive test completion tracking (Push Button Test and Injection/Timed Test). Includes test result recording (Pass/Fail) with optional notes. Distribution board numbers display in report preview and PDF reports as "Fixed RCD (DB-1)" format. Data stored with RCD-specific fields (pushButtonTest, injectionTimedTest, distributionBoardNumber) in test_results table. Report generation includes smart batch submission handling to prevent "No active session" errors when finishing jobs. AS/NZS 3760 compliance testing standard.

## External Dependencies

### Production
- **Database**: @neondatabase/serverless
- **Authentication**: bcryptjs
- **Session Storage**: connect-pg-simple
- **Email**: @sendgrid/mail
- **UI Components**: Radix UI
- **PDF Generation**: jsPDF
- **Excel Export**: XLSX

### Development
- **Language**: TypeScript
- **Build/Dev Tools**: Vite, ESBuild
- **Database Management**: Drizzle Kit