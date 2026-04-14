const pool = require('./db');

async function monitorDeviceChanges() {
  console.log('=== MONITORING DEVICE CHANGES FOR LAB 33 ===\n');
  
  try {
    // Check current state
    const beforeResult = await pool.query(`
      SELECT device_id, lab_id, device_status, sensor_reading
      FROM kratos.devices 
      WHERE lab_id::bigint = 33
      ORDER BY device_id
    `);
    
    console.log('BEFORE - Lab 33 devices:');
    beforeResult.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id} - Status: ${row.device_status}, Reading: ${row.sensor_reading}`);
    });
    
    // Check current lab_auditing records
    const auditBefore = await pool.query(`
      SELECT COUNT(*) as count FROM kratos.lab_auditing 
      WHERE lab_id::bigint = 33 AND recorded_at::date = CURRENT_DATE
    `);
    
    console.log(`\nCurrent lab_auditing records for Lab 33 today: ${auditBefore.rows[0].count}`);
    
    // Check current energy records
    const energyBefore = await pool.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(energy_wh), 0) as total_wh
      FROM kratos.energy_consumption 
      WHERE lab_id::bigint = 33 AND created_at::date = CURRENT_DATE
    `);
    
    console.log(`Current energy records for Lab 33 today: ${energyBefore.rows[0].count} records, ${energyBefore.rows[0].total_wh}Wh total`);
    
    console.log('\n' + '='.repeat(50));
    console.log('NOW TOGGLE YOUR LAB 33 DEVICE ON/OFF...');
    console.log('After you toggle, press Ctrl+C to stop monitoring');
    console.log('Or wait 30 seconds for auto-check...');
    
    // Wait for user to toggle device
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check after toggle
    const afterResult = await pool.query(`
      SELECT device_id, lab_id, device_status, sensor_reading
      FROM kratos.devices 
      WHERE lab_id::bigint = 33
      ORDER BY device_id
    `);
    
    console.log('\nAFTER - Lab 33 devices:');
    afterResult.rows.forEach((row, index) => {
      console.log(`${index + 1}: Device ${row.device_id} - Status: ${row.device_status}, Reading: ${row.sensor_reading}`);
    });
    
    // Check lab_auditing changes
    const auditAfter = await pool.query(`
      SELECT COUNT(*) as count FROM kratos.lab_auditing 
      WHERE lab_id::bigint = 33 AND recorded_at::date = CURRENT_DATE
    `);
    
    console.log(`\nlab_auditing records for Lab 33 today: ${auditAfter.rows[0].count} (${auditAfter.rows[0].count - auditBefore.rows[0].count} new)`);
    
    // Check energy changes
    const energyAfter = await pool.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(energy_wh), 0) as total_wh
      FROM kratos.energy_consumption 
      WHERE lab_id::bigint = 33 AND created_at::date = CURRENT_DATE
    `);
    
    console.log(`Energy records for Lab 33 today: ${energyAfter.rows[0].count} records, ${energyAfter.rows[0].total_wh}Wh total (${energyAfter.rows[0].total_wh - energyBefore.rows[0].total_wh}Wh new)`);
    
    // Show recent records if any
    if (auditAfter.rows[0].count > auditBefore.rows[0].count) {
      const recentAudit = await pool.query(`
        SELECT device_id, status, recorded_at
        FROM kratos.lab_auditing 
        WHERE lab_id::bigint = 33 AND recorded_at::date = CURRENT_DATE
        ORDER BY recorded_at DESC
        LIMIT 3
      `);
      
      console.log('\nRecent lab_auditing records:');
      recentAudit.rows.forEach((row, index) => {
        console.log(`${index + 1}: Device ${row.device_id}, Status ${row.status}, Time ${row.recorded_at}`);
      });
    }
    
    if (energyAfter.rows[0].count > energyBefore.rows[0].count) {
      const recentEnergy = await pool.query(`
        SELECT device_id, energy_wh, created_at
        FROM kratos.energy_consumption 
        WHERE lab_id::bigint = 33 AND created_at::date = CURRENT_DATE
        ORDER BY created_at DESC
        LIMIT 3
      `);
      
      console.log('\nRecent energy records:');
      recentEnergy.rows.forEach((row, index) => {
        console.log(`${index + 1}: Device ${row.device_id}, ${row.energy_wh}Wh, Time ${row.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

monitorDeviceChanges();
