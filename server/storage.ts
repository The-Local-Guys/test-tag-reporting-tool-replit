import { 
  testSessions, 
  testResults,
  users,
  environments,
  customFormTypes,
  certificates,
  type TestSession, 
  type InsertTestSession,
  type TestResult,
  type InsertTestResult,
  type User,
  type InsertUser,
  type Environment,
  type InsertEnvironment,
  type UpdateEnvironmentDetails,
  type CustomFormType,
  type InsertCustomFormType,
  type Certificate,
  type InsertCertificate
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, gte, sql, isNull, ilike, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { TransactionClient } from "./idempotency";

export interface IStorage {
  // User operations
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validatePassword(username: string, password: string): Promise<User | null>;
  updateUserPassword(userId: number, newPassword: string): Promise<void>;
  updateUserAppInfo(userId: number, version: string, platform: string): Promise<void>;

  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUserStatus(userId: number, isActive: boolean): Promise<User>;
  updateUser(userId: number, data: Partial<InsertUser>): Promise<User>;
  getAllTestSessions(): Promise<(TestSession & { technicianFullName?: string | null })[]>;
  getAllTestSessionsPaginated(page: number, limit: number, technicianFilter?: string, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { technicianFullName?: string | null; totalItems?: number; failedItems?: number })[]; total: number }>;
  getSessionsByUser(userId: number): Promise<TestSession[]>;
  getSessionsByUserPaginated(userId: number, page: number, limit: number, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { totalItems?: number; failedItems?: number })[]; total: number }>;
  updateTestSession(sessionId: number, data: Partial<InsertTestSession>): Promise<TestSession>;
  deleteTestSession(sessionId: number, deletedByUserId: number): Promise<void>;

  // Test Sessions
  createTestSession(session: InsertTestSession, client?: TransactionClient): Promise<TestSession>;
  getTestSession(id: number): Promise<TestSession | undefined>;

  // Draft session management (database-first architecture)
  getDraftSessionsByUser(userId: number): Promise<(TestSession & { totalItems: number; failedItems: number })[]>;
  getDraftSessionsByUserPaginated(userId: number, page: number, limit: number, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { totalItems: number; failedItems: number })[]; total: number }>;
  getAllDraftSessions(): Promise<(TestSession & { totalItems: number; failedItems: number })[]>;
  getAllDraftSessionsPaginated(page: number, limit: number, technicianFilter?: string, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { totalItems: number; failedItems: number })[]; total: number }>;
  finalizeSession(sessionId: number): Promise<TestSession>;
  updateCustomStartingNumbers(sessionId: number, numbers: object): Promise<TestSession>;
  updateSessionActivity(sessionId: number, client?: TransactionClient): Promise<void>;
  
  // Test Results
  createTestResult(result: InsertTestResult, client?: TransactionClient): Promise<TestResult>;
  updateTestResult(id: number, data: Partial<InsertTestResult>): Promise<TestResult>;
  deleteTestResult(id: number, deletedByUserId: number): Promise<void>;
  getTestResult(resultId: number): Promise<TestResult | undefined>;
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
  
  // Environments
  createEnvironment(environment: InsertEnvironment, client?: TransactionClient): Promise<Environment>;
  getEnvironmentsByUser(userId: number): Promise<Environment[]>;
  getEnvironment(id: number): Promise<Environment | undefined>;
  updateEnvironment(id: number, data: Partial<InsertEnvironment>): Promise<Environment>;
  updateEnvironmentDetails(id: number, data: UpdateEnvironmentDetails): Promise<Environment>;
  deleteEnvironment(id: number): Promise<void>;
  
  // Custom Form Types
  createCustomFormType(formType: InsertCustomFormType): Promise<CustomFormType>;
  getAllCustomFormTypes(): Promise<CustomFormType[]>;
  getCustomFormType(id: number): Promise<CustomFormType | undefined>;
  updateCustomFormType(id: number, data: Partial<InsertCustomFormType>): Promise<CustomFormType>;
  deleteCustomFormType(id: number): Promise<void>;
  
  // Certificates
  createCertificate(certificate: InsertCertificate, client?: TransactionClient): Promise<Certificate>;
  getCertificatesByUser(userId: number): Promise<Certificate[]>;
  getAllCertificates(): Promise<Certificate[]>;
  getCertificateById(id: number): Promise<Certificate | undefined>;
  updateCertificate(id: number, data: Partial<InsertCertificate>): Promise<Certificate>;
  deleteCertificate(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User authentication methods
  
  /**
   * Retrieves a user by their username from the database
   * Used during login authentication to find user accounts
   * @param username - The username to search for
   * @returns User object if found, undefined if not found
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  /**
   * Creates a new user account with encrypted password
   * Automatically hashes the password using bcrypt for security
   * Used by admins to create new technician and support center accounts
   * @param insertUser - User data including plaintext password
   * @returns Newly created user object with encrypted password
   */
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

  /**
   * Validates user credentials during login process
   * Checks if user exists, is active, and password matches
   * @param username - Username to authenticate
   * @param password - Plaintext password to verify
   * @returns User object if credentials are valid, null if invalid or user inactive
   */
  async validatePassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || !user.isActive) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  /**
   * Updates a user's password with proper encryption
   * Used by admins to reset passwords or by users to change their own password
   * @param userId - ID of the user whose password to update
   * @param newPassword - New plaintext password to set
   */
  async updateUserPassword(userId: number, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async updateUserAppInfo(userId: number, version: string, platform: string): Promise<void> {
    await db
      .update(users)
      .set({ lastAppVersion: version, lastAppPlatform: platform, lastSeenAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Admin operations

  /**
   * Retrieves all users from the database for admin management
   * Used in admin dashboard to display user list with roles and status
   * @returns Array of all user objects in the system
   */
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  /**
   * Activates or deactivates a user account
   * Used by admins to disable access without deleting user records
   * @param userId - ID of the user to update
   * @param isActive - New active status (true = active, false = disabled)
   * @returns Updated user object
   */
  async updateUserStatus(userId: number, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  /**
   * Updates user information with automatic password hashing
   * Used by admins to modify user details, roles, or reset passwords
   * @param userId - ID of the user to update
   * @param data - Partial user data to update (password will be hashed if provided)
   * @returns Updated user object
   */
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

  /**
   * Retrieves all test sessions with additional metadata for admin dashboard
   * Includes technician names, item counts, and failure statistics
   * @returns Array of test sessions with enriched data for management overview
   */
  async getAllTestSessions(): Promise<(TestSession & { technicianFullName?: string | null; totalItems?: number; failedItems?: number })[]> {
    const sessionsWithCounts = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        technicianFullName: users.fullName,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(users, eq(testSessions.userId, users.id))
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(isNull(testSessions.deletedAt))
      .groupBy(testSessions.id, users.fullName)
      .orderBy(desc(testSessions.testDate));

    return sessionsWithCounts;
  }

  /**
   * Retrieves all test sessions created by a specific user
   * Used to show technicians their testing history and session management
   * @param userId - ID of the user/technician whose sessions to retrieve
   * @returns Array of test sessions with item count statistics
   */
  async getSessionsByUser(userId: number): Promise<(TestSession & { totalItems?: number; failedItems?: number })[]> {
    const sessionsWithCounts = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(and(eq(testSessions.userId, userId), isNull(testSessions.deletedAt)))
      .groupBy(testSessions.id)
      .orderBy(desc(testSessions.testDate));

    return sessionsWithCounts;
  }

  async getAllTestSessionsPaginated(page: number, limit: number, technicianFilter?: string, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { technicianFullName?: string | null; totalItems?: number; failedItems?: number })[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [isNull(testSessions.deletedAt)];
    if (technicianFilter && technicianFilter !== "all") conditions.push(eq(users.fullName, technicianFilter));
    if (serviceTypeFilter && serviceTypeFilter !== "all") conditions.push(eq(testSessions.serviceType, serviceTypeFilter));
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(testSessions.clientName, term), ilike(testSessions.address, term), ilike(users.fullName, term))!);
    }
    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ count: sql<number>`count(distinct ${testSessions.id})`.mapWith(Number) })
      .from(testSessions)
      .leftJoin(users, eq(testSessions.userId, users.id))
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    const sessions = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        technicianFullName: users.fullName,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(users, eq(testSessions.userId, users.id))
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(whereClause)
      .groupBy(testSessions.id, users.fullName)
      .orderBy(desc(testSessions.testDate))
      .limit(limit)
      .offset(offset);

    return { sessions, total };
  }

  async getSessionsByUserPaginated(userId: number, page: number, limit: number, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { totalItems?: number; failedItems?: number })[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(testSessions.userId, userId), isNull(testSessions.deletedAt)];
    if (serviceTypeFilter && serviceTypeFilter !== 'all') conditions.push(eq(testSessions.serviceType, serviceTypeFilter));
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(testSessions.clientName, term), ilike(testSessions.address, term))!);
    }
    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ count: sql<number>`count(distinct ${testSessions.id})`.mapWith(Number) })
      .from(testSessions)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    const sessions = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(whereClause)
      .groupBy(testSessions.id)
      .orderBy(desc(testSessions.testDate))
      .limit(limit)
      .offset(offset);

    return { sessions, total };
  }

  /**
   * Updates test session information (client details, dates, etc.)
   * Used by admins to correct session information after creation
   * @param sessionId - ID of the session to update
   * @param data - Partial session data to update
   * @returns Updated test session object
   */
  async updateTestSession(sessionId: number, data: Partial<InsertTestSession>): Promise<TestSession> {
    const [session] = await db
      .update(testSessions)
      .set(data)
      .where(eq(testSessions.id, sessionId))
      .returning();
    return session;
  }

  /**
   * Soft deletes a test session and all associated test results
   * Records the user who performed the delete action for audit trail
   * Used by technicians to remove their own sessions or by admins for management
   * @param sessionId - ID of the session to delete
   * @param deletedByUserId - ID of the user performing the delete action
   */
  async deleteTestSession(sessionId: number, deletedByUserId: number): Promise<void> {
    try {
      const now = new Date();
      
      // Soft delete all test results for this session with audit info
      await db
        .update(testResults)
        .set({ deletedAt: now, deletedBy: deletedByUserId })
        .where(eq(testResults.sessionId, sessionId));

      // Soft delete the session itself with audit info
      await db
        .update(testSessions)
        .set({ deletedAt: now, deletedBy: deletedByUserId })
        .where(eq(testSessions.id, sessionId));
    } catch (error) {
      console.error('Error soft deleting session:', error);
      throw error;
    }
  }

  /**
   * Permanently deletes a test session and all associated test results
   * Cascades delete to maintain database consistency
   * @param sessionId - ID of the session to delete completely
   */

  /**
   * Creates a new test session to group related test results
   * Sets up testing context with client details and service type
   * @param insertSession - Session data (client, address, technician info)
   * @returns Newly created test session object
   */
  async createTestSession(insertSession: InsertTestSession, client?: TransactionClient): Promise<TestSession> {
    if (client) {
      const result = await client.query(
        `
          insert into test_sessions (
            service_type,
            test_date,
            technician_name,
            client_name,
            site_contact,
            address,
            country,
            user_id,
            starting_asset_number,
            technician_licensed,
            compliance_standard,
            status,
            custom_starting_numbers
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          returning
            id,
            service_type as "serviceType",
            test_date as "testDate",
            technician_name as "technicianName",
            client_name as "clientName",
            site_contact as "siteContact",
            address,
            country,
            user_id as "userId",
            starting_asset_number as "startingAssetNumber",
            technician_licensed as "technicianLicensed",
            compliance_standard as "complianceStandard",
            status,
            custom_starting_numbers as "customStartingNumbers",
            last_activity_at as "lastActivityAt",
            created_at as "createdAt",
            deleted_at as "deletedAt",
            deleted_by as "deletedBy"
        `,
        [
          insertSession.serviceType ?? "electrical",
          insertSession.testDate,
          insertSession.technicianName,
          insertSession.clientName,
          insertSession.siteContact,
          insertSession.address,
          insertSession.country,
          insertSession.userId ?? null,
          insertSession.startingAssetNumber ?? null,
          insertSession.technicianLicensed ?? null,
          insertSession.complianceStandard ?? null,
          insertSession.status ?? "draft",
          insertSession.customStartingNumbers ?? null,
        ],
      );
      return result.rows[0] as TestSession;
    }

    const [session] = await db
      .insert(testSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  /**
   * Retrieves a specific test session by its ID
   * Used to load session context for testing and reporting
   * @param id - ID of the test session to retrieve
   * @returns Test session object if found, undefined if not found
   */
  async getTestSession(id: number): Promise<TestSession | undefined> {
    const [session] = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
      })
      .from(testSessions)
      .where(and(eq(testSessions.id, id), isNull(testSessions.deletedAt)));
    return session || undefined;
  }

  /**
   * Retrieves all draft (unfinished) sessions for a user with item counts
   * Used to detect and recover multi-day jobs that weren't finalized
   * @param userId - ID of the user to get draft sessions for
   * @returns Array of draft sessions with totalItems and failedItems counts
   */
  async getDraftSessionsByUser(userId: number): Promise<(TestSession & { totalItems: number; failedItems: number })[]> {
    const draftSessions = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(and(
        eq(testSessions.userId, userId),
        eq(testSessions.status, 'draft'),
        isNull(testSessions.deletedAt)
      ))
      .groupBy(testSessions.id)
      .orderBy(desc(testSessions.lastActivityAt));

    return draftSessions;
  }

  /**
   * Gets all draft sessions across all users (for admin dashboard)
   * Used by admins to view and recover unfinished reports from any technician
   * @returns Array of draft sessions with totalItems and failedItems counts
   */
  async getAllDraftSessions(): Promise<(TestSession & { totalItems: number; failedItems: number })[]> {
    const draftSessions = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(and(
        eq(testSessions.status, 'draft'),
        isNull(testSessions.deletedAt)
      ))
      .groupBy(testSessions.id)
      .orderBy(desc(testSessions.lastActivityAt));

    return draftSessions;
  }

  async getDraftSessionsByUserPaginated(userId: number, page: number, limit: number, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { totalItems: number; failedItems: number })[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(testSessions.userId, userId), eq(testSessions.status, 'draft'), isNull(testSessions.deletedAt)];
    if (serviceTypeFilter && serviceTypeFilter !== 'all') conditions.push(eq(testSessions.serviceType, serviceTypeFilter));
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(testSessions.clientName, term), ilike(testSessions.address, term))!);
    }
    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ count: sql<number>`count(distinct ${testSessions.id})`.mapWith(Number) })
      .from(testSessions)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    const sessions = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(whereClause)
      .groupBy(testSessions.id)
      .orderBy(desc(testSessions.lastActivityAt))
      .limit(limit)
      .offset(offset);

    return { sessions, total };
  }

  async getAllDraftSessionsPaginated(page: number, limit: number, technicianFilter?: string, serviceTypeFilter?: string, search?: string): Promise<{ sessions: (TestSession & { totalItems: number; failedItems: number })[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = [eq(testSessions.status, 'draft'), isNull(testSessions.deletedAt)];
    if (technicianFilter && technicianFilter !== 'all') conditions.push(eq(testSessions.technicianName, technicianFilter));
    if (serviceTypeFilter && serviceTypeFilter !== 'all') conditions.push(eq(testSessions.serviceType, serviceTypeFilter));
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(testSessions.clientName, term), ilike(testSessions.address, term), ilike(testSessions.technicianName, term))!);
    }
    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ count: sql<number>`count(distinct ${testSessions.id})`.mapWith(Number) })
      .from(testSessions)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    const sessions = await db
      .select({
        id: testSessions.id,
        serviceType: testSessions.serviceType,
        testDate: testSessions.testDate,
        technicianName: testSessions.technicianName,
        clientName: testSessions.clientName,
        siteContact: testSessions.siteContact,
        address: testSessions.address,
        country: testSessions.country,
        userId: testSessions.userId,
        startingAssetNumber: testSessions.startingAssetNumber,
        technicianLicensed: testSessions.technicianLicensed,
        complianceStandard: testSessions.complianceStandard,
        status: testSessions.status,
        customStartingNumbers: testSessions.customStartingNumbers,
        lastActivityAt: testSessions.lastActivityAt,
        createdAt: testSessions.createdAt,
        deletedAt: testSessions.deletedAt,
        deletedBy: testSessions.deletedBy,
        totalItems: sql<number>`count(${testResults.id})`.mapWith(Number),
        failedItems: sql<number>`count(case when ${testResults.result} = 'fail' then 1 end)`.mapWith(Number),
      })
      .from(testSessions)
      .leftJoin(testResults, and(eq(testSessions.id, testResults.sessionId), isNull(testResults.deletedAt)))
      .where(whereClause)
      .groupBy(testSessions.id)
      .orderBy(desc(testSessions.lastActivityAt))
      .limit(limit)
      .offset(offset);

    return { sessions, total };
  }

  /**
   * Marks a session as finalized (completed)
   * Called when user clicks "Finish Report" to indicate the session is complete
   * @param sessionId - ID of the session to finalize
   * @returns Updated session object
   */
  async finalizeSession(sessionId: number): Promise<TestSession> {
    const [session] = await db
      .update(testSessions)
      .set({ status: 'finalized', lastActivityAt: new Date() })
      .where(eq(testSessions.id, sessionId))
      .returning();
    return session;
  }

  /**
   * Saves custom starting asset numbers for a session
   * Stored in the database to persist across browser sessions and devices
   * @param sessionId - ID of the session to update
   * @param numbers - Object containing custom starting numbers per frequency
   * @returns Updated session object
   */
  async updateCustomStartingNumbers(sessionId: number, numbers: object): Promise<TestSession> {
    const [session] = await db
      .update(testSessions)
      .set({ customStartingNumbers: numbers, lastActivityAt: new Date() })
      .where(eq(testSessions.id, sessionId))
      .returning();
    return session;
  }

  /**
   * Updates the lastActivityAt timestamp for a session
   * Called when test results are added/modified to track session activity
   * @param sessionId - ID of the session to update
   */
  async updateSessionActivity(sessionId: number, client?: TransactionClient): Promise<void> {
    if (client) {
      await client.query(
        "update test_sessions set last_activity_at = now() where id = $1",
        [sessionId],
      );
      return;
    }

    await db
      .update(testSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(testSessions.id, sessionId));
  }

  /**
   * Creates a new test result using client-provided data including asset number
   * This function now relies on client-side asset numbering and batching
   * @param insertResult - Test result data including item details, test outcomes, and asset number
   * @returns Newly created test result
   */
  async createTestResult(insertResult: any, client?: TransactionClient): Promise<TestResult> {
    try {
      console.log('Attempting to insert test result:', {
        ...insertResult,
        photoData: insertResult.photoData ? `Photo data included (${Math.round(insertResult.photoData.length / 1024)}KB)` : 'No photo data'
      });
      
      // Use the asset number provided by the client (from batched results)
      const assetNumber = insertResult.assetNumber || '1';
      
      // Use the pool directly for raw SQL execution with all fields including emergency-specific, fire-specific, RCD-specific, and microwave-specific ones
      const query = `
        INSERT INTO test_results
        (session_id, asset_number, item_name, item_type, location, classification, result, frequency, failure_reason, action_taken, notes, photo_data, vision_inspection, electrical_test,
        maintenance_type, globe_type, discharge_test, switching_test, charging_test, lux_test, lux_reading, lux_compliant, manufacturer_info, installation_date,
        equipment_type, extinguisher_type, size, weight, test_type, fire_visual_inspection, pressure_test, accessibility_check, signage_check, operational_test,
        push_button_test, injection_timed_test, trip_times, distribution_board_number, circuit_breaker_number, leakage_reading)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40)
        RETURNING *
      `;

      const queryClient = client ?? pool;
      const result = await queryClient.query(query, [
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
        insertResult.notes ?? null,
        insertResult.photoData,
        insertResult.visionInspection !== undefined ? insertResult.visionInspection : true,
        insertResult.electricalTest !== undefined ? insertResult.electricalTest : true,
        // Emergency exit light specific fields
        insertResult.maintenanceType ?? null,
        insertResult.globeType ?? null,
        insertResult.dischargeTest !== undefined ? insertResult.dischargeTest : false,
        insertResult.switchingTest !== undefined ? insertResult.switchingTest : false,
        insertResult.chargingTest !== undefined ? insertResult.chargingTest : false,
        insertResult.luxTest !== undefined ? insertResult.luxTest : false,
        insertResult.luxReading ?? null,
        insertResult.luxCompliant !== undefined ? insertResult.luxCompliant : false,
        insertResult.manufacturerInfo ?? null,
        insertResult.installationDate ?? null,
        // Fire testing specific fields
        insertResult.equipmentType ?? null,
        insertResult.extinguisherType ?? null,
        insertResult.size ?? null,
        insertResult.weight ?? null,
        insertResult.testType ?? null,
        insertResult.fireVisualInspection !== undefined ? insertResult.fireVisualInspection : false,
        insertResult.pressureTest !== undefined ? insertResult.pressureTest : false,
        insertResult.accessibilityCheck !== undefined ? insertResult.accessibilityCheck : false,
        insertResult.signageCheck !== undefined ? insertResult.signageCheck : false,
        insertResult.operationalTest !== undefined ? insertResult.operationalTest : false,
        // RCD specific fields
        insertResult.pushButtonTest ?? null,
        insertResult.injectionTimedTest ?? null,
        // Store full trip times array directly in the trip_times NUMERIC[] column
        insertResult.tripTimes && Array.isArray(insertResult.tripTimes) && insertResult.tripTimes.length > 0
          ? insertResult.tripTimes.map(Number).filter((n: number) => isFinite(n) && n > 0)
          : null,
        insertResult.distributionBoardNumber ?? null,
        insertResult.circuitBreakerNumber ?? null,
        // Microwave specific fields
        insertResult.leakageReading ?? null,
      ]);
      
      console.log('Successfully inserted test result:', result.rows[0]);

      // Update session's lastActivityAt timestamp for multi-day job tracking
      if (insertResult.sessionId) {
        await this.updateSessionActivity(insertResult.sessionId, client);
      }

      return result.rows[0] as TestResult;
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  }

  /**
   * Retrieves a single test result by its ID
   * Used for updating or validating individual test results
   * @param resultId - ID of the test result to retrieve
   * @returns Test result object if found, undefined if not found
   */
  async getTestResult(resultId: number): Promise<TestResult | undefined> {
    const [result] = await db
      .select()
      .from(testResults)
      .where(eq(testResults.id, resultId));
    return result;
  }

  /**
   * Retrieves all test results for a specific session
   * Returns results sorted by asset number for proper report sequencing
   * @param sessionId - ID of the test session to get results for
   * @returns Array of test results for the session
   */
  async getTestResultsBySession(sessionId: number): Promise<TestResult[]> {
    const results = await db
      .select()
      .from(testResults)
      .where(and(eq(testResults.sessionId, sessionId), isNull(testResults.deletedAt)));
    
    // Sort by asset number (numerical order) - handle both monthly (1-999) and 5-yearly (10001+) sequences
    return results.sort((a, b) => {
      const aNum = parseInt(a.assetNumber);
      const bNum = parseInt(b.assetNumber);
      
      // If both are numbers, sort numerically
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      
      // If one is a number and one isn't, number comes first
      if (!isNaN(aNum) && isNaN(bNum)) return -1;
      if (isNaN(aNum) && !isNaN(bNum)) return 1;
      
      // If both are non-numbers, sort alphabetically
      return a.assetNumber.localeCompare(b.assetNumber);
    });
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

  /**
   * Generates the next sequential asset number for monthly frequency testing (1, 2, 3...)
   * Covers 3, 6, 12, and 24 monthly testing frequencies
   * @param sessionId - ID of the session to generate asset number for
   * @returns Next available asset number starting from 1
   */
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

  /**
   * Generates the next sequential asset number for 5-yearly testing (10001, 10002, 10003...)
   * Uses separate numbering sequence to distinguish from monthly frequency items
   * @param sessionId - ID of the session to generate asset number for
   * @returns Next available 5-yearly asset number starting from 10001
   */
  async getNextFiveYearlyAssetNumber(sessionId: number): Promise<number> {
    const results = await this.getTestResultsBySession(sessionId);
    
    // Filter for 5 yearly frequency
    const fiveYearlyResults = results.filter(r => r.frequency === 'fiveyearly');
    
    console.log(`Found ${fiveYearlyResults.length} existing 5-yearly items:`, fiveYearlyResults.map(r => ({
      id: r.id,
      assetNumber: r.assetNumber,
      itemName: r.itemName
    })));
    
    if (fiveYearlyResults.length === 0) {
      console.log('No existing 5-yearly items found, returning 10001');
      return 10001;
    }
    
    const existingNumbers = fiveYearlyResults
      .map(r => parseInt(r.assetNumber))
      .filter(n => !isNaN(n) && n >= 10001) // Only consider numbers in the new 10001+ range
      .sort((a, b) => b - a);
    
    console.log('Existing 5-yearly asset numbers:', existingNumbers);
    
    const nextNumber = existingNumbers.length > 0 ? existingNumbers[0] + 1 : 10001;
    console.log('Next 5-yearly asset number:', nextNumber);
    
    return nextNumber;
  }

  async updateTestResult(id: number, data: Partial<InsertTestResult>): Promise<TestResult> {
    const updateData = { ...data };

    // Strip any legacy [TRIP_TIMES:[...]] embedding from notes if present
    // (produced by old code before the trip_times array column was added)
    if (updateData.notes) {
      updateData.notes = updateData.notes.replace(/\s*\[TRIP_TIMES:\[[^\]]*\]\]/g, '').trim() || null;
    }

    const [result] = await db
      .update(testResults)
      .set(updateData)
      .where(eq(testResults.id, id))
      .returning();
    return result;
  }

  /**
   * Soft deletes a single test result with audit trail
   * Records the user who performed the delete action
   * @param id - ID of the test result to delete
   * @param deletedByUserId - ID of the user performing the delete action
   */
  async deleteTestResult(id: number, deletedByUserId: number): Promise<void> {
    await db
      .update(testResults)
      .set({ deletedAt: new Date(), deletedBy: deletedByUserId })
      .where(eq(testResults.id, id));
  }

  async validateAssetNumber(sessionId: number, assetNumber: string, excludeId?: number): Promise<boolean> {
    const results = await this.getTestResultsBySession(sessionId);
    return !results.some(r => r.assetNumber === assetNumber && r.id !== excludeId);
  }

  async isDuplicateAssetNumber(sessionId: number, assetNumber: string): Promise<boolean> {
    const results = await this.getTestResultsBySession(sessionId);
    const isDuplicate = results.some(r => r.assetNumber === assetNumber);
    console.log(`Checking duplicate for asset number ${assetNumber}:`, isDuplicate);
    return isDuplicate;
  }

  async isDuplicateAssetNumberForFrequency(sessionId: number, assetNumber: string, frequency: string): Promise<boolean> {
    const results = await this.getTestResultsBySession(sessionId);
    
    // Filter results by frequency group
    const sameFrequencyResults = results.filter(r => {
      if (frequency === 'fiveyearly') {
        return r.frequency === 'fiveyearly';
      } else {
        // Monthly frequencies
        return r.frequency === 'threemonthly' || 
               r.frequency === 'sixmonthly' || 
               r.frequency === 'twelvemonthly' || 
               r.frequency === 'twentyfourmonthly';
      }
    });
    
    const isDuplicate = sameFrequencyResults.some(r => r.assetNumber === assetNumber);
    console.log(`Checking duplicate for asset number ${assetNumber} in frequency group ${frequency}:`, isDuplicate);
    return isDuplicate;
  }

  /**
   * Checks for recent duplicate test results to prevent multiple submissions
   * Searches for identical items tested within the last 10 seconds
   * @param insertResult - Test result data to check for duplicates
   * @returns Array of recent duplicate test results (empty if no duplicates found)
   */
  async checkForRecentDuplicates(insertResult: any): Promise<TestResult[]> {
    const tenSecondsAgo = new Date(Date.now() - 10000); // 10 seconds ago
    
    const results = await db
      .select()
      .from(testResults)
      .where(
        and(
          eq(testResults.sessionId, insertResult.sessionId),
          eq(testResults.itemName, insertResult.itemName),
          eq(testResults.itemType, insertResult.itemType),
          eq(testResults.location, insertResult.location),
          eq(testResults.frequency, insertResult.frequency),
          gte(testResults.createdAt, tenSecondsAgo)
        )
      );
    
    console.log(`Found ${results.length} recent duplicates for item: ${insertResult.itemName}`);
    return results;
  }

  /**
   * Retrieves asset numbering progress and counts for testing interface
   * Shows technicians what asset numbers will be assigned next and current counts
   * @param sessionId - ID of the session to get progress for
   * @returns Object with next asset numbers and item counts by frequency type
   */
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

  /**
   * Retrieves complete session data including all test results for reporting
   * Used for PDF and Excel report generation
   * @param sessionId - ID of the session to get complete data for
   * @returns Session details with all associated test results, or undefined if session not found
   */
  async getFullSessionData(sessionId: number): Promise<{
    session: TestSession;
    results: TestResult[];
  } | undefined> {
    const session = await this.getTestSession(sessionId);
    if (!session) return undefined;
    
    const results = await this.getTestResultsBySession(sessionId);
    return { session, results };
  }

  /**
   * Creates a new environment for custom item sets
   * Environments are account-specific and contain custom item lists per service type
   * @param environment - Environment data with userId, name, serviceType, and items
   * @returns Newly created environment object
   */
  async createEnvironment(environment: InsertEnvironment, client?: TransactionClient): Promise<Environment> {
    if (client) {
      const result = await client.query(
        `
          insert into environments (
            user_id,
            name,
            description,
            service_type,
            items
          )
          values ($1, $2, $3, $4, $5)
          returning
            id,
            user_id as "userId",
            name,
            description,
            service_type as "serviceType",
            items,
            created_at as "createdAt"
        `,
        [
          environment.userId,
          environment.name,
          environment.description ?? null,
          environment.serviceType,
          environment.items ?? [],
        ],
      );
      return result.rows[0] as Environment;
    }

    const [env] = await db
      .insert(environments)
      .values(environment)
      .returning();
    return env;
  }

  /**
   * Retrieves all environments for a specific user
   * Used to show technicians their custom environment list
   * @param userId - ID of the user whose environments to retrieve
   * @returns Array of environments owned by the user
   */
  async getEnvironmentsByUser(userId: number): Promise<Environment[]> {
    return await db
      .select()
      .from(environments)
      .where(eq(environments.userId, userId))
      .orderBy(desc(environments.createdAt));
  }

  /**
   * Retrieves a specific environment by ID
   * @param id - Environment ID to retrieve
   * @returns Environment object if found, undefined otherwise
   */
  async getEnvironment(id: number): Promise<Environment | undefined> {
    const [environment] = await db
      .select()
      .from(environments)
      .where(eq(environments.id, id));
    return environment;
  }

  /**
   * Updates an existing environment
   * @param id - Environment ID to update
   * @param data - Partial environment data to update
   * @returns Updated environment object
   */
  async updateEnvironment(id: number, data: Partial<InsertEnvironment>): Promise<Environment> {
    const [environment] = await db
      .update(environments)
      .set(data)
      .where(eq(environments.id, id))
      .returning();
    return environment;
  }

  /**
   * Updates only user-editable environment metadata.
   * Kept separate from the legacy environment update used by mobile clients.
   */
  async updateEnvironmentDetails(id: number, data: UpdateEnvironmentDetails): Promise<Environment> {
    const [environment] = await db
      .update(environments)
      .set(data)
      .where(eq(environments.id, id))
      .returning();
    return environment;
  }

  /**
   * Deletes an environment
   * @param id - Environment ID to delete
   */
  async deleteEnvironment(id: number): Promise<void> {
    await db
      .delete(environments)
      .where(eq(environments.id, id));
  }

  /**
   * Creates a new custom form type
   * @param formType - Form type data with name and csvData
   * @returns Newly created custom form type object
   */
  async createCustomFormType(formType: InsertCustomFormType): Promise<CustomFormType> {
    console.log('[DEBUG] Creating custom form type:', formType);
    try {
      const [type] = await db
        .insert(customFormTypes)
        .values(formType)
        .returning();
      console.log('[DEBUG] Custom form type created successfully:', type);
      return type;
    } catch (error) {
      console.error('[DEBUG] Error creating custom form type:', error);
      throw error;
    }
  }

  /**
   * Retrieves all custom form types
   * @returns Array of all custom form types
   */
  async getAllCustomFormTypes(): Promise<CustomFormType[]> {
    console.log('[DEBUG] Fetching all custom form types');
    try {
      // Check what tables exist in the connected database
      const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' ORDER BY table_name
      `);
      console.log('[DEBUG] Tables in connected database:', tables.rows.map((r: any) => r.table_name));
      
      const result = await db
        .select()
        .from(customFormTypes)
        .orderBy(desc(customFormTypes.createdAt));
      console.log('[DEBUG] Fetched custom form types:', result);
      return result;
    } catch (error) {
      console.error('[DEBUG] Error fetching custom form types:', error);
      throw error;
    }
  }

  /**
   * Retrieves a specific custom form type by ID
   * @param id - Form type ID to retrieve
   * @returns Custom form type object if found, undefined otherwise
   */
  async getCustomFormType(id: number): Promise<CustomFormType | undefined> {
    const [formType] = await db
      .select()
      .from(customFormTypes)
      .where(eq(customFormTypes.id, id));
    return formType;
  }

  /**
   * Updates an existing custom form type
   * @param id - Form type ID to update
   * @param data - Partial form type data to update
   * @returns Updated custom form type object
   */
  async updateCustomFormType(id: number, data: Partial<InsertCustomFormType>): Promise<CustomFormType> {
    const [formType] = await db
      .update(customFormTypes)
      .set(data)
      .where(eq(customFormTypes.id, id))
      .returning();
    return formType;
  }

  /**
   * Deletes a custom form type
   * @param id - Form type ID to delete
   */
  async deleteCustomFormType(id: number): Promise<void> {
    await db
      .delete(customFormTypes)
      .where(eq(customFormTypes.id, id));
  }

  // Certificate operations

  /**
   * Creates a new certificate of compliance
   * @param certificate - Certificate data to create
   * @returns Newly created certificate object
   */
  async createCertificate(certificate: InsertCertificate, client?: TransactionClient): Promise<Certificate> {
    if (client) {
      const result = await client.query(
        `
          insert into certificates (
            client_name,
            address,
            services,
            validity_dates,
            certification_date,
            technician_name,
            technician_license,
            user_id
          )
          values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
          returning
            id,
            client_name as "clientName",
            address,
            services,
            validity_dates as "validityDates",
            certification_date as "certificationDate",
            technician_name as "technicianName",
            technician_license as "technicianLicense",
            user_id as "userId",
            created_at as "createdAt"
        `,
        [
          certificate.clientName,
          certificate.address,
          JSON.stringify(certificate.services),
          JSON.stringify(certificate.validityDates),
          certificate.certificationDate,
          certificate.technicianName,
          certificate.technicianLicense ?? null,
          certificate.userId,
        ],
      );
      return result.rows[0] as Certificate;
    }

    const [cert] = await db
      .insert(certificates)
      .values(certificate)
      .returning();
    return cert;
  }

  /**
   * Retrieves all certificates created by a specific user
   * @param userId - User ID to filter certificates
   * @returns Array of certificate objects
   */
  async getCertificatesByUser(userId: number): Promise<Certificate[]> {
    return await db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.createdAt));
  }

  /**
   * Retrieves all certificates in the system
   * @returns Array of all certificate objects
   */
  async getAllCertificates(): Promise<Certificate[]> {
    return await db
      .select()
      .from(certificates)
      .orderBy(desc(certificates.createdAt));
  }

  /**
   * Retrieves a specific certificate by ID
   * @param id - Certificate ID to retrieve
   * @returns Certificate object if found, undefined otherwise
   */
  async getCertificateById(id: number): Promise<Certificate | undefined> {
    const [cert] = await db
      .select()
      .from(certificates)
      .where(eq(certificates.id, id));
    return cert;
  }

  /**
   * Updates an existing certificate
   * @param id - Certificate ID to update
   * @param data - Partial certificate data to update
   * @returns Updated certificate object
   */
  async updateCertificate(id: number, data: Partial<InsertCertificate>): Promise<Certificate> {
    // Remove userId from update data to prevent ownership reassignment
    const { userId, ...updateData } = data;
    
    const [cert] = await db
      .update(certificates)
      .set(updateData)
      .where(eq(certificates.id, id))
      .returning();
    return cert;
  }

  /**
   * Deletes a certificate
   * @param id - Certificate ID to delete
   */
  async deleteCertificate(id: number): Promise<void> {
    await db
      .delete(certificates)
      .where(eq(certificates.id, id));
  }
}

export const storage = new DatabaseStorage();
