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
  loginSchema,
  type User
} from "@shared/schema";
import { z } from "zod";

// Extend Express session interface
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: User;
  }
}

// Authentication middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

// Admin middleware - for super admin and support center
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId || !req.session.user || 
      (req.session.user.role !== "super_admin" && req.session.user.role !== "support_center")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Super admin only middleware
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId || !req.session.user || req.session.user.role !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session configuration
  const PgSession = connectPg(session);
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
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
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
      res.json({ message: "User created successfully", user: userWithoutPassword });
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
        return res.status(401).json({ message: "Invalid username or password" });
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
      res.clearCookie('connect.sid');
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
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      const userId = req.session.userId!;
      
      // Validate current password
      const isValid = await storage.validatePassword(req.session.user!.username, currentPassword);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
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
        return res.status(400).json({ message: "Username and full name are required" });
      }

      if (password && password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
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
          errors: validation.error.issues 
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
      res.status(500).json({ message: "Failed to update session", error: error instanceof Error ? error.message : String(error) });
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
        serviceType: sessionData.serviceType || 'electrical', // Default to electrical if not specified
        userId: req.session.userId, // Link session to the logged-in user
      };
      const session = await storage.createTestSession(sessionWithUser);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid session data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create session" });
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
  app.get("/api/sessions/:id/next-asset-number", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const nextNumber = await storage.getNextAssetNumber(sessionId);
      res.json({ nextAssetNumber: nextNumber });
    } catch (error) {
      res.status(500).json({ error: "Failed to get next asset number" });
    }
  });

  // Get next monthly asset number for session (protected)
  app.get("/api/sessions/:id/next-monthly-asset-number", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const nextNumber = await storage.getNextMonthlyAssetNumber(sessionId);
      res.json({ nextAssetNumber: nextNumber });
    } catch (error) {
      res.status(500).json({ error: "Failed to get next monthly asset number" });
    }
  });

  // Get next five yearly asset number for session (protected)
  app.get("/api/sessions/:id/next-five-yearly-asset-number", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const nextNumber = await storage.getNextFiveYearlyAssetNumber(sessionId);
      res.json({ nextAssetNumber: nextNumber });
    } catch (error) {
      res.status(500).json({ error: "Failed to get next five yearly asset number" });
    }
  });

  // Validate asset number for session (protected)
  app.post("/api/sessions/:id/validate-asset-number", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { assetNumber, excludeId } = req.body;
      const isValid = await storage.validateAssetNumber(sessionId, assetNumber, excludeId);
      res.json({ isValid });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate asset number" });
    }
  });

  // Add test result to session
  app.post("/api/sessions/:id/results", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTestSession(sessionId);
      
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // If no asset number provided, get the next one
      if (!req.body.assetNumber) {
        req.body.assetNumber = (await storage.getNextAssetNumber(sessionId)).toString();
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
        visionInspection: req.body.visionInspection !== undefined ? req.body.visionInspection : true,
        electricalTest: req.body.electricalTest !== undefined ? req.body.electricalTest : true,
        // Emergency exit light specific fields (AS 2293.2:2019)
        maintenanceType: req.body.maintenanceType || null,
        dischargeTest: req.body.dischargeTest !== undefined ? req.body.dischargeTest : false,
        switchingTest: req.body.switchingTest !== undefined ? req.body.switchingTest : false,
        chargingTest: req.body.chargingTest !== undefined ? req.body.chargingTest : false,
        manufacturerInfo: req.body.manufacturerInfo || null,
        installationDate: req.body.installationDate || null
      };
      
      console.log('Request body received:', {
        ...req.body,
        photoData: req.body.photoData ? `Photo included (${Math.round(req.body.photoData.length / 1024)}KB)` : 'No photo in request'
      });
      console.log('Creating result with data:', {
        ...resultData,
        photoData: resultData.photoData ? `Photo data included (${Math.round(resultData.photoData.length / 1024)}KB)` : 'No photo data'
      });
      
      const result = await storage.createTestResult(resultData);
      res.json(result);
    } catch (error) {
      console.error('Error creating test result:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', error.errors);
        res.status(400).json({ error: "Invalid result data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create test result", details: String(error) });
      }
    }
  });

  // Update test result
  app.patch("/api/sessions/:id/results/:resultId", requireAuth, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const resultId = parseInt(req.params.resultId);
      
      const session = await storage.getTestSession(sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const updateData = {
        itemName: req.body.itemName,
        location: req.body.location,
        classification: req.body.classification,
        result: req.body.result,
        frequency: req.body.frequency,
        failureReason: req.body.failureReason || null,
        actionTaken: req.body.actionTaken || null,
        notes: req.body.notes || null
      };
      
      const result = await storage.updateTestResult(resultId, updateData);
      res.json(result);
    } catch (error) {
      console.error('Error updating test result:', error);
      res.status(500).json({ error: "Failed to update test result" });
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
  app.get("/api/sessions/:id/report", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const sessionData = await storage.getFullSessionData(sessionId);
      
      if (!sessionData) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      const { session, results } = sessionData;
      const totalItems = results.length;
      const passedItems = results.filter(r => r.result === 'pass').length;
      const failedItems = results.filter(r => r.result === 'fail').length;
      const passRate = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

      res.json({
        session,
        results,
        summary: {
          totalItems,
          passedItems,
          failedItems,
          passRate
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
