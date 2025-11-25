# Electrical Testing System

## Overview
This full-stack web application streamlines electrical safety testing in Australia and New Zealand. It supports various testing types (PAT, emergency exit light, fire equipment, RCD, microwave leakage) and automates compliance report generation. The system features role-based access control, comprehensive test session management, and aims to meet critical safety and compliance needs in the electrical testing market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Framework**: React with TypeScript
- **UI Library**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS
- **Mobile Navigation**: Persistent site-wide header with mobile-responsive hamburger menu.
- **SPA Design**: True client-side routing with custom loading screens and seamless navigation.
- **Reporting Design**: Professional PDF/Excel reports with company branding and compliance formatting.

### Technical Implementations
- **Frontend**: React, TypeScript, Wouter for routing, TanStack Query for server state, Vite for build.
- **Backend**: Node.js with Express.js, TypeScript, Drizzle ORM (PostgreSQL), Express sessions.
- **Database**: Neon Database (PostgreSQL) with Drizzle Kit for schema management.
- **Authentication**: Role-based access control (super_admin, support_center, technician), session-based with bcrypt hashing.
- **Performance**: Optimized database queries using SQL aggregates to prevent N+1 query problems.

### Feature Specifications
- **Test Session Management**: Multi-step workflow, asset number validation, classification support, test frequency management, failure tracking, client-side batching. Includes frequency memory for emergency exit light and fire testing, and smart asset number updates for Electrical Test & Tag.
- **Report Generation**: PDF (jsPDF) and Excel (SheetJS) export with compliance formatting and next due date calculations.
- **Admin Dashboard**: User management, test session oversight, bulk data export.
- **ARA Compliance Support**: Standardized item codes (e.g., "1122 - 3D Printer") throughout the system and in reports.
- **Data Flow**: Client-side batched local storage system for test results, with batch submission upon job completion.
- **Session Cancellation**: Comprehensive functionality to cancel reports, delete associated data, and verify ownership.
- **Custom Environments**: Technicians can create and manage account-specific, service-filtered custom item sets with full CRUD operations.
- **Custom Form Types**: Admin/support roles can upload CSVs to create dynamic custom form types for various service types.
- **RCD Reporting**: Dedicated workflow for Fixed and Portable RCDs, supporting multiple trip times for Fixed RCDs, specific failure handling, and AS/NZS 3760 compliance.
- **Microwave Leakage Testing**: Dedicated service for microwave testing (AS/NZS 60335.2.25 compliance) with brand selection, custom brand input, and simplified test workflow. Panasonic brand selection disables testing.
- **Certificate of Compliance**: Admin feature for generating professional compliance certificates with client selection, multi-service support, automatic validity date calculation, technician credentials, and in-app preview/editing.
- **Asset Number Ranges**: Service-type-specific asset numbering with isolation between Electrical Test & Tag, Emergency Exit Light, Fire Equipment Testing, RCD Reporting, and Microwave Leakage Testing. Includes custom starting numbers for Electrical Test & Tag.

### System Design Choices
- **Database Schema**: Core entities include Users, sessions, test_sessions, test_results, environments, custom_form_types, certificates. Schema synchronization between development and production databases.
- **Zod Schema Validation**: Used for robust data validation, including specific RCD trip time validation.
- **Modular Frontend**: Dedicated components and hooks for features like Certificates, ensuring maintainability.

### Analytics Implementation
- **PostHog Integration**: Comprehensive full-stack analytics for debugging, user behavior tracking, and business intelligence.
  - **Backend Tracking** (`server/posthog.ts`):
    - API Request Middleware: Captures all API requests with full authentication context (userId, username, email, role, fullName, companyName, sessionId, isAuthenticated, authMethod).
    - Request Context: ip, userAgent, referer, origin, host, acceptLanguage, contentType.
    - Response Metrics: Status codes, duration, duration category (fast/normal/slow/very_slow), route category.
    - Request Body Logging: Sanitized POST/PUT/PATCH bodies with sensitive fields redacted.
    - Error Tracking: Distinct events for api_unauthorized (401), api_forbidden (403), api_not_found (404), api_server_error (5xx).
    - Helper Functions: trackLogin, trackLogout, trackSessionAction, trackTestResult, trackBatchSubmission, trackReportGenerated, trackCertificateAction, trackEnvironmentAction, trackCustomFormAction, trackUserManagementAction, trackAdminAction, trackDataExport, trackDatabaseOperation, trackSystemEvent.
    - System Events: Captures uncaught_exception, unhandled_rejection, process_warning, system_startup, system_shutdown.
  - **Frontend Tracking** (`client/src/lib/posthog.ts`):
    - Page Views: Automatic tracking with stored user info persistence.
    - Click Tracking: Captures clicks on interactive elements with tagName, id, testId, href, ariaLabel.
    - Form Tracking: Automatic form submission capture with input counts.
    - Input Tracking: Focus/blur events with duration tracking.
    - Scroll Tracking: Scroll depth milestones (25%, 50%, 75%, 100%).
    - Visibility Tracking: Page hide/show events with hidden duration.
    - Keyboard Tracking: Escape key, Ctrl+S, Enter in inputs.
    - Clipboard Tracking: Copy/paste events.
    - Modal/Dialog Tracking: Dialog open events via MutationObserver.
    - Select/Checkbox/Radio Tracking: Change events for form controls.
    - Tab Tracking: Tab clicks for navigation.
    - Error Tracking: JavaScript errors, unhandled promise rejections.
    - Helper Functions: trackLogin, trackLogout, trackSessionStart, trackSessionComplete, trackSessionCancelled, trackTestResult, trackItemAdded, trackItemDeleted, trackReportPreview, trackReportDownload, trackCertificateAction, trackEnvironmentAction, trackNavigation, trackButtonClick, trackFormSubmit, trackFormValidationError, trackModalOpen, trackModalClose, trackTabChange, trackDropdownSelect, trackSearchPerformed, trackFileUpload, trackAPICall, trackServiceTypeSelected, trackCountrySelected, trackFrequencySelected, trackAssetNumberChanged, trackPhotoCapture.
  - **Environment Variables**: POSTHOG_API_KEY, POSTHOG_HOST (backend), VITE_POSTHOG_API_KEY, VITE_POSTHOG_HOST (frontend). Analytics disabled gracefully when API key not configured.

## External Dependencies

- **Database**: Neon Database (@neondatabase/serverless)
- **Authentication**: bcryptjs
- **Session Storage**: connect-pg-simple
- **Email**: @sendgrid/mail
- **UI Components**: Radix UI
- **PDF Generation**: jsPDF
- **Excel Export**: XLSX
- **Analytics**: PostHog (posthog-js for frontend, posthog-node for backend)
- **Development Tools**: TypeScript, Vite, ESBuild, Drizzle Kit