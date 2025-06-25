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