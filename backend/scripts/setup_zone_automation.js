const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: (process.env.DB_SSL || "true").toLowerCase() !== "false"
    ? { rejectUnauthorized: false }
    : false,
});

async function setupZoneAutomation() {
  console.log("🚀 Setting up zone automation...");

  try {
    // Read and execute the SQL setup file
    const sqlFile = path.join(__dirname, "..", "sql", "01_zone_automation.sql");
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log("📝 Executing zone automation SQL setup...");
    await pool.query(sqlContent);

    console.log("✅ Zone automation setup completed successfully!");

    // Verify setup by checking triggers
    const triggers = await pool.query(`
      SELECT trigger_name, event_manipulation, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_schema = $1
    `, [DB_SCHEMA]);

    console.log("\n🔧 Created triggers:");
    triggers.rows.forEach(trigger => {
      console.log(`  - ${trigger.trigger_name}: ${trigger.event_manipulation} on ${trigger.event_object_table}`);
    });

    // Check unique constraint
    const constraints = await pool.query(`
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = $1 AND constraint_type = 'UNIQUE'
    `, [DB_SCHEMA]);

    console.log("\n🔒 Unique constraints:");
    constraints.rows.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name} on ${constraint.table_name}`);
    });

  } catch (error) {
    console.error("❌ Error setting up zone automation:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the setup
setupZoneAutomation()
  .catch((err) => {
    console.error("Setup failed:", err.message);
    process.exitCode = 1;
  });
