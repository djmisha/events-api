const express = require("express");
const cors = require("cors");
require("dotenv").config();

const eventsRouter = require("./api/events");
const healthRouter = require("./api/health");
const testRouter = require("./api/test");
const webhookRouter = require("./api/webhook");
const logger = require("./services/logger");
const apiKeyAuth = require("./middleware/apiKeyAuth");

const app = express();
const PORT = process.env.PORT || 8000;

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
app.use("/api/webhook", apiKeyAuth, webhookRouter);

// Public routes (no API key required)
app.use("/health", healthRouter);

// Test routes (only in development, no API key for easier testing)
if (process.env.NODE_ENV === "development") {
  app.use("/api/test", testRouter);
  // logger.info("Test endpoints enabled at /api/test/*");
}

// Root endpoint
app.get("/", (req, res) => {
  const endpoints = {
    events: "/api/v1/events/:id/:city (Requires API key)",
    health: "/health (Public)",
    webhook: "/api/webhook/* (Requires API key)",
  };

  // Add test endpoints in development
  if (process.env.NODE_ENV === "development") {
    endpoints.test = {
      edmtrain: "/api/test/edmtrain/71/chicago (Development only, no API key)",
      ticketmaster:
        "/api/test/ticketmaster/71/chicago (Development only, no API key)",
      combined: "/api/test/combined/71/chicago (Development only, no API key)",
    };
  }

  res.json({
    message: "Events API with API Key Authentication",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    architecture: "serverless-ready",
    authentication: {
      required: ["events", "webhook"],
      methods: [
        "Header: x-api-key: YOUR_API_KEY",
        "Query param: ?api_key=YOUR_API_KEY",
        "Bearer token: Authorization: Bearer YOUR_API_KEY",
      ],
    },
    endpoints,
  });
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

// Only start the server in development or when running standalone (not serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Events API server running on port ${PORT}`);
  });
}

// Export the app for Vercel
module.exports = app;
