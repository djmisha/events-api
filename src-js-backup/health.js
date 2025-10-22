const express = require("express");
const supabase = require("../services/supabaseClient");
const logger = require("../services/logger");

const router = express.Router();

router.get("/", async (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {},
  };

  try {
    // Check Supabase connection
    const { error } = await supabase
      .from("partner_events")
      .select("count")
      .limit(1);
    healthCheck.services.database = error ? "ERROR" : "OK";
    if (error) {
      healthCheck.status = "DEGRADED";
      logger.error("Database health check failed:", error);
    }
  } catch (error) {
    healthCheck.services.database = "ERROR";
    healthCheck.status = "DEGRADED";
    logger.error("Database health check failed:", error);
  }

  const statusCode = healthCheck.status === "OK" ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

module.exports = router;
