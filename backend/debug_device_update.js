const pool = require('./db');

async function debugDeviceUpdate() {
  console.log('=== DEBUGGING DEVICE UPDATE PROCESS ===\n');
  
  try {
    // Check current device states
    const deviceResult = await pool.query(`
      SELECT device_id, lab_id, device_status, sensor_reading
      FROM kratos.devices 
      WHERE lab_id::bigint IN (33, 43, 50)
      ORDER BY lab_id, device_id
    `);
    
    console.log('Current device states:');
    deviceResult.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id}, Lab ${row.lab_id}, Status: ${row.device_status}, Reading: ${row.sensor_reading}`);
    });
    
    // Check recent lab_auditing records
    const auditResult = await pool.query(`
      SELECT device_id, lab_id, status, reading, start_time, end_time, recorded_at
      FROM kratos.lab_auditing 
      WHERE lab_id::bigint IN (33, 43, 50)
      ORDER BY recorded_at DESC
      LIMIT 10
    `);
    
    console.log(`\nRecent lab_auditing records: ${auditResult.rows.length}`);
    auditResult.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id}, Lab ${row.lab_id}, Status: ${row.status}, Time: ${row.recorded_at}`);
    });
    
    // Check if lab_auditing table exists and has correct structure
    const tableCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'kratos' AND table_name = 'lab_auditing'
      ORDER BY ordinal_position
    `);
    
    console.log('\nlab_auditing table structure:');
    tableCheck.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugDeviceUpdate();
