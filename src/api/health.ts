import express, { Request, Response } from "express";
import supabase from "../services/supabaseClient";
import logger from "../services/logger";

const router = express.Router();

interface HealthCheck {
  status: "OK" | "DEGRADED" | "ERROR";
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    database?: "OK" | "ERROR";
  };
}

router.get("/", async (req: Request, res: Response) => {
  const healthCheck: HealthCheck = {
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

export default router;
