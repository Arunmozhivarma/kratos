const pool = require('./db');

async function createTestEnergy() {
  console.log('=== CREATING TEST ENERGY RECORD ===\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create a test energy record for lab 33
    await client.query(`
      INSERT INTO kratos.energy_consumption (
        device_id, lab_id, reading, start_time, end_time, 
        duration_hours, energy_wh, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      1,           // device_id
      33,          // lab_id  
      2.5,         // reading
      new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      new Date(),  // now
      2.0,         // 2 hours
      60.0,        // 60Wh energy
    ]);
    
    console.log('Created test energy record:');
    console.log('- Device 1, Lab 33');
    console.log('- 2.5W reading for 2 hours = 60Wh');
    console.log('- Should show as 0.060 kWh in dashboard');
    
    await client.query('COMMIT');
    
    // Verify the record
    const result = await client.query(`
      SELECT device_id, lab_id, energy_wh, created_at::date as date
      FROM kratos.energy_consumption 
      WHERE lab_id = 33 AND created_at::date = CURRENT_DATE
    `);
    
    console.log(`\nEnergy records for Lab 33 today: ${result.rows.length}`);
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id}, Lab ${row.lab_id}, ${row.energy_wh}Wh`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestEnergy();
