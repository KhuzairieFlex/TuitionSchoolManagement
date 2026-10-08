"use strict";

require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in your environment before running this check.");
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query("SELECT NOW() AS database_time")
    .then(({ rows }) => console.log(`Connected to Neon at ${rows[0].database_time}`))
    .catch((error) => {
      console.error("Database readiness check failed:", error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
