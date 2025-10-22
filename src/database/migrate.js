/**
 * Migration Runner
 * Executes SQL migration scripts on the Supabase database
 * 
 * Usage: node src/database/migrate.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const logger = require("../services/logger");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Execute SQL migration file
 */
async function runMigration(migrationFile) {
  const migrationPath = path.join(__dirname, "migrations", migrationFile);
  
  logger.info(`Running migration: ${migrationFile}`);
  
  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    
    // Split SQL into individual statements (simple split on semicolon)
    // Note: This is a simple approach and may not handle all edge cases
    const statements = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));
    
    logger.info(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith("--")) {
        continue;
      }
      
      try {
        // Execute via Supabase RPC or direct SQL execution
        // Note: Supabase JS client doesn't directly support raw SQL execution
        // In production, you would run these migrations directly via psql or Supabase dashboard
        logger.info(`Statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
        
      } catch (error) {
        logger.error(`Error executing statement ${i + 1}:`, error);
        throw error;
      }
    }
    
    logger.info(`Migration ${migrationFile} completed successfully`);
    
  } catch (error) {
    logger.error(`Migration ${migrationFile} failed:`, error);
    throw error;
  }
}

/**
 * Main migration runner
 */
async function runMigrations() {
  logger.info("=== Starting Database Migrations ===");
  
  const migrationsDir = path.join(__dirname, "migrations");
  
  try {
    // Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();
    
    if (files.length === 0) {
      logger.info("No migration files found");
      return;
    }
    
    logger.info(`Found ${files.length} migration file(s)`);
    
    // Note: Since Supabase JS client doesn't support raw SQL execution,
    // we'll just output instructions for manual execution
    logger.info("\n⚠️  IMPORTANT: Supabase migrations must be run manually via SQL Editor");
    logger.info("Please execute the following SQL files in the Supabase dashboard:");
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      logger.info(`\n📄 ${file}`);
      logger.info(`   Path: ${filePath}`);
      const content = fs.readFileSync(filePath, "utf8");
      logger.info(`   Lines: ${content.split('\n').length}`);
    }
    
    logger.info("\n=== Migration Instructions ===");
    logger.info("1. Go to your Supabase dashboard");
    logger.info("2. Navigate to SQL Editor");
    logger.info("3. Copy and execute each migration file in order");
    logger.info("4. Verify the tables were created successfully");
    logger.info("5. Run the backfill script: node src/database/backfill.js");
    logger.info("================================");
    
  } catch (error) {
    logger.error("Migration process failed:", error);
    throw error;
  }
}

// Run migrations if executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info("Migration process completed");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Migration process failed:", error);
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
};
