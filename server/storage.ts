import { 
  testSessions, 
  testResults, 
  type TestSession, 
  type InsertTestSession,
  type TestResult,
  type InsertTestResult 
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Test Sessions
  createTestSession(session: InsertTestSession): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | undefined>;
  
  // Test Results
  createTestResult(result: InsertTestResult): Promise<TestResult>;
  getTestResultsBySession(sessionId: number): Promise<TestResult[]>;
  
  // Report Data
  getFullSessionData(sessionId: number): Promise<{
    session: TestSession;
    results: TestResult[];
  } | undefined>;
}

export class DatabaseStorage implements IStorage {
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

  async createTestResult(insertResult: InsertTestResult): Promise<TestResult> {
    const [result] = await db
      .insert(testResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async getTestResultsBySession(sessionId: number): Promise<TestResult[]> {
    return await db
      .select()
      .from(testResults)
      .where(eq(testResults.sessionId, sessionId));
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
