// Test the complete dashboard flow
const pool = require("./db");
require("dotenv").config();

async function testDashboardFlow() {
  try {
    console.log("Testing complete dashboard flow...");

    const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

    // Test 1: Get labs for department 9
    console.log("\n1. Testing labs API for department 9...");
    const labsResult = await pool.query(`
      SELECT lab_id, name
      FROM ${DB_SCHEMA}.labs
      WHERE department_id = 9 AND is_active = true
      ORDER BY name
    `);

    console.log(`Found ${labsResult.rows.length} labs:`);
    labsResult.rows.forEach(lab => {
      console.log(`  Lab ${lab.lab_id}: ${lab.name}`);
    });

    // Test 2: Get dashboard data for each lab
    console.log("\n2. Testing dashboard data for each lab...");
    for (const lab of labsResult.rows) {
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
      `, [lab.lab_id]);

      if (dashboardResult.rows.length > 0) {
        const data = dashboardResult.rows[0];
        console.log(`  Lab ${data.lab_id} (${data.lab_name}):`);
        console.log(`    Power: ${data.current_power_watts}W`);
        console.log(`    Energy: ${data.energy_today_kwh}kWh`);
        console.log(`    Devices: ${data.active_devices}`);
        console.log(`    Updated: ${data.last_updated || 'Never'}`);
      } else {
        console.log(`  Lab ${lab.lab_id}: No dashboard data found`);
      }
    }

    // Test 3: Show comparison
    console.log("\n3. Comparison of different labs:");
    const sampleLabs = labsResult.rows.slice(0, 3);
    for (const lab of sampleLabs) {
      const dashboardResult = await pool.query(`
        SELECT current_power_watts, energy_today_kwh, active_devices
        FROM ${DB_SCHEMA}.lab_dashboard
        WHERE lab_id = $1
      `, [lab.lab_id]);

      if (dashboardResult.rows.length > 0) {
        const data = dashboardResult.rows[0];
        console.log(`  ${lab.name}: ${data.current_power_watts}W, ${data.energy_today_kwh}kWh, ${data.active_devices} devices`);
      }
    }

    console.log("\nDashboard flow test completed!");
    console.log("Each lab should show different values on the dashboard.");

  } catch (error) {
    console.error("Error testing dashboard flow:", error.message);
  } finally {
    await pool.end();
  }
}

testDashboardFlow();
