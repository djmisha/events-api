// Vercel serverless function - Express app definition
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const eventsRouter = require("../src/api/events");
const healthRouter = require("../src/api/health");
const testRouter = require("../src/api/test");
const webhookRouter = require("../src/api/webhook");
const logger = require("../src/services/logger");

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

// API Routes
app.use("/api/v1/events", eventsRouter);
app.use("/api/webhook", webhookRouter);
app.use("/health", healthRouter);

// Test routes (only in development)
if (process.env.NODE_ENV === "development") {
  app.use("/api/test", testRouter);
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

module.exports = app;
