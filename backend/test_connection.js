const pool = require("./db");

async function testConnection() {
  try {
    console.log("Testing database connection...");
    
    // Test basic connection
    const result = await pool.query("SELECT NOW()");
    console.log(" Connection successful:", result.rows[0]);
    
    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log("\n Tables in database:");
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Test departments table
    try {
      const deptResult = await pool.query("SELECT COUNT(*) FROM departments");
      console.log(`\n Departments count: ${deptResult.rows[0].count}`);
    } catch (err) {
      console.log(" Departments table error:", err.message);
    }
    
    // Test labs table
    try {
      const labResult = await pool.query("SELECT COUNT(*) FROM labs");
      console.log(` Labs count: ${labResult.rows[0].count}`);
    } catch (err) {
      console.log(" Labs table error:", err.message);
    }
    
    // Test users table
    try {
      const userResult = await pool.query("SELECT COUNT(*) FROM users");
      console.log(` Users count: ${userResult.rows[0].count}`);
    } catch (err) {
      console.log(" Users table error:", err.message);
    }
    
  } catch (error) {
    console.error(" Connection failed:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
