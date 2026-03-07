const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  const departments = await pool.query(
    `SELECT department_id, name::text AS name
     FROM kratos.departments
     ORDER BY department_id`
  );
  console.log("Departments:");
  console.table(departments.rows);

  const labs = await pool.query(
    `SELECT l.lab_id, l.name::text AS lab_name, l.department_id, d.name::text AS department_name, l.is_active
     FROM kratos.labs l
     JOIN kratos.departments d ON d.department_id = l.department_id
     ORDER BY d.department_id, l.lab_id`
  );
  console.log("Labs:");
  console.table(labs.rows);
}

main()
  .catch((err) => {
    console.error("Listing failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
