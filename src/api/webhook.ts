import express from "express";

const router = express.Router();

// TODO: Convert from webhook.js
router.post("/fetch-partner-data", (req, res) => {
  res.json({ message: "Webhook endpoint - to be converted" });
});

export default router;
