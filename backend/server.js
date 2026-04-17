const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const pool = require("./db");
const ZoneAutomationService = require("./services/zoneAutomationService");
require("dotenv").config();

const app = express();
const DB_SCHEMA = (process.env.DB_SCHEMA || "public").replace(/[^a-zA-Z0-9_]/g, "");

// Store previous device states to detect changes
let previousDeviceStates = new Map();

// ESP32 IP Configuration
const ESP32_IP = "http://10.192.37.109";

//for hello5 dashboard
function toBooleanStatus(status) {
  return status === "ON" || status === true || status === "true";
}

function calculateDurationHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / (1000 * 60 * 60);
}

function calculateEnergyKwh(currentAmps, durationHours) {
  return (5 * Number(currentAmps) * Number(durationHours)) / 1000;
}

async function handleEnergyConsumptionChange(deviceId, labId, deviceStatus, current) {
  if (Number(labId) !== 33) {
    return;
  }

  // when ON -> insert a new session row
  if (deviceStatus) {
    // avoid duplicate open rows if device keeps sending ON repeatedly
    const existingOpenSession = await pool.query(
      `SELECT id
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE device_id = $1
         AND lab_id = $2
         AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1`,
      [deviceId, labId]
    );

    if (existingOpenSession.rows.length === 0) {
      await pool.query(
        `INSERT INTO ${DB_SCHEMA}.energy_consumption
         (device_id, lab_id, reading, start_time, created_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [deviceId, labId, current]
      );
    }

    return;
  }

  // when OFF -> close latest open session
  const openSessionResult = await pool.query(
    `SELECT id, start_time, reading
     FROM ${DB_SCHEMA}.energy_consumption
     WHERE device_id = $1
       AND lab_id = $2
       AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    [deviceId, labId]
  );

  if (openSessionResult.rows.length === 0) {
    return;
  }

  const openSession = openSessionResult.rows[0];
  const endTime = new Date();
  const durationHours = calculateDurationHours(openSession.start_time, endTime);
  const readingToUse =
    current !== undefined && current !== null ? Number(current) : Number(openSession.reading || 0);
  const energyKwh = calculateEnergyKwh(readingToUse, durationHours);

  await pool.query(
    `UPDATE ${DB_SCHEMA}.energy_consumption
   SET end_time = $1,
       duration_hours = $2,
       energy_kwh = $3
   WHERE id = $4`,
    [endTime, durationHours, energyKwh, openSession.id]
  );
}

// Function to trigger ESP32
async function triggerESP32(deviceId, state) {
  let endpoint = "";

  try {
    if (state) {
      endpoint = `${ESP32_IP}/on${deviceId}`;
      console.log(`Turning fan ${deviceId} ON`);
    } else {
      endpoint = `${ESP32_IP}/off${deviceId}`;
      console.log(`Turning fan ${deviceId} OFF`);
    }

    const response = await axios.get(endpoint, { timeout: 10000 });

    return {
      sent: true,
      endpoint,
      httpStatus: response.status
    };
  } catch (err) {
    const message = `ESP32 request failed for ${endpoint}: ${err.message}`;
    console.error(message);

    return {
      sent: false,
      endpoint,
      httpStatus: err.response?.status || null,
      reason: err.message
    };
  }
}

// Poll DB
async function pollDatabaseForChanges() {
  try {
    const result = await pool.query(
      `SELECT device_id, lab_id, device_status FROM ${DB_SCHEMA}.devices`
    );

    for (const device of result.rows) {
      const key = `${device.lab_id}_${device.device_id}`;
      const prev = previousDeviceStates.get(key);

      if (prev !== undefined && prev !== device.device_status) {
        await triggerESP32(device.device_id, device.device_status);
      }

      previousDeviceStates.set(key, device.device_status);
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

setInterval(pollDatabaseForChanges, 2000);

// Init states
async function initializeDeviceStates() {
  try {
    const result = await pool.query(
      `SELECT device_id, lab_id, device_status FROM ${DB_SCHEMA}.devices`
    );

    result.rows.forEach(d => {
      const key = `${d.lab_id}_${d.device_id}`;
      previousDeviceStates.set(key, d.device_status);
    });
  } catch (err) {
    console.error(err);
  }
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("KRATOS backend is running");
});

// ================= BASIC APIs =================

app.get("/api/devices/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `SELECT 
         device_id,
         lab_id,
         device_status,
         COALESCE(sensor_reading, 0) AS sensor_reading
       FROM ${DB_SCHEMA}.devices
       WHERE lab_id = $1
       ORDER BY device_id`,
      [labId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/departments", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT department_id, name FROM ${DB_SCHEMA}.departments ORDER BY name`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/labs/:departmentId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lab_id, name FROM ${DB_SCHEMA}.labs
       WHERE department_id=$1 AND is_active=true`,
      [req.params.departmentId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/labs", async (req, res) => {
  try {
    const { name, department_id } = req.body;

    if (!name || !department_id) {
      return res.status(400).json({ message: "name and department_id are required" });
    }

    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.labs (name, department_id, is_active)
       VALUES ($1, $2, true)
       RETURNING lab_id, name, department_id, is_active`,
      [name, department_id]
    );

    const newLab = result.rows[0];

    // Automatically create zones for this new lab
    try {
      await ZoneAutomationService.createZonesForLab(newLab.lab_id);
      console.log(`Automatically created zones for new lab: ${newLab.lab_id}`);
    } catch (zoneError) {
      console.error("Error creating zones for new lab:", zoneError);
      // Don't fail the lab creation if zone creation fails
    }

    res.status(201).json({
      message: "Lab created successfully",
      lab: newLab
    });
  } catch (error) {
    console.error("Error creating lab:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= DASHBOARD APIs =================

app.get("/api/dashboard/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    // Handle test-lab specifically
    if (labId === 'test-lab') {
      return res.json({
        lab_id: 'test-lab',
        lab_name: 'Test Lab (Simulation)',
        current_power_watts: 0,
        energy_today_kwh: 0,
        active_devices: 0,
        last_updated: new Date().toISOString()
      });
    }

    const result = await pool.query(
      `SELECT
         l.lab_id,
         l.name AS lab_name,
         COALESCE(d.current_power_watts, 0) AS current_power_watts,
         COALESCE(d.energy_today_kwh, 0) AS energy_today_kwh,
         COALESCE(d.active_devices, 0) AS active_devices,
         d.last_updated
       FROM ${DB_SCHEMA}.labs l
       LEFT JOIN ${DB_SCHEMA}.lab_dashboard d ON l.lab_id = d.lab_id
       WHERE l.lab_id = $1
       LIMIT 1`,
      [labId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lab not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching dashboard values by lab ID:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const { departmentId, labName } = req.query;

    if (!departmentId || !labName) {
      return res.status(400).json({
        message: "departmentId and labName query params are required",
      });
    }

    const result = await pool.query(
      `SELECT
         l.lab_id,
         l.name AS lab_name,
         COALESCE(d.current_power_watts, 0) AS current_power_watts,
         COALESCE(d.energy_today_kwh, 0) AS energy_today_kwh,
         COALESCE(d.active_devices, 0) AS active_devices,
         d.last_updated
       FROM ${DB_SCHEMA}.labs l
       LEFT JOIN ${DB_SCHEMA}.lab_dashboard d ON l.lab_id = d.lab_id
       WHERE l.department_id = $1
         AND l.name = $2
       LIMIT 1`,
      [departmentId, labName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Lab not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching dashboard values by lab name:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= AUTH =================

app.post("/api/signup", async (req, res) => {
  try {
    const { username, email, department_id, password } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.users
       (username,email,department_id,password_hash)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [username, email, department_id, hash]
    );

    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ message: "Signup error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { identifier, department_id, password } = req.body;

    const result = await pool.query(
      `SELECT * FROM ${DB_SCHEMA}.users
       WHERE (username=$1 OR email=$1)
       AND department_id=$2`,
      [identifier, department_id]
    );

    if (!result.rows.length) return res.status(401).json({ message: "Invalid" });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) return res.status(401).json({ message: "Invalid" });

    res.json(user);
  } catch {
    res.status(500).json({ message: "Login error" });
  }
});

// ================= DEVICES =================

app.post("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO ${DB_SCHEMA}.devices (device_id, device_status)
       VALUES ($1,false)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.body.device_id]
    );

    if (!result.rows.length)
      return res.status(409).json({ message: "Exists" });

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating device" });
  }
});



// ================= CAMERA & DETECTION APIs =================

let detectionProcess = null;
let currentDetectionStatus = {};

app.get("/api/cameras", async (req, res) => {
  try {
    const { exec } = require('child_process');
    const isWindows = os.platform() === 'win32';
    const venvPython = isWindows
      ? path.join(__dirname, '../occupancy_detection/venv/Scripts/python.exe')
      : path.join(__dirname, '../occupancy_detection/venv/bin/python');

    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3');
    const scriptPath = path.join(__dirname, '../occupancy_detection/list_cameras.py');

    exec(`"${pythonExecutable}" "${scriptPath}"`, { cwd: path.join(__dirname, '../occupancy_detection') }, (error, stdout, stderr) => {
      if (error) {
        console.error("Error running list_cameras.py:", error, stderr);
        return res.status(500).json({ message: "Failed to read cameras", error: error.message });
      }
      try {
        const result = JSON.parse(stdout);
        res.json(result);
      } catch (parseError) {
        console.error("Error parsing camera list JSON:", parseError);
        res.status(500).json({ message: "Invalid response from camera process" });
      }
    });
  } catch (error) {
    console.error("Error listing cameras:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/zones", async (req, res) => {
  try {
    const { labId } = req.query;

    if (!labId) {
      return res.status(400).json({ message: "labId is required" });
    }

    if (labId === 'test-lab') {
      return res.json({});
    }

    // Get all zones for this lab with their configuration boxes
    const result = await pool.query(
      `SELECT device_id, zone_name, zone_coordinates 
       FROM ${DB_SCHEMA}.zones 
       WHERE lab_id = $1 
       ORDER BY zone_name, device_id`,
      [labId]
    );

    if (result.rows.length > 0) {
      // Convert database result to zone format
      const zones = {};
      result.rows.forEach(row => {
        const zoneName = row.zone_name || 'configBox1'; // Default if null
        const zoneKey = `${zoneName}_${row.device_id}`;
        // zone_coordinates is already an array, no need to parse
        zones[zoneKey] = row.zone_coordinates;
      });
      res.json(zones);
    } else {
      res.json({});
    }
  } catch (error) {
    console.error("Error reading zones:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/zones", async (req, res) => {
  try {
    const { labId, zones } = req.body;

    if (!labId) {
      return res.status(400).json({ message: "labId is required" });
    }

    if (labId === 'test-lab') {
      return res.json({ message: "Test lab zones are not persisted", labId, zonesCount: 0, zones: [] });
    }

    // Clear existing zones for this lab
    await pool.query(
      `DELETE FROM ${DB_SCHEMA}.zones WHERE lab_id = $1`,
      [labId]
    );

    // Insert new zones with unique configuration boxes
    for (const [zoneKey, coordinates] of Object.entries(zones)) {
      // Parse zoneKey to extract zone_name and device_id
      // Format: "configBox1_device1" or similar
      const parts = zoneKey.split('_');
      const device_id = parts[parts.length - 1]; // Last part is device_id
      const zone_name = parts.slice(0, -1).join('_'); // Everything except last part

      await pool.query(
        `INSERT INTO ${DB_SCHEMA}.zones (lab_id, device_id, zone_name, zone_coordinates)
         VALUES ($1, $2, $3, $4)`,
        [labId, device_id, zone_name, JSON.stringify(coordinates)]
      );
    }

    // Also save to file for main.py compatibility
    const zonesPath = path.join(__dirname, '../occupancy_detection/zones.json');
    fs.writeFileSync(zonesPath, JSON.stringify(zones, null, 2));

    res.json({
      message: "Zones saved successfully",
      labId: labId,
      zonesCount: Object.keys(zones).length,
      zones: Object.keys(zones)
    });
  } catch (error) {
    console.error("Error saving zones:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/start-detection", async (req, res) => {
  try {
    const { labId, zones } = req.body;

    if (detectionProcess) {
      return res.status(400).json({ message: "Detection is already running" });
    }

    console.log(`Starting detection for lab ${labId} with zones:`, zones);

    // Start the main.py detection script supporting cross-platform OS paths
    const isWindows = os.platform() === 'win32';
    const venvPython = isWindows
      ? path.join(__dirname, '../occupancy_detection/venv/Scripts/python.exe')
      : path.join(__dirname, '../occupancy_detection/venv/bin/python');

    // Fallback to global python if venv doesn't exist
    const pythonExecutable = fs.existsSync(venvPython) ? venvPython : (isWindows ? 'python' : 'python3');

    detectionProcess = spawn(pythonExecutable, ['main.py', labId.toString()], {
      cwd: path.join(__dirname, '../occupancy_detection'),
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    detectionProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Detection output:', data.toString().trim());

      // Parse detection status from output
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.includes('Updated')) {
          // Parse status updates like "Updated configBox1_1 to ON"
          const match = line.match(/Updated (.+) to (ON|OFF)/);
          if (match) {
            const zoneKey = match[1];
            const status = match[2] === 'ON';
            // Set status for this specific zoneKey
            currentDetectionStatus[zoneKey] = status;
          }
        }
      });
    });

    detectionProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('Detection error:', data.toString().trim());
    });

    detectionProcess.on('close', (code) => {
      console.log(`Detection process exited with code ${code}`);
      detectionProcess = null;
      currentDetectionStatus = {};
    });

    detectionProcess.on('error', (error) => {
      console.error('Failed to start detection process:', error);
      detectionProcess = null;
    });

    res.json({
      message: "Detection started successfully",
      labId: labId,
      zones: Object.keys(zones)
    });

  } catch (error) {
    console.error("Error starting detection:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/stop-detection", async (req, res) => {
  try {
    if (detectionProcess) {
      detectionProcess.kill('SIGTERM');
      detectionProcess = null;
      currentDetectionStatus = {};
      res.json({ message: "Detection stopped successfully" });
    } else {
      res.json({ message: "Detection is not running" });
    }
  } catch (error) {
    console.error("Error stopping detection:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/detection-status", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT device_id, device_status 
       FROM ${DB_SCHEMA}.devices 
       WHERE lab_id = $1`,
      [req.query.labId]
    );

    const status = {};

    result.rows.forEach(row => {
      const key = `configBox1_${row.device_id}`;
      status[key] = row.device_status;
    });

    res.json(status);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ================= ZONE AUTOMATION APIs =================

app.post("/api/labs/:labId/configure-zones", async (req, res) => {
  try {
    const { labId } = req.params;

    console.log(`Starting zone configuration for lab ${labId}`);

    // Use the zone automation service to create zones
    const result = await ZoneAutomationService.createZonesForLab(labId);

    res.json({
      message: "Zone configuration completed successfully",
      labId: labId,
      zonesCreated: result.zonesCreated,
      totalDevices: result.totalDevices
    });

  } catch (error) {
    console.error("Error in zone configuration:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/labs/:labId/bulk-assign-devices", async (req, res) => {
  try {
    const { labId } = req.params;
    const { deviceIds } = req.body;

    // Bulk assign devices to zones
    const result = await ZoneAutomationService.bulkAssignDevices(labId, deviceIds);

    res.json({
      message: "Devices assigned successfully",
      labId: labId,
      totalDevices: result.totalDevices,
      zonesCreated: result.zonesCreated,
      results: result.results
    });

  } catch (error) {
    console.error("Error bulk assigning devices to lab:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/setup-zones-for-all-labs", async (req, res) => {
  try {
    const result = await ZoneAutomationService.createZonesForAllExistingLabs();

    res.json({
      message: "Zone setup completed for all labs",
      totalLabs: result.totalLabs,
      results: result.results
    });

  } catch (error) {
    console.error("Error setting up zones for all labs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/labs/:labId/zone-integrity", async (req, res) => {
  try {
    const { labId } = req.params;
    const result = await ZoneAutomationService.validateZoneIntegrity(labId);

    res.json(result);

  } catch (error) {
    console.error("Error validating zone integrity:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ENERGY =================

app.get("/api/energy-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `SELECT
         DATE(created_at) AS date,
         COALESCE(SUM(energy_kwh), 0) AS total
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`,
      [labId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching energy consumption:", error);
    res.status(500).json({
      message: "Error fetching energy consumption",
      error: error.message
    });
  }
});
// ================= DEVICE UPDATE =================

app.post("/api/esp32/control", async (req, res) => {
  try {
    const { device_id, status, lab_id } = req.body;
    const resolvedDeviceId = String(device_id ?? "").trim();
    const resolvedLabId = lab_id === undefined || lab_id === null
      ? null
      : String(lab_id).trim();

    if (resolvedDeviceId.length === 0 || status === undefined) {
      return res.status(400).json({
        message: "device_id and status required"
      });
    }

    if (!/^\d+$/.test(resolvedDeviceId) || Number.parseInt(resolvedDeviceId, 10) <= 0) {
      return res.status(400).json({
        message: "device_id must be a positive integer"
      });
    }

    const normalizedDeviceId = String(Number.parseInt(resolvedDeviceId, 10));
    const deviceStatus = status === "ON" || status === true;
    console.log("Received ESP32 control request:", {
      device_id: normalizedDeviceId,
      lab_id: resolvedLabId,
      status: deviceStatus ? "ON" : "OFF"
    });
    const espResult = await triggerESP32(normalizedDeviceId, deviceStatus);

    if (!espResult.sent) {
      return res.status(503).json({
        message: "ESP32 command was not sent",
        device_id: normalizedDeviceId,
        lab_id: resolvedLabId,
        status: deviceStatus,
        reason: espResult.reason || "Unknown"
      });
    }

    res.status(200).json({
      message: "ESP32 command sent",
      device_id: normalizedDeviceId,
      lab_id: resolvedLabId,
      status: deviceStatus,
      esp32_endpoint: espResult.endpoint,
      esp32_http_status: espResult.httpStatus
    });
  } catch (error) {
    console.error("Error sending ESP32 command:", error);
    res.status(502).json({
      message: "Failed to send ESP32 command",
      error: error.message
    });
  }
});

app.post("/api/devices/update", async (req, res) => {
  try {
    const { device_id, lab_id, status, current } = req.body;

    if (!device_id || !lab_id || status === undefined || current === undefined) {
      return res.status(400).json({
        message: "device_id, lab_id, status, current required"
      });
    }

    const normalizedDeviceId = Number(device_id);
    const normalizedLabId = Number(lab_id);
    const normalizedCurrent = Number(current);
    const deviceStatus = toBooleanStatus(status);

    console.log("Received device update:", {
      device_id: normalizedDeviceId,
      lab_id: normalizedLabId,
      status: deviceStatus ? "ON" : "OFF",
      current: normalizedCurrent
    });

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const previousDeviceResult = await client.query(
        `SELECT device_status
         FROM ${DB_SCHEMA}.devices
         WHERE device_id = $1 AND lab_id = $2
         LIMIT 1`,
        [normalizedDeviceId, normalizedLabId]
      );

      if (previousDeviceResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Device not found for this lab"
        });
      }

      const previousStatus = previousDeviceResult.rows[0].device_status;

      await client.query(
        `UPDATE ${DB_SCHEMA}.devices
         SET device_status = $1,
             sensor_reading = $2
         WHERE device_id = $3 AND lab_id = $4`,
        [deviceStatus, normalizedCurrent, normalizedDeviceId, normalizedLabId]
      );

      // only log session changes when state actually changes
      if (previousStatus !== deviceStatus && normalizedLabId === 33) {
        if (deviceStatus) {
          const existingOpenSession = await client.query(
            `SELECT id
             FROM ${DB_SCHEMA}.energy_consumption
             WHERE device_id = $1
               AND lab_id = $2
               AND end_time IS NULL
             ORDER BY start_time DESC
             LIMIT 1`,
            [normalizedDeviceId, normalizedLabId]
          );

          if (existingOpenSession.rowCount === 0) {
            await client.query(
              `INSERT INTO ${DB_SCHEMA}.energy_consumption
               (device_id, lab_id, reading, start_time, created_at)
               VALUES ($1, $2, $3, NOW(), NOW())`,
              [normalizedDeviceId, normalizedLabId, normalizedCurrent]
            );
          }
        } else {
          const openSessionResult = await client.query(
            `SELECT id, start_time, reading
             FROM ${DB_SCHEMA}.energy_consumption
             WHERE device_id = $1
               AND lab_id = $2
               AND end_time IS NULL
             ORDER BY start_time DESC
             LIMIT 1`,
            [normalizedDeviceId, normalizedLabId]
          );

          if (openSessionResult.rowCount > 0) {
            const openSession = openSessionResult.rows[0];
            const endTime = new Date();
            const durationHours = calculateDurationHours(openSession.start_time, endTime);
            const readingToUse = normalizedCurrent ?? Number(openSession.reading || 0);
            const energyKwh = calculateEnergyKwh(readingToUse, durationHours);

            await client.query(
              `UPDATE ${DB_SCHEMA}.energy_consumption
              SET end_time = $1,
              duration_hours = $2,
              energy_kwh = $3
              WHERE id = $4`,
              [endTime, durationHours, energyKwh, openSession.id]
            );
          }
        }
      }

      // optional: update lab_dashboard live values for Hello5
      if (normalizedLabId === 33) {
        const dashboardStats = await client.query(
          `SELECT
             COALESCE(SUM(CASE WHEN device_status = true THEN 5 * COALESCE(sensor_reading, 0) ELSE 0 END), 0) AS current_power_watts,
             COUNT(*) FILTER (WHERE device_status = true) AS active_devices
           FROM ${DB_SCHEMA}.devices
           WHERE lab_id = $1`,
          [normalizedLabId]
        );

        const todayEnergy = await client.query(
          `SELECT COALESCE(SUM(energy_kwh), 0) AS energy_today_kwh
           FROM ${DB_SCHEMA}.energy_consumption
           WHERE lab_id = $1
             AND DATE(created_at) = CURRENT_DATE`,
          [normalizedLabId]
        );

        await client.query(
          `INSERT INTO ${DB_SCHEMA}.lab_dashboard
           (lab_id, current_power_watts, energy_today_kwh, active_devices, last_updated)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (lab_id)
           DO UPDATE SET
             current_power_watts = EXCLUDED.current_power_watts,
             energy_today_kwh = EXCLUDED.energy_today_kwh,
             active_devices = EXCLUDED.active_devices,
             last_updated = NOW()`,
          [
            normalizedLabId,
            Number(dashboardStats.rows[0].current_power_watts || 0),
            Number(todayEnergy.rows[0].energy_today_kwh || 0),
            Number(dashboardStats.rows[0].active_devices || 0)
          ]
        );
      }

      await client.query("COMMIT");
      res.status(200).json({ message: "Updated successfully" });
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating device:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ================= ANALYTICS =================

app.get("/api/analytics-summary/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const [dashboardResult, sessionsResult, peakResult, yesterdayResult] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(current_power_watts, 0) AS current_power_watts,
           COALESCE(energy_today_kwh, 0) AS energy_today_kwh,
           COALESCE(active_devices, 0) AS active_devices
         FROM ${DB_SCHEMA}.lab_dashboard
         WHERE lab_id = $1
         LIMIT 1`,
        [labId]
      ),
      pool.query(
        `SELECT COUNT(*) AS sessions_today
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND DATE(created_at) = CURRENT_DATE`,
        [labId]
      ),
      pool.query(
        `SELECT COALESCE(MAX(5 * reading), 0) AS peak_power
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND DATE(created_at) = CURRENT_DATE`,
        [labId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(energy_kwh), 0) AS yesterday_energy
         FROM ${DB_SCHEMA}.energy_consumption
         WHERE lab_id = $1
           AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`,
        [labId]
      )
    ]);

    const dashboard = dashboardResult.rows[0] || {
      current_power_watts: 0,
      energy_today_kwh: 0,
      active_devices: 0
    };

    const energyToday = Number(dashboard.energy_today_kwh || 0);
    const yesterdayEnergy = Number(yesterdayResult.rows[0]?.yesterday_energy || 0);
    const change =
      yesterdayEnergy === 0
        ? (energyToday === 0 ? 0 : 100)
        : (((energyToday - yesterdayEnergy) / yesterdayEnergy) * 100);

    res.json([
      {
        metric: "Total Energy Today",
        value: `${energyToday.toFixed(3)} kWh`,
        change: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`
      },
      {
        metric: "Active Devices",
        value: String(dashboard.active_devices || 0),
        change: "Live"
      },
      {
        metric: "Peak Power",
        value: `${Number(peakResult.rows[0]?.peak_power || 0).toFixed(2)} W`,
        change: "Today"
      },
      {
        metric: "Sessions Today",
        value: String(sessionsResult.rows[0]?.sessions_today || 0),
        change: "Today"
      }
    ]);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/weekly-energy-cost/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const unitCost = 8; // change if needed

    const result = await pool.query(
      `WITH days AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '6 days',
           CURRENT_DATE,
           INTERVAL '1 day'
         )::date AS day
       )
       SELECT
         d.day,
         COALESCE(SUM(ec.energy_kwh), 0) AS energy
       FROM days d
       LEFT JOIN ${DB_SCHEMA}.energy_consumption ec
         ON ec.lab_id = $1
        AND DATE(ec.created_at) = d.day
       GROUP BY d.day
       ORDER BY d.day`,
      [labId]
    );

    const formatted = result.rows.map((row) => {
      const energy = Number(row.energy || 0);
      return {
        day: new Date(row.day).toLocaleDateString("en-US", { weekday: "short" }),
        energy: energy.toFixed(3),
        cost: (energy * unitCost).toFixed(2)
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching weekly energy cost:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/six-month-consumption/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month'
         )::date AS month_start
       )
       SELECT
         m.month_start,
         COALESCE(SUM(ec.energy_kwh), 0) AS consumption
       FROM months m
       LEFT JOIN ${DB_SCHEMA}.energy_consumption ec
         ON ec.lab_id = $1
        AND date_trunc('month', ec.created_at) = m.month_start
       GROUP BY m.month_start
       ORDER BY m.month_start`,
      [labId]
    );

    res.json(
      result.rows.map((row) => ({
        month: new Date(row.month_start).toLocaleDateString("en-US", { month: "short" }),
        consumption: Number(row.consumption || 0).toFixed(3)
      }))
    );
  } catch (error) {
    console.error("Error fetching six month consumption:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/top-energy-consumers/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(energy_kwh), 0) AS total_energy
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1`,
      [labId]
    );

    const totalEnergy = Number(totalResult.rows[0]?.total_energy || 0);

    const result = await pool.query(
      `SELECT
         device_id,
         COALESCE(SUM(energy_kwh), 0) AS consumption
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1
       GROUP BY device_id
       ORDER BY consumption DESC
       LIMIT 5`,
      [labId]
    );

    res.json(
      result.rows.map((row) => {
        const consumption = Number(row.consumption || 0);
        return {
          device: `Device ${row.device_id}`,
          consumption: `${consumption.toFixed(3)} kWh`,
          percentage: totalEnergy === 0 ? 0 : Number(((consumption / totalEnergy) * 100).toFixed(1))
        };
      })
    );
  } catch (error) {
    console.error("Error fetching top energy consumers:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/peak-usage-hours/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `SELECT
         EXTRACT(HOUR FROM start_time)::int AS hour_num,
         COALESCE(SUM(5 * reading), 0) AS usage
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1
         AND start_time >= NOW() - INTERVAL '30 days'
       GROUP BY hour_num
       ORDER BY hour_num`,
      [labId]
    );

    res.json(
      result.rows.map((row) => ({
        hour: `${String(row.hour_num).padStart(2, "0")}:00`,
        usage: Number(row.usage || 0)
      }))
    );
  } catch (error) {
    console.error("Error fetching peak usage hours:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/energy-comparisons/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    const unitCost = 8;

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN energy_kwh END), 0) AS today,
         COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE - INTERVAL '1 day' THEN energy_kwh END), 0) AS yesterday,
         COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '6 days' AND created_at < CURRENT_DATE + INTERVAL '1 day' THEN energy_kwh END), 0) AS last_week,
         COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '13 days' AND created_at < CURRENT_DATE - INTERVAL '6 days' THEN energy_kwh END), 0) AS prev_week,
         COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '29 days' AND created_at < CURRENT_DATE + INTERVAL '1 day' THEN energy_kwh END), 0) AS last_month,
         COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '59 days' AND created_at < CURRENT_DATE - INTERVAL '29 days' THEN energy_kwh END), 0) AS prev_month
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1`,
      [labId]
    );

    const row = result.rows[0];

    const calcChange = (current, previous) => {
      const c = Number(current || 0);
      const p = Number(previous || 0);
      if (p === 0) return c === 0 ? 0 : 100;
      return Number((((c - p) / p) * 100).toFixed(1));
    };

    const today = Number(row.today || 0);
    const yesterday = Number(row.yesterday || 0);
    const lastWeek = Number(row.last_week || 0);
    const prevWeek = Number(row.prev_week || 0);
    const lastMonth = Number(row.last_month || 0);
    const prevMonth = Number(row.prev_month || 0);

    res.json([
      {
        period: "Today",
        consumption: today,
        cost: Number((today * unitCost).toFixed(2)),
        comparison: calcChange(today, yesterday)
      },
      {
        period: "Yesterday",
        consumption: yesterday,
        cost: Number((yesterday * unitCost).toFixed(2)),
        comparison: 0
      },
      {
        period: "Last Week",
        consumption: lastWeek,
        cost: Number((lastWeek * unitCost).toFixed(2)),
        comparison: calcChange(lastWeek, prevWeek)
      },
      {
        period: "Last Month",
        consumption: lastMonth,
        cost: Number((lastMonth * unitCost).toFixed(2)),
        comparison: calcChange(lastMonth, prevMonth)
      }
    ]);
  } catch (error) {
    console.error("Error fetching energy comparisons:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/power-trend/:labId", async (req, res) => {
  try {
    const { labId } = req.params;

    const result = await pool.query(
      `SELECT
         created_at,
         ROUND((5 * reading)::numeric, 2) AS power
       FROM ${DB_SCHEMA}.energy_consumption
       WHERE lab_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [labId]
    );

    res.json(
      result.rows
        .reverse()
        .map((row) => ({
          minute: new Date(row.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }),
          power: Number(row.power || 0)
        }))
    );
  } catch (error) {
    console.error("Error fetching power trend:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ================= START =================

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on ${PORT}`);
  await initializeDeviceStates();
});