
const express = require("express");
const os = require("os");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 5
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Kubernetes Monitoring API");
});

// Liveness: Is Node.js responsive?
app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    hostname: os.hostname(),
  });
});

// Readiness: Is PostgreSQL reachable?
app.get("/health/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ready",
      database: "connected",
    });
  } catch (err) {
    console.error("Readiness failed:", err.message);

    res.status(503).json({
      status: "not ready",
      database: "unavailable",
    });
  }
});

// Basic application health
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Inspect the responding Pod
app.get("/api/info", (req, res) => {
  res.json({
    message: "Monitoring API is running",
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

// Verify the database connection
app.get("/api/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");

    res.json({
      status: "connected",
      database_time: result.rows[0].time
    });
  } catch (err) {
    console.error("Database connection failed:", err.message);
    res.status(503).json({
      status: "database unavailable"
    });
  }
});

// Retrieve sensor readings
app.get("/api/readings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM sensor_readings ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Query failed:", err.message);
    res.status(503).json({
      error: "Unable to retrieve sensor readings"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
