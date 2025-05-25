import { 
  testSessions, 
  testResults, 
  type TestSession, 
  type InsertTestSession,
  type TestResult,
  type InsertTestResult 
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private sessions: Map<number, TestSession>;
  private results: Map<number, TestResult>;
  private currentSessionId: number;
  private currentResultId: number;

  constructor() {
    this.sessions = new Map();
    this.results = new Map();
    this.currentSessionId = 1;
    this.currentResultId = 1;
  }

  async createTestSession(insertSession: InsertTestSession): Promise<TestSession> {
    const id = this.currentSessionId++;
    const session: TestSession = { 
      ...insertSession, 
      id,
      createdAt: new Date()
    };
    this.sessions.set(id, session);
    return session;
  }

  async getTestSession(id: number): Promise<TestSession | undefined> {
    return this.sessions.get(id);
  }

  async createTestResult(insertResult: InsertTestResult): Promise<TestResult> {
    const id = this.currentResultId++;
    const result: TestResult = { 
      ...insertResult, 
      id,
      createdAt: new Date()
    };
    this.results.set(id, result);
    return result;
  }

  async getTestResultsBySession(sessionId: number): Promise<TestResult[]> {
    return Array.from(this.results.values()).filter(
      (result) => result.sessionId === sessionId
    );
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

export const storage = new MemStorage();
