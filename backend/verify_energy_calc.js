const pool = require('./db');

async function verifyEnergyCalc() {
  console.log('=== VERIFYING ENERGY CALCULATION ===\n');
  
  try {
    const result = await pool.query(`
      SELECT device_id, lab_id, reading, start_time, end_time, duration_hours, energy_wh
      FROM kratos.energy_consumption 
      WHERE lab_id = 33 AND created_at::date = CURRENT_DATE
    `);
    
    console.log('Lab 33 energy record:');
    result.rows.forEach((row, index) => {
      console.log(`Device ${row.device_id}:`);
      console.log(`- Reading: ${row.reading}W`);
      console.log(`- Duration: ${row.duration_hours}h`);
      console.log(`- Energy: ${row.energy_wh}Wh`);
      console.log(`- Expected: ${row.reading * row.duration_hours}Wh`);
      console.log(`- In kWh: ${row.energy_wh / 1000}kWh`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifyEnergyCalc();
