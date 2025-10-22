import express from "express";

const router = express.Router();

// TODO: Convert from test.js
router.get("/edmtrain/:id/:city", (req, res) => {
  res.json({ message: "Test endpoint - to be converted" });
});

export default router;
