const pool = require('../db');
const DB_SCHEMA = (process.env.DB_SCHEMA || 'public').replace(/[^a-zA-Z0-9_]/g, '');
const DEVICE_TABLE = `${DB_SCHEMA}.device`;

class ZoneAutomationService {
  /**
   * Create zones for all devices assigned to a lab
   * @param {string|number} labId - The lab ID
   * @returns {Promise<Object>} Result with zones created
   */
  static async createZonesForLab(labId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get all devices for this lab
      const devicesResult = await client.query(
        `SELECT id AS device_id FROM ${DEVICE_TABLE}
         WHERE lab_id = $1`,
        [Number(labId)]
      );
      
      let zonesCreated = 0;
      const defaultZoneName = 'configBox1';
      const defaultCoordinates = [];
      
      for (const device of devicesResult.rows) {
        // Check if zone already exists
        const existingZone = await client.query(
          `SELECT id FROM ${process.env.DB_SCHEMA || 'public'}.zones 
           WHERE lab_id = $1 AND device_id = $2`,
          [labId, device.device_id]
        );
        
        if (existingZone.rows.length === 0) {
          // Create new zone
          await client.query(
            `INSERT INTO ${process.env.DB_SCHEMA || 'public'}.zones 
             (lab_id, device_id, zone_name, zone_coordinates, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [labId, device.device_id, defaultZoneName, JSON.stringify(defaultCoordinates)]
          );
          zonesCreated++;
        }
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        labId,
        zonesCreated,
        totalDevices: devicesResult.rows.length
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating zones for lab:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bulk assign devices to a lab and create zones
   * @param {string|number} labId - The lab ID
   * @param {number[]} deviceIds - Array of device IDs
   * @returns {Promise<Object>} Result with assignment details
   */
  static async bulkAssignDevicesToLab(labId, deviceIds) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = [];
      const defaultZoneName = 'configBox1';
      const defaultCoordinates = [];
      
      for (const deviceId of deviceIds) {
        // Update device lab assignment
        await client.query(
          `UPDATE ${DEVICE_TABLE}
           SET lab_id = $1 
           WHERE id = $2`,
          [Number(labId), deviceId]
        );
        
        // Create zone if it doesn't exist
        const existingZone = await client.query(
          `SELECT id FROM ${process.env.DB_SCHEMA || 'public'}.zones 
           WHERE lab_id = $1 AND device_id = $2`,
          [labId, deviceId]
        );
        
        let zoneCreated = false;
        if (existingZone.rows.length === 0) {
          await client.query(
            `INSERT INTO ${process.env.DB_SCHEMA || 'public'}.zones 
             (lab_id, device_id, zone_name, zone_coordinates, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [labId, deviceId, defaultZoneName, JSON.stringify(defaultCoordinates)]
          );
          zoneCreated = true;
        }
        
        results.push({
          deviceId,
          zoneCreated,
          labAssigned: true
        });
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        labId,
        results,
        totalDevices: deviceIds.length,
        zonesCreated: results.filter(r => r.zoneCreated).length
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error bulk assigning devices to lab:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create zones for all existing labs (one-time setup)
   * @returns {Promise<Object>} Results for all labs
   */
  static async createZonesForAllExistingLabs() {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get all active labs
      const labsResult = await client.query(
        `SELECT lab_id FROM ${process.env.DB_SCHEMA || 'public'}.labs 
         WHERE is_active = true`
      );
      
      const results = [];
      
      for (const lab of labsResult.rows) {
        const result = await this.createZonesForLab(lab.lab_id);
        results.push(result);
      }
      
      await client.query('COMMIT');
      
      return {
        success: true,
        totalLabs: labsResult.rows.length,
        results
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating zones for all labs:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate zone integrity for a lab
   * @param {string|number} labId - The lab ID
   * @returns {Promise<Object>} Validation results
   */
  static async validateZoneIntegrity(labId) {
    try {
      // Get devices for this lab
      const devicesResult = await pool.query(
        `SELECT id AS device_id FROM ${DEVICE_TABLE}
         WHERE lab_id = $1`,
        [Number(labId)]
      );
      
      // Get zones for this lab
      const zonesResult = await pool.query(
        `SELECT device_id FROM ${process.env.DB_SCHEMA || 'public'}.zones 
         WHERE lab_id = $1`,
        [labId]
      );
      
      const deviceIds = new Set(devicesResult.rows.map(d => d.device_id));
      const zoneDeviceIds = new Set(zonesResult.rows.map(z => z.device_id));
      
      // Find missing zones
      const missingZones = [];
      for (const deviceId of deviceIds) {
        if (!zoneDeviceIds.has(deviceId)) {
          missingZones.push(deviceId);
        }
      }
      
      // Find orphaned zones (zones without corresponding devices)
      const orphanedZones = [];
      for (const deviceId of zoneDeviceIds) {
        if (!deviceIds.has(deviceId)) {
          orphanedZones.push(deviceId);
        }
      }
      
      return {
        labId,
        totalDevices: deviceIds.size,
        totalZones: zoneDeviceIds.size,
        missingZones,
        orphanedZones,
        isIntegrityValid: missingZones.length === 0 && orphanedZones.length === 0
      };
      
    } catch (error) {
      console.error('Error validating zone integrity:', error);
      throw error;
    }
  }
}

module.exports = ZoneAutomationService;
