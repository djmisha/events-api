const rateLimit = require("express-rate-limit");
const logger = require("../services/logger");

/**
 * Rate limiting middleware configuration
 * Protects API endpoints from abuse by limiting requests per IP
 */

// General API rate limiter - 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: "Too many requests",
      message: "You have exceeded the rate limit. Please try again later.",
      retryAfter: "15 minutes",
    });
  },
});

// Strict rate limiter for webhook endpoints - 30 requests per 15 minutes
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    error: "Too many webhook requests",
    message: "Webhook rate limit exceeded. Please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      `Webhook rate limit exceeded for IP: ${req.ip} on ${req.path}`
    );
    res.status(429).json({
      error: "Too many webhook requests",
      message: "Webhook rate limit exceeded. Please try again later.",
      retryAfter: "15 minutes",
    });
  },
});

// Lenient rate limiter for test endpoints (development only) - 200 requests per 15 minutes
const testLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for testing purposes
  message: {
    error: "Too many test requests",
    message: "Test rate limit exceeded. Please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Test rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: "Too many test requests",
      message: "Test rate limit exceeded. Please try again later.",
      retryAfter: "15 minutes",
    });
  },
});

module.exports = {
  apiLimiter,
  webhookLimiter,
  testLimiter,
};
