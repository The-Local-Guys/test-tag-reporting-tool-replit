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
  updateUser(userId: number, data: Partial<InsertUser>): Promise<User>;
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
  deleteTestResult(id: number): Promise<void>;
  getTestResultsBySession(sessionId: number): Promise<TestResult[]>;
  getNextAssetNumber(sessionId: number): Promise<number>;
  getNextMonthlyAssetNumber(sessionId: number): Promise<number>;
  getNextFiveYearlyAssetNumber(sessionId: number): Promise<number>;
  validateAssetNumber(sessionId: number, assetNumber: string, excludeId?: number): Promise<boolean>;
  
  // Asset Progress
  getAssetProgress(sessionId: number): Promise<{
    nextMonthly: number;
    nextFiveYearly: number;
    monthlyCount: number;
    fiveYearlyCount: number;
  }>;
  
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

  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
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

  async updateUser(userId: number, data: Partial<InsertUser>): Promise<User> {
    const updateData: any = { 
      ...data, 
      updatedAt: new Date() 
    };
    
    // Hash password if provided
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
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
      
      // Auto-generate asset number based on frequency if not provided or if provided number already exists
      let assetNumber = insertResult.assetNumber;
      
      if (!assetNumber || await this.isDuplicateAssetNumber(insertResult.sessionId, assetNumber)) {
        console.log('Auto-generating asset number for frequency:', insertResult.frequency);
        
        if (insertResult.frequency === 'fiveyearly') {
          assetNumber = (await this.getNextFiveYearlyAssetNumber(insertResult.sessionId)).toString();
        } else {
          assetNumber = (await this.getNextMonthlyAssetNumber(insertResult.sessionId)).toString();
        }
        
        console.log('Generated asset number:', assetNumber);
      }
      
      // Use the pool directly for raw SQL execution with all fields including emergency-specific ones
      const query = `
        INSERT INTO test_results 
        (session_id, asset_number, item_name, item_type, location, classification, result, frequency, failure_reason, action_taken, notes, photo_data, vision_inspection, electrical_test, maintenance_type, globe_type, discharge_test, switching_test, charging_test, manufacturer_info, installation_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *
      `;
      
      const { pool } = await import('./db');
      const result = await pool.query(query, [
        insertResult.sessionId,
        assetNumber,
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
        insertResult.electricalTest !== undefined ? insertResult.electricalTest : true,
        // Emergency exit light specific fields
        insertResult.maintenanceType,
        insertResult.globeType,
        insertResult.dischargeTest !== undefined ? insertResult.dischargeTest : false,
        insertResult.switchingTest !== undefined ? insertResult.switchingTest : false,
        insertResult.chargingTest !== undefined ? insertResult.chargingTest : false,
        insertResult.manufacturerInfo,
        insertResult.installationDate,
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

  async getNextMonthlyAssetNumber(sessionId: number): Promise<number> {
    const results = await this.getTestResultsBySession(sessionId);
    
    // Filter for monthly frequencies (3, 6, 12, 24 monthly)
    const monthlyResults = results.filter(r => 
      r.frequency === 'threemonthly' || 
      r.frequency === 'sixmonthly' || 
      r.frequency === 'twelvemonthly' || 
      r.frequency === 'twentyfourmonthly'
    );
    
    if (monthlyResults.length === 0) return 1;
    
    const existingNumbers = monthlyResults
      .map(r => parseInt(r.assetNumber))
      .filter(n => !isNaN(n))
      .sort((a, b) => b - a);
    
    return existingNumbers.length > 0 ? existingNumbers[0] + 1 : 1;
  }

  async getNextFiveYearlyAssetNumber(sessionId: number): Promise<number> {
    const results = await this.getTestResultsBySession(sessionId);
    
    // Filter for 5 yearly frequency
    const fiveYearlyResults = results.filter(r => r.frequency === 'fiveyearly');
    
    if (fiveYearlyResults.length === 0) return 5001;
    
    const existingNumbers = fiveYearlyResults
      .map(r => parseInt(r.assetNumber))
      .filter(n => !isNaN(n))
      .sort((a, b) => b - a);
    
    return existingNumbers.length > 0 ? existingNumbers[0] + 1 : 5001;
  }

  async updateTestResult(id: number, data: Partial<InsertTestResult>): Promise<TestResult> {
    const [result] = await db
      .update(testResults)
      .set(data)
      .where(eq(testResults.id, id))
      .returning();
    return result;
  }

  async deleteTestResult(id: number): Promise<void> {
    await db.delete(testResults).where(eq(testResults.id, id));
  }

  async validateAssetNumber(sessionId: number, assetNumber: string, excludeId?: number): Promise<boolean> {
    const results = await this.getTestResultsBySession(sessionId);
    return !results.some(r => r.assetNumber === assetNumber && r.id !== excludeId);
  }

  async isDuplicateAssetNumber(sessionId: number, assetNumber: string): Promise<boolean> {
    const results = await this.getTestResultsBySession(sessionId);
    return results.some(r => r.assetNumber === assetNumber);
  }

  async getAssetProgress(sessionId: number): Promise<{
    nextMonthly: number;
    nextFiveYearly: number;
    monthlyCount: number;
    fiveYearlyCount: number;
  }> {
    const results = await this.getTestResultsBySession(sessionId);
    
    // Count monthly items
    const monthlyResults = results.filter(r => 
      r.frequency === 'threemonthly' || 
      r.frequency === 'sixmonthly' || 
      r.frequency === 'twelvemonthly' || 
      r.frequency === 'twentyfourmonthly'
    );
    
    // Count 5-yearly items
    const fiveYearlyResults = results.filter(r => r.frequency === 'fiveyearly');
    
    // Get next asset numbers
    const nextMonthly = await this.getNextMonthlyAssetNumber(sessionId);
    const nextFiveYearly = await this.getNextFiveYearlyAssetNumber(sessionId);
    
    return {
      nextMonthly,
      nextFiveYearly,
      monthlyCount: monthlyResults.length,
      fiveYearlyCount: fiveYearlyResults.length,
    };
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
