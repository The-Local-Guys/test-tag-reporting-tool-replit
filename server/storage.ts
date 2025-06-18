import { 
  testSessions, 
  testResults,
  users,
  type TestSession, 
  type InsertTestSession,
  type TestResult,
  type InsertTestResult,
  type User,
  type InsertUser
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User operations
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validatePassword(username: string, password: string): Promise<User | null>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUserStatus(userId: number, isActive: boolean): Promise<User>;
  getAllTestSessions(): Promise<(TestSession & { technicianFullName?: string })[]>;
  getSessionsByUser(userId: number): Promise<TestSession[]>;
  updateTestSession(sessionId: number, data: Partial<InsertTestSession>): Promise<TestSession>;
  deleteTestSession(sessionId: number): Promise<void>;
  
  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | undefined>;
  
  // Test Results
  createTestResult(result: InsertTestResult): Promise<TestResult>;
  updateTestResult(id: number, data: Partial<InsertTestResult>): Promise<TestResult>;
  getTestResultsBySession(sessionId: number): Promise<TestResult[]>;
  getNextAssetNumber(sessionId: number): Promise<number>;
  validateAssetNumber(sessionId: number, assetNumber: string, excludeId?: number): Promise<boolean>;
  
  // Report Data
  getFullSessionData(sessionId: number): Promise<{
    session: TestSession;
    results: TestResult[];
  } | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User authentication methods
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async validatePassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || !user.isActive) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserStatus(userId: number, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllTestSessions(): Promise<(TestSession & { technicianFullName?: string; totalItems?: number; failedItems?: number })[]> {
    const sessions = await db
      .select({
        id: testSessions.id,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        createdAt: testSessions.createdAt,
        technicianFullName: users.fullName,
      })
      .from(testSessions)
      .leftJoin(users, eq(testSessions.userId, users.id))
      .orderBy(desc(testSessions.testDate));
    
    // Add item counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const results = await db
          .select()
          .from(testResults)
          .where(eq(testResults.sessionId, session.id));
        
        const totalItems = results.length;
        const failedItems = results.filter(result => result.result === 'fail').length;
        
        return {
          ...session,
          totalItems,
          failedItems,
        };
      })
    );
    
    return sessionsWithCounts;
  }

  async getSessionsByUser(userId: number): Promise<(TestSession & { totalItems?: number; failedItems?: number })[]> {
    const sessions = await db
      .select()
      .from(testSessions)
      .where(eq(testSessions.userId, userId))
      .orderBy(desc(testSessions.testDate));
    
    // Add item counts for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const results = await db
          .select()
          .from(testResults)
          .where(eq(testResults.sessionId, session.id));
        
        const totalItems = results.length;
        const failedItems = results.filter(result => result.result === 'fail').length;
        
        return {
          ...session,
          totalItems,
          failedItems,
        };
      })
    );
    
    return sessionsWithCounts;
  }

  async updateTestSession(sessionId: number, data: Partial<InsertTestSession>): Promise<TestSession> {
    const [session] = await db
      .update(testSessions)
      .set(data)
      .where(eq(testSessions.id, sessionId))
      .returning();
    return session;
  }

  async deleteTestSession(sessionId: number): Promise<void> {
    // First delete all related test results
    await db.delete(testResults).where(eq(testResults.sessionId, sessionId));
    // Then delete the session
    await db.delete(testSessions).where(eq(testSessions.id, sessionId));
  }

  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    const [session] = await db
      .insert(testSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getTestSession(id: number): Promise<TestSession | undefined> {
    const [session] = await db
      .select()
      .from(testSessions)
      .where(eq(testSessions.id, id));
    return session || undefined;
  }

  async createTestResult(insertResult: any): Promise<TestResult> {
    try {
      console.log('Attempting to insert test result:', {
        ...insertResult,
        photoData: insertResult.photoData ? `Photo data included (${Math.round(insertResult.photoData.length / 1024)}KB)` : 'No photo data'
      });
      
      // Use the pool directly for raw SQL execution  
      const query = `
        INSERT INTO test_results 
        (session_id, asset_number, item_name, item_type, location, classification, result, frequency, failure_reason, action_taken, notes, photo_data, vision_inspection, electrical_test)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      
      const { pool } = await import('./db');
      const result = await pool.query(query, [
        insertResult.sessionId,
        insertResult.assetNumber,
        insertResult.itemName,
        insertResult.itemType,
        insertResult.location,
        insertResult.classification,
        insertResult.result,
        insertResult.frequency,
        insertResult.failureReason,
        insertResult.actionTaken,
        insertResult.notes,
        insertResult.photoData,
        insertResult.visionInspection !== undefined ? insertResult.visionInspection : true,
        insertResult.electricalTest !== undefined ? insertResult.electricalTest : true
      ]);
      
      console.log('Successfully inserted test result:', result.rows[0]);
      return result.rows[0] as TestResult;
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  }

  async getTestResultsBySession(sessionId: number): Promise<TestResult[]> {
    return await db
      .select()
      .from(testResults)
      .where(eq(testResults.sessionId, sessionId));
  }

  async getNextAssetNumber(sessionId: number): Promise<number> {
    const results = await this.getTestResultsBySession(sessionId);
    if (results.length === 0) return 1;
    
    const existingNumbers = results
      .map(r => parseInt(r.assetNumber))
      .filter(n => !isNaN(n))
      .sort((a, b) => b - a);
    
    return existingNumbers.length > 0 ? existingNumbers[0] + 1 : 1;
  }

  async updateTestResult(id: number, data: Partial<InsertTestResult>): Promise<TestResult> {
    const [result] = await db
      .update(testResults)
      .set(data)
      .where(eq(testResults.id, id))
      .returning();
    return result;
  }

  async validateAssetNumber(sessionId: number, assetNumber: string, excludeId?: number): Promise<boolean> {
    const results = await this.getTestResultsBySession(sessionId);
    return !results.some(r => r.assetNumber === assetNumber && r.id !== excludeId);
  }

  async getFullSessionData(sessionId: number): Promise<{
    session: TestSession;
    results: TestResult[];
  } | undefined> {
    const session = await this.getTestSession(sessionId);
    if (!session) return undefined;
    
    const results = await this.getTestResultsBySession(sessionId);
    return { session, results };
  }
}

export const storage = new DatabaseStorage();
