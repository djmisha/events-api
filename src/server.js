const express = require("express");
const cors = require("cors");
require("dotenv").config();

const eventsRouter = require("./api/events");
const healthRouter = require("./api/health");
const testRouter = require("./api/test");
const webhookRouter = require("./api/webhook");
const logger = require("./services/logger");

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

// API Routes
app.use("/api/v1/events", eventsRouter);
app.use("/api/webhook", webhookRouter);
app.use("/health", healthRouter);

// Test routes (only in development)
if (process.env.NODE_ENV === "development") {
  app.use("/api/test", testRouter);
  // logger.info("Test endpoints enabled at /api/test/*");
}

// Root endpoint
app.get("/", (req, res) => {
  const endpoints = {
    events: "/api/v1/events/:id/:city (e.g., /api/v1/events/123/chicago)",
    health: "/health",
    webhook: "/api/webhook/health",
  };

  // Add test endpoints in development
  if (process.env.NODE_ENV === "development") {
    endpoints.test = {
      edmtrain: "/api/test/edmtrain/71/chicago",
      ticketmaster: "/api/test/ticketmaster/71/chicago",
      combined: "/api/test/combined/71/chicago",
    };
  }

  res.json({
    message: "Events API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    architecture: "serverless-ready",
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

app.listen(PORT, () => {
  logger.info(`Events API server running on port ${PORT}`);
});

module.exports = app;
