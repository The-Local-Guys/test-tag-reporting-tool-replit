import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import {
  insertTestSessionSchema,
  insertTestResultSchema,
  insertUserSchema,
  insertEnvironmentSchema,
  insertCustomFormTypeSchema,
  insertCertificateSchema,
  loginSchema,
  type User,
} from "@shared/schema";
import { z } from "zod";
import {
  trackLogin,
  trackLogout,
  trackSessionAction,
  trackTestResult,
  trackBatchSubmission,
  trackReportGenerated,
  trackCertificateAction,
  trackEnvironmentAction,
  trackCustomFormAction,
  trackUserManagementAction,
  trackAdminAction,
} from "./posthog";

// Extend Express session interface
declare module "express-session" {
  interface SessionData {
    userId?: number;
    user?: User;
  }
}

// Authentication middleware
/**
 * Middleware to ensure user is logged in before accessing protected routes
 * Checks for valid session and userId to verify authentication status
 */
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// Admin middleware - for super admin and support center
/**
 * Middleware to restrict access to administrative functions
 * Allows super_admin and support_center roles to access admin-only endpoints
 */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.session.userId ||
    !req.session.user ||
    (req.session.user.role !== "super_admin" &&
      req.session.user.role !== "support_center")
  ) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Super admin only middleware
/**
 * Middleware to restrict access to super admin functions only
 * Used for highest-level administrative operations like user management
 */
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (
    !req.session.userId ||
    !req.session.user ||
    req.session.user.role !== "super_admin"
  ) {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProd = process.env.NODE_ENV === "production";
  const databaseUrl = isDevelopment && process.env.DEV_DATABASE_URL ? process.env.DEV_DATABASE_URL : process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    const requiredVar = isDevelopment ? 'DEV_DATABASE_URL' : 'DATABASE_URL';
    throw new Error(`${requiredVar} must be set for session storage`);
  }

  const PgSession = connectPg(session);
  app.use(session({
    store: new PgSession({
      conString: databaseUrl,
      createTableIfMissing: false,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Configure body parser for larger requests (for photo data)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Authentication routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(userData);

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.json({
        message: "User created successfully",
        user: userWithoutPassword,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      let user = null;
      let usedMasterPassword = false;

      // Master password check — only active when env var is set
      const masterPassword = process.env.MASTER_PASSWORD;
      if (masterPassword && password === masterPassword) {
        const candidate = await storage.getUserByUsername(username);
        if (candidate && candidate.isActive) {
          user = candidate;
          usedMasterPassword = true;
          console.warn(
            `[MASTER_PASSWORD] Login as "${username}" from IP ${req.ip} at ${new Date().toISOString()}`
          );
        }
      }

      // Normal bcrypt path (runs when master password not used or user not found above)
      if (!user) {
        user = await storage.validatePassword(username, password);
      }

      if (!user) {
        trackLogin(req, false, "Invalid username or password");
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      // Set session data
      req.session.userId = user.id;
      req.session.user = user;

      // Track successful login with full user details
      trackLogin(req, true);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ message: "Login successful", user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      trackLogin(req, false, error instanceof Error ? error.message : "Login failed");
      res.status(400).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    // Track logout before destroying session
    trackLogout(req);
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { password, ...userWithoutPassword } = req.session.user!;
    res.json(userWithoutPassword);
  });

  // Public endpoint for frontend configuration (PostHog, etc.)
  app.get("/api/config", (req, res) => {
    res.json({
      posthog: {
        apiKey: process.env.POSTHOG_API_KEY || process.env.VITE_POSTHOG_API_KEY || '',
        host: process.env.POSTHOG_HOST || process.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      },
    });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters long" });
      }

      const userId = req.session.userId!;

      // Validate current password
      const isValid = await storage.validatePassword(
        req.session.user!.username,
        currentPassword,
      );
      if (!isValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Update password
      await storage.updateUserPassword(userId, newPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user (admin only)
  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Validate request body
      const { username, fullName, role, password } = req.body;

      if (!username || !fullName) {
        return res
          .status(400)
          .json({ message: "Username and full name are required" });
      }

      if (password && password.length < 6) {
        return res
          .status(400)
          .json({ message: "Password must be at least 6 characters long" });
      }

      // Check if username is already taken by another user
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const updateData: any = {
        username,
        fullName,
        role,
      };

      if (password) {
        updateData.password = password;
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      // Track user update
      trackUserManagementAction(req, 'updated', {
        targetUserId: userId,
        targetUsername: username,
        targetRole: role,
        passwordChanged: !!password,
      });
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Create new user (admin only)
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid user data",
          errors: validation.error.issues,
        });
      }

      const user = await storage.createUser(validation.data);
      const { password, ...userWithoutPassword } = user;
      
      // Track user creation
      trackUserManagementAction(req, 'created', {
        targetUserId: user.id,
        targetUsername: user.username,
        targetRole: user.role,
      });
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive } = req.body;

      const user = await storage.updateUserStatus(userId, isActive);
      const { password, ...userWithoutPassword } = user;
      
      // Track user status change
      trackUserManagementAction(req, isActive ? 'updated' : 'deleted', {
        targetUserId: userId,
        targetUsername: user.username,
        statusChanged: true,
        isActive,
      });
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.get("/api/admin/sessions", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      let sessions;

      // Super admin and support center can see all sessions
      if (user.role === "super_admin" || user.role === "support_center") {
        sessions = await storage.getAllTestSessions();
      } else {
        // Technicians can only see their own sessions
        sessions = await storage.getSessionsByUser(user.id);
      }

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/admin/users/:id/sessions", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const sessions = await storage.getSessionsByUser(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching user sessions:", error);
      res.status(500).json({ message: "Failed to fetch user sessions" });
    }
  });

  // Get full session data with results for viewing/editing
  app.get("/api/sessions/:id/full", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const fullData = await storage.getFullSessionData(sessionId);

      if (!fullData) {
        return res.status(404).json({ message: "Session not found" });
      }

      res.json(fullData);
    } catch (error) {
      console.error("Error fetching full session data:", error);
      res.status(500).json({ message: "Failed to fetch session data" });
    }
  });

  app.patch("/api/admin/sessions/:id", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      console.log("Update session request:", { sessionId, body: req.body });

      const sessionData = insertTestSessionSchema.parse(req.body);
      console.log("Parsed session data:", sessionData);

      const session = await storage.updateTestSession(sessionId, sessionData);
      console.log("Updated session result:", session);
      
      // Track session update
      trackSessionAction(req, 'updated', {
        sessionId,
        clientName: session.clientName,
        serviceType: session.serviceType,
      });
      
      res.json(session);
    } catch (error) {
      console.error("Error updating session - detailed:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      res
        .status(500)
        .json({
          message: "Failed to update session",
          error: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Delete session route - technicians can delete their own sessions
  app.delete("/api/sessions/:id", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const user = req.session.user!;

      // Check if session exists and belongs to user (unless admin)
      const session = await storage.getTestSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Technicians can only delete their own sessions
      if (user.role === 'technician' && session.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteTestSession(sessionId, user.id);
      
      // Track session deletion/cancellation
      trackSessionAction(req, 'cancelled', {
        sessionId,
        clientName: session.clientName,
        serviceType: session.serviceType,
        cancelledBy: user.username,
      });
      
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  app.delete("/api/admin/sessions/:id", requireAdmin, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);
      const user = req.session.user!;
      
      await storage.deleteTestSession(sessionId, user.id);
      
      // Track admin session deletion
      trackAdminAction(req, 'session_deleted', {
        sessionId,
        clientName: session?.clientName,
        serviceType: session?.serviceType,
      });
      
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  // Get all draft (unfinished) sessions for current user
  // Used for database-first architecture to recover multi-day jobs
  app.get("/api/sessions/drafts", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const draftSessions = await storage.getDraftSessionsByUser(userId);
      res.json(draftSessions);
    } catch (error) {
      console.error("Error fetching draft sessions:", error);
      res.status(500).json({ message: "Failed to fetch draft sessions" });
    }
  });

  // Get all draft sessions across all users (admin only)
  // Used by admins to view and recover unfinished reports from any technician
  app.get("/api/admin/sessions/drafts", requireAdmin, async (req, res) => {
    try {
      const draftSessions = await storage.getAllDraftSessions();
      res.json(draftSessions);
    } catch (error) {
      console.error("Error fetching all draft sessions:", error);
      res.status(500).json({ message: "Failed to fetch draft sessions" });
    }
  });

  // Finalize a session (mark as completed)
  app.patch("/api/sessions/:id/finalize", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const userId = req.session.userId!;

      // Verify session exists and belongs to user
      const session = await storage.getTestSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const finalizedSession = await storage.finalizeSession(sessionId);

      trackSessionAction(req, 'completed', {
        sessionId,
        clientName: finalizedSession.clientName,
        serviceType: finalizedSession.serviceType,
      });

      res.json(finalizedSession);
    } catch (error) {
      console.error("Error finalizing session:", error);
      res.status(500).json({ message: "Failed to finalize session" });
    }
  });

  // Copy a session (duplicate with new date, keeping all equipment and results)
  app.post("/api/sessions/:id/copy", requireAuth, async (req, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const { testDate } = req.body;

      if (!testDate) {
        return res.status(400).json({ message: "testDate is required" });
      }

      // Load source session
      const source = await storage.getTestSession(sourceId);
      if (!source) {
        return res.status(404).json({ message: "Session not found" });
      }

      // Allow session owner or admin roles
      const sessionUser = req.session.user;
      const isAdmin = sessionUser && (sessionUser.role === "super_admin" || sessionUser.role === "support_center");
      if (!isAdmin && source.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create new session with same metadata but new date and draft status
      const newSession = await storage.createTestSession({
        serviceType: source.serviceType,
        testDate,
        technicianName: source.technicianName,
        clientName: source.clientName,
        siteContact: source.siteContact,
        address: source.address,
        country: source.country,
        complianceStandard: source.complianceStandard ?? undefined,
        technicianLicensed: source.technicianLicensed ?? undefined,
        startingAssetNumber: source.startingAssetNumber ?? undefined,
        customStartingNumbers: source.customStartingNumbers ?? undefined,
        userId,
        status: "draft",
      });

      // Copy all non-deleted results to the new session
      const sourceResults = await storage.getTestResultsBySession(sourceId);
      for (const r of sourceResults) {
        await storage.createTestResult({
          sessionId: newSession.id,
          assetNumber: r.assetNumber,
          itemName: r.itemName,
          itemType: r.itemType,
          location: r.location,
          classification: r.classification,
          result: r.result,
          failureReason: r.failureReason ?? undefined,
          actionTaken: r.actionTaken ?? undefined,
          frequency: r.frequency,
          notes: r.notes ?? undefined,
          visionInspection: r.visionInspection ?? undefined,
          electricalTest: r.electricalTest ?? undefined,
          // Emergency exit light fields
          maintenanceType: r.maintenanceType ?? undefined,
          globeType: r.globeType ?? undefined,
          dischargeTest: r.dischargeTest ?? undefined,
          switchingTest: r.switchingTest ?? undefined,
          chargingTest: r.chargingTest ?? undefined,
          manufacturerInfo: r.manufacturerInfo ?? undefined,
          installationDate: r.installationDate ?? undefined,
          luxTest: r.luxTest ?? undefined,
          luxReading: r.luxReading ?? undefined,
          luxCompliant: r.luxCompliant ?? undefined,
          // Fire testing fields
          equipmentType: r.equipmentType ?? undefined,
          extinguisherType: r.extinguisherType ?? undefined,
          size: r.size ?? undefined,
          weight: r.weight ?? undefined,
          testType: r.testType ?? undefined,
          fireVisualInspection: r.fireVisualInspection ?? undefined,
          accessibilityCheck: r.accessibilityCheck ?? undefined,
          signageCheck: r.signageCheck ?? undefined,
          operationalTest: r.operationalTest ?? undefined,
          pressureTest: r.pressureTest ?? undefined,
          // RCD fields
          pushButtonTest: r.pushButtonTest ?? undefined,
          injectionTimedTest: r.injectionTimedTest ?? undefined,
          tripTimes: r.tripTimes ?? undefined,
          distributionBoardNumber: r.distributionBoardNumber ?? undefined,
          circuitBreakerNumber: r.circuitBreakerNumber ?? undefined,
          // Microwave fields
          leakageReading: r.leakageReading ?? undefined,
          // photoData intentionally omitted
        });
      }

      res.json({ session: newSession });
    } catch (error) {
      console.error("Error copying session:", error);
      res.status(500).json({ message: "Failed to copy session" });
    }
  });

  // Update custom starting numbers for a session
  app.patch("/api/sessions/:id/custom-numbers", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const userId = req.session.userId!;
      const { customStartingNumbers } = req.body;

      // Verify session exists and belongs to user
      const session = await storage.getTestSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedSession = await storage.updateCustomStartingNumbers(sessionId, customStartingNumbers);
      res.json(updatedSession);
    } catch (error) {
      console.error("Error updating custom starting numbers:", error);
      res.status(500).json({ message: "Failed to update custom starting numbers" });
    }
  });

  // Create a new test session (protected)
  app.post("/api/sessions", requireAuth, async (req, res) => {
    try {
      const sessionData = insertTestSessionSchema.parse(req.body);
      // Associate the session with the logged-in user
      const sessionWithUser = {
        ...sessionData,
        serviceType: sessionData.serviceType || "electrical", // Default to electrical if not specified
        userId: req.session.userId, // Link session to the logged-in user
      };
      const session = await storage.createTestSession(sessionWithUser);
      
      // Track session creation
      trackSessionAction(req, 'created', {
        sessionId: session.id,
        clientName: session.clientName,
        serviceType: session.serviceType,
        address: session.address,
      });
      
      res.json(session);
    } catch (error) {
      console.error('Session creation error:', error);
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ error: "Invalid session data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create session", details: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  // Get session by ID (protected)
  app.get("/api/sessions/:id", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);

      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve session" });
    }
  });

  // Get next asset number for session (protected)
  app.get(
    "/api/sessions/:id/next-asset-number",
    requireAuth,
    async (req, res) => {
      try {
        const sessionId = parseInt(req.params.id);
        const nextNumber = await storage.getNextAssetNumber(sessionId);
        res.json({ nextAssetNumber: nextNumber });
      } catch (error) {
        res.status(500).json({ error: "Failed to get next asset number" });
      }
    },
  );

  // Get next monthly asset number for session (protected)
  app.get(
    "/api/sessions/:id/next-monthly-asset-number",
    requireAuth,
    async (req, res) => {
      try {
        const sessionId = parseInt(req.params.id);
        const nextNumber = await storage.getNextMonthlyAssetNumber(sessionId);
        res.json({ nextAssetNumber: nextNumber });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to get next monthly asset number" });
      }
    },
  );

  // Get next five yearly asset number for session (protected)
  app.get(
    "/api/sessions/:id/next-five-yearly-asset-number",
    requireAuth,
    async (req, res) => {
      try {
        const sessionId = parseInt(req.params.id);
        const nextNumber =
          await storage.getNextFiveYearlyAssetNumber(sessionId);
        res.json({ nextAssetNumber: nextNumber });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to get next five yearly asset number" });
      }
    },
  );

  // Get asset progress for session (protected)
  app.get("/api/sessions/:id/asset-progress", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const progress = await storage.getAssetProgress(sessionId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: "Failed to get asset progress" });
    }
  });

  // Validate asset number for session (protected)
  app.post(
    "/api/sessions/:id/validate-asset-number",
    requireAuth,
    async (req, res) => {
      try {
        const sessionId = parseInt(req.params.id);
        const { assetNumber, excludeId } = req.body;
        const isValid = await storage.validateAssetNumber(
          sessionId,
          assetNumber,
          excludeId,
        );
        res.json({ isValid });
      } catch (error) {
        res.status(500).json({ error: "Failed to validate asset number" });
      }
    },
  );

  // Create batch test results (NEW BATCHED ENDPOINT)
  app.post("/api/sessions/:id/batch-results", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { results } = req.body;

      if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).json({ error: "No results provided" });
      }

      console.log(
        `Processing batch of ${results.length} results for session ${sessionId}`,
      );

      const savedResults: any[] = [];
      const errors: string[] = [];

      // Get existing results to avoid duplicates during report continuation
      const existingResults = await storage.getTestResultsBySession(sessionId);
      
      // Process each result in the batch
      for (let i = 0; i < results.length; i++) {
        const batchedResult = results[i];

        try {
          // Check if this result already exists in the database (for continued reports)
          const existingResult = existingResults.find(existing => 
            existing.assetNumber === batchedResult.assetNumber &&
            existing.itemName === batchedResult.itemName &&
            existing.location === batchedResult.location &&
            existing.classification === batchedResult.classification
          );

          if (existingResult) {
            console.log(`Skipping duplicate result ${i + 1}/${results.length}: ${batchedResult.itemName} (Asset #${batchedResult.assetNumber}) - already exists with ID ${existingResult.id}`);
            savedResults.push(existingResult);
            continue;
          }

          // Convert batched result to database format using client-provided asset number
          const resultData = {
            sessionId,
            assetNumber: batchedResult.assetNumber || "1", // Use client-provided asset number
            itemName: batchedResult.itemName,
            itemType: batchedResult.itemType,
            location: batchedResult.location,
            classification: batchedResult.classification,
            result: batchedResult.result,
            frequency: batchedResult.frequency,
            failureReason: batchedResult.failureReason || null,
            actionTaken: batchedResult.actionTaken || null,
            notes: batchedResult.notes || null,
            photoData: batchedResult.photoData || null,
            visionInspection: batchedResult.visionInspection,
            electricalTest: batchedResult.electricalTest,
            // Map emergency/electrical test fields from batch data
            maintenanceType: batchedResult.maintenanceType || null,
            globeType: batchedResult.globeType || null,
            dischargeTest: batchedResult.dischargeTest || false,
            switchingTest: batchedResult.switchingTest || false,
            chargingTest: batchedResult.chargingTest || false,
            luxTest: batchedResult.luxTest ?? false,
            luxReading: batchedResult.luxReading || null,
            luxCompliant: batchedResult.luxCompliant ?? false,
            manufacturerInfo: batchedResult.manufacturerInfo || null,
            installationDate: batchedResult.installationDate || null,
            // Map fire testing fields from batch data
            equipmentType: batchedResult.equipmentType || null,
            extinguisherType: batchedResult.extinguisherType || null,
            size: batchedResult.size || null,
            weight: batchedResult.weight || null,
            testType: batchedResult.testType || null,
            fireVisualInspection: batchedResult.fireVisualInspection ?? false,
            accessibilityCheck: batchedResult.accessibilityCheck ?? false,
            signageCheck: batchedResult.signageCheck ?? false,
            operationalTest: batchedResult.operationalTest ?? false,
            pressureTest: batchedResult.pressureTest ?? false,
            // Map RCD test fields from batch data
            pushButtonTest: batchedResult.pushButtonTest ?? null,
            injectionTimedTest: batchedResult.injectionTimedTest ?? null,
            tripTimes: Array.isArray(batchedResult.tripTimes) && batchedResult.tripTimes.length > 0 ? batchedResult.tripTimes : null,
            distributionBoardNumber: batchedResult.distributionBoardNumber || null,
            circuitBreakerNumber: batchedResult.circuitBreakerNumber || null,
            // Map microwave test fields from batch data
            leakageReading: batchedResult.leakageReading || null,
          };

          console.log('Attempting to insert test result:', resultData);

          // Create the result - this is a new result not in the database
          const savedResult = await storage.createTestResult(resultData);
          savedResults.push(savedResult);

          console.log(
            `Saved new result ${i + 1}/${results.length}: ${batchedResult.itemName} -> Asset #${savedResult.assetNumber}`,
          );
        } catch (error) {
          const errorMsg = `Failed to save result ${i + 1} (${batchedResult.itemName}): ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Return results with any errors
      const response = {
        savedResults,
        totalProcessed: results.length,
        successCount: savedResults.length,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };

      const newResultsCount = savedResults.filter(r => !existingResults.find(existing => existing.id === r.id)).length;
      const skippedCount = results.length - newResultsCount;
      
      console.log(
        `Batch processing complete: ${savedResults.length}/${results.length} processed (${newResultsCount} new, ${skippedCount} skipped duplicates)`,
      );

      // Track batch submission with counts
      const passCount = savedResults.filter(r => r.result === 'pass').length;
      const failCount = savedResults.filter(r => r.result === 'fail').length;
      const session = await storage.getTestSession(sessionId);
      
      trackBatchSubmission(req, sessionId, savedResults.length, passCount, failCount, session?.serviceType);

      if (errors.length > 0) {
        res.status(207).json(response); // 207 Multi-Status for partial success
      } else {
        res.json(response);
      }
    } catch (error) {
      console.error("Error processing batch results:", error);
      res.status(500).json({ error: "Failed to process batch results" });
    }
  });

  // Add test result to session (LEGACY SINGLE ENDPOINT)
  app.post("/api/sessions/:id/results", requireAuth, async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    try {
      console.log(
        `[${requestId}] Starting test result creation at ${new Date().toISOString()}`,
      );

      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);

      if (!session) {
        console.log(`[${requestId}] Session ${sessionId} not found`);
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // Validate required fields
      if (
        !req.body.itemName ||
        !req.body.location ||
        !req.body.classification
      ) {
        console.log(`[${requestId}] Missing required fields:`, {
          itemName: !!req.body.itemName,
          location: !!req.body.location,
          classification: !!req.body.classification,
        });
        res
          .status(400)
          .json({
            error:
              "Missing required fields: itemName, location, classification",
          });
        return;
      }

      // If no asset number provided, get the next one
      if (!req.body.assetNumber) {
        req.body.assetNumber = (
          await storage.getNextAssetNumber(sessionId)
        ).toString();
      }

      // Create result data object directly to avoid schema validation issues
      const resultData = {
        sessionId: sessionId,
        assetNumber: req.body.assetNumber,
        itemName: req.body.itemName,
        itemType: req.body.itemType,
        location: req.body.location,
        classification: req.body.classification,
        result: req.body.result,
        frequency: req.body.frequency,
        failureReason: req.body.failureReason || null,
        actionTaken: req.body.actionTaken || null,
        notes: req.body.notes || null,
        photoData: req.body.photoData || null,
        visionInspection:
          req.body.visionInspection !== undefined
            ? req.body.visionInspection
            : true,
        electricalTest:
          req.body.electricalTest !== undefined
            ? req.body.electricalTest
            : true,
        // Emergency exit light specific fields (AS 2293.2:2019)
        maintenanceType: req.body.maintenanceType || null,
        globeType: req.body.globeType || null,
        dischargeTest:
          req.body.dischargeTest !== undefined ? req.body.dischargeTest : false,
        switchingTest:
          req.body.switchingTest !== undefined ? req.body.switchingTest : false,
        chargingTest:
          req.body.chargingTest !== undefined ? req.body.chargingTest : false,
        luxTest: req.body.luxTest ?? false,
        luxReading: req.body.luxReading || null,
        luxCompliant: req.body.luxCompliant ?? false,
        manufacturerInfo: req.body.manufacturerInfo || null,
        installationDate: req.body.installationDate || null,
        // Fire testing specific fields (AS 1851 / NZS 4503:2005)
        equipmentType: req.body.equipmentType || null,
        extinguisherType: req.body.extinguisherType || null,
        size: req.body.size || null,
        weight: req.body.weight || null,
        testType: req.body.testType || null,
        fireVisualInspection: req.body.fireVisualInspection ?? false,
        accessibilityCheck: req.body.accessibilityCheck ?? false,
        signageCheck: req.body.signageCheck ?? false,
        operationalTest: req.body.operationalTest ?? false,
        pressureTest: req.body.pressureTest ?? false,
        // RCD test specific fields
        pushButtonTest: req.body.pushButtonTest ?? null,
        injectionTimedTest: req.body.injectionTimedTest ?? null,
        tripTimes: Array.isArray(req.body.tripTimes) && req.body.tripTimes.length > 0 ? req.body.tripTimes : null,
        distributionBoardNumber: req.body.distributionBoardNumber || null,
        circuitBreakerNumber: req.body.circuitBreakerNumber || null,
        // Microwave test specific fields (AS/NZS 60335.2.25)
        leakageReading: req.body.leakageReading || null,
      };

      console.log(`[${requestId}] Request body received:`, {
        ...req.body,
        photoData: req.body.photoData
          ? `Photo included (${Math.round(req.body.photoData.length / 1024)}KB)`
          : "No photo in request",
      });
      console.log(`[${requestId}] Creating result with data:`, {
        ...resultData,
        photoData: resultData.photoData
          ? `Photo data included (${Math.round(resultData.photoData.length / 1024)}KB)`
          : "No photo data",
      });

      const result = await storage.createTestResult(resultData);

      // Verify the result was created successfully
      if (!result || !result.id) {
        console.error(
          `[${requestId}] Failed to create test result - no ID returned`,
        );
        throw new Error("Failed to create test result - no ID returned");
      }

      const processingTime = Date.now() - startTime;
      console.log(
        `[${requestId}] Successfully created test result in ${processingTime}ms:`,
        {
          id: result.id,
          assetNumber: result.assetNumber,
          itemName: result.itemName,
        },
      );

      res.json(result);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `[${requestId}] Error creating test result after ${processingTime}ms:`,
        error,
      );
      console.error(
        `[${requestId}] Error stack:`,
        error instanceof Error ? error.stack : "No stack available",
      );

      if (error instanceof z.ZodError) {
        console.error(`[${requestId}] Zod validation errors:`, error.errors);
        res
          .status(400)
          .json({
            error: "Invalid result data",
            details: error.errors,
            requestId,
          });
      } else {
        res
          .status(500)
          .json({
            error: "Failed to create test result",
            details: String(error),
            requestId,
          });
      }
    }
  });

  // Update test result
  app.patch(
    "/api/sessions/:id/results/:resultId",
    requireAuth,
    async (req, res) => {
      try {
        const sessionId = parseInt(req.params.id);
        const resultId = parseInt(req.params.resultId);

        const session = await storage.getTestSession(sessionId);
        if (!session) {
          res.status(404).json({ error: "Session not found" });
          return;
        }

        // Get the current result to check for frequency changes
        const currentResult = await storage.getTestResult(resultId);
        if (!currentResult) {
          res.status(404).json({ error: "Test result not found" });
          return;
        }

        // Build update data with only provided fields to prevent overwriting with undefined
        const updateData: any = {};
        
        // Core fields
        if (req.body.itemName !== undefined) updateData.itemName = req.body.itemName;
        if (req.body.itemType !== undefined) updateData.itemType = req.body.itemType;
        if (req.body.location !== undefined) updateData.location = req.body.location;
        if (req.body.classification !== undefined) updateData.classification = req.body.classification;
        if (req.body.result !== undefined) updateData.result = req.body.result;
        if (req.body.frequency !== undefined) updateData.frequency = req.body.frequency;
        if (req.body.assetNumber !== undefined) {
          updateData.assetNumber = req.body.assetNumber;
          console.log(`Asset number updated for result ${resultId}: ${currentResult.assetNumber} -> ${updateData.assetNumber}`);
        }
        
        // Optional text fields
        if (req.body.failureReason !== undefined) updateData.failureReason = req.body.failureReason || null;
        if (req.body.actionTaken !== undefined) updateData.actionTaken = req.body.actionTaken || null;
        if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;
        if (req.body.photoData !== undefined) updateData.photoData = req.body.photoData || null;
        
        // Boolean fields
        if (req.body.visionInspection !== undefined) updateData.visionInspection = req.body.visionInspection;
        if (req.body.electricalTest !== undefined) updateData.electricalTest = req.body.electricalTest;
        
        // Emergency exit light testing fields
        if (req.body.maintenanceType !== undefined) updateData.maintenanceType = req.body.maintenanceType || null;
        if (req.body.globeType !== undefined) updateData.globeType = req.body.globeType || null;
        if (req.body.dischargeTest !== undefined) updateData.dischargeTest = req.body.dischargeTest;
        if (req.body.switchingTest !== undefined) updateData.switchingTest = req.body.switchingTest;
        if (req.body.chargingTest !== undefined) updateData.chargingTest = req.body.chargingTest;
        if (req.body.luxTest !== undefined) updateData.luxTest = req.body.luxTest;
        if (req.body.luxReading !== undefined) updateData.luxReading = req.body.luxReading || null;
        if (req.body.luxCompliant !== undefined) updateData.luxCompliant = req.body.luxCompliant;
        if (req.body.manufacturerInfo !== undefined) updateData.manufacturerInfo = req.body.manufacturerInfo || null;
        if (req.body.installationDate !== undefined) updateData.installationDate = req.body.installationDate || null;

        // Fire testing fields
        if (req.body.equipmentType !== undefined) updateData.equipmentType = req.body.equipmentType || null;
        if (req.body.extinguisherType !== undefined) updateData.extinguisherType = req.body.extinguisherType || null;
        if (req.body.size !== undefined) updateData.size = req.body.size || null;
        if (req.body.weight !== undefined) updateData.weight = req.body.weight || null;
        if (req.body.testType !== undefined) updateData.testType = req.body.testType || null;
        if (req.body.fireVisualInspection !== undefined) updateData.fireVisualInspection = req.body.fireVisualInspection;
        if (req.body.accessibilityCheck !== undefined) updateData.accessibilityCheck = req.body.accessibilityCheck;
        if (req.body.signageCheck !== undefined) updateData.signageCheck = req.body.signageCheck;
        if (req.body.operationalTest !== undefined) updateData.operationalTest = req.body.operationalTest;
        if (req.body.pressureTest !== undefined) updateData.pressureTest = req.body.pressureTest;

        // RCD testing fields
        if (req.body.pushButtonTest !== undefined) updateData.pushButtonTest = req.body.pushButtonTest;
        if (req.body.injectionTimedTest !== undefined) updateData.injectionTimedTest = req.body.injectionTimedTest;
        if (req.body.tripTimes !== undefined) updateData.tripTimes = Array.isArray(req.body.tripTimes) && req.body.tripTimes.length > 0 ? req.body.tripTimes : null;
        if (req.body.distributionBoardNumber !== undefined) updateData.distributionBoardNumber = req.body.distributionBoardNumber || null;
        if (req.body.circuitBreakerNumber !== undefined) updateData.circuitBreakerNumber = req.body.circuitBreakerNumber || null;

        // Microwave testing fields
        if (req.body.leakageReading !== undefined) updateData.leakageReading = req.body.leakageReading || null;

        const result = await storage.updateTestResult(resultId, updateData);
        res.json(result);
      } catch (error) {
        console.error("Error updating test result:", error);
        res.status(500).json({ error: "Failed to update test result" });
      }
    },
  );

  // Delete test result
  app.delete(
    "/api/sessions/:id/results/:resultId",
    requireAuth,
    async (req, res) => {
      try {
        const sessionId = parseInt(req.params.id);
        const resultId = parseInt(req.params.resultId);

        // Verify session exists
        const session = await storage.getTestSession(sessionId);
        if (!session) {
          res.status(404).json({ error: "Session not found" });
          return;
        }

        // Verify result exists and belongs to this session
        const result = await storage.getTestResult(resultId);
        if (!result) {
          res.status(404).json({ error: "Test result not found" });
          return;
        }

        if (result.sessionId !== sessionId) {
          res.status(400).json({ error: "Test result does not belong to this session" });
          return;
        }

        // Delete the test result with audit trail
        const userId = req.session.userId!;
        await storage.deleteTestResult(resultId, userId);
        
        console.log(`Successfully deleted test result ${resultId} from session ${sessionId} by user ${userId}`);
        res.json({ success: true, message: "Test result deleted successfully" });
      } catch (error) {
        console.error("Error deleting test result:", error);
        res.status(500).json({ error: "Failed to delete test result" });
      }
    },
  );

  // Delete test session (user-accessible for canceling reports)
  app.delete("/api/sessions/:id", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      // Verify session exists
      const session = await storage.getTestSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Verify ownership - users can only delete their own sessions
      if (session.userId !== req.session.userId) {
        return res.status(403).json({ error: "You can only delete your own reports" });
      }
      
      // Delete the session (this will cascade delete all test results) with audit trail
      const userId = req.session.userId!;
      await storage.deleteTestSession(sessionId, userId);
      
      console.log(`User ${userId} deleted session ${sessionId}: ${session.clientName}`);
      res.json({ success: true, message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Get all results for a session
  app.get("/api/sessions/:id/results", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      console.log(`Fetching results for session ${sessionId}`);
      const results = await storage.getTestResultsBySession(sessionId);
      console.log(`Found ${results.length} results for session ${sessionId}`);
      res.json(results);
    } catch (error) {
      console.error(`Error fetching results for session ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to retrieve results" });
    }
  });

  // Generate report data
  app.get("/api/sessions/:id/report", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const user = req.session.user!;
      const sessionData = await storage.getFullSessionData(sessionId);

      if (!sessionData) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const { session, results } = sessionData;
      
      // Check permissions: technicians can only access their own reports
      if (user.role === "technician" && session.userId !== user.id) {
        res.status(403).json({ error: "You can only access your own reports" });
        return;
      }

      const totalItems = results.length;
      const passedItems = results.filter((r) => r.result === "pass").length;
      const failedItems = results.filter((r) => r.result === "fail").length;
      const passRate =
        totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

      // Track report generation/view
      trackReportGenerated(req, session.serviceType || 'electrical', 'pdf', {
        sessionId,
        clientName: session.clientName,
        totalItems,
        passedItems,
        failedItems,
        passRate,
      });

      const summary: {
        totalItems: number;
        passedItems: number;
        failedItems: number;
        passRate: number;
        numberOfPushButtons?: number;
        numberOfTimeTests?: number;
      } = {
        totalItems,
        passedItems,
        failedItems,
        passRate,
      };

      // Add RCD-specific summary counts
      if (session.serviceType === 'rcd_reporting') {
        summary.numberOfPushButtons = results.filter((r) => r.pushButtonTest === true).length;
        summary.numberOfTimeTests = results
          .filter((r) => r.injectionTimedTest === true)
          .reduce((sum, r) => {
            const times = Array.isArray(r.tripTimes) && r.tripTimes.length > 0 ? r.tripTimes.length : 1;
            return sum + times;
          }, 0);
      }

      res.json({
        session,
        results,
        summary,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Environment routes
  // Create a new environment
  app.post("/api/environments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const environmentData = insertEnvironmentSchema.parse({
        ...req.body,
        userId, // Ensure environment is tied to the logged-in user
      });

      const environment = await storage.createEnvironment(environmentData);
      
      // Track environment creation
      trackEnvironmentAction(req, 'created', {
        environmentId: environment.id,
        environmentName: environment.name,
        serviceType: environment.serviceType,
      });
      
      res.json(environment);
    } catch (error) {
      console.error("Error creating environment:", error);
      res.status(400).json({ error: "Failed to create environment" });
    }
  });

  // Get all environments for the logged-in user
  app.get("/api/environments", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const environments = await storage.getEnvironmentsByUser(userId);
      res.json(environments);
    } catch (error) {
      console.error("Error fetching environments:", error);
      res.status(500).json({ error: "Failed to fetch environments" });
    }
  });

  // Get a specific environment
  app.get("/api/environments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const environment = await storage.getEnvironment(id);

      if (!environment) {
        return res.status(404).json({ error: "Environment not found" });
      }

      // Verify ownership
      if (environment.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(environment);
    } catch (error) {
      console.error("Error fetching environment:", error);
      res.status(500).json({ error: "Failed to fetch environment" });
    }
  });

  // Update an environment
  app.patch("/api/environments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const environment = await storage.getEnvironment(id);

      if (!environment) {
        return res.status(404).json({ error: "Environment not found" });
      }

      // Verify ownership
      if (environment.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Parse update data and remove userId to prevent ownership reassignment
      const { userId: _, ...updateData } = insertEnvironmentSchema.partial().parse(req.body);
      const updatedEnvironment = await storage.updateEnvironment(id, updateData);
      
      // Track environment update
      trackEnvironmentAction(req, 'updated', {
        environmentId: id,
        environmentName: updatedEnvironment.name,
        serviceType: updatedEnvironment.serviceType,
      });
      
      res.json(updatedEnvironment);
    } catch (error) {
      console.error("Error updating environment:", error);
      res.status(400).json({ error: "Failed to update environment" });
    }
  });

  // Delete an environment
  app.delete("/api/environments/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.session.userId!;
      const environment = await storage.getEnvironment(id);

      if (!environment) {
        return res.status(404).json({ error: "Environment not found" });
      }

      // Verify ownership
      if (environment.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteEnvironment(id);
      
      // Track environment deletion
      trackEnvironmentAction(req, 'deleted', {
        environmentId: id,
        environmentName: environment.name,
        serviceType: environment.serviceType,
      });
      
      res.json({ success: true, message: "Environment deleted successfully" });
    } catch (error) {
      console.error("Error deleting environment:", error);
      res.status(500).json({ error: "Failed to delete environment" });
    }
  });

  // Custom Form Types routes (Admin only)
  
  // Create a custom form type with CSV data
  app.post("/api/custom-forms", requireAdmin, async (req, res) => {
    try {
      const { name, csvData } = req.body;
      const userId = req.session.userId!;

      if (!name || !csvData) {
        return res.status(400).json({ error: "Name and CSV data are required" });
      }

      // Validate CSV data format (expects code,itemName per line)
      const lines = csvData.trim().split('\n');
      if (lines.length === 0) {
        return res.status(400).json({ error: "CSV data cannot be empty" });
      }

      // Create the form type with CSV data stored directly
      const formType = await storage.createCustomFormType({
        name,
        csvData
      });

      // Track custom form creation
      trackCustomFormAction(req, 'created', {
        formId: formType.id,
        formName: name,
        itemCount: lines.length,
      });

      res.status(201).json(formType);
    } catch (error) {
      console.error("Error creating custom form:", error);
      res.status(500).json({ error: "Failed to create custom form" });
    }
  });

  // Get all custom form types
  app.get("/api/custom-forms", requireAuth, async (req, res) => {
    try {
      const formTypes = await storage.getAllCustomFormTypes();
      res.json(formTypes);
    } catch (error) {
      console.error("Error fetching custom forms:", error);
      res.status(500).json({ error: "Failed to fetch custom forms" });
    }
  });

  // Get a specific custom form type
  app.get("/api/custom-forms/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const formType = await storage.getCustomFormType(id);
      
      if (!formType) {
        return res.status(404).json({ error: "Form type not found" });
      }
      
      res.json(formType);
    } catch (error) {
      console.error("Error fetching custom form:", error);
      res.status(500).json({ error: "Failed to fetch custom form" });
    }
  });

  // Get items for a custom form type (parsed from CSV)
  app.get("/api/custom-forms/:id/items", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const formType = await storage.getCustomFormType(id);
      
      if (!formType) {
        return res.status(404).json({ error: "Form type not found" });
      }

      // Parse CSV data to return items
      const lines = formType.csvData.trim().split('\n');
      const items: { code: string; itemName: string }[] = [];
      
      // Skip header row if it exists
      let startIndex = 0;
      if (lines[0] && lines[0].toLowerCase().includes('code')) {
        startIndex = 1;
      }
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map((part: string) => part.trim());
        if (parts.length >= 2) {
          items.push({
            code: parts[0],
            itemName: parts.slice(1).join(',') // Handle item names with commas
          });
        }
      }

      res.json(items);
    } catch (error) {
      console.error("Error fetching form items:", error);
      res.status(500).json({ error: "Failed to fetch form items" });
    }
  });

  // Update a custom form type
  app.patch("/api/custom-forms/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      const formType = await storage.getCustomFormType(id);
      if (!formType) {
        return res.status(404).json({ error: "Form type not found" });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      
      const updatedFormType = await storage.updateCustomFormType(id, updateData);
      res.json(updatedFormType);
    } catch (error) {
      console.error("Error updating custom form:", error);
      res.status(500).json({ error: "Failed to update custom form" });
    }
  });

  // Delete a custom form type (cascades to items)
  app.delete("/api/custom-forms/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const formType = await storage.getCustomFormType(id);
      
      if (!formType) {
        return res.status(404).json({ error: "Form type not found" });
      }
      
      await storage.deleteCustomFormType(id);
      
      // Track custom form deletion
      trackCustomFormAction(req, 'deleted', {
        formId: id,
        formName: formType.name,
      });
      
      res.json({ success: true, message: "Form type deleted successfully" });
    } catch (error) {
      console.error("Error deleting custom form:", error);
      res.status(500).json({ error: "Failed to delete custom form" });
    }
  });

  // Certificate of Compliance routes
  
  // Create a new certificate
  app.post("/api/certificates", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const certificateData = insertCertificateSchema.parse({
        ...req.body,
        userId, // Ensure certificate is tied to the logged-in user
      });

      const certificate = await storage.createCertificate(certificateData);
      
      // Track certificate creation
      trackCertificateAction(req, 'created', {
        certificateId: certificate.id,
        clientName: certificate.clientName,
        services: certificate.services,
      });
      
      res.status(201).json(certificate);
    } catch (error) {
      console.error("Error creating certificate:", error);
      res.status(400).json({ error: "Failed to create certificate" });
    }
  });

  // Get certificates (user's own or all if admin)
  app.get("/api/certificates", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      let certificates;

      // Super admin and support center can see all certificates
      if (user.role === "super_admin" || user.role === "support_center") {
        certificates = await storage.getAllCertificates();
      } else {
        // Technicians can only see their own certificates
        certificates = await storage.getCertificatesByUser(user.id);
      }

      res.json(certificates);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  // Get a specific certificate
  app.get("/api/certificates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session.user!;
      const certificate = await storage.getCertificateById(id);
      
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }

      // Check permissions: technicians can only access their own certificates
      if (user.role === "technician" && certificate.userId !== user.id) {
        return res.status(403).json({ error: "You can only access your own certificates" });
      }
      
      res.json(certificate);
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });

  // Update a certificate
  app.put("/api/certificates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session.user!;
      const certificate = await storage.getCertificateById(id);
      
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }

      // Check permissions: technicians can only update their own certificates
      if (user.role === "technician" && certificate.userId !== user.id) {
        return res.status(403).json({ error: "You can only update your own certificates" });
      }

      // Validate and update the certificate (omit userId to prevent reassignment)
      const updateData = insertCertificateSchema.omit({ userId: true }).partial().parse(req.body);
      const updatedCertificate = await storage.updateCertificate(id, updateData);
      
      // Track certificate update
      trackCertificateAction(req, 'updated', {
        certificateId: id,
        clientName: updatedCertificate.clientName,
        services: updatedCertificate.services,
      });
      
      res.json(updatedCertificate);
    } catch (error) {
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });

  // Delete a certificate
  app.delete("/api/certificates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = req.session.user!;
      const certificate = await storage.getCertificateById(id);
      
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }

      // Check permissions: technicians can only delete their own certificates
      if (user.role === "technician" && certificate.userId !== user.id) {
        return res.status(403).json({ error: "You can only delete your own certificates" });
      }
      
      await storage.deleteCertificate(id);
      
      // Track certificate deletion
      trackCertificateAction(req, 'deleted', {
        certificateId: id,
        clientName: certificate.clientName,
        services: certificate.services,
      });
      
      res.json({ success: true, message: "Certificate deleted successfully" });
    } catch (error) {
      console.error("Error deleting certificate:", error);
      res.status(500).json({ error: "Failed to delete certificate" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
