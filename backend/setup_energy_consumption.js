const pool = require("./db");
require("dotenv").config();

async function setupEnergyConsumption() {
  try {
    console.log(" Setting up energy consumption table...");

    const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

    // Drop and recreate energy_consumption table
    await pool.query(`DROP TABLE IF EXISTS ${DB_SCHEMA}.energy_consumption CASCADE`);

    await pool.query(`
      CREATE TABLE ${DB_SCHEMA}.energy_consumption (
        consumption_id SERIAL PRIMARY KEY,
        lab_id INTEGER REFERENCES ${DB_SCHEMA}.labs(lab_id),
        date DATE NOT NULL,
        hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
        energy_kwh DECIMAL(8,4) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(lab_id, date, hour)
      )
    `);
    console.log(" Energy consumption table created");

    // Get all labs
    const labs = await pool.query(`
      SELECT lab_id, name 
      FROM ${DB_SCHEMA}.labs 
      ORDER BY lab_id
    `);

    console.log(`\n Generating energy consumption data for ${labs.rows.length} labs...`);

    // Generate sample data for the last 7 days
    const today = new Date();
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const date = new Date(today);
      date.setDate(date.getDate() - dayOffset);
      const dateStr = date.toISOString().split('T')[0];

      for (const lab of labs.rows) {
        // Generate realistic hourly consumption based on lab type
        let baseConsumption = 0.5; // Base consumption in kWh

        // Different consumption patterns for different labs
        if (lab.name.includes('Programming') || lab.name.includes('Hardware')) {
          baseConsumption = 1.2; // Higher consumption for computer labs
        } else if (lab.name.includes('PG') || lab.name.includes('GRD')) {
          baseConsumption = 0.8; // Medium consumption for research labs
        } else if (lab.name.includes('AIR') || lab.name.includes('3AI')) {
          baseConsumption = 2.0; // High consumption for specialized labs
        }

        // Generate hourly data (higher during working hours 9AM-6PM)
        for (let hour = 0; hour <= 23; hour++) {
          let hourMultiplier = 0.3; // Base consumption for non-working hours

          if (hour >= 9 && hour <= 18) {
            hourMultiplier = 1.0 + Math.random() * 0.5; // Working hours with variation
          } else if (hour >= 19 && hour <= 22) {
            hourMultiplier = 0.6; // Evening usage
          }

          const energyKwh = baseConsumption * hourMultiplier * (0.8 + Math.random() * 0.4);

          await pool.query(`
            INSERT INTO ${DB_SCHEMA}.energy_consumption (lab_id, date, hour, energy_kwh)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (lab_id, date, hour) DO NOTHING
          `, [lab.lab_id, dateStr, hour, energyKwh.toFixed(4)]);
        }
      }
    }

    console.log(" Energy consumption data generated");

    // Verify data for one lab
    const sampleData = await pool.query(`
      SELECT date, hour, energy_kwh
      FROM ${DB_SCHEMA}.energy_consumption
      WHERE lab_id = 1 AND date = CURRENT_DATE - INTERVAL '1 day'
      ORDER BY hour
      LIMIT 8
    `);

    console.log("\n Sample energy data for Lab 1 (yesterday):");
    sampleData.rows.forEach(row => {
      console.log(`  Hour ${row.hour}: ${row.energy_kwh} kWh`);
    });

    // Get daily totals for dashboard
    const dailyTotals = await pool.query(`
      SELECT 
        lab_id,
        date,
        SUM(energy_kwh) as daily_total
      FROM ${DB_SCHEMA}.energy_consumption
      WHERE date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY lab_id, date
      ORDER BY lab_id, date
    `);

    console.log(`\n Generated ${dailyTotals.rows.length} daily consumption records`);

    console.log("\n Energy consumption setup completed!");

  } catch (error) {
    console.error(" Setup failed:", error.message);
  } finally {
    await pool.end();
  }
}

setupEnergyConsumption();
