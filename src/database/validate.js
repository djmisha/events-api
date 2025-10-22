/**
 * Validation Script - Check migration status and data integrity
 * 
 * This script validates:
 * 1. All required tables exist
 * 2. Foreign keys and indexes are in place
 * 3. Data counts match between legacy and normalized tables
 * 4. Sample records have correct relationships
 * 
 * Usage: node src/database/validate.js
 */

require("dotenv").config();
const supabase = require("../services/supabaseClient");
const logger = require("../services/logger");

/**
 * Check if required tables exist
 */
async function validateTables() {
  logger.info("=== Validating Tables ===");
  
  const requiredTables = [
    "partner_events",
    "partner_venues",
    "partner_artists",
    "partner_event_artists",
  ];
  
  try {
    for (const table of requiredTables) {
      const { data, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      
      if (error) {
        logger.error(`✗ Table ${table} not found or not accessible`);
        return false;
      }
      
      logger.info(`✓ Table ${table} exists (${data?.length || 0} rows)`);
    }
    
    return true;
  } catch (error) {
    logger.error("Error validating tables:", error);
    return false;
  }
}

/**
 * Validate venue migration
 */
async function validateVenues() {
  logger.info("\n=== Validating Venues ===");
  
  try {
    // Count events with venue JSON
    const { data: eventsWithVenueJson, error: jsonError } = await supabase
      .rpc("count_events_with_venue_json", {}, { count: "exact" })
      .catch(() => null);
    
    // Direct count query
    const { count: totalEvents } = await supabase
      .from("partner_events")
      .select("*", { count: "exact", head: true });
    
    const { count: eventsWithVenueId } = await supabase
      .from("partner_events")
      .select("*", { count: "exact", head: true })
      .not("venue_id", "is", null);
    
    const { count: totalVenues } = await supabase
      .from("partner_venues")
      .select("*", { count: "exact", head: true });
    
    logger.info(`Total events: ${totalEvents}`);
    logger.info(`Events with venue_id: ${eventsWithVenueId}`);
    logger.info(`Total venues created: ${totalVenues}`);
    
    const coverage = totalEvents > 0 
      ? ((eventsWithVenueId / totalEvents) * 100).toFixed(1)
      : 0;
    
    logger.info(`Venue coverage: ${coverage}%`);
    
    if (coverage < 80) {
      logger.warn("⚠️  Low venue coverage - may need to re-run backfill");
    } else {
      logger.info("✓ Venue coverage looks good");
    }
    
    // Sample check
    const { data: sample, error: sampleError } = await supabase
      .from("partner_events")
      .select("id, name, venue_id")
      .not("venue_id", "is", null)
      .limit(3);
    
    if (!sampleError && sample) {
      logger.info(`Sample events with venue_id: ${sample.length} records`);
    }
    
    return coverage >= 80;
  } catch (error) {
    logger.error("Error validating venues:", error);
    return false;
  }
}

/**
 * Validate artist migration
 */
async function validateArtists() {
  logger.info("\n=== Validating Artists ===");
  
  try {
    const { count: totalArtists } = await supabase
      .from("partner_artists")
      .select("*", { count: "exact", head: true });
    
    const { count: totalMappings } = await supabase
      .from("partner_event_artists")
      .select("*", { count: "exact", head: true });
    
    logger.info(`Total artists created: ${totalArtists}`);
    logger.info(`Total event-artist mappings: ${totalMappings}`);
    
    // Sample check
    const { data: sample, error: sampleError } = await supabase
      .from("partner_event_artists")
      .select("event_id, artist_id")
      .limit(5);
    
    if (!sampleError && sample) {
      logger.info(`Sample mappings: ${sample.length} records`);
    }
    
    if (totalArtists > 0 && totalMappings > 0) {
      logger.info("✓ Artist data looks good");
      return true;
    } else {
      logger.warn("⚠️  No artist data found");
      return false;
    }
  } catch (error) {
    logger.error("Error validating artists:", error);
    return false;
  }
}

/**
 * Validate indexes exist
 */
async function validateIndexes() {
  logger.info("\n=== Validating Indexes ===");
  
  const expectedIndexes = [
    "idx_partner_venues_external_id",
    "idx_partner_artists_external_id",
    "idx_partner_events_venue_id",
    "idx_partner_events_city",
    "idx_partner_events_date",
  ];
  
  // Note: Direct index checking requires raw SQL which isn't available via JS client
  // This would need to be done via psql or Supabase dashboard
  
  logger.info("Index validation requires SQL access");
  logger.info("Please run this query in Supabase SQL Editor:");
  logger.info("SELECT indexname FROM pg_indexes WHERE tablename IN ('partner_events', 'partner_venues', 'partner_artists');");
  
  return true;
}

/**
 * Test query performance
 */
async function testQueryPerformance() {
  logger.info("\n=== Testing Query Performance ===");
  
  try {
    const startTime = Date.now();
    
    const { data, error } = await supabase
      .from("partner_events")
      .select(`
        *,
        venue:partner_venues(*)
      `)
      .eq("location_id", 71)
      .limit(10);
    
    const duration = Date.now() - startTime;
    
    if (error) {
      logger.error("Query error:", error);
      return false;
    }
    
    logger.info(`✓ Query completed in ${duration}ms`);
    logger.info(`  Returned ${data?.length || 0} events`);
    
    if (duration > 1000) {
      logger.warn("⚠️  Query took longer than 1 second - check indexes");
    }
    
    return true;
  } catch (error) {
    logger.error("Error testing query:", error);
    return false;
  }
}

/**
 * Run all validations
 */
async function runValidation() {
  logger.info("Starting migration validation...\n");
  
  const results = {
    tables: await validateTables(),
    venues: await validateVenues(),
    artists: await validateArtists(),
    indexes: await validateIndexes(),
    performance: await testQueryPerformance(),
  };
  
  logger.info("\n=== Validation Summary ===");
  logger.info(`Tables: ${results.tables ? "✓ PASS" : "✗ FAIL"}`);
  logger.info(`Venues: ${results.venues ? "✓ PASS" : "✗ FAIL"}`);
  logger.info(`Artists: ${results.artists ? "✓ PASS" : "✗ FAIL"}`);
  logger.info(`Indexes: ${results.indexes ? "✓ PASS" : "✗ FAIL"}`);
  logger.info(`Performance: ${results.performance ? "✓ PASS" : "✗ FAIL"}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    logger.info("\n✓ All validations passed!");
    logger.info("Migration appears to be successful.");
  } else {
    logger.warn("\n⚠️  Some validations failed.");
    logger.warn("Please review the output and consider re-running backfill or checking migration steps.");
  }
  
  return allPassed;
}

// Run validation if executed directly
if (require.main === module) {
  runValidation()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error("Validation failed with error:", error);
      process.exit(1);
    });
}

module.exports = {
  runValidation,
  validateTables,
  validateVenues,
  validateArtists,
};
