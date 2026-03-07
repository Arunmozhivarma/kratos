const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function buildDummyValues(labId) {
  const n = Number(labId);
  return {
    energyKwh: Number((45 + (n % 10) * 3.7).toFixed(2)),
    occupancyAvg: Number((42 + (n % 7) * 6.1).toFixed(2)),
    uptimePct: Number((95 + (n % 5) * 0.8).toFixed(2)),
    temperatureAvg: Number((23 + (n % 6) * 0.5).toFixed(2)),
    anomalies: n % 4,
    auditScore: Number((78 + (n % 9) * 2.1).toFixed(2)),
  };
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS kratos.lab_audit_values (
        audit_id BIGSERIAL PRIMARY KEY,
        lab_id BIGINT NOT NULL REFERENCES kratos.labs(lab_id) ON DELETE CASCADE,
        audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
        energy_kwh NUMERIC(10,2) NOT NULL,
        occupancy_avg_pct NUMERIC(5,2) NOT NULL,
        device_uptime_pct NUMERIC(5,2) NOT NULL,
        temperature_avg_c NUMERIC(5,2) NOT NULL,
        anomalies_count INTEGER NOT NULL DEFAULT 0,
        audit_score NUMERIC(5,2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_lab_audit_per_day UNIQUE (lab_id, audit_date)
      );
    `);

    const deptResult = await client.query(
      `SELECT department_id
       FROM kratos.departments
       WHERE name::text = 'Computer Science & Engineering'
       LIMIT 1`
    );

    if (deptResult.rowCount === 0) {
      throw new Error("Department 'Computer Science & Engineering' not found.");
    }

    const cseDepartmentId = deptResult.rows[0].department_id;

    await client.query(
      `INSERT INTO kratos.labs (department_id, name, is_active)
       VALUES ($1, 'ABC Lab', true)
       ON CONFLICT DO NOTHING`,
      [cseDepartmentId]
    );

    const labsResult = await client.query(
      `SELECT lab_id, name::text AS name
       FROM kratos.labs
       WHERE department_id = $1 AND is_active = true
       ORDER BY lab_id`,
      [cseDepartmentId]
    );

    const upserted = [];

    for (const lab of labsResult.rows) {
      const v = buildDummyValues(lab.lab_id);
      const result = await client.query(
        `INSERT INTO kratos.lab_audit_values (
           lab_id, audit_date, energy_kwh, occupancy_avg_pct, device_uptime_pct,
           temperature_avg_c, anomalies_count, audit_score, updated_at
         ) VALUES (
           $1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, NOW()
         )
         ON CONFLICT (lab_id, audit_date)
         DO UPDATE SET
           energy_kwh = EXCLUDED.energy_kwh,
           occupancy_avg_pct = EXCLUDED.occupancy_avg_pct,
           device_uptime_pct = EXCLUDED.device_uptime_pct,
           temperature_avg_c = EXCLUDED.temperature_avg_c,
           anomalies_count = EXCLUDED.anomalies_count,
           audit_score = EXCLUDED.audit_score,
           updated_at = NOW()
         RETURNING lab_id, audit_date, energy_kwh, occupancy_avg_pct, device_uptime_pct,
                   temperature_avg_c, anomalies_count, audit_score`,
        [
          lab.lab_id,
          v.energyKwh,
          v.occupancyAvg,
          v.uptimePct,
          v.temperatureAvg,
          v.anomalies,
          v.auditScore,
        ]
      );

      upserted.push({
        lab_id: lab.lab_id,
        lab_name: lab.name,
        ...result.rows[0],
      });
    }

    await client.query("COMMIT");

    console.log(
      `Seeded dummy audit data for ${upserted.length} active CSE labs on current date.`
    );
    console.table(
      upserted.map((r) => ({
        lab_id: r.lab_id,
        lab_name: r.lab_name,
        audit_date: r.audit_date,
        energy_kwh: r.energy_kwh,
        occupancy_avg_pct: r.occupancy_avg_pct,
        device_uptime_pct: r.device_uptime_pct,
        temperature_avg_c: r.temperature_avg_c,
        anomalies_count: r.anomalies_count,
        audit_score: r.audit_score,
      }))
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
