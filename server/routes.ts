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
  insertCustomFormItemSchema,
  loginSchema,
  type User,
} from "@shared/schema";
import { z } from "zod";

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

      const user = await storage.validatePassword(username, password);
      if (!user) {
        return res
          .status(401)
          .json({ message: "Invalid username or password" });
      }

      // Set session data
      req.session.userId = user.id;
      req.session.user = user;

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      res.json({ message: "Login successful", user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
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

      await storage.deleteTestSession(sessionId);
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  app.delete("/api/admin/sessions/:id", requireAdmin, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      await storage.deleteTestSession(sessionId);
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ message: "Failed to delete session" });
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
            dischargeTest: batchedResult.dischargeTest || false,
            switchingTest: batchedResult.switchingTest || false,
            chargingTest: batchedResult.chargingTest || false,
            manufacturerInfo: batchedResult.manufacturerInfo || null,
            installationDate: batchedResult.installationDate || null,
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
        dischargeTest:
          req.body.dischargeTest !== undefined ? req.body.dischargeTest : false,
        switchingTest:
          req.body.switchingTest !== undefined ? req.body.switchingTest : false,
        chargingTest:
          req.body.chargingTest !== undefined ? req.body.chargingTest : false,
        manufacturerInfo: req.body.manufacturerInfo || null,
        installationDate: req.body.installationDate || null,
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

        const updateData: any = {
          itemName: req.body.itemName,
          location: req.body.location,
          classification: req.body.classification,
          result: req.body.result,
          frequency: req.body.frequency,
          failureReason: req.body.failureReason || null,
          actionTaken: req.body.actionTaken || null,
          notes: req.body.notes || null,
        };

        // Use the asset number provided by the admin (manual entry)
        if (req.body.assetNumber !== undefined) {
          updateData.assetNumber = req.body.assetNumber;
          console.log(`Admin manually set asset number for result ${resultId}: ${currentResult.assetNumber} -> ${updateData.assetNumber} (frequency: ${currentResult.frequency} -> ${req.body.frequency})`);
        }

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

        // Delete the test result
        await storage.deleteTestResult(resultId);
        
        console.log(`Successfully deleted test result ${resultId} from session ${sessionId}`);
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
      
      // Delete the session (this will cascade delete all test results)
      await storage.deleteTestSession(sessionId);
      
      console.log(`User ${req.session.userId} deleted session ${sessionId}: ${session.clientName}`);
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
      const results = await storage.getTestResultsBySession(sessionId);
      res.json(results);
    } catch (error) {
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

      res.json({
        session,
        results,
        summary: {
          totalItems,
          passedItems,
          failedItems,
          passRate,
        },
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
      const { name, serviceType, csvData } = req.body;
      const userId = req.session.userId!;

      if (!name || !serviceType || !csvData) {
        return res.status(400).json({ error: "Name, service type, and CSV data are required" });
      }

      // Parse CSV data - expects format: code,itemName
      const lines = csvData.trim().split('\n');
      const items: { code: string; itemName: string }[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(part => part.trim());
        if (parts.length < 2) {
          return res.status(400).json({ 
            error: `Invalid CSV format at line ${i + 1}. Expected format: code,itemName` 
          });
        }
        
        items.push({
          code: parts[0],
          itemName: parts.slice(1).join(',') // Handle item names with commas
        });
      }

      if (items.length === 0) {
        return res.status(400).json({ error: "CSV data must contain at least one item" });
      }

      // Create the form type
      const formType = await storage.createCustomFormType({
        name,
        serviceType,
        createdBy: userId,
        isActive: true
      });

      // Create all items
      const formItems = await storage.createCustomFormItems(
        items.map(item => ({
          formTypeId: formType.id,
          code: item.code,
          itemName: item.itemName
        }))
      );

      res.json({ formType, itemsCount: formItems.length });
    } catch (error) {
      console.error("Error creating custom form:", error);
      res.status(500).json({ error: "Failed to create custom form" });
    }
  });

  // Get all custom form types
  app.get("/api/custom-forms", requireAuth, async (req, res) => {
    try {
      const { serviceType } = req.query;
      
      let formTypes;
      if (serviceType && typeof serviceType === 'string') {
        formTypes = await storage.getCustomFormTypesByService(serviceType);
      } else {
        formTypes = await storage.getAllCustomFormTypes();
      }
      
      res.json(formTypes);
    } catch (error) {
      console.error("Error fetching custom forms:", error);
      res.status(500).json({ error: "Failed to fetch custom forms" });
    }
  });

  // Get a specific custom form type with its items
  app.get("/api/custom-forms/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const formType = await storage.getCustomFormType(id);
      
      if (!formType) {
        return res.status(404).json({ error: "Form type not found" });
      }
      
      const items = await storage.getCustomFormItems(id);
      res.json({ ...formType, items });
    } catch (error) {
      console.error("Error fetching custom form:", error);
      res.status(500).json({ error: "Failed to fetch custom form" });
    }
  });

  // Get items for a custom form type
  app.get("/api/custom-forms/:id/items", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const items = await storage.getCustomFormItems(id);
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
      const { name, isActive } = req.body;
      
      const formType = await storage.getCustomFormType(id);
      if (!formType) {
        return res.status(404).json({ error: "Form type not found" });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      
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
      res.json({ success: true, message: "Form type deleted successfully" });
    } catch (error) {
      console.error("Error deleting custom form:", error);
      res.status(500).json({ error: "Failed to delete custom form" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
