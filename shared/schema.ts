import { pgTable, text, serial, integer, boolean, timestamp, varchar, jsonb, index, numeric, uuid, uniqueIndex } from "drizzle-orm/pg-core";
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
  lastAppVersion: varchar("last_app_version", { length: 20 }), // e.g. "1.0.3"
  lastAppPlatform: varchar("last_app_platform", { length: 10 }), // 'ios' | 'android'
  lastSeenAt: timestamp("last_seen_at"), // last time a mobile request was received
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

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id").notNull().references(() => users.id),
    method: text("method").notNull(),
    endpoint: text("endpoint").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    resourceType: text("resource_type"),
    resourceId: integer("resource_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_user_method_endpoint_key_idx").on(
      table.userId,
      table.method,
      table.endpoint,
      table.key,
    ),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ],
);

export const testSessions = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull().default("electrical"), // 'electrical', 'emergency_exit_light', 'fire_testing', 'rcd_reporting', or 'microwave_leakage'
  testDate: text("test_date").notNull(),
  technicianName: text("technician_name").notNull(),
  clientName: text("client_name").notNull(),
  siteContact: text("site_contact").notNull(),
  address: text("address").notNull(),
  country: text("country").notNull(), // 'australia', 'newzealand', or 'national_client'
  userId: integer("user_id").references(() => users.id), // Link to technician
  startingAssetNumber: integer("starting_asset_number"), // Starting asset number for the session
  // Fire testing specific fields
  technicianLicensed: boolean("technician_licensed"), // Licensing acknowledgment for fire testing
  complianceStandard: text("compliance_standard"), // 'AS_1851_AU' or 'NZS_4503_NZ'
  // Database-first architecture fields
  status: text("status").notNull().default("draft"), // 'draft' or 'finalized'
  customStartingNumbers: jsonb("custom_starting_numbers"), // JSON object with custom asset number ranges per frequency
  lastActivityAt: timestamp("last_activity_at").defaultNow(), // Track last modification for multi-day jobs
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete - null means active, timestamp means deleted
  deletedBy: integer("deleted_by").references(() => users.id), // User who performed the soft delete
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
  frequency: text("frequency").notNull(), // For electrical: 'threemonthly', 'sixmonthly', 'twelvemonthly', 'twentyfourmonthly', 'fiveyearly', 'customfrequency' | For emergency: 'sixmonthly', 'annually'
  expiryDate: text("expiry_date"), // Explicit expiry/due date (ISO) when frequency is 'customfrequency'
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
  equipmentType: text("equipment_type"), // 'fire_extinguisher', 'fire_blanket', 'fire_hose_reel', 'fire_hydrant'
  extinguisherType: text("extinguisher_type"), // 'dry_powder', 'water', 'co2', 'wet_chemical', 'foam', 'vaporising_liquid'
  size: text("size"), // For extinguishers - e.g., "1.5kg", "4.5kg"
  weight: text("weight"), // Current weight for extinguishers
  testType: text("test_type"), // 'test_1_6monthly', 'test_2_12monthly', 'test_4_replacement'
  // Fire equipment inspection results
  fireVisualInspection: boolean("fire_visual_inspection"), // Physical condition check
  accessibilityCheck: boolean("accessibility_check"), // Clear access verification
  signageCheck: boolean("signage_check"), // Proper signage verification
  operationalTest: boolean("operational_test"), // Equipment operation check
  pressureTest: boolean("pressure_test"), // Pressure gauge check (for extinguishers)
  // RCD testing specific fields
  pushButtonTest: boolean("push_button_test"), // Push button test completed
  injectionTimedTest: boolean("injection_timed_test"), // Injection/Timed test completed
  tripTimes: numeric("trip_times").array(), // Array of trip times in milliseconds for timed test (for Fixed RCD, up to 3 values)
  distributionBoardNumber: text("distribution_board_number"), // Distribution board number for Fixed RCD
  circuitBreakerNumber: text("circuit_breaker_number"), // Circuit breaker number for Fixed RCD
  // Microwave leakage testing specific fields
  leakageReading: text("leakage_reading"), // Microwave radiation leakage reading
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete - null means active, timestamp means deleted
  deletedBy: integer("deleted_by").references(() => users.id), // User who performed the soft delete
});

// Environments table for custom item sets per technician
export const environments = pgTable("environments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  serviceType: text("service_type").notNull(), // 'electrical', 'emergency_exit_light', 'fire_testing', or 'microwave_leakage'
  items: jsonb("items").notNull().default('[]'), // Array of item objects
  createdAt: timestamp("created_at").defaultNow(),
});

// Custom form types table for admin-created dynamic forms
export const customFormTypes = pgTable("custom_form_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // Display name in setup page
  csvData: text("csv_data").notNull(), // CSV data containing code,itemName pairs
  createdAt: timestamp("created_at").defaultNow(),
});

// Certificates of Compliance table
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  address: text("address").notNull(),
  services: jsonb("services").notNull(), // Array of service type strings: ['electrical', 'rcd_reporting', etc.]
  validityDates: jsonb("validity_dates").notNull(), // Object mapping service types to validity dates: {electrical: '2024-12-31', rcd_reporting: '2024-06-30'}
  certificationDate: text("certification_date").notNull(),
  technicianName: text("technician_name").notNull(),
  technicianLicense: text("technician_license"),
  notes: text("notes"), // optional general note shown on the certificate PDF
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * Maximum length for the site address on a test session.
 *
 * The address prints in the report header, where it is wrapped to 90mm and every
 * wrapped line pushes the technician line, the summary and the results table 5mm
 * further down. Nothing in the header checks for a page break, so an unbounded
 * address runs straight through the letterhead footer and off the page. At 10pt
 * a 90mm line holds roughly 45 characters, so 250 characters wraps to at most
 * 6 lines (~30mm) and leaves the header intact.
 */
export const MAX_SESSION_ADDRESS_LENGTH = 250;

export const insertTestSessionSchema = createInsertSchema(testSessions)
  .omit({
    id: true,
    createdAt: true,
    deletedAt: true,
    deletedBy: true,
    lastActivityAt: true, // Auto-set by database
  })
  .extend({
    address: z
      .string()
      .max(
        MAX_SESSION_ADDRESS_LENGTH,
        `Address must be ${MAX_SESSION_ADDRESS_LENGTH} characters or less`,
      ),
  });

/**
 * Maximum length for per-item notes/comments.
 *
 * These render into fixed-width columns of the PDF report table, where the row
 * height is derived from the wrapped line count. An unbounded comment produces a
 * row taller than the page, which overflows the letterhead footer and pushes every
 * following row off the document. A fresh page fits 46 such lines; 250 characters
 * keeps even the narrowest column (RCD comments, 17mm at 6pt) to 19 lines, and
 * matches the existing certificate notes limit.
 */
export const MAX_TEST_RESULT_NOTES_LENGTH = 250;

/**
 * Trim a free-text note to the supported length.
 * Truncates rather than rejects: the batch-submit path posts a whole job at once,
 * so a hard failure would cost a technician every result in the batch.
 */
export function clampTestResultNotes(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Drop any legacy [TRIP_TIMES:[...]] marker first so truncation can never cut one in half
  const trimmed = value.replace(/\s*\[TRIP_TIMES:\[[^\]]*\]\]/g, '').trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_TEST_RESULT_NOTES_LENGTH
    ? trimmed.slice(0, MAX_TEST_RESULT_NOTES_LENGTH)
    : trimmed;
}

export const insertTestResultSchema = createInsertSchema(testResults)
  .omit({
    id: true,
    createdAt: true,
    deletedAt: true,
    deletedBy: true,
  })
  .extend({
    notes: z.string().trim().max(MAX_TEST_RESULT_NOTES_LENGTH).nullable().optional(),
  });

export const insertEnvironmentSchema = createInsertSchema(environments).omit({
  id: true,
  createdAt: true,
});

export const updateEnvironmentDetailsSchema = z.object({
  name: z.string().trim().min(1, "Environment name is required").max(120),
  description: z.string().trim().max(500).nullable().optional(),
}).strict();

export const insertCustomFormTypeSchema = createInsertSchema(customFormTypes).omit({
  id: true,
  createdAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    notes: z.string().trim().max(250).nullable().optional(),
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
export type InsertEnvironment = z.infer<typeof insertEnvironmentSchema>;
export type Environment = typeof environments.$inferSelect;
export type UpdateEnvironmentDetails = z.infer<typeof updateEnvironmentDetailsSchema>;
export type InsertCustomFormType = z.infer<typeof insertCustomFormTypeSchema>;
export type CustomFormType = typeof customFormTypes.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificates.$inferSelect;

// Define enum values for validation
export const serviceTypes = ['electrical', 'emergency_exit_light', 'fire_testing', 'rcd_reporting', 'microwave_leakage'] as const;
export const equipmentClassifications = ['class1', 'class2', 'epod', 'rcd', '3phase'] as const;
export const emergencyClassifications = ['emergency_exit_sign', 'emergency_light_downlight', 'combination_unit', 'emergency_spotlight', 'floor_path_light', 'emergency_bulkhead'] as const;
export const fireEquipmentTypes = ['fire_extinguisher', 'fire_blanket', 'fire_hose_reel', 'fire_hydrant'] as const;
export const fireTestTypes = ['test_1_6monthly', 'test_2_12monthly', 'test_4_replacement'] as const;
export const complianceStandards = ['AS_1851_AU', 'NZS_4503_NZ'] as const;
export const testResultValues = ['pass', 'fail'] as const;
export const failureReasons = ['vision', 'earth', 'insulation', 'polarity', 'other'] as const;
export const emergencyFailureReasons = ['physical_damage', 'battery_failure', 'lamp_failure', 'wiring_fault', 'charging_fault', 'insufficient_illumination', 'mounting_issue', 'other'] as const;
export const fireFailureReasons = ['physical_damage', 'pressure_loss', 'corrosion', 'blocked_nozzle', 'damaged_seal', 'expired', 'mounting_issue', 'other'] as const;
export const rcdFailureReasons = ['push_button', 'injection_timed', 'tripping_time', 'no_trip', 'visual', 'other'] as const;
export const actionsTaken = ['given', 'removed'] as const;
export const countries = ['australia', 'newzealand', 'national_client'] as const;
export const frequencies = ['threemonthly', 'sixmonthly', 'twelvemonthly', 'twentyfourmonthly', 'fiveyearly'] as const;
export const emergencyFrequencies = ['sixmonthly', 'annually'] as const;
export const fireFrequencies = ['sixmonthly', 'twelvemonthly'] as const;
export const maintenanceTypes = ['maintained', 'non_maintained'] as const;
export const globeTypes = ['led', 'fluorescent'] as const;
export const userRoles = ['super_admin', 'support_center', 'technician'] as const;
