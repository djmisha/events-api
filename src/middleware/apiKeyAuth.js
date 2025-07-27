const logger = require("../services/logger");

/**
 * Simple API Key authentication middleware
 * Checks for API key in header, query parameter, or bearer token
 */
const apiKeyAuth = (req, res, next) => {
  try {
    // Extract API key from multiple sources
    const apiKey =
      req.headers["x-api-key"] ||
      req.query.api_key ||
      req.headers.authorization?.replace("Bearer ", "");

    // Get valid API keys from environment (comma-separated)
    const validApiKeys =
      process.env.API_KEYS?.split(",").map((key) => key.trim()) || [];

    if (!apiKey) {
      logger.warn("API request without key", {
        ip: req.ip,
        path: req.path,
        userAgent: req.get("User-Agent"),
      });

      return res.status(401).json({
        error: "Authentication required",
        message:
          "API key is required. Provide via 'x-api-key' header, 'api_key' query parameter, or Bearer token.",
        examples: {
          header: "x-api-key: YOUR_API_KEY",
          query: "?api_key=YOUR_API_KEY",
          bearer: "Authorization: Bearer YOUR_API_KEY",
        },
      });
    }

    if (!validApiKeys.includes(apiKey)) {
      logger.warn("Invalid API key attempt", {
        ip: req.ip,
        path: req.path,
        apiKey: apiKey.substring(0, 8) + "...",
        userAgent: req.get("User-Agent"),
      });

      return res.status(403).json({
        error: "Invalid API key",
        message: "The provided API key is not valid.",
      });
    }

    // Log successful authentication
    logger.info("API request authenticated", {
      path: req.path,
      method: req.method,
      apiKey: apiKey.substring(0, 8) + "...",
    });

    // Continue to next middleware
    next();
  } catch (error) {
    logger.error("API key authentication error:", error);
    return res.status(500).json({
      error: "Authentication error",
      message: "An error occurred during authentication",
    });
  }
};

module.exports = apiKeyAuth;
