const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const artistTypeDefs = require("./schemas/artist");
const artistResolvers = require("./resolvers/artist");
const logger = require("../services/logger");

/**
 * GraphQL Server Configuration
 * 
 * This module sets up the Apollo Server with all schemas and resolvers.
 * It integrates with the Express.js application.
 */

/**
 * Create and configure the Apollo Server instance
 * @returns {ApolloServer} Configured Apollo Server instance
 */
async function createGraphQLServer() {
  const server = new ApolloServer({
    typeDefs: [artistTypeDefs],
    resolvers: [artistResolvers],
    formatError: (error) => {
      // Log all GraphQL errors
      logger.error("GraphQL Error:", {
        message: error.message,
        path: error.path,
        extensions: error.extensions,
      });
      
      return error;
    },
    introspection: process.env.NODE_ENV === "development",
    plugins: [
      {
        async serverWillStart() {
          logger.info("GraphQL server starting...");
        },
        async requestDidStart() {
          return {
            async didEncounterErrors(ctx) {
              logger.error("GraphQL request errors:", ctx.errors);
            },
          };
        },
      },
    ],
  });

  await server.start();
  logger.info("GraphQL server started successfully");
  
  return server;
}

/**
 * Get Express middleware for GraphQL
 * Requires authentication via API key
 * @param {ApolloServer} server - Apollo Server instance
 * @returns {Function} Express middleware function
 */
function getGraphQLMiddleware(server) {
  return expressMiddleware(server, {
    context: async ({ req }) => {
      // Pass request context to resolvers
      return {
        req,
        // API key was already validated by the apiKeyAuth middleware
        authenticated: true,
      };
    },
  });
}

module.exports = {
  createGraphQLServer,
  getGraphQLMiddleware,
};
