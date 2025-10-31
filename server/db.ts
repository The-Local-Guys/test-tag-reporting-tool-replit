import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Use development database in development mode, production database otherwise
const isDevelopment = process.env.NODE_ENV === 'development';
const databaseUrl = isDevelopment && process.env.DEV_DATABASE_URL ? process.env.DEV_DATABASE_URL : process.env.DATABASE_URL;

if (!databaseUrl) {
  const requiredVar = isDevelopment ? 'DEV_DATABASE_URL' : 'DATABASE_URL';
  throw new Error(
    `${requiredVar} must be set. Did you forget to provision a database?`,
  );
}

console.log(`Using ${isDevelopment ? 'development' : 'production'} database`);

// Configure pool with lower limits for Neon database
export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 3, // Reduce max connections to avoid overwhelming Neon
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000 // Timeout after 10 seconds
});
export const db = drizzle({ client: pool, schema });