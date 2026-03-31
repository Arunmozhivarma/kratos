const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

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

async function checkExistingData() {
  console.log("🔍 Checking existing data in database...\n");

  try {
    // Check departments
    const departments = await pool.query(`SELECT COUNT(*) as count FROM ${DB_SCHEMA}.departments`);
    console.log(`📁 Departments: ${departments.rows[0].count} records`);

    if (departments.rows[0].count > 0) {
      const deptList = await pool.query(`SELECT department_id, name FROM ${DB_SCHEMA}.departments LIMIT 5`);
      console.log("   Sample departments:");
      deptList.rows.forEach(dept => {
        console.log(`   - ${dept.department_id}: ${dept.name}`);
      });
    }

    // Check labs
    const labs = await pool.query(`SELECT COUNT(*) as count FROM ${DB_SCHEMA}.labs`);
    console.log(`\n🏢 Labs: ${labs.rows[0].count} records`);

    if (labs.rows[0].count > 0) {
      const labList = await pool.query(`
        SELECT l.lab_id, l.name, d.name as dept_name 
        FROM ${DB_SCHEMA}.labs l 
        JOIN ${DB_SCHEMA}.departments d ON l.department_id = d.department_id 
        LIMIT 5
      `);
      console.log("   Sample labs:");
      labList.rows.forEach(lab => {
        console.log(`   - ${lab.lab_id}: ${lab.name} (Dept: ${lab.dept_name})`);
      });
    }

    // Check devices
    const devices = await pool.query(`SELECT COUNT(*) as count FROM ${DB_SCHEMA}.devices`);
    console.log(`\n🔧 Devices: ${devices.rows[0].count} records`);

    if (devices.rows[0].count > 0) {
      const deviceList = await pool.query(`
        SELECT device_id, device_status, lab_id 
        FROM ${DB_SCHEMA}.devices 
        WHERE lab_id IS NOT NULL 
        LIMIT 5
      `);
      console.log("   Sample devices with lab assignments:");
      deviceList.rows.forEach(device => {
        console.log(`   - Device ${device.device_id}: Status=${device.device_status}, Lab=${device.lab_id || 'None'}`);
      });

      const unassignedDevices = await pool.query(`
        SELECT COUNT(*) as count FROM ${DB_SCHEMA}.devices WHERE lab_id IS NULL OR lab_id = ''
      `);
      console.log(`   Unassigned devices: ${unassignedDevices.rows[0].count}`);
    }

    // Check zones
    const zones = await pool.query(`SELECT COUNT(*) as count FROM ${DB_SCHEMA}.zones`);
    console.log(`\n📍 Zones: ${zones.rows[0].count} records`);

    if (zones.rows[0].count > 0) {
      const zoneList = await pool.query(`
        SELECT z.id, z.lab_id, z.device_id, z.zone_name, l.name as lab_name
        FROM ${DB_SCHEMA}.zones z
        LEFT JOIN ${DB_SCHEMA}.labs l ON z.lab_id = l.lab_id
        LIMIT 5
      `);
      console.log("   Sample zones:");
      zoneList.rows.forEach(zone => {
        console.log(`   - Zone ${zone.id}: Lab=${zone.lab_id}, Device=${zone.device_id}, Name=${zone.zone_name} (${zone.lab_name || 'Unknown Lab'})`);
      });
    }

    // Check for data integrity issues
    console.log("\n🔍 Data Integrity Check:");

    // Devices without zones
    const devicesWithoutZones = await pool.query(`
      SELECT COUNT(*) as count 
      FROM ${DB_SCHEMA}.devices d 
      LEFT JOIN ${DB_SCHEMA}.zones z ON d.lab_id::BIGINT = z.lab_id AND d.device_id::VARCHAR = z.device_id 
      WHERE d.lab_id IS NOT NULL AND d.lab_id != '' AND z.id IS NULL
    `);
    console.log(`   Devices without zones: ${devicesWithoutZones.rows[0].count}`);

    // Zones without devices
    const zonesWithoutDevices = await pool.query(`
      SELECT COUNT(*) as count 
      FROM ${DB_SCHEMA}.zones z 
      LEFT JOIN ${DB_SCHEMA}.devices d ON z.lab_id = d.lab_id::BIGINT AND z.device_id = d.device_id::VARCHAR 
      WHERE d.device_id IS NULL
    `);
    console.log(`   Zones without devices: ${zonesWithoutDevices.rows[0].count}`);

    // Duplicate zones check
    const duplicateZones = await pool.query(`
      SELECT lab_id, device_id, COUNT(*) as duplicate_count
      FROM ${DB_SCHEMA}.zones 
      GROUP BY lab_id, device_id 
      HAVING COUNT(*) > 1
    `);
    if (duplicateZones.rows.length > 0) {
      console.log("   ⚠️  Duplicate zones found:");
      duplicateZones.rows.forEach(dup => {
        console.log(`      Lab ${dup.lab_id}, Device ${dup.device_id}: ${dup.duplicate_count} entries`);
      });
    } else {
      console.log("   ✅ No duplicate zones found");
    }

  } catch (error) {
    console.error("❌ Error checking existing data:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run data check
checkExistingData()
  .catch((err) => {
    console.error("Data check failed:", err.message);
    process.exitCode = 1;
  });
