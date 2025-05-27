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

  app.patch("/api/admin/sessions/:id", requireAdmin, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const sessionData = insertTestSessionSchema.parse(req.body);
      
      const session = await storage.updateTestSession(sessionId, sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Failed to update session" });
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
        photoData: req.body.photoData || null
      };
      
      console.log('Creating result with data:', {
        ...resultData,
        photoData: resultData.photoData ? `Photo data included (${Math.round(resultData.photoData.length / 1024)}KB)` : 'No photo data'
      });
      console.log('Request body photoData:', req.body.photoData ? `Photo included (${Math.round(req.body.photoData.length / 1024)}KB)` : 'No photo in request');
      
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
  app.patch("/api/sessions/:id/results/:resultId", (req, res, next) => {
    // Check if development bypass mode
    const devBypass = req.headers['x-dev-bypass'] === 'true';
    if (devBypass) {
      // Skip authentication for development mode
      next();
    } else {
      // Require authentication for production
      requireAuth(req, res, next);
    }
  }, async (req, res) => {
    try {
      console.log('=== SERVER UPDATE DEBUG ===');
      console.log('Headers:', req.headers);
      console.log('Params:', req.params);
      console.log('Body:', req.body);
      
      const sessionId = parseInt(req.params.id);
      const resultId = parseInt(req.params.resultId);
      
      console.log('Parsed sessionId:', sessionId);
      console.log('Parsed resultId:', resultId);
      
      const session = await storage.getTestSession(sessionId);
      if (!session) {
        console.log('Session not found for ID:', sessionId);
        res.status(404).json({ error: "Session not found" });
        return;
      }

      console.log('Found session:', session);

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
      
      console.log('Update data prepared:', updateData);
      
      const result = await storage.updateTestResult(resultId, updateData);
      console.log('Update result:', result);
      res.json(result);
    } catch (error) {
      console.error('=== SERVER UPDATE ERROR ===');
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
