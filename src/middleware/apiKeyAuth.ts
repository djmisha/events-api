import { Request, Response, NextFunction } from "express";
import logger from "../services/logger";

/**
 * Simple API Key authentication middleware
 * Checks for API key in header, query parameter, or bearer token
 */
const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Extract API key from multiple sources
    const apiKey =
      (req.headers["x-api-key"] as string) ||
      (req.query.api_key as string) ||
      (req.headers.authorization as string)?.replace("Bearer ", "");

    // Get valid API keys from environment (comma-separated)
    const validApiKeys =
      process.env.API_KEYS?.split(",").map((key) => key.trim()) || [];

    if (!apiKey) {
      logger.warn(`Unauthorized request to ${req.path} from ${req.ip}`);

      res.status(401).json({
        error: "Authentication required",
        message:
          "API key is required. Provide via 'x-api-key' header, 'api_key' query parameter, or Bearer token.",
        examples: {
          header: "x-api-key: YOUR_API_KEY",
          query: "?api_key=YOUR_API_KEY",
          bearer: "Authorization: Bearer YOUR_API_KEY",
        },
      });
      return;
    }

    if (!validApiKeys.includes(apiKey)) {
      logger.warn(`Invalid API key for ${req.path} from ${req.ip}`);

      res.status(403).json({
        error: "Invalid API key",
        message: "The provided API key is not valid.",
      });
      return;
    }

    // Continue to next middleware
    next();
  } catch (error) {
    logger.error("API key authentication error:", error);
    res.status(500).json({
      error: "Authentication error",
      message: "An error occurred during authentication",
    });
  }
};

export default apiKeyAuth;
