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
  const tables = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'kratos'
     ORDER BY table_name`
  );

  for (const { table_name } of tables.rows) {
    const cols = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'kratos' AND table_name = $1
       ORDER BY ordinal_position`,
      [table_name]
    );

    console.log(`\n[${table_name}]`);
    for (const c of cols.rows) {
      console.log(`- ${c.column_name}: ${c.data_type}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Schema inspection failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
