const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../sql/03_device_snapshot_energy_tracking.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');
    // Replace hardcoded "public." with "kratos."
    sql = sql.replace(/public\./g, 'kratos.');
    sql = sql.replace(/table_schema = 'public'/g, "table_schema = 'kratos'");
    
    console.log("Running migration on kratos schema...");
    await pool.query(sql);
    console.log("Migration successful!");
  } catch(e) {
    console.error("Migration failed:", e);
  } finally {
    pool.end();
  }
}

run();
