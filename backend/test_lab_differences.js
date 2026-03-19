// Test to verify different labs show different data
const pool = require("./db");
require("dotenv").config();

async function testLabDifferences() {
  try {
    console.log("Testing lab differences...");

    const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

    // Test dashboard data for different labs
    const labs = [1, 2, 4, 7]; // Test a few different labs

    for (const labId of labs) {
      console.log(`\nLab ${labId}:`);

      // Dashboard data
      const dashboardResult = await pool.query(`
        SELECT
          l.lab_id,
          l.name AS lab_name,
          COALESCE(d.current_power_watts, 0) AS current_power_watts,
          COALESCE(d.energy_today_kwh, 0) AS energy_today_kwh,
          COALESCE(d.active_devices, 0) AS active_devices,
          d.last_updated
        FROM ${DB_SCHEMA}.labs l
        LEFT JOIN ${DB_SCHEMA}.lab_dashboard d ON l.lab_id = d.lab_id
        WHERE l.lab_id = $1
        LIMIT 1
      `, [labId]);

      if (dashboardResult.rows.length > 0) {
        const data = dashboardResult.rows[0];
        console.log(`  Dashboard: ${data.current_power_watts}W, ${data.energy_today_kwh}kWh, ${data.active_devices} devices`);
      }

      // Energy consumption data (latest 3 days)
      const energyResult = await pool.query(`
        SELECT date, SUM(energy_kwh) as daily_total
        FROM ${DB_SCHEMA}.energy_consumption
        WHERE lab_id = $1 
          AND date >= CURRENT_DATE - INTERVAL '3 days'
        GROUP BY date
        ORDER BY date DESC
        LIMIT 3
      `, [labId]);

      console.log(`  Energy (last 3 days):`);
      energyResult.rows.forEach(row => {
        console.log(`    ${row.date}: ${row.daily_total} kWh`);
      });
    }

    console.log("\nLab differences test completed!");
    console.log("Each lab should show different dashboard and energy values.");

  } catch (error) {
    console.error("Test failed:", error.message);
  } finally {
    await pool.end();
  }
}

testLabDifferences();
