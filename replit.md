# Electrical Testing System

## Overview
This is a full-stack web application for electrical safety testing in Australia and New Zealand. It enables technicians to perform portable appliance testing (PAT) and generate compliance reports. The system features role-based access control (super admin, support center, technician), comprehensive test session management, and automated report generation, addressing critical safety and compliance needs in the electrical testing market.

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
- **Core Entities**: Users, sessions, test_sessions, test_results

### Key Features
- **Authentication**: Role-based access control (super_admin, support_center, technician), session-based.
- **Test Session Management**: Multi-step workflow (setup → item selection → testing → results), asset number validation, classification support (Class 1, Class 2, EPOD, RCD, 3 Phase), test frequency management, failure reason tracking. Features client-side batching for improved performance, ensuring atomic submission of results.
- **Report Generation**: PDF (jsPDF) and Excel (SheetJS) export with company branding, compliance formatting, and next due date calculations.
- **Admin Dashboard**: User management, test session oversight, bulk data export, system administration.
- **Data Flow**: User authentication, test session creation, testing workflow, report generation, and admin operations are managed via a client-side batched local storage system that submits results in a single, atomic operation to the backend. Asset numbering is handled client-side with intelligent allocation and duplicate prevention, then validated server-side upon batch submission.
- **Mobile Navigation**: Persistent site-wide header with mobile-responsive hamburger menu, accessible from all pages with global sign out functionality.
- **Session Cancellation**: Comprehensive cancel report functionality available on both item-selection and report-preview pages with database deletion, ownership verification, and proper cleanup of all associated test results.
- **Single Page Application (SPA)**: True client-side routing with no full page reloads, custom loading screens with 500ms minimum display time, and seamless navigation between testing and admin modes. Uses wouter for routing with custom SPA navigation hooks for consistent loading states.

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