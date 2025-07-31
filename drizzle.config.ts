import { defineConfig } from "drizzle-kit";

const isDevelopment = process.env.NODE_ENV === "development";

// Robust fallback logic:
const connectionString =
  isDevelopment && process.env.DEV_DATABASE_URL
    ? process.env.DEV_DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No valid database connection string found. Set either DATABASE_URL or DEV_DATABASE_URL depending on your environment."
  );
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
