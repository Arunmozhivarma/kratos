const pool = require("./db");

async function checkExistingTables() {
  try {
    console.log(" Checking existing database tables...");
    
    // Check all schemas
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name
    `);
    
    console.log("\n Available schemas:");
    schemas.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });
    
    // Check tables in each schema
    for (const schema of schemas.rows) {
      const tables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        ORDER BY table_name
      `, [schema.schema_name]);
      
      if (tables.rows.length > 0) {
        console.log(`\n Tables in '${schema.schema_name}' schema:`);
        tables.rows.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
        
        // Check departments table specifically
        const deptTable = tables.rows.find(row => row.table_name === 'departments');
        if (deptTable) {
          const deptData = await pool.query(`
            SELECT department_id, name 
            FROM ${schema.schema_name}.departments 
            ORDER BY name
          `);
          console.log(`\n Departments in '${schema.schema_name}' schema:`);
          deptData.rows.forEach(dept => {
            console.log(`  ${dept.department_id}: ${dept.name}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error(" Error checking tables:", error.message);
  } finally {
    await pool.end();
  }
}

checkExistingTables();
