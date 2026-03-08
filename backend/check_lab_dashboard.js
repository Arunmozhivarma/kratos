const pool = require("./db");
require("dotenv").config();

async function checkLabDashboard() {
  try {
    console.log(" Checking lab_dashboard table...");
    
    const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");
    console.log(`Using schema: ${DB_SCHEMA}`);
    
    // Check table structure
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'lab_dashboard'
      ORDER BY ordinal_position
    `, [DB_SCHEMA]);
    
    console.log("\n lab_dashboard table structure:");
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
    });
    
    // Check existing data
    const data = await pool.query(`
      SELECT lab_id, current_power_watts, energy_today_kwh, active_devices, last_updated
      FROM ${DB_SCHEMA}.lab_dashboard
      ORDER BY lab_id
    `);
    
    console.log(`\n Found ${data.rows.length} lab_dashboard records:`);
    data.rows.forEach(row => {
      console.log(`  Lab ${row.lab_id}: ${row.current_power_watts}W, ${row.energy_today_kwh}kWh, ${row.active_devices} devices, Updated: ${row.last_updated}`);
    });
    
    // Check labs table
    const labs = await pool.query(`
      SELECT lab_id, name, department_id
      FROM ${DB_SCHEMA}.labs
      ORDER BY department_id, name
    `);
    
    console.log(`\n Available labs:`);
    labs.rows.forEach(lab => {
      console.log(`  Lab ${lab.lab_id}: ${lab.name} (Dept ${lab.department_id})`);
    });
    
  } catch (error) {
    console.error(" Error checking lab_dashboard:", error.message);
  } finally {
    await pool.end();
  }
}

checkLabDashboard();
