const pool = require('./db');

async function checkEnergyRecords() {
  console.log('=== CHECKING ENERGY CONSUMPTION RECORDS ===\n');
  
  try {
    // Check today's energy records
    const todayResult = await pool.query(`
      SELECT device_id, lab_id, energy_wh, start_time, end_time, duration_hours, created_at
      FROM kratos.energy_consumption 
      WHERE created_at::date = CURRENT_DATE
      ORDER BY created_at DESC
    `);
    
    console.log(`Today's energy records: ${todayResult.rows.length}`);
    
    if (todayResult.rows.length > 0) {
      todayResult.rows.forEach((row, index) => {
        console.log(`${index + 1}: Device ${row.device_id}, Lab ${row.lab_id}, ${row.energy_wh}Wh, ${row.duration_hours}h`);
        console.log(`   Start: ${row.start_time}, End: ${row.end_time}`);
      });
    } else {
      console.log('No energy records found for today');
    }
    
    // Check all energy records
    const allResult = await pool.query(`
      SELECT device_id, lab_id, energy_wh, created_at::date as date
      FROM kratos.energy_consumption 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`\nAll energy records (last 10): ${allResult.rows.length}`);
    allResult.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id}, Lab ${row.lab_id}, ${row.energy_wh}Wh, Date: ${row.date}`);
    });
    
    // Check device status changes
    const auditResult = await pool.query(`
      SELECT device_id, lab_id, status, recorded_at
      FROM kratos.lab_auditing 
      WHERE recorded_at::date = CURRENT_DATE
      ORDER BY recorded_at DESC
      LIMIT 5
    `);
    
    console.log(`\nToday's device status changes: ${auditResult.rows.length}`);
    auditResult.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id}, Lab ${row.lab_id}, Status: ${row.status}, Time: ${row.recorded_at}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkEnergyRecords();
