import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTestSessionSchema, insertTestResultSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create a new test session
  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertTestSessionSchema.parse(req.body);
      const session = await storage.createTestSession(sessionData);
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid session data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create session" });
      }
    }
  });

  // Get session by ID
  app.get("/api/sessions/:id", async (req, res) => {
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

  // Get next asset number for session
  app.get("/api/sessions/:id/next-asset-number", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const nextNumber = await storage.getNextAssetNumber(sessionId);
      res.json({ nextAssetNumber: nextNumber });
    } catch (error) {
      res.status(500).json({ error: "Failed to get next asset number" });
    }
  });

  // Validate asset number for session
  app.post("/api/sessions/:id/validate-asset-number", async (req, res) => {
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
  app.post("/api/sessions/:id/results", async (req, res) => {
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

      // Validate asset number uniqueness
      try {
        const isValidAssetNumber = await storage.validateAssetNumber(sessionId, req.body.assetNumber);
        if (!isValidAssetNumber) {
          res.status(400).json({ error: "Asset number already exists for this session" });
          return;
        }
      } catch (validationError) {
        console.error('Asset validation error:', validationError);
        // Continue with insertion if validation fails - let database handle uniqueness
      }

      console.log('Request body:', req.body);
      console.log('Session ID:', sessionId);
      
      const resultData = insertTestResultSchema.parse({
        ...req.body,
        sessionId
      });
      
      console.log('Parsed result data:', resultData);
      
      const result = await storage.createTestResult(resultData);
      res.json(result);
    } catch (error) {
      console.error('Error creating test result:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid result data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create test result", details: String(error) });
      }
    }
  });

  // Get all results for a session
  app.get("/api/sessions/:id/results", async (req, res) => {
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
