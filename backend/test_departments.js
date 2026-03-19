const pool = require("./db");
require("dotenv").config();

async function testDepartments() {
  try {
    console.log("Testing departments API...");

    const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");
    console.log(`Using schema: ${DB_SCHEMA}`);

    const result = await pool.query(
      `SELECT department_id, name FROM ${DB_SCHEMA}.departments ORDER BY name`
    );

    console.log(`\nFound ${result.rows.length} departments:`);
    result.rows.forEach(dept => {
      console.log(`  ${dept.department_id}: ${dept.name}`);
    });

  } catch (error) {
    console.error("Error fetching departments:", error.message);
  } finally {
    await pool.end();
  }
}

testDepartments();
