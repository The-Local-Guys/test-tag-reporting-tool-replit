import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Will be hashed
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("technician"), // 'super_admin', 'franchise_admin', or 'technician'
  franchiseId: integer("franchise_id").references(() => users.id), // Links technicians to their franchise admin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const testSessions = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  testDate: text("test_date").notNull(),
  technicianName: text("technician_name").notNull(),
  clientName: text("client_name").notNull(),
  siteContact: text("site_contact").notNull(),
  address: text("address").notNull(),
  country: text("country").notNull(), // 'australia' or 'newzealand'
  userId: integer("user_id").references(() => users.id), // Link to technician
  createdAt: timestamp("created_at").defaultNow(),
});

export const testResults = pgTable("test_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => testSessions.id),
  assetNumber: text("asset_number").notNull(),
  itemName: text("item_name").notNull(),
  itemType: text("item_type").notNull(),
  location: text("location").notNull(),
  classification: text("classification").notNull(), // 'class1', 'class2', 'epod', 'rcd'
  result: text("result").notNull(), // 'pass' or 'fail'
  failureReason: text("failure_reason"), // nullable for passed items
  actionTaken: text("action_taken"), // nullable for passed items
  frequency: text("frequency").notNull(), // 'threemonthly', 'sixmonthly', 'twelvemonthly', 'twentyfourmonthly', 'fiveyearly'
  notes: text("notes"), // optional additional notes
  photoData: text("photo_data"), // Base64 encoded photo for failed items
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTestSessionSchema = createInsertSchema(testSessions).omit({
  id: true,
  createdAt: true,
});

export const insertTestResultSchema = createInsertSchema(testResults).omit({
  id: true,
  createdAt: true,
});

// User authentication schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  loginMode: z.enum(['admin', 'testing']).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type TestSession = typeof testSessions.$inferSelect;
export type InsertTestResult = z.infer<typeof insertTestResultSchema>;
export type TestResult = typeof testResults.$inferSelect;

// Define enum values for validation
export const equipmentClassifications = ['class1', 'class2', 'epod', 'rcd', '3phase'] as const;
export const testResultValues = ['pass', 'fail'] as const;
export const failureReasons = ['vision', 'earth', 'insulation', 'polarity', 'other'] as const;
export const actionsTaken = ['given', 'removed'] as const;
export const countries = ['australia', 'newzealand'] as const;
export const frequencies = ['threemonthly', 'sixmonthly', 'twelvemonthly', 'twentyfourmonthly', 'fiveyearly'] as const;
export const userRoles = ['super_admin', 'support_center', 'technician'] as const;
