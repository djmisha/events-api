const supabase = require("../../services/supabaseClient");
const logger = require("../../services/logger");

/**
 * GraphQL Resolvers for Artist Type
 * 
 * These resolvers handle querying artist data from the Supabase database.
 */
const artistResolvers = {
  Query: {
    /**
     * Get a single artist by ID
     * @param {Object} parent - Parent resolver
     * @param {Object} args - Query arguments
     * @param {string} args.id - Artist ID to fetch
     * @param {Object} context - GraphQL context (contains request info)
     * @returns {Promise<Object|null>} Artist object or null if not found
     */
    artist: async (parent, { id }, context) => {
      try {
        logger.info(`GraphQL: Fetching artist with ID: ${id}`);

        const { data, error } = await supabase
          .from("artists")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          logger.error(`GraphQL: Error fetching artist ${id}:`, {
            message: error.message,
            code: error.code,
          });
          
          // Return null if not found (404), throw error for other cases
          if (error.code === "PGRST116") {
            return null;
          }
          
          throw new Error(`Failed to fetch artist: ${error.message}`);
        }

        logger.info(`GraphQL: Successfully fetched artist ${id}`);
        return data;
      } catch (error) {
        logger.error("GraphQL: Artist query error:", error);
        throw error;
      }
    },

    /**
     * Get multiple artists by their IDs
     * @param {Object} parent - Parent resolver
     * @param {Object} args - Query arguments
     * @param {Array<string>} args.ids - Array of artist IDs to fetch
     * @param {Object} context - GraphQL context (contains request info)
     * @returns {Promise<Array<Object>>} Array of artist objects
     */
    artists: async (parent, { ids }, context) => {
      try {
        logger.info(`GraphQL: Fetching ${ids.length} artists`);

        const { data, error } = await supabase
          .from("artists")
          .select("*")
          .in("id", ids);

        if (error) {
          logger.error(`GraphQL: Error fetching artists:`, {
            message: error.message,
            code: error.code,
          });
          throw new Error(`Failed to fetch artists: ${error.message}`);
        }

        logger.info(`GraphQL: Successfully fetched ${data.length} artists`);
        return data || [];
      } catch (error) {
        logger.error("GraphQL: Artists query error:", error);
        throw error;
      }
    },
  },
};

module.exports = artistResolvers;
