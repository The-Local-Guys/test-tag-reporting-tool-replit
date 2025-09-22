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
  franchiseId: integer("franchise_id"), // Links technicians to their franchise admin
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
  serviceType: text("service_type").notNull().default("electrical"), // 'electrical', 'emergency_exit_light', or 'fire_testing'
  testDate: text("test_date").notNull(),
  technicianName: text("technician_name").notNull(),
  clientName: text("client_name").notNull(),
  siteContact: text("site_contact").notNull(),
  address: text("address").notNull(),
  country: text("country").notNull(), // 'australia' or 'newzealand'
  userId: integer("user_id").references(() => users.id), // Link to technician
  // Fire testing specific fields
  technicianLicensed: boolean("technician_licensed"), // Licensing acknowledgment for fire testing
  complianceStandard: text("compliance_standard"), // 'AS_1851_AU' or 'NZS_4503_NZ'
  createdAt: timestamp("created_at").defaultNow(),
});

export const testResults = pgTable("test_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => testSessions.id),
  assetNumber: text("asset_number").notNull(),
  itemName: text("item_name").notNull(),
  itemType: text("item_type").notNull(),
  location: text("location").notNull(),
  classification: text("classification").notNull(), // For electrical: 'class1', 'class2', 'epod', 'rcd' | For emergency: 'emergency_exit_sign', 'emergency_light_downlight', 'combination_unit', 'emergency_spotlight', 'floor_path_light', 'emergency_bulkhead'
  result: text("result").notNull(), // 'pass' or 'fail'
  failureReason: text("failure_reason"), // nullable for passed items
  actionTaken: text("action_taken"), // nullable for passed items
  frequency: text("frequency").notNull(), // For electrical: 'threemonthly', 'sixmonthly', 'twelvemonthly', 'twentyfourmonthly', 'fiveyearly' | For emergency: 'sixmonthly', 'annually'
  notes: text("notes"), // optional additional notes
  photoData: text("photo_data"), // Base64 encoded photo for failed items
  visionInspection: boolean("vision_inspection").default(true), // Vision inspection completed
  electricalTest: boolean("electrical_test").default(true), // Electrical test completed
  // Emergency exit light specific fields (AS/NZS 2293.2:2019)
  maintenanceType: text("maintenance_type"), // 'maintained' or 'non_maintained'
  globeType: text("globe_type"), // 'led' or 'fluorescent'
  dischargeTest: boolean("discharge_test"), // 90-minute discharge test passed

  switchingTest: boolean("switching_test"), // Automatic switching test
  chargingTest: boolean("charging_test"), // Charging circuit test
  manufacturerInfo: text("manufacturer_info"), // Manufacturer and model details
  installationDate: text("installation_date"), // Installation/last replacement date
  // Legacy emergency light fields (deprecated, keeping temporarily to avoid migration conflicts)
  luxTest: boolean("lux_test"), // Legacy lux level test field
  luxReading: text("lux_reading"), // Legacy lux reading field
  luxCompliant: boolean("lux_compliant"), // Legacy lux compliance field
  // Fire testing specific fields (AS 1851 / NZS 4503:2005)
  equipmentType: text("equipment_type"), // 'fire_extinguisher', 'fire_blanket', 'fire_hose_reel'
  size: text("size"), // For extinguishers - e.g., "1.5kg", "4.5kg"
  weight: text("weight"), // Current weight for extinguishers
  testType: text("test_type"), // 'test_1_6monthly', 'test_2_12monthly', 'test_4_replacement'
  // Fire equipment inspection results
  fireVisualInspection: boolean("fire_visual_inspection"), // Physical condition check
  accessibilityCheck: boolean("accessibility_check"), // Clear access verification
  signageCheck: boolean("signage_check"), // Proper signage verification
  operationalTest: boolean("operational_test"), // Equipment operation check
  pressureTest: boolean("pressure_test"), // Pressure gauge check (for extinguishers)
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
export const serviceTypes = ['electrical', 'emergency_exit_light', 'fire_testing'] as const;
export const equipmentClassifications = ['class1', 'class2', 'epod', 'rcd', '3phase'] as const;
export const emergencyClassifications = ['emergency_exit_sign', 'emergency_light_downlight', 'combination_unit', 'emergency_spotlight', 'floor_path_light', 'emergency_bulkhead'] as const;
export const fireEquipmentTypes = ['fire_extinguisher', 'fire_blanket', 'fire_hose_reel'] as const;
export const fireTestTypes = ['test_1_6monthly', 'test_2_12monthly', 'test_4_replacement'] as const;
export const complianceStandards = ['AS_1851_AU', 'NZS_4503_NZ'] as const;
export const testResultValues = ['pass', 'fail'] as const;
export const failureReasons = ['vision', 'earth', 'insulation', 'polarity', 'other'] as const;
export const emergencyFailureReasons = ['physical_damage', 'battery_failure', 'lamp_failure', 'wiring_fault', 'charging_fault', 'insufficient_illumination', 'mounting_issue', 'other'] as const;
export const fireFailureReasons = ['physical_damage', 'pressure_loss', 'corrosion', 'blocked_nozzle', 'damaged_seal', 'expired', 'mounting_issue', 'other'] as const;
export const actionsTaken = ['given', 'removed'] as const;
export const countries = ['australia', 'newzealand'] as const;
export const frequencies = ['threemonthly', 'sixmonthly', 'twelvemonthly', 'twentyfourmonthly', 'fiveyearly'] as const;
export const emergencyFrequencies = ['sixmonthly', 'annually'] as const;
export const fireFrequencies = ['sixmonthly', 'twelvemonthly'] as const;
export const maintenanceTypes = ['maintained', 'non_maintained'] as const;
export const globeTypes = ['led', 'fluorescent'] as const;
export const userRoles = ['super_admin', 'support_center', 'technician'] as const;
