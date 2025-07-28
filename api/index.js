// !TODO - SEE IF YOU CAN IMPORT server from src/server.js HERE

// Vercel serverless function - Express app definition
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Use absolute paths for imports
const eventsRouter = require(path.join(__dirname, "../src/api/events"));
const healthRouter = require(path.join(__dirname, "../src/api/health"));
const testRouter = require(path.join(__dirname, "../src/api/test"));
const webhookRouter = require(path.join(__dirname, "../src/api/webhook"));
const logger = require(path.join(__dirname, "../src/services/logger"));
const apiKeyAuth = require(path.join(
  __dirname,
  "../src/middleware/apiKeyAuth"
));

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Protected API Routes (require API key)
app.use("/api/v1/events", apiKeyAuth, eventsRouter);

// Webhook routes (use their own WEBHOOK_SECRET authentication)
app.use("/api/webhook", webhookRouter);

// Public routes (no API key required)
app.use("/health", healthRouter);

// Test routes (only in development, no API key for easier testing)
if (process.env.NODE_ENV === "development") {
  app.use("/api/test", testRouter);
}

// Root endpoint
app.get("/", (req, res) => {
  res.status(404).send("Not Found");
  // const endpoints = {
  //   events: {
  //     path: "/api/v1/events/:id/:city",
  //     authentication: "API Key required",
  //     example: "/api/v1/events/71/chicago",
  //   },
  //   webhook: {
  //     path: "/api/webhook/fetch-data",
  //     authentication: "WEBHOOK_SECRET required",
  //     method: "POST",
  //     note: "For background processing only",
  //   },
  //   health: {
  //     path: "/health",
  //     authentication: "None (public)",
  //   },
  // };

  // // Add test endpoints in development
  // if (process.env.NODE_ENV === "development") {
  //   endpoints.test = {
  //     path: "/api/test/*",
  //     authentication: "None (development only)",
  //     examples: [
  //       "/api/test/edmtrain/71/chicago",
  //       "/api/test/ticketmaster/71/chicago",
  //       "/api/test/combined/71/chicago",
  //     ],
  //   };
  // }

  // const authMethods = {
  //   apiKey: [
  //     "Header: x-api-key: YOUR_API_KEY",
  //     "Query param: ?api_key=YOUR_API_KEY",
  //     "Bearer token: Authorization: Bearer YOUR_API_KEY",
  //   ],
  //   webhook: ["Header: Authorization: Bearer YOUR_WEBHOOK_SECRET"],
  // };

  // res.json({
  //   message: "Events API with Authentication",
  //   version: "1.0.0",
  //   environment: process.env.NODE_ENV || "development",
  //   architecture: "serverless-ready",
  //   caching: "Supabase cache_control table (6 hour TTL)",
  //   endpoints,
  //   authentication: authMethods,
  // });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Export as serverless function handler
module.exports = app;
